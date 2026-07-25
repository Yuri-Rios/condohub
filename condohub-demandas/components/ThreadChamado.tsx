"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Mensagem = {
  id: number;
  conteudo: string;
  autor_nome: string;
  autor_avatar_url: string | null;
  autor_papeis: string[];
  criado_em: string;
  reacoes: Array<{ emoji: string; quantidade: number; minha: boolean }>;
};

type Thread = {
  descricao: string;
  status: StatusChamado;
  autor_nome: string | null;
  autor_avatar_url: string | null;
  pode_alterar_status: boolean;
  pode_reabrir: boolean;
  mensagens: Mensagem[];
};

type StatusChamado = "novo" | "em_andamento" | "em_espera" | "fechado";

const statusChamado: Record<
  StatusChamado,
  { nome: string; classe: string }
> = {
  novo: { nome: "Novo", classe: "border-blue-500 text-blue-700" },
  em_andamento: {
    nome: "Em andamento",
    classe: "border-amber-500 text-amber-700",
  },
  em_espera: { nome: "Em espera", classe: "border-violet-500 text-violet-700" },
  fechado: { nome: "Fechado", classe: "border-emerald-500 text-emerald-700" },
};

const nomesPapeis: Record<string, string> = {
  morador: "Morador(a)",
  funcionario: "Funcionário",
  sindico: "Síndico",
  subsindico: "Subsíndico",
  admin: "Admin",
};

