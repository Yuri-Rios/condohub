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
  const ehGestor = papeis.some((papel) => ["sindico", "subsindico", "funcionario", "admin"].includes(papel));
  const podeConfigurar = papeis.some((papel) => ["sindico", "admin"].includes(papel));
  const podeAcessarModulo = (chave: string) => {
    const modulo = acesso?.modulos?.[chave];
    return Boolean(modulo?.habilitado && (ehGestor || modulo.visivel_moradores));
  };
  const [pendentes, setPendentes] = useState(0);
  const [atualizacoesChamados, setAtualizacoesChamados] = useState(0);
  const [condominios, setCondominios] = useState<CondominioDisponivel[]>([]);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (!menuAberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, [menuAberto]);

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

  const itensPrincipais: ItemMenu[] = [
    ...(podeAcessarModulo("chamados") ? [{
      href: "/ocorrencias",
      label: "Chamados",
      badge: atualizacoesChamados,
    }, { href: "/nova-ocorrencia", label: "Novo chamado" }] : []),
    ...(podeAgendar && podeAcessarModulo("agendamentos")
      ? [{ href: "/agendamentos", label: "Agendamentos" }]
      : []),
  ];
  const itensCondominio: ItemMenu[] = [
    ...(podeAcessarModulo("atas") ? [{ href: "/atas", label: "Atas" }] : []),
    ...(podeAcessarModulo("financeiro") ? [{ href: "/balancetes", label: "Balancetes" }, { href: "/orcamentos", label: "Orçamentos" }, { href: "/contratos", label: "Contratos" }, { href: "/certificados", label: "Certificados" }, { href: "/memorial", label: "Memorial" }] : []),
    ...(podeAcessarModulo("acompanhamento") ? [{ href: "/acompanhamento", label: "Acompanhamento" }] : []),
    ...(podeAdministrar ? [
        {
          href: "/administracao/solicitacoes",
          label: "Acessos",
          badge: pendentes,
        },
        ...(podeVerMoradores
          ? [{ href: "/administracao/moradores", label: "Moradores" }]
          : []),
        ...(podeAcessarModulo("compras") ? [{ href: "/pedidos-compra", label: "Compras" }] : []),
        ...(podeAcessarModulo("estoque") ? [{ href: "/estoque", label: "Estoque" }] : []),
        ...(podeAcessarModulo("patrimonio") ? [{ href: "/patrimonio", label: "Patrimônio" }] : []),
        ...(podeAcessarModulo("prestadores") ? [{ href: "/prestadores", label: "Prestadores" }] : []),
        ...(podeAcessarModulo("cronogramas") ? [{ href: "/cronogramas", label: "Cronogramas" }] : []),
      ] : []),
  ];
  const itensConfiguracoes: ItemMenu[] = [
    ...(podeAdministrar && (podeAcessarModulo("atas") || podeAcessarModulo("financeiro")) ? [{ href: "/administracao/onedrive", label: "Sincronizar" }] : []),
    ...(podeConfigurar ? [{ href: "/configuracoes", label: "Configurações do condomínio" }] : []),
    { href: "/conta", label: "Minha conta" },
  ];
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
    <>
    <aside id="menu-desktop" className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-slate-200 bg-white shadow-[8px_0_30px_rgba(15,23,42,.05)] lg:flex">
      <div className="border-b border-slate-100 p-4 pt-5"><div className="flex items-center gap-3"><UserButton appearance={{elements:{avatarBox:"h-11 w-11"}}}/><div className="min-w-0"><p className="truncate font-bold text-slate-900">{user?.fullName??"Minha conta"}</p><p className="truncate text-xs text-slate-500">{papeis.length?papeis.map(p=>nomesDosPapeis[p]??p).join(" · "):"Acesso não aprovado"}</p></div></div>{condominios.length>1?<select aria-label="Condomínio ativo" value={acesso?.condominio.slug??""} onChange={e=>void trocarCondominio(e.target.value)} className="input mt-3 py-2 text-xs font-semibold">{condominios.map(c=><option key={c.id} value={c.slug}>{c.nome}</option>)}</select>:<p className="mt-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{acesso?.condominio.nome??"Condomínio"}</p>}</div>
      <div className="flex-1 overflow-y-auto p-4"><div className="grid gap-6">{grupoMenu("Principal",itensPrincipais)}{grupoMenu("Condomínio",itensCondominio)}{grupoMenu("Configurações",itensConfiguracoes)}{grupoMenu("Plataforma",itensPlataforma)}</div></div>
      <div className="border-t border-slate-100 p-4 text-center text-xs text-slate-400">CondoHub</div>
    </aside>
    <header className="sticky top-0 z-30 mb-7 -mx-4 border-b border-slate-200/80 bg-white px-4 py-2.5 shadow-sm sm:-mx-6 sm:px-6 lg:hidden">
      <nav className="mx-auto flex max-w-7xl items-center gap-2">
        <button
          type="button"
          aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuAberto}
          aria-controls="menu-principal"
          onClick={() => setMenuAberto((aberto) => !aberto)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-700 hover:bg-slate-100"
        >
          <span className="flex w-5 flex-col gap-1.5" aria-hidden="true"><span className="h-0.5 rounded-full bg-current"/><span className="h-0.5 rounded-full bg-current"/><span className="h-0.5 rounded-full bg-current"/></span>
        </button>
        <Link
          href={podeAcessarModulo("chamados") ? "/ocorrencias" : "/conta"}
          aria-label="CondoHub"
          className="flex min-w-0 items-center gap-2"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-sm font-black text-white shadow-sm">
            CH
          </span>
          <span className="truncate font-bold tracking-tight text-slate-950">
            CondoHub
          </span>
        </Link>

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

          <UserButton
            appearance={{
              elements: { avatarBox: "h-9 w-9 ring-2 ring-slate-100" },
            }}
          />
        </div>
      </nav>
      {menuAberto && <><button type="button" aria-label="Fechar menu" onClick={()=>setMenuAberto(false)} className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] lg:hidden"/><aside id="menu-principal" className="fixed inset-y-0 left-0 z-50 flex w-[min(21rem,88vw)] flex-col bg-white shadow-[20px_0_60px_rgba(15,23,42,.2)] lg:hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-4"><p className="font-bold text-slate-950">Menu</p><button type="button" aria-label="Fechar menu" onClick={()=>setMenuAberto(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xl text-slate-700">×</button></div>
        <div className="border-b border-slate-100 p-4"><div className="flex items-center gap-3"><UserButton appearance={{elements:{avatarBox:"h-11 w-11"}}}/><div className="min-w-0"><p className="truncate font-bold text-slate-900">{user?.fullName??"Minha conta"}</p><p className="truncate text-xs text-slate-500">{papeis.length?papeis.map(p=>nomesDosPapeis[p]??p).join(" · "):"Acesso não aprovado"}</p></div></div><p className="mt-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{acesso?.condominio.nome??"CondoHub"}</p></div>
        <div className="flex-1 overflow-y-auto p-4"><div className="grid gap-6">{grupoMenu("Principal",itensPrincipais)}{grupoMenu("Condomínio",itensCondominio)}{grupoMenu("Configurações",itensConfiguracoes)}{grupoMenu("Plataforma",itensPlataforma)}</div></div>
        <div className="border-t border-slate-100 p-4 text-center text-xs text-slate-400">CondoHub</div>
      </aside></>}
    </header>
    </>
  );
}
