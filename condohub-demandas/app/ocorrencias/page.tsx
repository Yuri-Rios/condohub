"use client";

import { Fragment, useEffect, useState } from "react";

import Navbar from "@/components/Navbar";
import ThreadChamado from "@/components/ThreadChamado";
import Titulo from "@/components/Titulo";
import { aguardarApiPronta } from "@/src/lib/api-pronta";
import { useAcesso } from "@/src/hooks/useAcesso";

type Ocorrencia = {
  id: number;
  titulo: string;
  local: string;
  descricao: string;
  data_solicitacao: string;
  autor_nome: string | null;
  pode_editar: boolean;
  status: "novo" | "em_andamento" | "em_espera" | "fechado";
};

const statusChamado = {
  novo: { nome: "Novo", classe: "border-blue-500 bg-blue-50 text-blue-700" },
  em_andamento: {
    nome: "Em andamento",
    classe: "border-amber-500 bg-amber-50 text-amber-700",
  },
  em_espera: {
    nome: "Em espera",
    classe: "border-violet-500 bg-violet-50 text-violet-700",
  },
  fechado: {
    nome: "Fechado",
    classe: "border-emerald-500 bg-emerald-50 text-emerald-700",
  },
};

const MAXIMO_TENTATIVAS = 5;

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
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const acesso = useAcesso();
  const podeExcluir = acesso?.papeis.includes("admin") ?? false;

  async function excluirOcorrencia(id: number, titulo: string) {
    const confirmou = window.confirm(
      `Excluir definitivamente o chamado “${titulo}” e toda a conversa?`,
    );
    if (!confirmou) return;

    setExcluindoId(id);
    setErro("");
    const resposta = await fetch(`/api/ocorrencias/${id}`, {
      method: "DELETE",
    });
    setExcluindoId(null);

    if (!resposta.ok) {
      const dados = await resposta.json();
      setErro(dados.detail ?? "Não foi possível excluir o chamado.");
      return;
    }

    setOcorrencias((atuais) => atuais.filter((item) => item.id !== id));
    if (abertoId === id) setAbertoId(null);
  }

  useEffect(() => {
    async function carregarOcorrencias() {
      const apiPronta = await aguardarApiPronta();
      if (!apiPronta) {
        setErro("A API não conseguiu iniciar. Tente recarregar a página.");
        setCarregando(false);
        return;
      }

      for (
        let tentativa = 1;
        tentativa <= MAXIMO_TENTATIVAS;
        tentativa += 1
      ) {
        try {
          const resposta = await fetch("/api/ocorrencias", {
            cache: "no-store",
            signal: AbortSignal.timeout(20_000),
          });

          if (!resposta.ok) {
            const dados = (await resposta.json().catch(() => null)) as {
              detail?: string;
            } | null;
            throw new Error(
              dados?.detail ?? "Não foi possível carregar as ocorrências.",
            );
          }

          setOcorrencias(await resposta.json());
          setCarregando(false);
          return;
        } catch (error) {
          if (tentativa === MAXIMO_TENTATIVAS) {
            setErro(
              error instanceof Error ? error.message : "Erro inesperado.",
            );
            setCarregando(false);
            return;
          }

          await new Promise((resolver) => setTimeout(resolver, 3_000));
        }
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
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="whitespace-nowrap px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Aberto há</th>
              </tr>
            </thead>

            <tbody>
              {ocorrencias.map((ocorrencia) => {
                const aberto = abertoId === ocorrencia.id;
                return (
                  <Fragment key={ocorrencia.id}>
                    <tr
                      id={`chamado-${ocorrencia.id}`}
                      onClick={() => setAbertoId(aberto ? null : ocorrencia.id)}
                      className={`group cursor-pointer border-b border-slate-100 hover:bg-blue-50/40 ${aberto ? "bg-blue-50/50" : ""}`}
                    >
                      <td className="px-5 py-4 font-mono text-sm text-slate-500">#{String(ocorrencia.id).padStart(4, "0")}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs text-slate-400 transition-transform ${aberto ? "rotate-90" : ""}`}>▶</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900">{ocorrencia.titulo}</p>
                            {ocorrencia.autor_nome && (
                              <p className="mt-0.5 text-xs text-slate-400">
                                Aberto por {ocorrencia.autor_nome}
                              </p>
                            )}
                          </div>
                          {podeExcluir && (
                            <button
                              type="button"
                              disabled={excluindoId === ocorrencia.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void excluirOcorrencia(
                                  ocorrencia.id,
                                  ocorrencia.titulo,
                                );
                              }}
                              aria-label={`Excluir chamado ${ocorrencia.titulo}`}
                              title="Excluir chamado"
                              className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 opacity-0 hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100 disabled:opacity-40"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                className="h-4.5 w-4.5"
                                aria-hidden="true"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{ocorrencia.local}</td>
                      <td className="px-5 py-4">
                        <span className={`whitespace-nowrap border-b-2 px-2 py-1 text-xs font-bold ${statusChamado[ocorrencia.status].classe}`}>
                          {statusChamado[ocorrencia.status].nome}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          {calcularDias(ocorrencia.data_solicitacao)} dias
                        </span>
                      </td>
                    </tr>
                    {aberto && (
                      <tr className="border-b border-slate-200 bg-slate-50/70">
                        <td colSpan={5} className="px-5 py-5 sm:px-10">
                          <ThreadChamado
                            ocorrenciaId={ocorrencia.id}
                            onOcorrenciaAlterada={(dados) =>
                              setOcorrencias((atuais) =>
                                atuais.map((item) =>
                                  item.id === ocorrencia.id
                                    ? { ...item, ...dados }
                                    : item,
                                ),
                              )
                            }
                            onStatusAlterado={(status) =>
                              setOcorrencias((atuais) =>
                                atuais.map((item) =>
                                  item.id === ocorrencia.id
                                    ? { ...item, status }
                                    : item,
                                ),
                              )
                            }
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
      </div>
    </main>
  );
}
