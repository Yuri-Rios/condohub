"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const nomesDosPapeis: Record<string, string> = {
  morador: "Morador(a)",
  sindico: "Síndico",
  subsindico: "Subsíndico",
  funcionario: "Funcionário",
  admin: "Admin",
};

export default function Navbar() {
  const pathname = usePathname();
  const { user } = useUser();
  const papeisNovos = user?.publicMetadata?.roles;
  const papeis = Array.isArray(papeisNovos)
    ? papeisNovos.map(String)
    : user?.publicMetadata?.role
      ? [String(user.publicMetadata.role)]
      : [];
  const podeAdministrar = papeis.some((papel) =>
    ["sindico", "subsindico", "admin"].includes(papel),
  );
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    if (!podeAdministrar) return;

    void fetch("/api/solicitacoes")
      .then((resposta) => (resposta.ok ? resposta.json() : []))
      .then((solicitacoes: Array<{ status: string }>) => {
        setPendentes(
          solicitacoes.filter((solicitacao) => solicitacao.status === "pendente")
            .length,
        );
      });
  }, [podeAdministrar]);

  const ativo = (rota: string) =>
    pathname === rota
      ? "bg-blue-700 text-white"
      : "bg-white text-blue-700 hover:bg-blue-100";

  return (
    <nav className="mb-6 flex items-center gap-3">
      <div className="flex flex-1 flex-wrap gap-3">
        <Link
          href="/nova-ocorrencia"
          className={`rounded border px-4 py-2 ${ativo("/nova-ocorrencia")}`}
        >
          Nova Ocorrência
        </Link>

        <Link
          href="/ocorrencias"
          className={`rounded border px-4 py-2 ${ativo("/ocorrencias")}`}
        >
          Ocorrências
        </Link>
        {podeAdministrar && (
          <Link
            href="/administracao/solicitacoes"
            className={`rounded border px-4 py-2 ${ativo("/administracao/solicitacoes")}`}
          >
            Solicitações
            {pendentes > 0 && (
              <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">
                {pendentes}
              </span>
            )}
          </Link>
        )}
      </div>

      <span className="hidden text-sm text-gray-600 sm:inline">
        {papeis.length > 0
          ? papeis.map((papel) => nomesDosPapeis[papel] ?? papel).join(" · ")
          : "Acesso não aprovado"}
      </span>
      <UserButton />
    </nav>
  );
}
