"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";

type EtapaModelo = { titulo: string; responsavel_sugerido: string; duracao_dias: number };
type Modelo = { id: number; nome: string; categoria: string; objetivo: string; prioridade: string; duracao_total_dias: number; etapas: Array<EtapaModelo & { id: number; ordem: number }> };

const categorias = ["Inspeção predial", "Obra", "Manutenção", "Pintura", "Renovação", "Segurança", "Outro"];
const etapaVazia = (): EtapaModelo => ({ titulo: "", responsavel_sugerido: "", duracao_dias: 1 });

export default function ModelosCronogramaPage() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const [formulario, setFormulario] = useState({ nome: "", categoria: "Inspeção predial", objetivo: "", prioridade: "normal" });
  const [etapas, setEtapas] = useState<EtapaModelo[]>([etapaVazia()]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  async function carregar() {
    const resposta = await fetch("/api/cronogramas/modelos", { cache: "no-store" });
    if (resposta.ok) setModelos(await resposta.json()); else setErro("Não foi possível carregar os modelos.");
  }
  useEffect(() => { let ativo = true; void fetch("/api/cronogramas/modelos", { cache: "no-store" }).then(async (r) => { if (!ativo) return; if (r.ok) setModelos(await r.json()); else setErro("Não foi possível carregar os modelos."); }); return () => { ativo = false; }; }, []);

  function limpar() { setEditando(null); setFormulario({ nome: "", categoria: "Inspeção predial", objetivo: "", prioridade: "normal" }); setEtapas([etapaVazia()]); setErro(""); }
  function editar(modelo: Modelo) { setEditando(modelo.id); setFormulario({ nome: modelo.nome, categoria: modelo.categoria, objetivo: modelo.objetivo, prioridade: modelo.prioridade }); setEtapas(modelo.etapas.map((e) => ({ titulo: e.titulo, responsavel_sugerido: e.responsavel_sugerido ?? "", duracao_dias: e.duracao_dias }))); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function salvar(evento: FormEvent) {
    evento.preventDefault(); setSalvando(true); setErro(""); setAviso("");
    const resposta = await fetch(editando ? `/api/cronogramas/modelos/${editando}` : "/api/cronogramas/modelos", { method: editando ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formulario, etapas }) });
    setSalvando(false);
    if (!resposta.ok) { const dados = await resposta.json().catch(() => null); setErro(typeof dados?.detail === "string" ? dados.detail : dados?.detail?.[0]?.msg ?? "Não foi possível salvar o modelo."); return; }
    setAviso(editando ? "Modelo atualizado." : "Modelo criado."); limpar(); await carregar();
  }

  async function excluir(modelo: Modelo) {
    if (!window.confirm(`Excluir o modelo “${modelo.nome}”? Os cronogramas já criados não serão alterados.`)) return;
    const resposta = await fetch(`/api/cronogramas/modelos/${modelo.id}`, { method: "DELETE" });
    if (!resposta.ok) { setErro("Não foi possível excluir o modelo."); return; }
    if (editando === modelo.id) limpar(); setAviso("Modelo excluído."); await carregar();
  }

  return <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl"><Navbar />
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><Titulo texto="Modelos de cronograma" subtitulo="Crie estruturas reutilizáveis com etapas e durações sugeridas." /><Link href="/cronogramas" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">← Voltar aos cronogramas</Link></div>
    {erro && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{erro}</div>}{aviso && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{aviso}</div>}
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]"><form onSubmit={salvar} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">{editando ? "Editar modelo" : "Novo modelo"}</h2>{editando && <button type="button" onClick={limpar} className="text-sm font-semibold text-slate-500">Cancelar edição</button>}</div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2 text-sm font-semibold text-slate-700">Nome do modelo<input required minLength={3} className="input mt-2" value={formulario.nome} onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })} placeholder="Ex.: Inspeção predial anual" /></label><label className="text-sm font-semibold text-slate-700">Categoria<select className="input mt-2" value={formulario.categoria} onChange={(e) => setFormulario({ ...formulario, categoria: e.target.value })}>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Prioridade sugerida<select className="input mt-2" value={formulario.prioridade} onChange={(e) => setFormulario({ ...formulario, prioridade: e.target.value })}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label><label className="sm:col-span-2 text-sm font-semibold text-slate-700">Objetivo sugerido<textarea required minLength={3} className="input mt-2 min-h-20 resize-y" value={formulario.objetivo} onChange={(e) => setFormulario({ ...formulario, objetivo: e.target.value })} /></label></div>
      <div className="mt-6 flex items-center justify-between"><h3 className="font-bold text-slate-900">Etapas</h3><button type="button" onClick={() => setEtapas((a) => [...a, etapaVazia()])} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">＋ Adicionar</button></div><div className="mt-3 grid gap-3">{etapas.map((etapa, i) => <fieldset key={i} className="rounded-xl bg-slate-50 p-4"><legend className="px-1 text-xs font-bold uppercase text-slate-500">Etapa {i + 1}</legend><div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_100px]"><label className="text-xs font-semibold text-slate-600">Atividade<input required minLength={2} className="input mt-1" value={etapa.titulo} onChange={(e) => setEtapas((a) => a.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x))} /></label><label className="text-xs font-semibold text-slate-600">Responsável sugerido<input className="input mt-1" value={etapa.responsavel_sugerido} onChange={(e) => setEtapas((a) => a.map((x, j) => j === i ? { ...x, responsavel_sugerido: e.target.value } : x))} /></label><label className="text-xs font-semibold text-slate-600">Duração (dias)<input required type="number" min={1} max={365} className="input mt-1" value={etapa.duracao_dias} onChange={(e) => setEtapas((a) => a.map((x, j) => j === i ? { ...x, duracao_dias: Number(e.target.value) } : x))} /></label></div>{etapas.length > 1 && <button type="button" onClick={() => setEtapas((a) => a.filter((_, j) => j !== i))} className="mt-2 text-xs font-semibold text-rose-600">Remover etapa</button>}</fieldset>)}</div><button disabled={salvando} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar modelo"}</button>
    </form><section><h2 className="mb-3 font-bold text-slate-950">Modelos disponíveis</h2>{modelos.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">Nenhum modelo criado.</div> : <div className="grid gap-3">{modelos.map((m) => <article key={m.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-bold uppercase text-blue-600">{m.categoria}</span><h3 className="mt-1 font-bold text-slate-950">{m.nome}</h3><p className="mt-2 text-sm text-slate-500">{m.etapas.length} etapas · {m.duracao_total_dias} dias estimados</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => editar(m)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Editar</button><button type="button" onClick={() => void excluir(m)} className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-600">Excluir</button></div></article>)}</div>}</section></div>
  </div></main>;
}
