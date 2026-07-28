import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL;
const STATUS_TRANSITORIOS = new Set([502, 503, 504]);
const ATRASOS_TENTATIVAS_MS = [0, 1_000, 2_000];
const LIMITE_REQUISICAO_MS = 5_000;
const CONDOMINIO_PADRAO =
  process.env.CONDOMINIO_PADRAO_SLUG ?? "camila-barbosa";

function aguardar(tempo: number) {
  return new Promise((resolver) => setTimeout(resolver, tempo));
}

async function encaminhar(
  caminho: string,
  init?: RequestInit,
  token?: string | null,
): Promise<Response> {
  if (!API_URL) {
    return Response.json(
      { detail: "API_URL não configurada no servidor Next.js." },
      { status: 503 },
    );
  }

  const metodo = init?.method?.toUpperCase() ?? "GET";
  const podeRepetir = metodo === "GET";
  const cabecalhos = new Headers(init?.headers);
  if (token) cabecalhos.set("Authorization", `Bearer ${token}`);
  if (!cabecalhos.has("X-Condominio-Slug")) {
    const armazenados = await cookies();
    cabecalhos.set(
      "X-Condominio-Slug",
      armazenados.get("condohub_condominio")?.value ?? CONDOMINIO_PADRAO,
    );
  }

  for (
    let tentativa = 0;
    tentativa < (podeRepetir ? ATRASOS_TENTATIVAS_MS.length : 1);
    tentativa += 1
  ) {
    if (ATRASOS_TENTATIVAS_MS[tentativa] > 0) {
      await aguardar(ATRASOS_TENTATIVAS_MS[tentativa]);
    }

    try {
      const limite = AbortSignal.timeout(LIMITE_REQUISICAO_MS);
      const signal = init?.signal
        ? AbortSignal.any([init.signal, limite])
        : limite;
      const resposta = await fetch(`${API_URL}${caminho}`, {
        ...init,
        cache: "no-store",
        headers: cabecalhos,
        signal,
      });

      const deveRepetir =
        podeRepetir &&
        STATUS_TRANSITORIOS.has(resposta.status) &&
        tentativa < ATRASOS_TENTATIVAS_MS.length - 1;
      if (deveRepetir) {
        await resposta.body?.cancel();
        continue;
      }

      return new Response(resposta.body, {
        status: resposta.status,
        headers: {
          "content-type":
            resposta.headers.get("content-type") ?? "application/json",
        },
      });
    } catch {
      if (tentativa < ATRASOS_TENTATIVAS_MS.length - 1) continue;
    }
  }

  return Response.json(
    {
      detail:
        "A API está iniciando e ainda não respondeu. Tente novamente em instantes.",
    },
    { status: 503 },
  );
}

export async function chamarApi(caminho: string, init?: RequestInit) {
  const { getToken } = await auth.protect();
  return encaminhar(caminho, init, await getToken());
}

export async function chamarApiPublica(caminho: string, init?: RequestInit) {
  return encaminhar(caminho, init);
}
