"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

type Ocorrencia = {
  id: number;
  titulo: string;
  local: string;
  descricao: string;
};

const API = "http://127.0.0.1:8000";

export default function OcorrenciasPage() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [idsAlterados, setIdsAlterados] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);

  async function buscarOcorrencias() {
    const resposta = await fetch(`${API}/ocorrencias`);
    return resposta.json();
  }

  async function carregarOcorrencias() {
    const dados = await buscarOcorrencias();
    setOcorrencias(dados);
    setIdsAlterados([]);
  }

  useEffect(() => {
    void buscarOcorrencias().then((dados) => {
      setOcorrencias(dados);
      setIdsAlterados([]);
    });
  }, []);

  function atualizarCampo(
    id: number,
    campo: "titulo" | "local" | "descricao",
    valor: string
  ) {
    setOcorrencias((lista) =>
      lista.map((item) =>
        item.id === id ? { ...item, [campo]: valor } : item
      )
    );

    setIdsAlterados((ids) =>
      ids.includes(id) ? ids : [...ids, id]
    );
  }

  async function salvarAlteracoes() {
    setSalvando(true);

    const ocorrenciasAlteradas = ocorrencias.filter((item) =>
      idsAlterados.includes(item.id)
    );

    for (const item of ocorrenciasAlteradas) {
      await fetch(`${API}/ocorrencias/${item.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titulo: item.titulo,
          local: item.local,
          descricao: item.descricao,
        }),
      });
    }

    await carregarOcorrencias();
    setSalvando(false);
  }

  function cancelarAlteracoes() {
    carregarOcorrencias();
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
    <Navbar />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-blue-700">
          Ocorrências cadastradas
        </h1>

        {idsAlterados.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={salvarAlteracoes}
              disabled={salvando}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-green-300"
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>

            <button
              onClick={cancelarAlteracoes}
              disabled={salvando}
              className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600 disabled:bg-gray-300"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {idsAlterados.length > 0 && (
        <p className="mt-3 text-sm text-yellow-700">
          Você tem alterações não salvas.
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full border-collapse text-left">
          <thead className="bg-gray-200 text-gray-800">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Título</th>
              <th className="p-3">Local</th>
              <th className="p-3">Descrição</th>
            </tr>
          </thead>

          <tbody>
            {ocorrencias.map((item) => {
              const alterado = idsAlterados.includes(item.id);

              return (
                <tr
                  key={item.id}
                  className={`border-t text-gray-800 ${
                    alterado ? "bg-yellow-50" : ""
                  }`}
                >
                  <td className="p-3">{item.id}</td>

                  <td className="p-3">
                    <input
                      className="w-full rounded border p-2"
                      value={item.titulo}
                      onChange={(e) =>
                        atualizarCampo(item.id, "titulo", e.target.value)
                      }
                    />
                  </td>

                  <td className="p-3">
                    <input
                      className="w-full rounded border p-2"
                      value={item.local}
                      onChange={(e) =>
                        atualizarCampo(item.id, "local", e.target.value)
                      }
                    />
                  </td>

                  <td className="p-3">
                    <input
                      className="w-full rounded border p-2"
                      value={item.descricao}
                      onChange={(e) =>
                        atualizarCampo(item.id, "descricao", e.target.value)
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ocorrencias.length === 0 && (
        <p className="mt-4 text-gray-600">
          Nenhuma ocorrência cadastrada.
        </p>
      )}
    </main>
  );
}
