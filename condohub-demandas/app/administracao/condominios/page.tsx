"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";

type Condominio = {
  id: number;
  nome: string;
  slug: string;
  ativo: boolean;
};

export default function CondominiosPage() {
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const resposta = await fetch("/api/admin/condominios");
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível carregar os condomínios.");
      return;
    }
    setCondominios(dados);
  }, []);

  useEffect(() => {
    let ativo = true;
    async function carregarInicial() {
      const resposta = await fetch("/api/admin/condominios");
      const dados = await resposta.json();
      if (!ativo) return;
      if (!resposta.ok) {
        setErro(dados.detail ?? "Não foi possível carregar os condomínios.");
        return;
      }
      setCondominios(dados);
    }
    void carregarInicial();
    return () => {
      ativo = false;
    };
  }, []);

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSalvando(true);
    setErro("");
    const formulario = event.currentTarget;
    const dados = new FormData(formulario);
    const resposta = await fetch("/api/admin/condominios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: dados.get("nome"),
        slug: dados.get("slug"),
      }),
    });
    const retorno = await resposta.json();
    setSalvando(false);
    if (!resposta.ok) {
      setErro(
        typeof retorno.detail === "string"
          ? retorno.detail
          : retorno.detail?.[0]?.msg ?? "Não foi possível cadastrar.",
      );
      return;
    }
    formulario.reset();
    await carregar();
  }

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Navbar />
        <Titulo
          texto="Condomínios"
          subtitulo="Cadastre e acompanhe os condomínios atendidos pela plataforma."
        />

        {erro && (
          <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            {erro}
          </p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={cadastrar}
            className="h-fit space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold text-slate-950">
              Novo condomínio
            </h2>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Nome</span>
              <input
                name="nome"
                required
                placeholder="Ex.: Residencial Único"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Endereço no CondoHub
              </span>
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="residencial-unico"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Apenas letras minúsculas, números e hífens.
              </span>
            </label>
            <button
              disabled={salvando}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {salvando ? "Cadastrando..." : "Cadastrar condomínio"}
            </button>
          </form>

          <section className="space-y-3">
            {condominios.map((condominio) => (
              <article
                key={condominio.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
              >
                <div>
                  <h2 className="font-bold text-slate-950">{condominio.nome}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    /{condominio.slug}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {condominio.ativo ? "Ativo" : "Inativo"}
                  </span>
                  <Link
                    href={`/solicitar-acesso?condominio=${encodeURIComponent(condominio.slug)}`}
                    className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Link de acesso
                  </Link>
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
