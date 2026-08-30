import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { Readable } from "node:stream";
import { test } from "node:test";
import vm from "node:vm";
import { gzipSync, brotliCompressSync } from "node:zlib";
import ts from "typescript";

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

function loadBackend(apiUrl) {
  const source = readFileSync(new URL("../src/lib/backend.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, Headers, Response, AbortSignal, fetch, setTimeout,
    process: { env: { API_URL: apiUrl } },
    require(name) {
      if (name === "next/headers") return { cookies: async () => ({ get: () => undefined }) };
      if (name === "@clerk/nextjs/server") {
        return { auth: { protect: async () => ({ getToken: async () => "test-token" }) } };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

function loadFileRoute(routePath, backend) {
  const source = readFileSync(new URL(routePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.equal(name, "@/src/lib/backend");
      return backend;
    },
  });
  return exports;
}

for (const resource of ["atas", "documentos-financeiros"]) {
  test(`${resource}: devolve o link temporário sem baixar o PDF no servidor`, async (t) => {
    let downloads = 0;
    let apiUrl;
    const upstream = http.createServer((req, res) => {
      if (req.url === "/download.pdf") {
        downloads += 1;
        res.end("%PDF");
        return;
      }
      assert.equal(req.url, `/${resource}/1/arquivo`);
      assert.equal(req.headers.authorization, "Bearer test-token");
      res.writeHead(302, { location: `${apiUrl}/download.pdf`, "cache-control": "no-store" });
      res.end();
    });
    t.after(() => { upstream.closeAllConnections(); upstream.close(); });
    apiUrl = await listen(upstream);
    const route = loadFileRoute(`../app/api/${resource}/[id]/arquivo/route.ts`, loadBackend(apiUrl));
    const response = await route.GET(new Request(`http://localhost/api/${resource}/1/arquivo`), { params: Promise.resolve({ id: "1" }) });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), `${apiUrl}/download.pdf`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), "");
    assert.equal(downloads, 0);
  });
}

for (const encoding of ["gzip", "br", "identity"]) {
  test(`JSON completo através do proxy (${encoding})`, async (t) => {
    const data = { condominios: Array.from({ length: 100 }, (_, id) => ({ id, nome: "Condomínio de teste" })) };
    const body = Buffer.from(JSON.stringify(data));
    const encoded = encoding === "gzip" ? gzipSync(body) : encoding === "br" ? brotliCompressSync(body) : body;
    const upstream = http.createServer((req, res) => {
      assert.equal(req.headers.authorization, "Bearer test-token");
      assert.equal(req.headers["x-condominio-slug"], "camila-barbosa");
      res.writeHead(200, { "content-type": "application/json", "content-encoding": encoding, "content-length": encoded.length });
      res.end(encoded);
    });
    t.after(() => { upstream.closeAllConnections(); upstream.close(); });
    const backend = loadBackend(await listen(upstream));
    // Serializa a Response em HTTP para detectar truncamento real no cliente.
    const proxy = http.createServer(async (_req, res) => {
      const response = await backend.chamarApi("/me");
      res.writeHead(response.status, Object.fromEntries(response.headers));
      Readable.fromWeb(response.body).pipe(res);
    });
    t.after(() => { proxy.closeAllConnections(); proxy.close(); });
    const response = await fetch(await listen(proxy));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), data);
  });
}

test("preserva Range e headers de PDF parcial", async (t) => {
  const upstream = http.createServer((req, res) => {
    assert.equal(req.headers.range, "bytes=0-3");
    res.writeHead(206, {
      "content-type": "application/pdf", "content-length": "4",
      "content-range": "bytes 0-3/100", "accept-ranges": "bytes",
      "content-disposition": "inline; filename=test.pdf", "cache-control": "private, max-age=300",
    });
    res.end("%PDF");
  });
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const backend = loadBackend(await listen(upstream));
  const response = await backend.chamarApi("/atas/1/arquivo", { headers: { Range: "bytes=0-3" } });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-length"), "4");
  assert.equal(response.headers.get("content-range"), "bytes 0-3/100");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("content-disposition"), "inline; filename=test.pdf");
  assert.equal(response.headers.get("cache-control"), "private, max-age=300");
  assert.equal(await response.text(), "%PDF");
});
