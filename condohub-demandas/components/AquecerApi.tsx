"use client";

import { useEffect } from "react";

export default function AquecerApi() {
  useEffect(() => {
    const controlador = new AbortController();

    async function aguardarApi() {
      for (let tentativa = 0; tentativa < 6; tentativa += 1) {
        try {
          const resposta = await fetch("/api/health", {
            cache: "no-store",
            signal: controlador.signal,
          });
          if (resposta.ok) return;
        } catch {
          if (controlador.signal.aborted) return;
        }

        await new Promise((resolver) => setTimeout(resolver, 4000));
      }
    }

    void aguardarApi();
    return () => controlador.abort();
  }, []);

  return null;
}
