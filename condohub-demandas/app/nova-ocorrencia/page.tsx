"use client";

import { useState, type FormEvent } from "react";

import Titulo from "@/components/Titulo";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import Navbar from "@/components/Navbar";

// const API = "http://127.0.0.1:8000";
const API = process.env.NEXT_PUBLIC_API_URL;

export default function NovaOcorrenciaPage() {
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");

  async function salvarOcorrencia(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!titulo || !local || !descricao) {
      alert("Preencha todos os campos.");
      return;
    }

    const resposta = await fetch(`${API}/ocorrencias`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        titulo,
        local,
        descricao,
      }),
    });

    if (!resposta.ok) {
      alert("Erro ao salvar.");
      return;
    }

    setTitulo("");
    setLocal("");
    setDescricao("");

    alert("Ocorrência salva com sucesso.");
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
          className="rounded bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800"
        >
          Salvar
        </button>
      </form>
    </main>
  );
}