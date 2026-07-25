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
      ? "bg-blue-600 text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950";

  return (
    <header className="sticky top-3 z-20 mb-10 rounded-2xl border border-white/80 bg-white/90 p-2 shadow-[0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur">
      <nav className="flex flex-wrap items-center gap-2">
        <Link href="/ocorrencias" className="mr-2 flex items-center gap-2 px-2 py-1">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-sm font-black text-white shadow-sm">
            CH
          </span>
          <span className="hidden font-bold tracking-tight text-slate-950 lg:inline">
            CondoHub
          </span>
        </Link>

        <div className="order-3 flex w-full gap-1 overflow-x-auto border-t border-slate-100 pt-2 sm:order-none sm:w-auto sm:flex-1 sm:border-0 sm:pt-0">
          <Link
            href="/nova-ocorrencia"
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold ${ativo("/nova-ocorrencia")}`}
          >
            Novo chamado
          </Link>

          <Link
            href="/ocorrencias"
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold ${ativo("/ocorrencias")}`}
          >
            Chamados
          </Link>
          {podeAdministrar && (
            <Link
              href="/administracao/solicitacoes"
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold ${ativo("/administracao/solicitacoes")}`}
            >
              Acessos
              {pendentes > 0 && (
                <span className="ml-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                  {pendentes}
                </span>
              )}
            </Link>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3 pl-2">
          <div className="hidden text-right md:block">
            <p className="max-w-48 truncate text-sm font-semibold text-slate-800">
              {user?.fullName ?? "Minha conta"}
            </p>
            <p className="max-w-56 truncate text-xs text-slate-500">
              {papeis.length > 0
                ? papeis.map((papel) => nomesDosPapeis[papel] ?? papel).join(" · ")
                : "Acesso não aprovado"}
            </p>
          </div>
          <UserButton
            appearance={{
              elements: { avatarBox: "h-9 w-9 ring-2 ring-slate-100" },
            }}
          />
        </div>
      </nav>
    </header>
  );
}
