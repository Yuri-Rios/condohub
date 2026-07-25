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
    <main className="min-h-screen bg-gray-100 p-6">
      <Navbar />

      <Titulo texto="Ocorrências" />

      <div className="mt-6 rounded-lg bg-white p-4 shadow">
        {carregando ? (
          <p className="text-gray-600">Carregando ocorrências...</p>
        ) : erro ? (
          <p className="text-red-700">{erro}</p>
        ) : ocorrencias.length === 0 ? (
          <p className="text-gray-600">Nenhuma ocorrência cadastrada.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="p-3 text-left">ID</th>
                <th className="p-3 text-left">Título</th>
                <th className="p-3 text-left">Local</th>
                <th className="p-3 text-left">Dias desde solicitação</th>
              </tr>
            </thead>

            <tbody>
              {ocorrencias.map((ocorrencia) => (
                <tr key={ocorrencia.id} className="border-b">
                  <td className="p-3">{ocorrencia.id}</td>
                  <td className="p-3">{ocorrencia.titulo}</td>
                  <td className="p-3">{ocorrencia.local}</td>
                  <td className="p-3">
                    {calcularDias(ocorrencia.data_solicitacao)} dias
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
