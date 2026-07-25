"use client";

import { useCallback, useEffect, useState } from "react";

import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";

type Solicitacao = {
  id: number;
  nome: string;
  email: string;
  tipo: "morador" | "funcionario";
  bloco: string | null;
  apartamento: string | null;
  observacao: string | null;
  status: string;
  criado_em: string;
};

export default function SolicitacoesPage() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    const resposta = await fetch("/api/solicitacoes");
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível carregar as solicitações.");
      return;
    }
    setSolicitacoes(dados);
  }, []);

  useEffect(() => {
    void fetch("/api/solicitacoes")
      .then(async (resposta) => ({
        resposta,
        dados: await resposta.json(),
      }))
      .then(({ resposta, dados }) => {
        if (!resposta.ok) {
          setErro(dados.detail ?? "Não foi possível carregar as solicitações.");
          return;
        }
        setSolicitacoes(dados);
      });
  }, []);

  async function decidir(id: number, decisao: "aprovar" | "recusar") {
    const motivo =
      decisao === "recusar"
        ? window.prompt("Informe o motivo da recusa:")
        : null;
    if (decisao === "recusar" && !motivo) return;

    setProcessando(id);
    setErro("");
    const resposta = await fetch(`/api/solicitacoes/${id}/${decisao}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(motivo ? { motivo } : {}),
    });
    const dados = await resposta.json();
    setProcessando(null);

    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível concluir a decisão.");
      return;
    }
    await carregar();
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <Navbar />
      <Titulo texto="Solicitações de acesso" />
      {erro && <p className="mt-4 rounded bg-red-100 p-3 text-red-800">{erro}</p>}

      <div className="mt-6 space-y-4">
        {solicitacoes.filter((item) => item.status === "pendente").length === 0 ? (
          <div className="rounded-lg bg-white p-4 shadow">Nenhuma solicitação pendente.</div>
        ) : (
          solicitacoes
            .filter((item) => item.status === "pendente")
            .map((item) => (
              <article key={item.id} className="rounded-lg bg-white p-5 shadow">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{item.nome}</h2>
                    <p className="text-gray-600">{item.email}</p>
                    <p className="mt-2">
                      {item.tipo === "morador"
                        ? `Morador(a) — Bloco ${item.bloco}, apto. ${item.apartamento}`
                        : "Funcionário"}
                    </p>
                    {item.observacao && (
                      <p className="mt-2 text-sm text-gray-600">{item.observacao}</p>
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <button
                      disabled={processando === item.id}
                      onClick={() => decidir(item.id, "recusar")}
                      className="rounded border border-red-700 px-3 py-2 text-red-700"
                    >
                      Recusar
                    </button>
                    <button
                      disabled={processando === item.id}
                      onClick={() => decidir(item.id, "aprovar")}
                      className="rounded bg-blue-700 px-3 py-2 text-white"
                    >
                      Aprovar e convidar
                    </button>
                  </div>
                </div>
              </article>
            ))
        )}
      </div>
    </main>
  );
}
