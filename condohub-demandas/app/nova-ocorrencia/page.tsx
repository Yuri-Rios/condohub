"use client";

import { useState, type FormEvent } from "react";

import Titulo from "@/components/Titulo";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import Navbar from "@/components/Navbar";

export default function NovaOcorrenciaPage() {
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvarOcorrencia(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!titulo || !local || !descricao) {
      alert("Preencha todos os campos.");
      return;
    }

    setSalvando(true);

    try {
      const resposta = await fetch("/api/ocorrencias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ titulo, local, descricao }),
      });

      if (!resposta.ok) {
        throw new Error();
      }

      setTitulo("");
      setLocal("");
      setDescricao("");
      alert("Ocorrência salva com sucesso.");
    } catch {
      alert("Erro ao salvar. Verifique sua sessão e tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
      <Navbar />

      <Titulo
        texto="Novo chamado"
        subtitulo="Conte o que aconteceu e informe onde a equipe deve verificar."
      />

      <form
        onSubmit={salvarOcorrencia}
        className="mt-8 max-w-2xl space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-8"
      >
        <Input
          label="Título"
          placeholder="Ex.: Vazamento próximo ao portão"
          value={titulo}
          onChange={setTitulo}
        />

        <Input
          label="Local"
          placeholder="Ex.: Garagem, próximo à vaga 12"
          value={local}
          onChange={setLocal}
        />

        <Textarea
          label="Descrição"
          placeholder="Descreva o problema com detalhes para facilitar o atendimento."
          value={descricao}
          onChange={setDescricao}
        />

        <button
          type="submit"
          disabled={salvando}
          className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {salvando ? "Enviando chamado..." : "Enviar chamado"}
        </button>
      </form>
      </div>
    </main>
  );
}
