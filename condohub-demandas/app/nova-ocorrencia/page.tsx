"use client";

import { useEffect, useState } from "react";

import Titulo from "@/components/Titulo";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import Navbar from "@/components/Navbar";

type Ocorrencia = {
  id: number;
  titulo: string;
  local: string;
  descricao: string;
};

const API = "http://127.0.0.1:8000";

export default function Home() {
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);

  async function buscarOcorrencias() {
    const resposta = await fetch(`${API}/ocorrencias`);
    return resposta.json();
  }

  async function carregarOcorrencias() {
    const dados = await buscarOcorrencias();
    setOcorrencias(dados);
  }

  useEffect(() => {
    void buscarOcorrencias().then(setOcorrencias);
  }, []);

  async function salvarOcorrencia(
    evento: React.FormEvent<HTMLFormElement>
  ) {
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

    carregarOcorrencias();
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

      <section className="mt-8 max-w-xl">
        <h2 className="text-xl font-semibold text-gray-800">
          Ocorrências
        </h2>

        {ocorrencias.length === 0 && (
          <p className="mt-4 text-gray-600">
            Nenhuma ocorrência cadastrada.
          </p>
        )}

        {ocorrencias.map((item) => (
          <div
            key={item.id}
            className="mt-4 rounded border bg-white p-4 shadow-sm"
          >
            <h3 className="font-bold text-gray-900">
              {item.titulo}
            </h3>

            <p className="mt-1 text-sm text-gray-800">
              <strong>Local:</strong> {item.local}
            </p>

            <p className="mt-2 text-gray-700">
              {item.descricao}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
