"use client";

const MAXIMO_TENTATIVAS = 4;
const INTERVALO_TENTATIVAS_MS = 2_000;
// Maior que o limite do proxy Next para que o navegador não cancele a
// requisição que está efetivamente despertando o serviço no Render.
const LIMITE_REQUISICAO_MS = 100_000;

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
