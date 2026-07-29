const API_URL = process.env.API_URL;
// O Render pode manter a primeira conexão aberta durante todo o cold start.
// Interromper em poucos segundos faz o serviço voltar a responder 502 sem
// concluir o despertar. Esta rota existe justamente para sustentar a conexão.
const LIMITE_TENTATIVA_MS = 90_000;
const VERSAO_WAKEUP = "browser-direct-v5";

export async function GET() {
  if (!API_URL) {
    return Response.json(
      { detail: "API_URL não configurada no servidor Next.js." },
      { status: 503 },
    );
  }

  try {
    const resposta = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(LIMITE_TENTATIVA_MS),
    });

    return new Response(resposta.body, {
      status: resposta.status,
      headers: {
        "content-type":
          resposta.headers.get("content-type") ?? "application/json",
        "x-condohub-wakeup-version": VERSAO_WAKEUP,
      },
    });
  } catch {
    // A primeira conexão com um serviço gratuito adormecido pode permanecer
    // aberta durante todo o cold start. Encerrá-la permite que o cliente faça
    // novas tentativas enquanto o Render continua iniciando a API.
    return Response.json(
      { detail: "API iniciando. Uma nova tentativa será feita em instantes." },
      {
        status: 503,
        headers: { "x-condohub-wakeup-version": VERSAO_WAKEUP },
      },
    );
  }
}
