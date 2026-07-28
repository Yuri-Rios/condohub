"use client";

const MAXIMO_TENTATIVAS = 4;
const INTERVALO_TENTATIVAS_MS = 2_000;
const LIMITE_REQUISICAO_MS = 100_000;
const API_PUBLICA_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://condohub-siou.onrender.com";

let inicializacaoEmAndamento: Promise<boolean> | null = null;

function aguardar(tempo: number) {
  return new Promise((resolver) => setTimeout(resolver, tempo));
}

async function verificarAteResponder() {
  for (let tentativa = 0; tentativa < MAXIMO_TENTATIVAS; tentativa += 1) {
    try {
      // A chamada precisa partir do navegador. Requisições Render → Render
      // pela URL pública recebem 502 imediatamente e não sustentam o cold
      // start; uma conexão externa direta efetivamente desperta o serviço.
      const resposta = await fetch(`${API_PUBLICA_URL}/health`, {
        cache: "no-store",
        keepalive: true,
        signal: AbortSignal.timeout(LIMITE_REQUISICAO_MS),
      });
      if (resposta.ok) return true;
    } catch {}

    await aguardar(INTERVALO_TENTATIVAS_MS);
  }

  return false;
}

export function aguardarApiPronta() {
  if (!inicializacaoEmAndamento) {
    inicializacaoEmAndamento = verificarAteResponder().finally(() => {
      inicializacaoEmAndamento = null;
    });
  }

  return inicializacaoEmAndamento;
}
