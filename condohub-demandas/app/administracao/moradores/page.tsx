"use client";

import { useEffect, useMemo, useState } from "react";

import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";

type Morador = {
  id: number;
  nome: string;
  avatar_url: string | null;
  bloco: string | null;
  apartamento: string | null;
  papeis: string[];
  status: string;
  criado_em: string;
};

const nomesDosPapeis: Record<string, string> = {
  morador: "Morador(a)",
  sindico: "Síndico",
  subsindico: "Subsíndico",
  funcionario: "Funcionário",
  admin: "Admin",
};

export default function MoradoresPage() {
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const resposta = await fetch("/api/moradores", { cache: "no-store" });
      const dados = await resposta.json();
      if (!ativo) return;
      if (!resposta.ok) {
        setErro(dados.detail ?? "Não foi possível carregar os moradores.");
      } else {
        setMoradores(dados);
      }
      setCarregando(false);
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, []);

  const moradoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return moradores;
    return moradores.filter((morador) =>
      [
        morador.nome,
        morador.bloco ?? "",
        morador.apartamento ?? "",
        ...morador.papeis.map((papel) => nomesDosPapeis[papel] ?? papel),
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(termo),
    );
  }, [busca, moradores]);

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Navbar />

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <Titulo
            texto="Moradores"
            subtitulo="Consulte os moradores cadastrados no condomínio ativo."
          />
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800">
            {moradores.length}{" "}
            {moradores.length === 1 ? "morador" : "moradores"}
          </div>
        </div>

        <div className="mt-7 rounded-2xl border border-white bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <label className="relative block">
            <span className="sr-only">Buscar moradores</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m16 16 4 4" />
            </svg>
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por nome, bloco ou apartamento"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>

        {erro && (
          <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            {erro}
          </p>
        )}

        <section className="mt-5 overflow-hidden rounded-2xl border border-white bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
          {carregando ? (
            <p className="p-8 text-center text-slate-500">
              Carregando moradores...
            </p>
          ) : moradoresFiltrados.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-xl text-slate-500">
                ○
              </div>
              <h2 className="mt-4 font-bold text-slate-900">
                Nenhum morador encontrado
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Tente outra busca ou aprove uma solicitação de acesso.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-4">Morador</th>
                    <th className="px-5 py-4">Bloco</th>
                    <th className="px-5 py-4">Apartamento</th>
                    <th className="px-5 py-4">Papéis</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {moradoresFiltrados.map((morador) => (
                    <tr
                      key={morador.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            style={
                              morador.avatar_url
                                ? {
                                    backgroundImage: `url("${morador.avatar_url}")`,
                                  }
                                : undefined
                            }
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-100 to-sky-100 bg-cover bg-center font-bold text-blue-700"
                            aria-label={`Foto de ${morador.nome}`}
                          >
                            {!morador.avatar_url &&
                              morador.nome.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {morador.nome}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {morador.bloco ?? "—"}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {morador.apartamento ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {morador.papeis.map((papel) => (
                            <span
                              key={papel}
                              className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                            >
                              {nomesDosPapeis[papel] ?? papel}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            morador.status === "ativo"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {morador.status === "ativo" ? "Ativo" : morador.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
