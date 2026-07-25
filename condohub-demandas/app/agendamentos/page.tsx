"use client";

import { useEffect, useMemo, useState } from "react";

import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";

type Ambiente = "piscina_deck" | "salao_festas";
type Reserva = {
  id: number | null;
  ambiente: Ambiente;
  inicio: string;
  fim: string;
  minha: boolean;
};

const ambientes: Array<{ id: Ambiente; nome: string; detalhe: string }> = [
  {
    id: "piscina_deck",
    nome: "Piscina / Deck",
    detalhe: "Área externa e deck da piscina",
  },
  {
    id: "salao_festas",
    nome: "Salão de festas",
    detalhe: "Espaço interno para comemorações",
  },
];
const horas = [8, 10, 12, 14, 16, 18, 20];
const fuso = "America/Fortaleza";

function dataFortaleza(data = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
}

function somarDias(data: string, quantidade: number) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const resultado = new Date(Date.UTC(ano, mes - 1, dia + quantidade, 12));
  return resultado.toISOString().slice(0, 10);
}

function isoDoHorario(data: string, hora: number) {
  return `${data}T${String(hora).padStart(2, "0")}:00:00-03:00`;
}

function chaveDoHorario(valor: string) {
  const data = new Date(valor);
  const dataLocal = dataFortaleza(data);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    hour: "2-digit",
    hour12: false,
  }).format(data);
  return `${dataLocal}-${hora}`;
}

async function detalheDoErro(resposta: Response, padrao: string) {
  const dados = await resposta.json().catch(() => null);
  return dados?.detail ?? padrao;
}