function Avatar({
  nome,
  avatarUrl,
}: {
  nome: string;
  avatarUrl: string | null;
}) {
  const estilo = avatarUrl
    ? { backgroundImage: `url("${avatarUrl}")` }
    : undefined;

  return (
    <span
      style={estilo}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-sky-400 bg-cover bg-center font-bold text-white shadow-sm"
      aria-label={`Foto de ${nome}`}
    >
      {!avatarUrl && nome.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function ThreadChamado({
  ocorrenciaId,
  onStatusAlterado,
}: {
  ocorrenciaId: number;
  onStatusAlterado?: (status: StatusChamado) => void;
}) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [reagindo, setReagindo] = useState<string | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState(false);
  const campoMensagem = useRef<HTMLTextAreaElement>(null);

  function adicionarEmoji(emoji: string) {
    const campo = campoMensagem.current;
    const inicio = campo?.selectionStart ?? mensagem.length;
    const fim = campo?.selectionEnd ?? mensagem.length;
    setMensagem(`${mensagem.slice(0, inicio)}${emoji}${mensagem.slice(fim)}`);

    requestAnimationFrame(() => {
      campo?.focus();
      campo?.setSelectionRange(inicio + emoji.length, inicio + emoji.length);
    });
  }

  async function carregar() {
    const resposta = await fetch(`/api/ocorrencias/${ocorrenciaId}/thread`);
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível abrir a conversa.");
      return;
    }
    setThread(dados);
  }

  useEffect(() => {
    void fetch(`/api/ocorrencias/${ocorrenciaId}/thread`)
      .then(async (resposta) => ({ resposta, dados: await resposta.json() }))
      .then(({ resposta, dados }) => {
        if (!resposta.ok) {
          setErro(dados.detail ?? "Não foi possível abrir a conversa.");
          return;
        }
        setThread(dados);
      });
  }, [ocorrenciaId]);

  async function responder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mensagem.trim()) return;

    setEnviando(true);
    setErro("");
    const resposta = await fetch(`/api/ocorrencias/${ocorrenciaId}/mensagens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conteudo: mensagem }),
    });
    const dados = await resposta.json();
    setEnviando(false);

    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível enviar a mensagem.");
      return;
    }
    setMensagem("");
    setMostrarEmojis(false);
    await carregar();
  }

  async function reagir(mensagemId: number, emoji: string) {
    const chave = `${mensagemId}-${emoji}`;
    setReagindo(chave);
    const resposta = await fetch(`/api/mensagens/${mensagemId}/reacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    setReagindo(null);
    if (!resposta.ok) {
      setErro("Não foi possível registrar a reação.");
      return;
    }
    await carregar();
  }

  async function alterarStatus(status: StatusChamado) {
    setAlterandoStatus(true);
    setErro("");
    const resposta = await fetch(`/api/ocorrencias/${ocorrenciaId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const dados = await resposta.json();
    setAlterandoStatus(false);
    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível alterar o status.");
      return;
    }
    onStatusAlterado?.(status);
    await carregar();
  }

  if (erro && !thread) {
    return <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{erro}</p>;
  }

  if (!thread) {
    return (
      <div className="flex items-center gap-3 py-5 text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        Abrindo conversa...
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span
          className={`border-b-2 px-1 pb-1 text-sm font-bold ${statusChamado[thread.status].classe}`}
        >
          {statusChamado[thread.status].nome}
        </span>
        {thread.pode_alterar_status ? (
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            Alterar status
            <select
              value={thread.status}
              disabled={alterandoStatus}
              onChange={(event) =>
                alterarStatus(event.target.value as StatusChamado)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              {Object.entries(statusChamado).map(([valor, status]) => (
                <option key={valor} value={valor}>
                  {status.nome}
                </option>
              ))}
            </select>
          </label>
        ) : thread.pode_reabrir ? (
          <button
            type="button"
            disabled={alterandoStatus}
            onClick={() => alterarStatus("novo")}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Reabrir chamado
          </button>
        ) : null}
      </div>
      <div className="flex gap-3">
        {thread.autor_nome && (
          <Avatar
            nome={thread.autor_nome}
            avatarUrl={thread.autor_avatar_url}
          />
        )}
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Descrição inicial
            </span>
            <span className="text-xs text-slate-400">
              {thread.autor_nome ? `Aberto por ${thread.autor_nome}` : "Autor protegido"}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {thread.descricao}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {thread.mensagens.length === 0 ? (
          <p className="py-3 text-center text-sm text-slate-400">
            Nenhuma mensagem ainda. Inicie a conversa.
          </p>
        ) : (
          thread.mensagens.map((item) => (
            <div key={item.id} className="flex gap-3">
              <Avatar nome={item.autor_nome} avatarUrl={item.autor_avatar_url} />
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-bold text-slate-900">{item.autor_nome}</span>
                  <span className="text-xs font-semibold text-blue-600">
                    {item.autor_papeis
                      .map((papel) => nomesPapeis[papel] ?? papel)
                      .join(" · ")}
                  </span>
                  <time className="ml-auto text-xs text-slate-400">
                    {new Date(item.criado_em).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {item.conteudo}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["👍", "❤️", "😂", "👏"].map((emoji) => {
                    const reacao = item.reacoes.find(
                      (atual) => atual.emoji === emoji,
                    );
                    const chave = `${item.id}-${emoji}`;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        disabled={reagindo === chave}
                        onClick={() => reagir(item.id, emoji)}
                        aria-label={`Reagir com ${emoji}`}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          reacao?.minha
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50"
                        } disabled:opacity-50`}
                      >
                        <span className="text-sm">{emoji}</span>
                        {reacao && reacao.quantidade > 0 && (
                          <span className="ml-1">{reacao.quantidade}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={responder} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <textarea
            ref={campoMensagem}
            value={mensagem}
            onChange={(event) => setMensagem(event.target.value)}
            placeholder="Escreva uma mensagem..."
            maxLength={4000}
            className="min-h-12 w-full resize-none rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-12 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => setMostrarEmojis((aberto) => !aberto)}
            aria-label="Adicionar emoji"
            aria-expanded={mostrarEmojis}
            className="absolute bottom-3 right-3 grid h-7 w-7 place-items-center rounded-lg text-lg hover:bg-slate-100"
          >
            🙂
          </button>
          {mostrarEmojis && (
            <div className="absolute bottom-14 right-0 z-10 grid grid-cols-6 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              {["👍", "🙏", "😊", "✅", "👏", "❤️", "😂", "😮", "😢", "🚨", "🔧", "💡"].map(
                (emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => adicionarEmoji(emoji)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-xl hover:bg-blue-50"
                    aria-label={`Adicionar ${emoji}`}
                  >
                    {emoji}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
        <button
          disabled={enviando || !mensagem.trim()}
          className="self-end rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Responder"}
        </button>
      </form>
      {erro && <p className="mt-3 text-sm text-rose-700">{erro}</p>}
    </div>
  );
}
