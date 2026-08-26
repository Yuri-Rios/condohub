"use client";

import { useEffect, useState } from "react";

import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";

type EtapaPublica = {
  id: number;
  ordem: number;
  titulo: string;
  inicio_previsto: string;
  fim_previsto: string;
  status: "nao_iniciada" | "em_andamento" | "concluida" | "atrasada" | "bloqueada";
};

type Acompanhamento = {
  id: number;
  titulo: string;
  categoria: string;
  objetivo: string;
  inicio_previsto: string;
  fim_previsto: string;
  progresso: number;
  ultima_atualizacao: string | null;
  atualizado_em: string;
  etapas: EtapaPublica[];
};

const situacoes: Record<EtapaPublica["status"], { nome: string; simbolo: string; classe: string }> = {
  nao_iniciada: { nome: "Não iniciada", simbolo: "○", classe: "bg-slate-100 text-slate-600" },
  em_andamento: { nome: "Em andamento", simbolo: "●", classe: "bg-blue-50 text-blue-700" },
  concluida: { nome: "Concluída", simbolo: "✓", classe: "bg-emerald-50 text-emerald-700" },
  atrasada: { nome: "Atrasada", simbolo: "!", classe: "bg-rose-50 text-rose-700" },
  bloqueada: { nome: "Bloqueada", simbolo: "×", classe: "bg-amber-50 text-amber-700" },
};

function dataCurta(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${valor}T12:00:00Z`));
}

function dataAtualizacao(valor: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(valor));
}

const DIA = 86_400_000;
function dataUtc(valor:string){return new Date(`${valor}T00:00:00Z`).getTime()}

function GraficoGantt({itens,hoje}:{itens:Acompanhamento[];hoje:number}) {
  const etapas=itens.flatMap(item=>item.etapas);
  if(!etapas.length)return null;
  const inicio=Math.min(...etapas.map(etapa=>dataUtc(etapa.inicio_previsto)));
  const fim=Math.max(...etapas.map(etapa=>dataUtc(etapa.fim_previsto)));
  const totalDias=Math.max(1,Math.round((fim-inicio)/DIA)+1);
  const largura=Math.max(900,totalDias*9);
  const posicao=(valor:string)=>((dataUtc(valor)-inicio)/(totalDias*DIA))*100;
  const duracao=(de:string,ate:string)=>Math.max(0.8,((dataUtc(ate)-dataUtc(de)+DIA)/(totalDias*DIA))*100);
  const meses:Array<{rotulo:string;esquerda:number}> = [];
  const cursor=new Date(inicio); cursor.setUTCDate(1);
  while(cursor.getTime()<=fim){meses.push({rotulo:cursor.toLocaleDateString("pt-BR",{timeZone:"UTC",month:"short",year:"2-digit"}),esquerda:((cursor.getTime()-inicio)/(totalDias*DIA))*100});cursor.setUTCMonth(cursor.getUTCMonth()+1)}
  const hojeVisivel=hoje>=inicio&&hoje<=fim+DIA;
  const cores:Record<EtapaPublica["status"],string>={nao_iniciada:"bg-slate-400",em_andamento:"bg-blue-600",concluida:"bg-emerald-500",atrasada:"bg-rose-500",bloqueada:"bg-amber-500"};
  return <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold text-slate-950">Visão geral dos cronogramas</h2><p className="mt-1 text-sm text-slate-500">Etapas reunidas em uma única linha do tempo. Deslize horizontalmente para consultar todo o período.</p></div><div className="flex flex-wrap gap-2 text-[11px] font-semibold">{(["nao_iniciada","em_andamento","concluida","atrasada","bloqueada"] as const).map(status=><span key={status} className="flex items-center gap-1.5 text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${cores[status]}`}/>{situacoes[status].nome}</span>)}</div></div><div className="overflow-x-auto"><div className="grid" style={{gridTemplateColumns:`300px ${largura}px`,minWidth:`${largura+300}px`}}><div className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold uppercase tracking-wide text-slate-600">Processo / etapa</div><div className="relative h-[53px] border-b border-slate-200 bg-slate-50">{meses.map(m=><span key={`${m.rotulo}-${m.esquerda}`} className="absolute inset-y-0 border-l border-slate-200 pl-3 pt-4 text-sm font-semibold capitalize text-slate-600" style={{left:`${Math.max(0,m.esquerda)}%`}}>{m.rotulo}</span>)}</div>{itens.flatMap(item=>[<div key={`titulo-${item.id}`} className="sticky left-0 z-20 flex min-h-[76px] flex-col justify-center border-b border-r border-slate-200 bg-blue-50 px-5 py-4"><p className="whitespace-normal break-words text-base font-bold leading-6 text-blue-950">{item.titulo}</p><p className="mt-1.5 text-xs font-medium text-blue-700">{item.progresso}% concluído</p></div>,<div key={`linha-${item.id}`} className="relative min-h-[76px] border-b border-slate-200 bg-blue-50/40"><div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full bg-blue-200" style={{left:`${posicao(item.inicio_previsto)}%`,width:`${duracao(item.inicio_previsto,item.fim_previsto)}%`}}/>{hojeVisivel&&<span className="absolute inset-y-0 z-10 border-l-2 border-dashed border-violet-500" style={{left:`${((hoje-inicio)/(totalDias*DIA))*100}%`}}/>}</div>,...item.etapas.flatMap(etapa=>[<div key={`nome-${etapa.id}`} className="sticky left-0 z-20 flex min-h-16 items-center border-b border-r border-slate-100 bg-white px-5 py-3 text-sm font-medium text-slate-700"><span className={`mr-3 h-2.5 w-2.5 shrink-0 rounded-full ${cores[etapa.status]}`}/><span className="whitespace-normal break-words leading-5.5">{etapa.titulo}</span></div>,<div key={`etapa-${etapa.id}`} className="relative min-h-16 border-b border-slate-100 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px)] bg-[size:9px_100%]"><div title={`${etapa.titulo}: ${dataCurta(etapa.inicio_previsto)} a ${dataCurta(etapa.fim_previsto)}`} className={`absolute top-1/2 h-5 -translate-y-1/2 rounded-md shadow-sm ${cores[etapa.status]}`} style={{left:`${posicao(etapa.inicio_previsto)}%`,width:`${duracao(etapa.inicio_previsto,etapa.fim_previsto)}%`}}/>{hojeVisivel&&<span className="absolute inset-y-0 z-10 border-l-2 border-dashed border-violet-500" style={{left:`${((hoje-inicio)/(totalDias*DIA))*100}%`}}/>}</div>])])}</div></div><div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Período: {dataCurta(new Date(inicio).toISOString().slice(0,10))} a {dataCurta(new Date(fim).toISOString().slice(0,10))}{hojeVisivel&&<span className="ml-3 text-violet-700">┊ Hoje</span>}</div></section>
}

