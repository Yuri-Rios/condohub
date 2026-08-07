"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type CondominioPublico = {
  id: number;
  nome: string;
  slug: string;
};

export default function SolicitarAcessoPage() {
  const [condominioAtual, setCondominioAtual] =
    useState<CondominioPublico | null>(null);
  const [carregandoCondominio, setCarregandoCondominio] = useState(true);
  const [erroCondominio, setErroCondominio] = useState("");
  const [tentativaCondominio, setTentativaCondominio] = useState(0);
  const [tipo, setTipo] = useState("morador");
  const [apartamento, setApartamento] = useState("");
  const [erroApartamento, setErroApartamento] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    let ativo = true;
    const controlador = new AbortController();
    // O proxy do backend pode fazer três tentativas de até cinco segundos,
    // com pequenos intervalos, enquanto a API sai do modo de espera.
    const limite = window.setTimeout(() => controlador.abort(), 25_000);

    async function carregarCondominio() {
      try {
        setCarregandoCondominio(true);
        setErroCondominio("");
        const parametros = new URLSearchParams(window.location.search);
        const slug = parametros.get("condominio") ?? "camila-barbosa";
        const resposta = await fetch(
          `/api/condominio-publico?condominio=${encodeURIComponent(slug)}`,
          { cache: "no-store", signal: controlador.signal },
        );
        if (!ativo) return;
        if (!resposta.ok) {
          setErroCondominio(
            resposta.status === 404
              ? "O condomínio informado não foi encontrado."
              : "Não foi possível identificar o condomínio.",
          );
          return;
        }
        const dados = (await resposta.json()) as CondominioPublico;
        setCondominioAtual(dados);
        if (!parametros.has("condominio")) {
          parametros.set("condominio", dados.slug);
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}?${parametros.toString()}`,
          );
        }
      } catch {
        if (ativo) {
          setErroCondominio(
            "Não foi possível identificar o condomínio. Verifique sua conexão e tente novamente.",
          );
        }
      } finally {
        window.clearTimeout(limite);
        if (ativo) setCarregandoCondominio(false);
      }
    }
    void carregarCondominio();
    return () => {
      ativo = false;
      window.clearTimeout(limite);
      controlador.abort();
    };
  }, [tentativaCondominio]);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!condominioAtual) {
      setMensagem("Não foi possível identificar o condomínio.");
      return;
    }
    const formulario = event.currentTarget;
    setEnviando(true);
    setMensagem("");

    const dados = new FormData(formulario);
    if (tipo === "morador" && !/^\d+$/.test(apartamento)) {
      setErroApartamento("Informe o apartamento usando apenas números.");
      setEnviando(false);
      return;
    }

    const destino = `/api/solicitacoes?condominio=${encodeURIComponent(condominioAtual.slug)}`;
    const resposta = await fetch(destino, {
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
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/entrar" className="inline-flex items-center gap-2 font-bold text-slate-950">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-sm font-black text-white shadow-sm">
            CH
          </span>
          CondoHub
        </Link>

        <div className="mt-10">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
            Acesso ao condomínio
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">
            Solicite seu acesso
          </h1>
          {carregandoCondominio ? (
            <div className="mt-4 h-12 animate-pulse rounded-xl bg-slate-200/70" />
          ) : condominioAtual ? (
            <div className="mt-4 inline-flex items-center gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-xs font-black text-white">
                CH
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Condomínio
                </p>
                <p className="font-bold text-slate-950">
                  {condominioAtual.nome}
                </p>
              </div>
            </div>
          ) : (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 font-medium text-rose-700"
            >
              <p>{erroCondominio}</p>
              <button
                type="button"
                onClick={() => setTentativaCondominio((tentativa) => tentativa + 1)}
                className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-rose-100"
              >
                Tentar novamente
              </button>
            </div>
          )}
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
            Preencha seus dados. A administração confere a solicitação e, após
            a aprovação, você recebe o convite por e-mail.
          </p>
        </div>

        <form onSubmit={enviar} className="mt-8 space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)] sm:p-8">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Nome completo</span>
            <input name="nome" required placeholder="Como aparece no documento" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">E-mail</span>
            <input name="email" type="email" required placeholder="voce@exemplo.com" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Solicito acesso como</span>
            <select
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            >
              <option value="morador">Morador(a)</option>
              <option value="funcionario">Funcionário</option>
            </select>
          </label>

          {tipo === "morador" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-slate-700">Bloco</span>
                <input
                  name="bloco"
                  required
                  placeholder="Ex.: Único"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-700">Apartamento</span>
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
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
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
            <span className="text-sm font-semibold text-slate-700">Observação <span className="font-normal text-slate-400">(opcional)</span></span>
            <textarea name="observacao" placeholder="Alguma informação que ajude na validação?" className="mt-2 min-h-28 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
          </label>

          {mensagem && <p className="rounded-xl bg-blue-50 p-4 text-sm font-medium text-blue-800">{mensagem}</p>}

          <button
            disabled={enviando || !condominioAtual}
            className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Enviando..." : "Enviar solicitação"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Já recebeu seu acesso?{" "}
          <Link href="/entrar" className="font-semibold text-blue-700 hover:text-blue-800">
            Entrar no CondoHub
          </Link>
        </p>
      </div>
    </main>
  );
}
