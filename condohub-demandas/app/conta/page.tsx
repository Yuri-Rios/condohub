"use client";

import { useState } from "react";

import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";

export default function ContaPage() {
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  async function excluirConta() {
    if (confirmacao !== "EXCLUIR") return;
    setExcluindo(true);
    setErro("");

    const resposta = await fetch("/api/conta", { method: "DELETE" });
    if (resposta.ok) {
      window.location.assign("/conta-excluida");
      return;
    }

    const dados = (await resposta.json().catch(() => null)) as
      | { detail?: string }
      | null;
    setErro(dados?.detail ?? "Não foi possível excluir a conta.");
    setExcluindo(false);
  }

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Navbar />
        <Titulo
          texto="Minha conta"
          subtitulo="Privacidade, suporte e controle dos seus dados."
        />

        <section className="mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-slate-950">Excluir conta</h2>
          <p className="mt-3 leading-7 text-slate-600">
            A exclusão remove seu login, vínculos com condomínios, reservas,
            reações e solicitações de acesso. Registros operacionais
            compartilhados, como ocorrências e históricos administrativos, são
            mantidos sem seu nome, foto ou identificador para preservar a
            integridade dos registros do condomínio.
          </p>
          <p className="mt-3 font-semibold text-rose-700">
            Esta ação é definitiva e não pode ser desfeita.
          </p>

          <label className="mt-6 block">
            <span className="text-sm font-semibold text-slate-700">
              Digite EXCLUIR para confirmar
            </span>
            <input
              value={confirmacao}
              onChange={(evento) => setConfirmacao(evento.target.value)}
              autoComplete="off"
              className="input mt-2"
              aria-describedby={erro ? "erro-exclusao" : undefined}
            />
          </label>

          {erro && (
            <p id="erro-exclusao" role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-rose-700">
              {erro}
            </p>
          )}

          <button
            type="button"
            disabled={confirmacao !== "EXCLUIR" || excluindo}
            onClick={() => void excluirConta()}
            className="mt-5 rounded-xl bg-rose-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {excluindo ? "Excluindo conta…" : "Excluir minha conta definitivamente"}
          </button>
        </section>
      </div>
    </main>
  );
}