export default function AcompanhamentoPage() {
  const [hoje] = useState(() => Date.now());
  const [itens, setItens] = useState<Acompanhamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    void fetch("/api/acompanhamento", { cache: "no-store" }).then(async (resposta) => {
      if (!ativo) return;
      if (resposta.ok) setItens(await resposta.json());
      else setErro("Não foi possível carregar o acompanhamento.");
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, []);

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <Navbar />
        <Titulo texto="Acompanhamento" subtitulo="Veja o andamento das melhorias, manutenções e projetos do condomínio." />

        {erro && <div role="alert" className="mt-7 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>}
        {carregando ? <p className="mt-8 text-sm text-slate-500">Carregando atualizações...</p> : itens.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center">
            <p className="text-lg font-bold text-slate-900">Nenhum acompanhamento publicado</p>
            <p className="mt-2 text-sm text-slate-500">Quando a gestão publicar um cronograma, ele aparecerá aqui.</p>
          </section>
        ) : <><GraficoGantt itens={itens} hoje={hoje}/><section className="mt-8 grid gap-6">{itens.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-2xl border border-white bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
            <div className="p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><span className="text-xs font-bold uppercase tracking-wide text-blue-600">{item.categoria}</span><h2 className="mt-1 text-xl font-bold text-slate-950">{item.titulo}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{item.objetivo}</p></div><strong className="text-2xl text-blue-700">{item.progresso}%</strong></div>
              <div className="mt-5"><div className="h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Progresso de ${item.titulo}`} aria-valuenow={item.progresso} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-blue-600" style={{ width: `${item.progresso}%` }} /></div><p className="mt-2 text-xs text-slate-500">Previsto de {dataCurta(item.inicio_previsto)} a {dataCurta(item.fim_previsto)}</p></div>

              <ol className="mt-7 grid gap-1">{item.etapas.map((etapa) => { const situacao = situacoes[etapa.status]; return <li key={etapa.id} className="flex gap-3 py-3"><span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${situacao.classe}`}>{situacao.simbolo}</span><div className="min-w-0 flex-1 border-b border-slate-100 pb-3"><div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center"><p className="font-semibold text-slate-800">{etapa.titulo}</p><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${situacao.classe}`}>{situacao.nome}</span></div><p className="mt-1 text-xs text-slate-500">{dataCurta(etapa.inicio_previsto)} – {dataCurta(etapa.fim_previsto)}</p></div></li>; })}</ol>
            </div>
            {item.ultima_atualizacao && <footer className="border-t border-blue-100 bg-blue-50 px-5 py-4 sm:px-7"><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Última atualização</p><p className="mt-1 text-sm leading-6 text-blue-950">{item.ultima_atualizacao}</p><p className="mt-1 text-xs text-blue-600">{dataAtualizacao(item.atualizado_em)}</p></footer>}
          </article>
        ))}</section></>}
      </div>
    </main>
  );
}
