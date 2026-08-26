"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";

type Etapa = {
  titulo: string;
  responsavel: string;
  inicio_previsto: string;
  fim_previsto: string;
  custo_previsto: string;
};

type Cronograma = {
  id: number;
  titulo: string;
  categoria: string;
  objetivo: string;
  responsavel: string;
  inicio_previsto: string;
  fim_previsto: string;
  prioridade: "normal" | "alta" | "urgente";
  orcamento_previsto: number | null;
  status: "rascunho" | "planejado";
  publicado: boolean;
  ultima_atualizacao: string | null;
  progresso: number;
  etapas: Array<{
    id: number; ordem: number; status: string; titulo: string; responsavel: string;
    inicio_previsto: string; fim_previsto: string; custo_previsto: number | null;
  }>;
};

type ModeloCronograma = {
  id: number; nome: string; categoria: string; objetivo: string; prioridade: string; duracao_total_dias: number;
  etapas: Array<{ id: number; ordem: number; titulo: string; responsavel_sugerido: string | null; duracao_dias: number }>;
};

const categorias = ["Inspeção predial", "Obra", "Manutenção", "Pintura", "Renovação", "Segurança", "Outro"];

function etapaVazia(inicio = "", fim = ""): Etapa {
  return { titulo: "", responsavel: "", inicio_previsto: inicio, fim_previsto: fim, custo_previsto: "" };
}

