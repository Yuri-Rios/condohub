"use client";

import { useEffect } from "react";

export default function AquecerApi() {
  useEffect(() => {
    void fetch("/api/health", { cache: "no-store" }).catch(() => {
      // O primeiro contato pode terminar antes de o serviço gratuito despertar.
      // As chamadas autenticadas seguintes fazem uma nova tentativa normalmente.
    });
  }, []);

  return null;
}
