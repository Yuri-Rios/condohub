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
    <main className="min-h-screen bg-gray-100 p-6">
      <Navbar />

      <Titulo texto="Nova Ocorrência" />

      <form
        onSubmit={salvarOcorrencia}
        className="mt-6 max-w-xl rounded-lg bg-white p-4 shadow"
      >
        <Input
          label="Título"
          placeholder="Ex.: Vazamento na garagem"
          value={titulo}
          onChange={setTitulo}
        />

        <Input
          label="Local"
          placeholder="Bloco A - Garagem"
          value={local}
          onChange={setLocal}
        />

        <Textarea
          label="Descrição"
          placeholder="Descreva o problema encontrado"
          value={descricao}
          onChange={setDescricao}
        />

        <button
          type="submit"
          disabled={salvando}
          className="rounded bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </main>
  );
}
