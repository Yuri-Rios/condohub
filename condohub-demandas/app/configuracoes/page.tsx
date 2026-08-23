"use client";

import { useEffect, useState } from "react";

import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";

type Modulo = {
  chave: string;
  nome: string;
  permite_moradores: boolean;
  habilitado: boolean;
  visivel_moradores: boolean;
};

const descricoes: Record<string, string> = {
  chamados: "Permitir abertura e acompanhamento de chamados.",
  agendamentos: "Permitir reservas dos ambientes disponíveis.",
  atas: "Disponibilizar as atas publicadas pela gestão.",
  acompanhamento: "Mostrar o andamento dos cronogramas publicados.",
  financeiro: "Disponibilizar balancetes e orçamentos publicados pela gestão.",
};

export default function ConfiguracoesPage() {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  async function carregar() {
    const resposta = await fetch("/api/configuracoes/modulos", { cache: "no-store" });
    if (resposta.ok) setModulos(await resposta.json());
    else setErro("Não foi possível carregar as configurações.");
    setCarregando(false);
  }

  useEffect(() => {
    let ativo = true;
    void fetch("/api/configuracoes/modulos", { cache: "no-store" }).then(async (resposta) => {
      if (!ativo) return;
      if (resposta.ok) setModulos(await resposta.json());
      else setErro("Não foi possível carregar as configurações.");
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, []);

  async function alternar(modulo: Modulo) {
    setProcessando(modulo.chave); setErro(""); setAviso("");
    const resposta = await fetch(`/api/configuracoes/modulos/${encodeURIComponent(modulo.chave)}/visibilidade`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visivel_moradores: !modulo.visivel_moradores }),
    });
    setProcessando("");
    if (!resposta.ok) { const dados = await resposta.json().catch(() => null); setErro(dados?.detail ?? "Não foi possível alterar a configuração."); return; }
    setAviso("Visibilidade atualizada."); await carregar();
  }

  const disponiveis = modulos.filter((modulo) => modulo.permite_moradores);

  return <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl"><Navbar /><Titulo texto="Configurações do condomínio" subtitulo="Escolha quais recursos contratados ficarão disponíveis para os moradores." />
    {erro && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>}
    {aviso && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{aviso}</div>}
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="font-bold text-slate-950">Visibilidade para moradores</h2><p className="mt-1 text-sm text-slate-500">Somente módulos liberados pelo CondoHub podem ser ativados.</p></div>
      {carregando ? <p className="p-6 text-sm text-slate-500">Carregando configurações...</p> : <div className="divide-y divide-slate-100">{disponiveis.map((modulo) => <div key={modulo.chave} className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:px-6"><div><p className="font-semibold text-slate-900">{modulo.nome}</p><p className="mt-1 text-sm text-slate-500">{descricoes[modulo.chave]}</p>{!modulo.habilitado && <p className="mt-1 text-xs font-semibold text-amber-700">Não contratado pelo condomínio</p>}</div><button type="button" role="switch" aria-checked={modulo.visivel_moradores} disabled={!modulo.habilitado || processando === modulo.chave} onClick={() => void alternar(modulo)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${modulo.visivel_moradores ? "bg-blue-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${modulo.visivel_moradores ? "left-6" : "left-1"}`} /><span className="sr-only">{modulo.visivel_moradores ? "Ocultar" : "Mostrar"} {modulo.nome}</span></button></div>)}</div>}
    </section>
  </div></main>;
}