export default function AgendamentosPage() {
  const hoje = useMemo(() => dataFortaleza(), []);
  const [inicioSemana, setInicioSemana] = useState(hoje);
  const [ambiente, setAmbiente] = useState<Ambiente>("piscina_deck");
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [selecionada, setSelecionada] = useState<Reserva | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, indice) => somarDias(inicioSemana, indice)),
    [inicioSemana],
  );
  const reservasPorHorario = useMemo(
    () =>
      new Map(
        reservas
          .filter((reserva) => reserva.ambiente === ambiente)
          .map((reserva) => [chaveDoHorario(reserva.inicio), reserva]),
      ),
    [ambiente, reservas],
  );

  async function carregarReservas() {
    setCarregando(true);
    setErro("");
    const inicio = isoDoHorario(inicioSemana, 0);
    const fim = isoDoHorario(somarDias(inicioSemana, 7), 0);
    const resposta = await fetch(
      `/api/reservas?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`,
    );
    if (!resposta.ok) {
      setErro(await detalheDoErro(resposta, "Não foi possível carregar a agenda."));
      setReservas([]);
    } else {
      setReservas(await resposta.json());
    }
    setCarregando(false);
  }

  useEffect(() => {
    let ativo = true;
    async function carregarJanela() {
      const inicio = isoDoHorario(inicioSemana, 0);
      const fim = isoDoHorario(somarDias(inicioSemana, 7), 0);
      const resposta = await fetch(
        `/api/reservas?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`,
      );
      if (!ativo) return;
      if (!resposta.ok) {
        setErro(
          await detalheDoErro(resposta, "Não foi possível carregar a agenda."),
        );
        setReservas([]);
      } else {
        setReservas(await resposta.json());
      }
      setCarregando(false);
    }
    void carregarJanela();
    return () => {
      ativo = false;
    };
  }, [inicioSemana]);

  function trocarSemana(dias: number) {
    setCarregando(true);
    setErro("");
    setAviso("");
    setSelecionada(null);
    setInicioSemana((atual) => somarDias(atual, dias));
  }

  async function reservar(data: string, hora: number) {
    const inicio = isoDoHorario(data, hora);
    const chave = `${data}-${String(hora).padStart(2, "0")}`;
    setProcessando(chave);
    setErro("");
    setAviso("");

    const reagendando = selecionada?.id != null;
    const resposta = await fetch(
      reagendando ? `/api/reservas/${selecionada.id}` : "/api/reservas",
      {
        method: reagendando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          reagendando ? { inicio } : { ambiente, inicio },
        ),
      },
    );
    setProcessando("");
    if (!resposta.ok) {
      setErro(
        await detalheDoErro(
          resposta,
          reagendando
            ? "Não foi possível reagendar."
            : "Não foi possível fazer a reserva.",
        ),
      );
      await carregarReservas();
      return;
    }

    setAviso(reagendando ? "Reserva reagendada." : "Horário reservado.");
    setSelecionada(null);
    await carregarReservas();
  }

  async function cancelar() {
    if (selecionada?.id == null) return;
    if (!window.confirm("Cancelar esta reserva? O horário ficará livre.")) return;

    setProcessando(`cancelar-${selecionada.id}`);
    setErro("");
    const resposta = await fetch(`/api/reservas/${selecionada.id}`, {
      method: "DELETE",
    });
    setProcessando("");
    if (!resposta.ok) {
      setErro(await detalheDoErro(resposta, "Não foi possível cancelar."));
      return;
    }
    setAviso("Reserva cancelada.");
    setSelecionada(null);
    await carregarReservas();
  }

  function trocarAmbiente(novoAmbiente: Ambiente) {
    setAmbiente(novoAmbiente);
    setSelecionada(null);
    setErro("");
    setAviso("");
  }

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Navbar />
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <Titulo
            texto="Agendamentos"
            subtitulo="Escolha um ambiente e reserve um horário livre. A ocupação dos demais moradores permanece anônima."
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={inicioSemana === hoje}
              onClick={() => trocarSemana(-7)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Anterior
            </button>
            <button
              type="button"
              onClick={() => trocarSemana(7)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:border-blue-300 hover:text-blue-700"
            >
              Próxima →
            </button>
          </div>
        </div>

        <section className="mb-5 grid gap-3 sm:grid-cols-2">
          {ambientes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => trocarAmbiente(item.id)}
              className={`rounded-2xl border p-5 text-left shadow-sm ${
                ambiente === item.id
                  ? "border-blue-500 bg-blue-600 text-white shadow-blue-100"
                  : "border-white bg-white text-slate-900 hover:border-blue-200"
              }`}
            >
              <span className="block text-lg font-bold">{item.nome}</span>
              <span
                className={`mt-1 block text-sm ${
                  ambiente === item.id ? "text-blue-100" : "text-slate-500"
                }`}
              >
                {item.detalhe}
              </span>
            </button>
          ))}
        </section>

        {(erro || aviso) && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              erro
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {erro || aviso}
          </div>
        )}

        {selecionada && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-blue-950">Sua reserva está selecionada</p>
              <p className="text-sm text-blue-700">
                Clique em outro horário livre para reagendar ou cancele a reserva.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelecionada(null)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                Manter reserva
              </button>
              <button
                type="button"
                disabled={processando.startsWith("cancelar-")}
                onClick={() => void cancelar()}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-white bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full table-fixed border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="w-24 px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Horário
                  </th>
                  {dias.map((dia) => (
                    <th key={dia} className="px-2 py-4 text-center">
                      <span className="block text-xs font-bold uppercase text-slate-400">
                        {new Intl.DateTimeFormat("pt-BR", {
                          weekday: "short",
                          timeZone: "UTC",
                        }).format(new Date(`${dia}T12:00:00Z`))}
                      </span>
                      <span className="mt-1 block text-sm font-bold text-slate-800">
                        {new Intl.DateTimeFormat("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          timeZone: "UTC",
                        }).format(new Date(`${dia}T12:00:00Z`))}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {horas.map((hora) => (
                  <tr key={hora} className="border-b border-slate-100 last:border-0">
                    <th className="px-3 py-3 text-left text-sm font-semibold text-slate-600">
                      {String(hora).padStart(2, "0")}:00
                      <span className="block text-xs font-normal text-slate-400">
                        até {String(hora + 2).padStart(2, "0")}:00
                      </span>
                    </th>
                    {dias.map((dia) => {
                      const chave = `${dia}-${String(hora).padStart(2, "0")}`;
                      const reserva = reservasPorHorario.get(chave);
                      const passado =
                        new Date(isoDoHorario(dia, hora)).getTime() <= Date.now();
                      const minha = reserva?.minha === true;
                      return (
                        <td key={chave} className="p-2">
                          <button
                            type="button"
                            disabled={
                              carregando ||
                              processando !== "" ||
                              passado ||
                              (!!reserva && !minha)
                            }
                            onClick={() => {
                              if (minha) {
                                setSelecionada(
                                  selecionada?.id === reserva.id ? null : reserva,
                                );
                              } else {
                                void reservar(dia, hora);
                              }
                            }}
                            className={`min-h-14 w-full rounded-xl border px-2 py-2 text-xs font-bold ${
                              minha
                                ? selecionada?.id === reserva.id
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                : reserva
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                  : passado
                                    ? "cursor-not-allowed border-transparent bg-slate-50 text-slate-300"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100"
                            }`}
                          >
                            {processando === chave
                              ? "Salvando..."
                              : minha
                                ? "Sua reserva"
                                : reserva
                                  ? "Ocupado"
                                  : passado
                                    ? "Encerrado"
                                    : selecionada
                                      ? "Reagendar aqui"
                                      : "Livre"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {carregando && (
            <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
              Carregando horários...
            </p>
          )}
        </section>
        <p className="mt-4 text-center text-xs text-slate-500">
          Cada reserva ocupa um período de 2 horas. Horários disponíveis das 08:00 às 22:00.
        </p>
      </div>
    </main>
  );
}
