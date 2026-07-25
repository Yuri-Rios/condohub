"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function SolicitarAcessoPage() {
  const [tipo, setTipo] = useState("morador");
  const [apartamento, setApartamento] = useState("");
  const [erroApartamento, setErroApartamento] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formulario = event.currentTarget;
    setEnviando(true);
    setMensagem("");

    const dados = new FormData(formulario);
    if (tipo === "morador" && !/^\d+$/.test(apartamento)) {
      setErroApartamento("Informe o apartamento usando apenas números.");
      setEnviando(false);
      return;
    }

    const resposta = await fetch("/api/solicitacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: dados.get("nome"),
        email: dados.get("email"),
        tipo,
        bloco: tipo === "morador" ? dados.get("bloco") : null,
        apartamento: tipo === "morador" ? apartamento : null,
        observacao: dados.get("observacao") || null,
      }),
    });

    const retorno = await resposta.json();
    setEnviando(false);

    if (!resposta.ok) {
      const detalhe = retorno.detail;
      setMensagem(
        typeof detalhe === "string"
          ? detalhe
          : detalhe?.[0]?.msg ?? "Não foi possível enviar a solicitação.",
      );
      return;
    }

    formulario.reset();
    setApartamento("");
    setErroApartamento("");
    setMensagem(
      "Solicitação enviada. Você receberá um convite por e-mail se for aprovada.",
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold text-blue-700">Solicitar acesso</h1>
        <p className="mt-2 text-gray-600">
          O síndico analisará seus dados antes da criação da conta.
        </p>

        <form onSubmit={enviar} className="mt-6 space-y-4 rounded-lg bg-white p-6 shadow">
          <label className="block">
            <span className="text-sm font-medium">Nome completo</span>
            <input name="nome" required className="mt-1 w-full rounded border p-2" />
          </label>

          <label className="block">
            <span className="text-sm font-medium">E-mail</span>
            <input name="email" type="email" required className="mt-1 w-full rounded border p-2" />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Solicito acesso como</span>
            <select
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
              className="mt-1 w-full rounded border p-2"
            >
              <option value="morador">Morador(a)</option>
              <option value="funcionario">Funcionário</option>
            </select>
          </label>

          {tipo === "morador" && (
            <div className="grid grid-cols-2 gap-4">
              <label>
                <span className="text-sm font-medium">Bloco</span>
                <input
                  name="bloco"
                  required
                  placeholder="Ex.: Único"
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <label>
                <span className="text-sm font-medium">Apartamento</span>
                <input
                  name="apartamento"
                  required
                  inputMode="numeric"
                  pattern="[0-9]+"
                  placeholder="Ex.: 1001"
                  value={apartamento}
                  onChange={(event) => {
                    const valor = event.target.value;
                    if (!/^\d*$/.test(valor)) {
                      setErroApartamento(
                        "Use apenas números no campo apartamento.",
                      );
                      return;
                    }
                    setApartamento(valor);
                    setErroApartamento("");
                  }}
                  className="mt-1 w-full rounded border p-2"
                />
                {erroApartamento && (
                  <span className="mt-1 block text-xs text-red-700">
                    {erroApartamento}
                  </span>
                )}
              </label>
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium">Observação (opcional)</span>
            <textarea name="observacao" className="mt-1 min-h-24 w-full rounded border p-2" />
          </label>

          {mensagem && <p className="text-sm text-gray-700">{mensagem}</p>}

          <button
            disabled={enviando}
            className="rounded bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {enviando ? "Enviando..." : "Enviar solicitação"}
          </button>
        </form>

        <Link href="/entrar" className="mt-4 inline-block text-blue-700 underline">
          Já tenho acesso
        </Link>
      </div>
    </main>
  );
}
