"use client";

import { useEffect } from "react";

export default function AquecerApi() {
  useEffect(() => {
    async function aguardarApi() {
      // O Render gratuito pode levar cerca de um minuto para iniciar. Este
      // pedido não deve ser cancelado quando o Clerk troca a rota de login.
      for (let tentativa = 0; tentativa < 18; tentativa += 1) {
        try {
          const resposta = await fetch("/api/health", {
            cache: "no-store",
            keepalive: true,
          });
          if (resposta.ok) return;
        } catch {}

        await new Promise((resolver) => setTimeout(resolver, 4000));
      }
    }

    void aguardarApi();
  }, []);

  return null;
}
