"use client";

const MAXIMO_TENTATIVAS = 30;
const INTERVALO_TENTATIVAS_MS = 2_000;
const LIMITE_REQUISICAO_MS = 8_000;

let inicializacaoEmAndamento: Promise<boolean> | null = null;

function aguardar(tempo: number) {
  return new Promise((resolver) => setTimeout(resolver, tempo));
}

async function verificarAteResponder() {
  for (let tentativa = 0; tentativa < MAXIMO_TENTATIVAS; tentativa += 1) {
    try {
      const resposta = await fetch("/api/health", {
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
