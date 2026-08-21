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

export default function AcompanhamentoPage() {
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
      <div className="mx-auto max-w-5xl">
        <Navbar />
        <Titulo texto="Acompanhamento" subtitulo="Veja o andamento das melhorias, manutenções e projetos do condomínio." />

        {erro && <div role="alert" className="mt-7 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div>}
        {carregando ? <p className="mt-8 text-sm text-slate-500">Carregando atualizações...</p> : itens.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-14 text-center">
            <p className="text-lg font-bold text-slate-900">Nenhum acompanhamento publicado</p>
            <p className="mt-2 text-sm text-slate-500">Quando a gestão publicar um cronograma, ele aparecerá aqui.</p>
          </section>
        ) : <section className="mt-8 grid gap-6">{itens.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-2xl border border-white bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
            <div className="p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><span className="text-xs font-bold uppercase tracking-wide text-blue-600">{item.categoria}</span><h2 className="mt-1 text-xl font-bold text-slate-950">{item.titulo}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{item.objetivo}</p></div><strong className="text-2xl text-blue-700">{item.progresso}%</strong></div>
              <div className="mt-5"><div className="h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Progresso de ${item.titulo}`} aria-valuenow={item.progresso} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-blue-600" style={{ width: `${item.progresso}%` }} /></div><p className="mt-2 text-xs text-slate-500">Previsto de {dataCurta(item.inicio_previsto)} a {dataCurta(item.fim_previsto)}</p></div>

              <ol className="mt-7 grid gap-1">{item.etapas.map((etapa) => { const situacao = situacoes[etapa.status]; return <li key={etapa.id} className="flex gap-3 py-3"><span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${situacao.classe}`}>{situacao.simbolo}</span><div className="min-w-0 flex-1 border-b border-slate-100 pb-3"><div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center"><p className="font-semibold text-slate-800">{etapa.titulo}</p><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${situacao.classe}`}>{situacao.nome}</span></div><p className="mt-1 text-xs text-slate-500">{dataCurta(etapa.inicio_previsto)} – {dataCurta(etapa.fim_previsto)}</p></div></li>; })}</ol>
            </div>
            {item.ultima_atualizacao && <footer className="border-t border-blue-100 bg-blue-50 px-5 py-4 sm:px-7"><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Última atualização</p><p className="mt-1 text-sm leading-6 text-blue-950">{item.ultima_atualizacao}</p><p className="mt-1 text-xs text-blue-600">{dataAtualizacao(item.atualizado_em)}</p></footer>}
          </article>
        ))}</section>}
      </div>
    </main>
  );
}
