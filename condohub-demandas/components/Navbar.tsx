"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAcesso } from "@/src/hooks/useAcesso";

type CondominioDisponivel = {
  id: number;
  nome: string;
  slug: string;
  papeis: string[];
};

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
  const acesso = useAcesso();
  const papeis = acesso?.papeis ?? [];
  const podeAdministrar = papeis.some((papel) =>
    ["sindico", "subsindico", "admin"].includes(papel),
  );
  const podeAgendar = papeis.includes("morador");
  const podeVerMoradores = papeis.some((papel) =>
    ["sindico", "admin"].includes(papel),
  );
  const [pendentes, setPendentes] = useState(0);
  const [condominios, setCondominios] = useState<CondominioDisponivel[]>([]);

  useEffect(() => {
    void fetch("/api/condominios", { cache: "no-store" })
      .then((resposta) => (resposta.ok ? resposta.json() : []))
      .then(setCondominios);
  }, []);

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

  async function trocarCondominio(slug: string) {
    const resposta = await fetch("/api/condominio-ativo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (resposta.ok) window.location.reload();
  }

  return (
    <>
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
          {podeAdministrar && <Link href="/pedidos-compra" className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold ${ativo("/pedidos-compra")}`}>Compras</Link>}
          {podeAdministrar && <Link href="/estoque" className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold ${ativo("/estoque")}`}>Estoque</Link>}
          {podeAdministrar && <Link href="/prestadores" className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold ${ativo("/prestadores")}`}>Prestadores</Link>}
          {podeAgendar && (
            <Link
              href="/agendamentos"
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold ${ativo("/agendamentos")}`}
            >
              Agendamentos
            </Link>
          )}
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
          {podeVerMoradores && (
            <Link
              href="/administracao/moradores"
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold ${ativo("/administracao/moradores")}`}
            >
              Moradores
            </Link>
          )}
          {acesso?.admin_plataforma && (
            <Link
              href="/administracao/condominios"
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold ${ativo("/administracao/condominios")}`}
            >
              Condomínios
            </Link>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3 pl-2">
          {condominios.length > 1 ? (
            <select
              aria-label="Condomínio ativo"
              value={acesso?.condominio.slug ?? ""}
              onChange={(event) => void trocarCondominio(event.target.value)}
              className="max-w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              {condominios.map((condominio) => (
                <option key={condominio.id} value={condominio.slug}>
                  {condominio.nome}
                </option>
              ))}
            </select>
          ) : acesso?.condominio ? (
            <span className="hidden max-w-44 truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 lg:inline">
              {acesso.condominio.nome}
            </span>
          ) : null}
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
          <Link
            href="/conta"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          >
            Conta
          </Link>
          <UserButton
            appearance={{
              elements: { avatarBox: "h-9 w-9 ring-2 ring-slate-100" },
            }}
          />
        </div>
      </nav>
    </header>
    </>
  );
}
