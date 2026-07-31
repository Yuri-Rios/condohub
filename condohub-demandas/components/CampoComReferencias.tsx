"use client";

import { forwardRef, useEffect, useMemo, useState, type TextareaHTMLAttributes } from "react";

type Opcao = { id:number; nome:string; avatar_url?:string|null };
type Referencias = { pessoas:Opcao[]; chamados:Opcao[]; pedidos:Opcao[] };
let referenciasCache: Promise<Referencias> | null = null;

function carregarReferencias() {
  referenciasCache ??= fetch("/api/referencias",{cache:"no-store"}).then(r => r.ok ? r.json() : {pessoas:[],chamados:[],pedidos:[]});
  return referenciasCache;
}

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>,"value"|"onChange"> & { value:string; onChange:(valor:string)=>void; containerClassName?:string };

const CampoComReferencias = forwardRef<HTMLTextAreaElement,Props>(function CampoComReferencias({value,onChange,className,containerClassName,...props},ref) {
  const [referencias,setReferencias] = useState<Referencias>({pessoas:[],chamados:[],pedidos:[]});
  const [cursor,setCursor] = useState(value.length);
  const [ativo,setAtivo] = useState(0);
  useEffect(()=>{let montado=true;void carregarReferencias().then(d=>{if(montado)setReferencias(d)});return()=>{montado=false}},[]);
  const busca = useMemo(()=>value.slice(0,cursor).match(/(^|\s)([@#$])([^\s@#$]*)$/),[value,cursor]);
  const gatilho = busca?.[2]; const termo=(busca?.[3]??"").toLocaleLowerCase("pt-BR");
  const fonte = gatilho==="@"?referencias.pessoas:gatilho==="#"?referencias.chamados:gatilho==="$"?referencias.pedidos:[];
  const opcoes = fonte.filter(o=>`${o.id} ${o.nome}`.toLocaleLowerCase("pt-BR").includes(termo)).slice(0,8);

  function selecionar(opcao:Opcao) {
    if (!busca || !gatilho) return;
    const inicio=cursor-(busca[2].length+busca[3].length);
    const tipo=gatilho==="@"?"pessoa":gatilho==="#"?"chamado":"pedido";
    const nome=opcao.nome.replace(/[\[\]()]/g,"");
    const token=`${gatilho}[${nome}](${tipo}:${opcao.id}) `;
    onChange(value.slice(0,inicio)+token+value.slice(cursor));
    setCursor(inicio+token.length);setAtivo(0);
  }

  return <div className={`relative ${containerClassName??""}`}>
    <textarea {...props} ref={ref} value={value} onChange={e=>{onChange(e.target.value);setCursor(e.target.selectionStart)}} onClick={e=>setCursor(e.currentTarget.selectionStart)} onKeyUp={e=>setCursor(e.currentTarget.selectionStart)} onKeyDown={e=>{if(!opcoes.length)return;if(e.key==="ArrowDown"){e.preventDefault();setAtivo(a=>(a+1)%opcoes.length)}else if(e.key==="ArrowUp"){e.preventDefault();setAtivo(a=>(a-1+opcoes.length)%opcoes.length)}else if(e.key==="Enter"&&busca){e.preventDefault();selecionar(opcoes[ativo]??opcoes[0])}else if(e.key==="Escape"){setCursor(-1)}}} className={className}/>
    {busca&&opcoes.length>0&&<div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{opcoes.map((o,i)=><button key={o.id} type="button" onMouseDown={e=>{e.preventDefault();selecionar(o)}} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${i===ativo?"bg-blue-50 text-blue-800":"hover:bg-slate-50"}`}><span className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">{gatilho}</span><span><b>{o.nome}</b><small className="ml-2 text-slate-400">{gatilho}{o.id}</small></span></button>)}</div>}
  </div>;
});
export default CampoComReferencias;
