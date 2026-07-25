import { auth } from "@clerk/nextjs/server";

const API_URL = process.env.API_URL;

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

  try {
    const resposta = await fetch(`${API_URL}${caminho}`, {
      ...init,
      cache: "no-store",
      headers: {
        ...init?.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    return new Response(resposta.body, {
      status: resposta.status,
      headers: {
        "content-type":
          resposta.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return Response.json(
      { detail: "A API de ocorrências não respondeu." },
      { status: 502 },
    );
  }
}

export async function chamarApi(caminho: string, init?: RequestInit) {
  const { getToken } = await auth.protect();
  return encaminhar(caminho, init, await getToken());
}

export async function chamarApiPublica(caminho: string, init?: RequestInit) {
  return encaminhar(caminho, init);
}
