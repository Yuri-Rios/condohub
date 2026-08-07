"use client";

import { useCallback, useEffect, useState } from "react";

import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";
import { useAcesso } from "@/src/hooks/useAcesso";

const URL_PUBLICA = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

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
  const acesso = useAcesso();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [erro, setErro] = useState("");
  const [processando, setProcessando] = useState<number | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const linkConvite = acesso?.condominio && URL_PUBLICA
    ? `${URL_PUBLICA}/c/${encodeURIComponent(acesso.condominio.slug)}`
    : "";

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

  async function copiarLink() {
    if (!linkConvite) return;
    await navigator.clipboard.writeText(linkConvite);
    setLinkCopiado(true);
    window.setTimeout(() => setLinkCopiado(false), 2_000);
  }

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
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
      <Navbar />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Titulo
          texto="Solicitações de acesso"
          subtitulo="Valide os dados antes de permitir a entrada de novos usuários."
        />
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
          {solicitacoes.filter((item) => item.status === "pendente").length} pendentes
        </div>
      </div>
      {erro && <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{erro}</p>}

      {acesso?.condominio && URL_PUBLICA && (
        <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
          <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
            Link para novos moradores
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">
            Compartilhe o acesso de {acesso.condominio.nome}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Envie este endereço para quem precisa solicitar acesso ao condomínio.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a
              href={linkConvite}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-medium text-blue-800 hover:border-blue-300"
            >
              {linkConvite}
            </a>
            <button
              type="button"
              onClick={() => void copiarLink()}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {linkCopiado ? "Link copiado" : "Copiar link"}
            </button>
          </div>
        </section>
      )}

      <div className="mt-6 space-y-4">
        {solicitacoes.filter((item) => item.status === "pendente").length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-xl text-emerald-600">✓</div>
            <h2 className="mt-4 font-semibold text-slate-900">Fila em dia</h2>
            <p className="mt-1 text-sm text-slate-500">Nenhuma solicitação aguarda análise.</p>
          </div>
        ) : (
          solicitacoes
            .filter((item) => item.status === "pendente")
            .map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:p-6">
                <div className="flex flex-col justify-between gap-5 md:flex-row">
                  <div className="flex gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-100 font-bold text-blue-700">
                      {item.nome.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">{item.nome}</h2>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Pendente</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{item.email}</p>
                    <p className="mt-3 font-medium text-slate-700">
                      {item.tipo === "morador"
                        ? `Morador(a) — Bloco ${item.bloco}, apto. ${item.apartamento}`
                        : "Funcionário"}
                    </p>
                    {item.observacao && (
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{item.observacao}</p>
                    )}
                    <p className="mt-3 text-xs text-slate-400">
                      Solicitado em {new Date(item.criado_em).toLocaleDateString("pt-BR")}
                    </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <button
                      disabled={processando === item.id}
                      onClick={() => decidir(item.id, "recusar")}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    >
                      Recusar
                    </button>
                    <button
                      disabled={processando === item.id}
                      onClick={() => decidir(item.id, "aprovar")}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      Aprovar e convidar
                    </button>
                  </div>
                </div>
              </article>
            ))
        )}
      </div>
      </div>
    </main>
  );
}
