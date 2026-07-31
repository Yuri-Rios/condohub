"use client";

import { useEffect, useState, type FormEvent } from "react";
import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";

type Historico = { id:number; status:string; observacao:string|null; autor_nome:string; criado_em:string };
type Pedido = { id:number; ocorrencia_id:number|null; item:string; quantidade:number; unidade:string; justificativa:string; valor_estimado:number|null; status:"create"|"ongoing"|"done"; solicitante_nome:string; criado_em:string; pode_gerenciar:boolean; historico:Historico[] };
type Chamado = { id:number; titulo:string };
const rotulos = { create:"Criado", ongoing:"Em andamento", done:"Concluído" };

export default function PedidosCompraPage() {
  const [pedidos,setPedidos] = useState<Pedido[]>([]);
  const [chamados,setChamados] = useState<Chamado[]>([]);
  const [erro,setErro] = useState("");
  const [salvando,setSalvando] = useState(false);
  const [item,setItem] = useState("");
  const [quantidade,setQuantidade] = useState("1");
  const [unidade,setUnidade] = useState("un");
  const [justificativa,setJustificativa] = useState("");
  const [valor,setValor] = useState("");
  const [ocorrenciaId,setOcorrenciaId] = useState("");

  async function carregar() {
    const [rp,ro] = await Promise.all([fetch("/api/pedidos-compra"),fetch("/api/ocorrencias")]);
    const [dp,dO] = await Promise.all([rp.json(),ro.json()]);
    if (rp.ok) setPedidos(dp); else setErro(dp.detail ?? "Não foi possível carregar os pedidos.");
    if (ro.ok) setChamados(dO);
  }

  useEffect(() => {
    void Promise.all([fetch("/api/pedidos-compra"),fetch("/api/ocorrencias")])
      .then(async ([rp,ro]) => ({rp,ro,dp:await rp.json(),dO:await ro.json()}))
      .then(({rp,ro,dp,dO}) => {
        if (rp.ok) setPedidos(dp); else setErro(dp.detail ?? "Não foi possível carregar os pedidos.");
        if (ro.ok) setChamados(dO);
      });
  },[]);

  async function criar(evento:FormEvent) {
    evento.preventDefault(); setSalvando(true); setErro("");
    const resposta = await fetch("/api/pedidos-compra",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({item,quantidade:Number(quantidade),unidade,justificativa,valor_estimado:valor?Number(valor):null,ocorrencia_id:ocorrenciaId?Number(ocorrenciaId):null})});
    const dados = await resposta.json(); setSalvando(false);
    if (!resposta.ok) { setErro(dados.detail ?? "Não foi possível criar o pedido."); return; }
    setItem(""); setJustificativa(""); setValor(""); setOcorrenciaId(""); await carregar();
  }

  async function avancar(pedido:Pedido) {
    const novo = pedido.status === "create" ? "ongoing" : "done";
    const observacao = window.prompt("Observação (opcional):") || null;
    const resposta = await fetch(`/api/pedidos-compra/${pedido.id}/status`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:novo,observacao})});
    if (!resposta.ok) { const dados=await resposta.json(); setErro(dados.detail??"Não foi possível atualizar o pedido."); return; }
    await carregar();
  }

  return <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl"><Navbar/><Titulo texto="Pedidos de compra" subtitulo="Solicitações vinculáveis a chamados, com entrada automática no estoque ao concluir."/>
    <form onSubmit={criar} className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-6">
      <input required value={item} onChange={e=>setItem(e.target.value)} placeholder="Item solicitado" className="input md:col-span-2"/>
      <input required min="0.001" step="0.001" type="number" value={quantidade} onChange={e=>setQuantidade(e.target.value)} className="input"/>
      <input required value={unidade} onChange={e=>setUnidade(e.target.value)} placeholder="Unidade" className="input"/>
      <input min="0" step="0.01" type="number" value={valor} onChange={e=>setValor(e.target.value)} placeholder="Valor estimado" className="input md:col-span-2"/>
      <select value={ocorrenciaId} onChange={e=>setOcorrenciaId(e.target.value)} className="input md:col-span-2"><option value="">Sem chamado relacionado</option>{chamados.map(c=><option key={c.id} value={c.id}>#{c.id} · {c.titulo}</option>)}</select>
      <textarea required value={justificativa} onChange={e=>setJustificativa(e.target.value)} placeholder="Justificativa" className="input md:col-span-3"/>
      <button disabled={salvando} className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{salvando?"Enviando...":"Criar pedido"}</button>
    </form>
    {erro&&<p className="mt-4 rounded-xl bg-rose-50 p-4 text-rose-700">{erro}</p>}
    <div className="mt-6 space-y-4">{pedidos.map(p=><details key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer list-none"><div className="flex flex-wrap justify-between gap-3"><div><b>#{p.id} · {p.item}</b><p className="mt-1 text-sm text-slate-500">{p.quantidade} {p.unidade} · por {p.solicitante_nome} · {new Date(p.criado_em).toLocaleDateString("pt-BR")}</p>{p.ocorrencia_id&&<p className="mt-1 text-xs font-bold text-blue-700">Chamado #{p.ocorrencia_id}</p>}</div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">{rotulos[p.status]}</span></div></summary><p className="mt-4 text-sm text-slate-700">{p.justificativa}</p>{p.valor_estimado!=null&&<p className="mt-1 text-sm">Estimativa: {p.valor_estimado.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>}{p.pode_gerenciar&&p.status!=="done"&&<button onClick={()=>void avancar(p)} className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">{p.status==="create"?"Iniciar pedido":"Concluir e adicionar ao estoque"}</button>}<div className="mt-5 border-t border-slate-100 pt-4"><b className="text-sm">Histórico</b>{p.historico.map(h=><p key={h.id} className="mt-2 text-xs text-slate-500">{new Date(h.criado_em).toLocaleString("pt-BR")} · {rotulos[h.status as keyof typeof rotulos]??h.status} · {h.autor_nome}{h.observacao?` — ${h.observacao}`:""}</p>)}</div></details>)}</div>
  </div></main>;
}