function dinheiro(valor: number | null) {
  if (valor == null) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function dataCurta(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${valor}T12:00:00Z`));
}

function somarDias(valor: string, dias: number) {
  const data = new Date(`${valor}T12:00:00Z`); data.setUTCDate(data.getUTCDate() + dias); return data.toISOString().slice(0, 10);
}

async function detalheErro(resposta: Response) {
  const dados = await resposta.json().catch(() => null);
  if (typeof dados?.detail === "string") return dados.detail;
  if (Array.isArray(dados?.detail)) return dados.detail[0]?.msg?.replace(/^Value error, /, "") ?? "Revise os dados informados.";
  return "Não foi possível salvar o cronograma.";
}

export default function CronogramasPage() {
  const [cronogramas, setCronogramas] = useState<Cronograma[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId,setEditandoId]=useState<number|null>(null);
  const [modalModelos, setModalModelos] = useState(false);
  const [modelos, setModelos] = useState<ModeloCronograma[]>([]);
  const [inicioModelo, setInicioModelo] = useState(new Date().toISOString().slice(0, 10));
  const [passo, setPasso] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [gerenciando, setGerenciando] = useState<number | null>(null);
  const [atualizacao, setAtualizacao] = useState("");
  const [processando, setProcessando] = useState("");
  const [formulario, setFormulario] = useState({
    titulo: "", categoria: "Inspeção predial", objetivo: "", responsavel: "",
    inicio_previsto: "", fim_previsto: "", prioridade: "normal", orcamento_previsto: "",
  });
  const [etapas, setEtapas] = useState<Etapa[]>([etapaVazia()]);

  const totalEtapas = etapas.reduce((total, etapa) => total + (Number(etapa.custo_previsto.replace(",", ".")) || 0), 0);
  const totalPrevisto = Number(formulario.orcamento_previsto.replace(",", ".")) || totalEtapas;
  const resumo = useMemo(() => ({ quantidade: cronogramas.length, planejados: cronogramas.filter((item) => item.status === "planejado").length }), [cronogramas]);
  const editandoRascunho = editandoId !== null && cronogramas.find((item) => item.id === editandoId)?.status === "rascunho";

  async function carregar() {
    setCarregando(true);
    const resposta = await fetch("/api/cronogramas", { cache: "no-store" });
    if (resposta.ok) setCronogramas(await resposta.json());
    else setErro("Não foi possível carregar os cronogramas.");
    setCarregando(false);
  }

  useEffect(() => {
    let ativo = true;
    void fetch("/api/cronogramas", { cache: "no-store" }).then(async (resposta) => {
      if (!ativo) return;
      if (resposta.ok) setCronogramas(await resposta.json());
      else setErro("Não foi possível carregar os cronogramas.");
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, []);

  function fechar() {
    setModalAberto(false);
    setEditandoId(null);
    setPasso(0);
    setErro("");
  }

  function editar(item:Cronograma){
    setEditandoId(item.id);setFormulario({titulo:item.titulo,categoria:item.categoria,objetivo:item.objetivo,responsavel:item.responsavel,inicio_previsto:item.inicio_previsto,fim_previsto:item.fim_previsto,prioridade:item.prioridade,orcamento_previsto:item.orcamento_previsto==null?"":String(item.orcamento_previsto)});
    setEtapas(item.etapas.map(etapa=>({titulo:etapa.titulo,responsavel:etapa.responsavel,inicio_previsto:etapa.inicio_previsto,fim_previsto:etapa.fim_previsto,custo_previsto:etapa.custo_previsto==null?"":String(etapa.custo_previsto)})));
    setPasso(0);setErro("");setModalAberto(true);
  }

  function atualizarEtapa(indice: number, campo: keyof Etapa, valor: string) {
    setEtapas((atuais) => atuais.map((etapa, i) => i === indice ? { ...etapa, [campo]: valor } : etapa));
  }

  function validarPasso() {
    if (passo === 0 && (!formulario.titulo.trim() || !formulario.objetivo.trim() || !formulario.responsavel.trim() || !formulario.inicio_previsto || !formulario.fim_previsto)) {
      setErro("Preencha título, objetivo, responsável e período."); return false;
    }
    if (passo === 0 && formulario.fim_previsto < formulario.inicio_previsto) {
      setErro("O término não pode ser anterior ao início."); return false;
    }
    if (passo === 1 && etapas.some((etapa) => !etapa.titulo.trim() || !etapa.responsavel.trim() || !etapa.inicio_previsto || !etapa.fim_previsto)) {
      setErro("Preencha nome, responsável e período de todas as etapas."); return false;
    }
    if (passo === 1 && etapas.some((etapa) => etapa.inicio_previsto < formulario.inicio_previsto || etapa.fim_previsto > formulario.fim_previsto || etapa.fim_previsto < etapa.inicio_previsto)) {
      setErro("As etapas precisam estar dentro do período do cronograma."); return false;
    }
    setErro(""); return true;
  }

  function continuar() {
    if (validarPasso()) setPasso((atual) => Math.min(2, atual + 1));
  }

  async function salvar(status: "rascunho" | "planejado") {
    if (status === "rascunho" && passo === 0 && !validarPasso()) return;
    const passoAnterior = passo;
    if (status === "planejado" && passo < 2 && !validarPasso()) return;
    if (passo === 2) {
      setPasso(0); if (!validarPasso()) { setPasso(passoAnterior); return; }
      setPasso(1); if (!validarPasso()) { setPasso(passoAnterior); return; }
      setPasso(passoAnterior);
    }
    setSalvando(true); setErro("");
    const resposta = await fetch(editandoId?`/api/cronogramas/${editandoId}`:"/api/cronogramas", {
      method: editandoId?"PUT":"POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formulario,
        status,
        orcamento_previsto: formulario.orcamento_previsto ? Number(formulario.orcamento_previsto.replace(",", ".")) : null,
        etapas: etapas
          .filter((etapa) => etapa.titulo.trim() && etapa.responsavel.trim() && etapa.inicio_previsto && etapa.fim_previsto)
          .map((etapa) => ({ ...etapa, custo_previsto: etapa.custo_previsto ? Number(etapa.custo_previsto.replace(",", ".")) : null })),
      }),
    });
    setSalvando(false);
    if (!resposta.ok) { setErro(await detalheErro(resposta)); return; }
    setFormulario({ titulo: "", categoria: "Inspeção predial", objetivo: "", responsavel: "", inicio_previsto: "", fim_previsto: "", prioridade: "normal", orcamento_previsto: "" });
    setEtapas([etapaVazia()]); fechar();
    setAviso(editandoId?"Cronograma atualizado.":status === "rascunho" ? "Rascunho salvo." : "Cronograma criado.");
    await carregar();
  }

  function enviar(evento: FormEvent) { evento.preventDefault(); if (passo < 2) continuar(); else void salvar("planejado"); }

  async function abrirModelos() {
    setErro("");
    const resposta = await fetch("/api/cronogramas/modelos", { cache: "no-store" });
    if (!resposta.ok) { setErro("Não foi possível carregar os modelos."); return; }
    setModelos(await resposta.json()); setModalModelos(true);
  }

  function usarModelo(modelo: ModeloCronograma) {
    let cursor = inicioModelo;
    const etapasCalculadas = modelo.etapas.map((etapa) => {
      const inicio = cursor; const fim = somarDias(inicio, etapa.duracao_dias - 1); cursor = somarDias(fim, 1);
      return { titulo: etapa.titulo, responsavel: etapa.responsavel_sugerido ?? "", inicio_previsto: inicio, fim_previsto: fim, custo_previsto: "" };
    });
    const fim = etapasCalculadas.at(-1)?.fim_previsto ?? inicioModelo;
    setFormulario({ titulo: modelo.nome, categoria: modelo.categoria, objetivo: modelo.objetivo, responsavel: "", inicio_previsto: inicioModelo, fim_previsto: fim, prioridade: modelo.prioridade, orcamento_previsto: "" });
    setEtapas(etapasCalculadas); setPasso(0); setModalModelos(false); setModalAberto(true);
  }

  async function atualizarStatus(item: Cronograma, etapaId: number, status: string) {
    setProcessando(`etapa-${etapaId}`); setErro("");
    const resposta = await fetch(`/api/cronogramas/${item.id}/etapas/${etapaId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, atualizacao: atualizacao || null }),
    });
    setProcessando("");
    if (!resposta.ok) { setErro(await detalheErro(resposta)); return; }
    setAviso("Andamento atualizado."); setAtualizacao("");
    await carregar();
  }

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Navbar />
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <Titulo texto="Cronogramas" subtitulo="Planeje atividades, responsáveis, prazos e custos da gestão do condomínio." />
          <div className="flex flex-wrap gap-2"><Link href="/cronogramas/modelos" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700">Gerenciar modelos</Link><button type="button" onClick={() => void abrirModelos()} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">Usar modelo</button><button type="button" onClick={() => {setEditandoId(null);setFormulario({titulo:"",categoria:"Inspeção predial",objetivo:"",responsavel:"",inicio_previsto:"",fim_previsto:"",prioridade:"normal",orcamento_previsto:""});setEtapas([etapaVazia()]);setPasso(0);setModalAberto(true)}} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-700">Novo cronograma</button></div>
        </div>

        {erro && !modalAberto && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>}
        {aviso && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{aviso}</div>}

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Total</p><p className="mt-1 text-2xl font-bold text-slate-950">{resumo.quantidade}</p></div>
          <div className="rounded-2xl border border-white bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Planejados</p><p className="mt-1 text-2xl font-bold text-blue-700">{resumo.planejados}</p></div>
          <div className="rounded-2xl border border-white bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Em rascunho</p><p className="mt-1 text-2xl font-bold text-amber-700">{resumo.quantidade - resumo.planejados}</p></div>
        </section>

        {carregando ? <p className="text-sm text-slate-500">Carregando cronogramas...</p> : cronogramas.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center"><p className="text-lg font-bold text-slate-900">Nenhum cronograma criado</p><p className="mt-2 text-sm text-slate-500">Comece organizando uma inspeção, obra ou manutenção.</p></section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">{cronogramas.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase tracking-wide text-blue-600">{item.categoria}</span><h2 className="mt-1 text-lg font-bold text-slate-950">{item.titulo}</h2></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "planejado" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{item.status === "planejado" ? "Planejado" : "Rascunho"}</span></div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{item.objetivo}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm"><div><dt className="text-slate-400">Período</dt><dd className="mt-1 font-semibold text-slate-700">{dataCurta(item.inicio_previsto)} – {dataCurta(item.fim_previsto)}</dd></div><div><dt className="text-slate-400">Responsável</dt><dd className="mt-1 font-semibold text-slate-700">{item.responsavel}</dd></div><div><dt className="text-slate-400">Etapas</dt><dd className="mt-1 font-semibold text-slate-700">{item.etapas.length}</dd></div><div><dt className="text-slate-400">Orçamento</dt><dd className="mt-1 font-semibold text-slate-700">{dinheiro(item.orcamento_previsto)}</dd></div></dl>
              <div className="mt-5"><div className="mb-2 flex justify-between text-xs font-semibold text-slate-500"><span>Andamento</span><span>{item.progresso}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${item.progresso}%` }} /></div></div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><span className={`text-xs font-semibold ${item.status === "planejado" ? "text-emerald-700" : "text-slate-400"}`}>{item.status === "planejado" ? "Visível no acompanhamento" : "Rascunho não publicado"}</span><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>editar(item)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">Editar</button><button type="button" onClick={() => { setGerenciando(gerenciando === item.id ? null : item.id); setAtualizacao(item.ultima_atualizacao ?? ""); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">{gerenciando === item.id ? "Fechar andamento" : "Gerenciar andamento"}</button></div></div>
              {gerenciando === item.id && <div className="mt-5 border-t border-slate-100 pt-5"><label className="text-sm font-semibold text-slate-700">Atualização para os condôminos <span className="font-normal text-slate-400">(opcional)</span><textarea value={atualizacao} onChange={(e) => setAtualizacao(e.target.value)} className="input mt-2 min-h-20 resize-y" placeholder="Ex.: Vistoria concluída. Aguardando entrega do laudo." /></label><div className="mt-4 grid gap-3">{item.etapas.map((etapa) => <div key={etapa.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-800">{etapa.ordem}. {etapa.titulo}</p><p className="mt-0.5 text-xs text-slate-500">{dataCurta(etapa.inicio_previsto)} – {dataCurta(etapa.fim_previsto)}</p></div><select aria-label={`Situação de ${etapa.titulo}`} value={etapa.status} disabled={processando === `etapa-${etapa.id}`} onChange={(e) => void atualizarStatus(item, etapa.id, e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><option value="nao_iniciada">Não iniciada</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option><option value="atrasada">Atrasada</option><option value="bloqueada">Bloqueada</option></select></div>)}</div></div>}
            </article>
          ))}</section>
        )}
      </div>

      {modalAberto && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-modal">
        <div className="mx-auto my-4 max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-7"><div><h2 id="titulo-modal" className="text-xl font-bold text-slate-950">{editandoId?"Editar cronograma":"Novo cronograma"}</h2><p className="mt-1 text-sm text-slate-500">Planeje prazos, responsáveis e custos.</p></div><button type="button" onClick={fechar} className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar">✕</button></div>
          <div className="flex gap-5 overflow-x-auto border-b border-slate-200 px-5 sm:px-7">{["Informações gerais", "Etapas", "Revisão"].map((rotulo, indice) => <button key={rotulo} type="button" onClick={() => indice < passo && setPasso(indice)} className={`whitespace-nowrap border-b-2 py-3 text-sm font-semibold ${passo === indice ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400"}`}>{indice + 1}. {rotulo}</button>)}</div>
          <form onSubmit={enviar}>
            <div className="min-h-96 p-5 sm:p-7">
              {erro && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>}
              {passo === 0 && <div className="grid gap-5 sm:grid-cols-2">
                <label className="sm:col-span-2 text-sm font-semibold text-slate-700">Título do cronograma<input className="input mt-2" value={formulario.titulo} onChange={(e) => setFormulario({ ...formulario, titulo: e.target.value })} placeholder="Ex.: Inspeção predial 2026" /></label>
                <label className="text-sm font-semibold text-slate-700">Categoria<select className="input mt-2" value={formulario.categoria} onChange={(e) => setFormulario({ ...formulario, categoria: e.target.value })}>{categorias.map((categoria) => <option key={categoria}>{categoria}</option>)}</select></label>
                <label className="text-sm font-semibold text-slate-700">Responsável principal<input className="input mt-2" value={formulario.responsavel} onChange={(e) => setFormulario({ ...formulario, responsavel: e.target.value })} placeholder="Nome ou função" /></label>
                <label className="sm:col-span-2 text-sm font-semibold text-slate-700">Objetivo / resultado esperado<textarea className="input mt-2 min-h-24 resize-y" value={formulario.objetivo} onChange={(e) => setFormulario({ ...formulario, objetivo: e.target.value })} placeholder="O que deverá estar entregue ao final?" /></label>
                <label className="text-sm font-semibold text-slate-700">Início previsto<input type="date" className="input mt-2" value={formulario.inicio_previsto} onChange={(e) => setFormulario({ ...formulario, inicio_previsto: e.target.value })} /></label>
                <label className="text-sm font-semibold text-slate-700">Término previsto<input type="date" className="input mt-2" value={formulario.fim_previsto} onChange={(e) => setFormulario({ ...formulario, fim_previsto: e.target.value })} /></label>
                <label className="text-sm font-semibold text-slate-700">Prioridade<select className="input mt-2" value={formulario.prioridade} onChange={(e) => setFormulario({ ...formulario, prioridade: e.target.value })}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
                <label className="text-sm font-semibold text-slate-700">Orçamento previsto <span className="font-normal text-slate-400">(opcional)</span><div className="mt-2 flex items-center gap-2"><span className="text-slate-500">R$</span><input inputMode="decimal" className="input" value={formulario.orcamento_previsto} onChange={(e) => setFormulario({ ...formulario, orcamento_previsto: e.target.value })} placeholder="0,00" /></div></label>
              </div>}

              {passo === 1 && <div><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="font-bold text-slate-950">Etapas do cronograma</h3><p className="mt-1 text-sm text-slate-500">Inclua as atividades na ordem de execução.</p></div><button type="button" onClick={() => setEtapas((atuais) => [...atuais, etapaVazia(formulario.inicio_previsto, formulario.fim_previsto)])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">＋ Adicionar etapa</button></div>
                <div className="grid gap-4">{etapas.map((etapa, indice) => <fieldset key={indice} className="rounded-2xl border border-slate-200 p-4"><legend className="px-2 text-sm font-bold text-slate-700">Etapa {indice + 1}</legend><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="sm:col-span-2 text-xs font-semibold text-slate-600">Atividade<input className="input mt-1.5" value={etapa.titulo} onChange={(e) => atualizarEtapa(indice, "titulo", e.target.value)} placeholder="Ex.: Realizar vistoria" /></label>
                  <label className="sm:col-span-2 text-xs font-semibold text-slate-600">Responsável<input className="input mt-1.5" value={etapa.responsavel} onChange={(e) => atualizarEtapa(indice, "responsavel", e.target.value)} placeholder="Pessoa, conselho ou empresa" /></label>
                  <label className="text-xs font-semibold text-slate-600">Início<input type="date" className="input mt-1.5" value={etapa.inicio_previsto} onChange={(e) => atualizarEtapa(indice, "inicio_previsto", e.target.value)} /></label>
                  <label className="text-xs font-semibold text-slate-600">Término<input type="date" className="input mt-1.5" value={etapa.fim_previsto} onChange={(e) => atualizarEtapa(indice, "fim_previsto", e.target.value)} /></label>
                  <label className="text-xs font-semibold text-slate-600">Custo previsto<input inputMode="decimal" className="input mt-1.5" value={etapa.custo_previsto} onChange={(e) => atualizarEtapa(indice, "custo_previsto", e.target.value)} placeholder="R$ 0,00" /></label>
                  <div className="flex items-end justify-end">{etapas.length > 1 && <button type="button" onClick={() => setEtapas((atuais) => atuais.filter((_, i) => i !== indice))} className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">Remover</button>}</div>
                </div></fieldset>)}</div>
              </div>}

              {passo === 2 && <div><h3 className="font-bold text-slate-950">Revise antes de criar</h3><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Período</p><p className="mt-1 font-bold text-slate-800">{dataCurta(formulario.inicio_previsto)} – {dataCurta(formulario.fim_previsto)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Etapas</p><p className="mt-1 font-bold text-slate-800">{etapas.length} atividades</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Orçamento</p><p className="mt-1 font-bold text-slate-800">{dinheiro(totalPrevisto || null)}</p></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-2xl text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400"><th className="px-2 py-3">Etapa</th><th className="px-2 py-3">Responsável</th><th className="px-2 py-3">Período</th><th className="px-2 py-3 text-right">Custo</th></tr></thead><tbody>{etapas.map((etapa, indice) => <tr key={indice} className="border-b border-slate-100"><td className="px-2 py-3 font-semibold text-slate-800">{etapa.titulo}</td><td className="px-2 py-3 text-slate-600">{etapa.responsavel}</td><td className="px-2 py-3 text-slate-600">{dataCurta(etapa.inicio_previsto)} – {dataCurta(etapa.fim_previsto)}</td><td className="px-2 py-3 text-right text-slate-600">{dinheiro(Number(etapa.custo_previsto.replace(",", ".")) || null)}</td></tr>)}</tbody></table></div></div>}
            </div>
            <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:px-7">{editandoId&&!editandoRascunho?<span/>:<button type="button" disabled={salvando} onClick={() => void salvar("rascunho")} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50">Salvar rascunho</button>}<div className="flex justify-end gap-2">{passo > 0 && <button type="button" onClick={() => { setErro(""); setPasso((atual) => atual - 1); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Voltar</button>}<button type="submit" disabled={salvando} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{salvando ? "Salvando..." : passo === 2 ? editandoId?"Salvar alterações":"Criar cronograma" : "Continuar"}</button></div></div>
          </form>
        </div>
      </div>}

      {modalModelos && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-modelos"><div className="mx-auto my-8 max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-200 p-5 sm:px-6"><div><h2 id="titulo-modelos" className="text-xl font-bold text-slate-950">Criar a partir de um modelo</h2><p className="mt-1 text-sm text-slate-500">Escolha a data inicial; as etapas serão calculadas e poderão ser editadas.</p></div><button type="button" onClick={() => setModalModelos(false)} className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar">✕</button></div><div className="p-5 sm:p-6"><label className="block max-w-xs text-sm font-semibold text-slate-700">Data inicial<input type="date" className="input mt-2" value={inicioModelo} onChange={(e) => setInicioModelo(e.target.value)} /></label>{modelos.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center"><p className="font-semibold text-slate-800">Nenhum modelo criado</p><Link href="/cronogramas/modelos" className="mt-3 inline-block text-sm font-semibold text-blue-700">Criar o primeiro modelo</Link></div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{modelos.map((modelo) => <article key={modelo.id} className="rounded-xl border border-slate-200 p-4"><span className="text-xs font-bold uppercase text-blue-600">{modelo.categoria}</span><h3 className="mt-1 font-bold text-slate-900">{modelo.nome}</h3><p className="mt-2 text-sm text-slate-500">{modelo.etapas.length} etapas · {modelo.duracao_total_dias} dias</p><button type="button" disabled={!inicioModelo} onClick={() => usarModelo(modelo)} className="mt-4 w-full rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Usar este modelo</button></article>)}</div>}</div></div></div>}
    </main>
  );
}
