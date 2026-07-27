"use client";

import { useEffect } from "react";

const MAXIMO_TENTATIVAS = 24;
const INTERVALO_TENTATIVAS_MS = 2_000;
const LIMITE_REQUISICAO_MS = 8_000;

export default function AquecerApi() {
  useEffect(() => {
    async function aguardarApi() {
      // O Render gratuito pode levar mais de um minuto para iniciar. Cada
      // pedido tem seu próprio limite para que uma conexão presa durante o
      // cold start não impeça as tentativas seguintes.
      for (let tentativa = 0; tentativa < MAXIMO_TENTATIVAS; tentativa += 1) {
        try {
          const resposta = await fetch("/api/health", {
            cache: "no-store",
            keepalive: true,
            signal: AbortSignal.timeout(LIMITE_REQUISICAO_MS),
          });
          if (resposta.ok) return;
        } catch {}

        await new Promise((resolver) =>
          setTimeout(resolver, INTERVALO_TENTATIVAS_MS),
        );
      }
    }

    void aguardarApi();
  }, []);

  return null;
}
