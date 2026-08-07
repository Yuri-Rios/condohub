"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAcesso } from "@/src/hooks/useAcesso";

type CondominioDisponivel = {
  id: number;
  nome: string;
  slug: string;
  papeis: string[];
};

type ItemMenu = {
  href: string;
  label: string;
  badge?: number;
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
  const [atualizacoesChamados, setAtualizacoesChamados] = useState(0);
  const [condominios, setCondominios] = useState<CondominioDisponivel[]>([]);
  const [menuAberto, setMenuAberto] = useState(false);

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

  useEffect(() => {
    let ativo = true;
    async function carregarNotificacoes() {
      const resposta = await fetch("/api/notificacoes", { cache: "no-store" });
      if (!resposta.ok || !ativo) return;
      const dados = (await resposta.json()) as { quantidade: number };
      setAtualizacoesChamados(dados.quantidade);
    }

    void carregarNotificacoes();
    const intervalo = window.setInterval(() => void carregarNotificacoes(), 30_000);
    const atualizar = () => void carregarNotificacoes();
    window.addEventListener("condohub:notificacoes-atualizadas", atualizar);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("condohub:notificacoes-atualizadas", atualizar);
    };
  }, [acesso?.condominio.id]);

  const itensAtendimento: ItemMenu[] = [
    { href: "/nova-ocorrencia", label: "Novo chamado" },
    {
      href: "/ocorrencias",
      label: "Chamados",
      badge: atualizacoesChamados,
    },
    ...(podeAgendar
      ? [{ href: "/agendamentos", label: "Agendamentos" }]
      : []),
  ];
  const itensGestao: ItemMenu[] = podeAdministrar
    ? [
        {
          href: "/administracao/solicitacoes",
          label: "Acessos",
          badge: pendentes,
        },
        ...(podeVerMoradores
          ? [{ href: "/administracao/moradores", label: "Moradores" }]
          : []),
        { href: "/pedidos-compra", label: "Compras" },
        { href: "/estoque", label: "Estoque" },
        { href: "/prestadores", label: "Prestadores" },
      ]
    : [];
  const itensPlataforma: ItemMenu[] = acesso?.admin_plataforma
    ? [{ href: "/administracao/condominios", label: "Condomínios" }]
    : [];

  const classeLink = (rota: string) =>
    pathname === rota
      ? "bg-blue-600 text-white shadow-sm"
      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950";

  async function trocarCondominio(slug: string) {
    const resposta = await fetch("/api/condominio-ativo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (resposta.ok) window.location.reload();
  }

  function grupoMenu(titulo: string, itens: ItemMenu[]) {
    if (itens.length === 0) return null;
    return (
      <div>
        <p className="px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          {titulo}
        </p>
        <div className="mt-2 grid gap-1">
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuAberto(false)}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold ${classeLink(item.href)}`}
            >
              {item.label}
              {item.badge ? (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <header className="sticky top-3 z-20 mb-10 rounded-2xl border border-white/80 bg-white/90 p-2 shadow-[0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur">
      <nav className="flex items-center gap-2">
        <Link
          href="/ocorrencias"
          aria-label="CondoHub — chamados"
          className="flex shrink-0 items-center gap-2 px-2 py-1"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-sm font-black text-white shadow-sm">
            CH
          </span>
          <span className="hidden font-bold tracking-tight text-slate-950 lg:inline">
            CondoHub
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <Link
            href="/nova-ocorrencia"
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${classeLink("/nova-ocorrencia")}`}
          >
            Novo chamado
          </Link>
          <Link
            href="/ocorrencias"
            className={`flex items-center whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${classeLink("/ocorrencias")}`}
          >
            Chamados
            {atualizacoesChamados > 0 && (
              <span className="ml-2 rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                {atualizacoesChamados}
              </span>
            )}
          </Link>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {condominios.length > 1 ? (
            <select
              aria-label="Condomínio ativo"
              value={acesso?.condominio.slug ?? ""}
              onChange={(event) => void trocarCondominio(event.target.value)}
              className="min-w-0 max-w-36 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 sm:max-w-52 sm:px-3 sm:text-sm"
            >
              {condominios.map((condominio) => (
                <option key={condominio.id} value={condominio.slug}>
                  {condominio.nome}
                </option>
              ))}
            </select>
          ) : acesso?.condominio ? (
            <span className="hidden max-w-44 truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 sm:block">
              {acesso.condominio.nome}
            </span>
          ) : null}

          <div className="hidden text-right xl:block">
            <p className="max-w-40 truncate text-sm font-semibold text-slate-800">
              {user?.fullName ?? "Minha conta"}
            </p>
            <p className="max-w-48 truncate text-xs text-slate-500">
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

          <div className="relative">
            <button
              type="button"
              aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuAberto}
              aria-controls="menu-principal"
              onClick={() => setMenuAberto((aberto) => !aberto)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <span className="flex w-5 flex-col gap-1" aria-hidden="true">
                <span className="h-0.5 rounded-full bg-current" />
                <span className="h-0.5 rounded-full bg-current" />
                <span className="h-0.5 rounded-full bg-current" />
              </span>
            </button>

            {menuAberto && (
              <>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  onClick={() => setMenuAberto(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div
                  id="menu-principal"
                  className="absolute right-0 z-20 mt-3 max-h-[calc(100vh-6rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
                >
                  <div className="border-b border-slate-100 px-2 pb-4">
                    <p className="truncate font-bold text-slate-950">
                      {user?.fullName ?? "Minha conta"}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {acesso?.condominio.nome ?? "CondoHub"}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    {grupoMenu("Atendimento", itensAtendimento)}
                    {grupoMenu("Gestão do condomínio", itensGestao)}
                    {grupoMenu("Plataforma", itensPlataforma)}
                    {grupoMenu("Perfil", [{ href: "/conta", label: "Minha conta" }])}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
