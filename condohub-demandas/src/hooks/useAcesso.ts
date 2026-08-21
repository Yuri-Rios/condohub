"use client";

import { useEffect, useState } from "react";

export type AcessoAtual = {
  id: string;
  papeis: string[];
  admin_plataforma: boolean;
  modulos: Record<string, { habilitado: boolean; visivel_moradores: boolean }>;
  condominio: {
    id: number;
    slug: string;
    nome: string;
  };
};

export function useAcesso() {
  const [acesso, setAcesso] = useState<AcessoAtual | null>(null);

  useEffect(() => {
    let ativo = true;
    void fetch("/api/me", { cache: "no-store" })
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados: AcessoAtual | null) => {
        if (ativo) setAcesso(dados);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return acesso;
}
