import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../components/ArvoreArquivos.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
);
const exports = {};
vm.runInNewContext(outputText, { exports, require: createRequire(import.meta.url) });

for (const caminho of ["", "Anteriores/2025"]) {
  test(`balancetes preservam competência decrescente na pasta '${caminho}'`, () => {
    // O nome do mais antigo viria primeiro em uma ordenação alfabética.
    const arquivos = [
      { id: 2, nome_arquivo: "Z recente.pdf", caminho_relativo: caminho },
      { id: 1, nome_arquivo: "A antigo.pdf", caminho_relativo: caminho },
    ];
    const markup = renderToStaticMarkup(createElement(exports.default, {
      arquivos, preservarOrdem: true, renderArquivo: (a) => a.nome_arquivo,
    }));
    assert.ok(markup.indexOf("Z recente.pdf") < markup.indexOf("A antigo.pdf"));
  });
}

test("demais módulos continuam em ordem alfabética", () => {
  const arquivos = [
    { id: 2, nome_arquivo: "Z.pdf", caminho_relativo: "" },
    { id: 1, nome_arquivo: "A.pdf", caminho_relativo: "" },
  ];
  const markup = renderToStaticMarkup(createElement(exports.default, {
    arquivos, renderArquivo: (a) => a.nome_arquivo,
  }));
  assert.ok(markup.indexOf("A.pdf") < markup.indexOf("Z.pdf"));
  assert.equal(arquivos[0].id, 2);
});
