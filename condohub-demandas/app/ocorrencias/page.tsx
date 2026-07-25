"use client";

import { useEffect, useState } from "react";

import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";

type Ocorrencia = {
  id: number;
  titulo: string;
  local: string;
  descricao: string;
  data_solicitacao: string;
};

function calcularDias(dataSolicitacao: string) {
  const dataInicial = new Date(dataSolicitacao);
  const hoje = new Date();

  const formatador = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  function inicioDoDia(data: Date) {
    const partes = formatador.formatToParts(data);
    const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
      Number(partes.find((parte) => parte.type === tipo)?.value);

    return Date.UTC(valor("year"), valor("month") - 1, valor("day"));
  }

  const diferenca = inicioDoDia(hoje) - inicioDoDia(dataInicial);
  return Math.max(0, Math.floor(diferenca / (1000 * 60 * 60 * 24)));
}

export default function OcorrenciasPage() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarOcorrencias() {
      try {
        const resposta = await fetch("/api/ocorrencias");

        if (!resposta.ok) {
          throw new Error("Não foi possível carregar as ocorrências.");
        }

        setOcorrencias(await resposta.json());
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro inesperado.");
      } finally {
        setCarregando(false);
      }
    }

    carregarOcorrencias();
  }, []);

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
      <Navbar />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <Titulo
          texto="Chamados"
          subtitulo="Acompanhe as solicitações registradas no condomínio."
        />
        {!carregando && !erro && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
            {ocorrencias.length} {ocorrencias.length === 1 ? "chamado" : "chamados"}
          </div>
        )}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
        {carregando ? (
          <div className="flex items-center gap-3 p-8 text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            Carregando chamados...
          </div>
        ) : erro ? (
          <p className="m-5 rounded-xl bg-rose-50 p-4 text-rose-700">{erro}</p>
        ) : ocorrencias.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-xl">✓</div>
            <h2 className="mt-4 font-semibold text-slate-900">Tudo tranquilo por aqui</h2>
            <p className="mt-1 text-sm text-slate-500">Nenhum chamado foi registrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Protocolo</th>
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Chamado</th>
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Local</th>
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Aberto há</th>
              </tr>
            </thead>

            <tbody>
              {ocorrencias.map((ocorrencia) => (
                <tr key={ocorrencia.id} className="border-b border-slate-100 last:border-0 hover:bg-blue-50/30">
                  <td className="px-5 py-4 font-mono text-sm text-slate-500">#{String(ocorrencia.id).padStart(4, "0")}</td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{ocorrencia.titulo}</td>
                  <td className="px-5 py-4 text-slate-600">{ocorrencia.local}</td>
                  <td className="px-5 py-4">
                    <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {calcularDias(ocorrencia.data_solicitacao)} dias
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
      </div>
    </main>
  );
}
