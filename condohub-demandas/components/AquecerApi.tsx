"use client";

import { useEffect } from "react";

import { aguardarApiPronta } from "@/src/lib/api-pronta";

export default function AquecerApi() {
  useEffect(() => {
    // Inicia uma única sequência compartilhada. As telas que precisam da API
    // aguardam esta mesma promessa, em vez de disputar o cold start do Render.
    void aguardarApiPronta();
  }, []);

  return null;
}
