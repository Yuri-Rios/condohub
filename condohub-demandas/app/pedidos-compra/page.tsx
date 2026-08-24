"use client";

import { useEffect, useState, type FormEvent } from "react";
import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";
import CampoComReferencias from "@/components/CampoComReferencias";
import TextoComReferencias from "@/components/TextoComReferencias";

type Historico = { id:number; status:string; observacao:string|null; autor_nome:string; criado_em:string };
type Anexo = { id:number; nome:string; mime_type:string; tamanho:number; url:string };
type Pedido = { id:number; ocorrencia_id:number|null; item:string; quantidade:number; unidade:string; justificativa:string; valor_estimado:number|null; data_compra:string; status:"create"|"ongoing"|"done"; solicitante_nome:string; criado_em:string; pode_gerenciar:boolean; pode_editar:boolean; pode_excluir:boolean; historico:Historico[]; anexos:Anexo[] };
type Chamado = { id:number; titulo:string };
const rotulos = { create:"Criado", ongoing:"Em andamento", done:"Concluído" };
const dataLocalHoje = () => { const agora = new Date(); agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset()); return agora.toISOString().slice(0,10); };

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
  const [dataCompra,setDataCompra] = useState(dataLocalHoje);
  const [ocorrenciaId,setOcorrenciaId] = useState("");
  const [fotos,setFotos] = useState<File[]>([]);

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
    const resposta = await fetch("/api/pedidos-compra",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({item,quantidade:Number(quantidade),unidade,justificativa,valor_estimado:valor?Number(valor):null,data_compra:dataCompra,ocorrencia_id:ocorrenciaId?Number(ocorrenciaId):null})});
    const dados = await resposta.json();
    if (!resposta.ok) { setSalvando(false); setErro(dados.detail ?? "Não foi possível criar o pedido."); return; }
    if (fotos.length) { const formulario = new FormData(); fotos.forEach((foto) => formulario.append("arquivos", foto)); const envio = await fetch(`/api/pedidos-compra/${dados.id}/anexos`, { method:"POST", body:formulario }); if (!envio.ok) { const falha=await envio.json().catch(()=>null); setErro(`O pedido foi criado, mas as fotos não foram enviadas. ${falha?.detail ?? "Verifique o armazenamento do condomínio."}`); } }
    setSalvando(false); setItem(""); setJustificativa(""); setValor(""); setDataCompra(dataLocalHoje()); setOcorrenciaId(""); setFotos([]); await carregar();
  }

  async function avancar(pedido:Pedido) {
    const novo = pedido.status === "create" ? "ongoing" : "done";
    const observacao = window.prompt("Observação (opcional):") || null;
    const resposta = await fetch(`/api/pedidos-compra/${pedido.id}/status`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:novo,observacao})});
    if (!resposta.ok) { const dados=await resposta.json(); setErro(dados.detail??"Não foi possível atualizar o pedido."); return; }
    await carregar();
  }

  async function editar(pedido:Pedido) {
    const novoItem=window.prompt("Item solicitado:",pedido.item); if(!novoItem)return;
    const novaQuantidade=Number(window.prompt("Quantidade:",String(pedido.quantidade))); if(!novaQuantidade)return;
    const novaUnidade=window.prompt("Unidade:",pedido.unidade); if(!novaUnidade)return;
    const novaJustificativa=window.prompt("Justificativa:",pedido.justificativa); if(!novaJustificativa)return;
    const novoValor=window.prompt("Valor estimado (opcional):",pedido.valor_estimado==null?"":String(pedido.valor_estimado));
    const novaData=window.prompt("Data da compra (AAAA-MM-DD):",pedido.data_compra); if(!novaData)return;
    const novoChamado=window.prompt("Número da ocorrência relacionada (opcional):",pedido.ocorrencia_id==null?"":String(pedido.ocorrencia_id));
    const resposta=await fetch(`/api/pedidos-compra/${pedido.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({item:novoItem,quantidade:novaQuantidade,unidade:novaUnidade,justificativa:novaJustificativa,valor_estimado:novoValor?Number(novoValor):null,data_compra:novaData,ocorrencia_id:novoChamado?Number(novoChamado):null})});
    if(!resposta.ok){const dados=await resposta.json();setErro(dados.detail??"Não foi possível editar o pedido.");return}await carregar();
  }

  async function excluir(pedido:Pedido) {
    if(!window.confirm(`Excluir o pedido #${pedido.id} — ${pedido.item}?`))return;
    const resposta=await fetch(`/api/pedidos-compra/${pedido.id}`,{method:"DELETE"});
    if(!resposta.ok){const dados=await resposta.json();setErro(dados.detail??"Não foi possível excluir o pedido.");return}await carregar();
  }

  return <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl"><Navbar/><Titulo texto="Pedidos de compra" subtitulo="Solicitações vinculáveis a ocorrências, com entrada automática no estoque ao concluir."/>
    <form onSubmit={criar} className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-6">
      <input required value={item} onChange={e=>setItem(e.target.value)} placeholder="Item solicitado" className="input md:col-span-2"/>
      <input required min="0.001" step="0.001" type="number" value={quantidade} onChange={e=>setQuantidade(e.target.value)} className="input"/>
      <input required value={unidade} onChange={e=>setUnidade(e.target.value)} placeholder="Unidade" className="input"/>
      <input min="0" step="0.01" type="number" value={valor} onChange={e=>setValor(e.target.value)} placeholder="Valor estimado" className="input md:col-span-2"/>
      <label className="text-xs font-bold text-slate-600 md:col-span-2">Data da compra<input required type="date" value={dataCompra} onChange={e=>setDataCompra(e.target.value)} className="input mt-1 font-normal"/></label>
      <label className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 hover:border-blue-300 hover:bg-blue-50 md:col-span-2"><strong className="text-blue-700">Adicionar fotos</strong><span className="ml-2">{fotos.length ? `${fotos.length} selecionada(s)` : "produto, nota ou comprovante"}</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only" onChange={e=>{const selecionadas=Array.from(e.target.files??[]).slice(0,5);if(selecionadas.some(f=>f.size>8*1024*1024)){setErro("Cada foto pode ter no máximo 8 MB.");return}setFotos(selecionadas)}}/></label>
      <select value={ocorrenciaId} onChange={e=>setOcorrenciaId(e.target.value)} className="input md:col-span-2"><option value="">Sem ocorrência relacionada</option>{chamados.map(c=><option key={c.id} value={c.id}>#{c.id} · {c.titulo}</option>)}</select>
      <CampoComReferencias required value={justificativa} onChange={setJustificativa} placeholder="Justificativa — use #, @ ou $ para referenciar" containerClassName="md:col-span-3" className="input"/>
      <button disabled={salvando} className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{salvando?"Enviando...":"Criar pedido"}</button>
    </form>
    {erro&&<p className="mt-4 rounded-xl bg-rose-50 p-4 text-rose-700">{erro}</p>}
    <div className="mt-6 space-y-4">{pedidos.map(p=><details id={`pedido-${p.id}`} key={p.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer list-none"><div className="flex flex-wrap justify-between gap-3"><div><b>#{p.id} · {p.item}</b><p className="mt-1 text-sm text-slate-500">{p.quantidade} {p.unidade} · por {p.solicitante_nome} · compra em {new Date(`${p.data_compra}T12:00:00`).toLocaleDateString("pt-BR")}</p>{p.ocorrencia_id&&<a href={`/ocorrencias#chamado-${p.ocorrencia_id}`} className="mt-1 block text-xs font-bold text-blue-700 hover:underline">Ocorrência #{p.ocorrencia_id}</a>}</div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">{rotulos[p.status]}</span></div></summary><TextoComReferencias texto={p.justificativa} className="mt-4 block text-sm text-slate-700"/>{p.valor_estimado!=null&&<p className="mt-1 text-sm">Estimativa: {p.valor_estimado.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p>}{p.anexos?.length>0&&<div className="mt-4 flex flex-wrap gap-2">{p.anexos.map(a=><a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">📎 {a.nome}</a>)}</div>}<div className="mt-4 flex flex-wrap gap-2">{p.pode_gerenciar&&p.status!=="done"&&<button onClick={()=>void avancar(p)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">{p.status==="create"?"Iniciar pedido":"Concluir e adicionar ao estoque"}</button>}{p.pode_editar&&<button onClick={()=>void editar(p)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Editar</button>}{p.pode_excluir&&<button onClick={()=>void excluir(p)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Excluir</button>}</div><div className="mt-5 border-t border-slate-100 pt-4"><b className="text-sm">Histórico</b>{p.historico.map(h=><p key={h.id} className="mt-2 text-xs text-slate-500">{new Date(h.criado_em).toLocaleString("pt-BR")} · {rotulos[h.status as keyof typeof rotulos]??h.status} · {h.autor_nome}{h.observacao?` — ${h.observacao}`:""}</p>)}</div></details>)}</div>
  </div></main>;
}
