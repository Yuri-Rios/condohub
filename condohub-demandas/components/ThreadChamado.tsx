"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import CampoComReferencias from "@/components/CampoComReferencias";
import TextoComReferencias from "@/components/TextoComReferencias";

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
  titulo: string;
  local: string;
  descricao: string;
  status: StatusChamado;
  autor_nome: string | null;
  autor_avatar_url: string | null;
  pode_alterar_status: boolean;
  pode_reabrir: boolean;
  pode_editar: boolean;
  mensagens: Mensagem[];
};

type Anexo = { id: number; nome: string; mime_type: string; tamanho: number; autor_nome: string; criado_em: string; url: string; pode_excluir: boolean };

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
  onOcorrenciaAlterada,
}: {
  ocorrenciaId: number;
  onStatusAlterado?: (status: StatusChamado) => void;
  onOcorrenciaAlterada?: (dados: {
    titulo: string;
    local: string;
    descricao: string;
  }) => void;
}) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [mostrarEmojis, setMostrarEmojis] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [reagindo, setReagindo] = useState<string | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState(false);
  const [editando, setEditando] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
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
    const [resposta, respostaAnexos] = await Promise.all([fetch(`/api/ocorrencias/${ocorrenciaId}/thread`), fetch(`/api/ocorrencias/${ocorrenciaId}/anexos`)]);
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível abrir a conversa.");
      return;
    }
    setThread(dados);
    if (respostaAnexos.ok) setAnexos(await respostaAnexos.json());
  }

  useEffect(() => {
    void Promise.all([fetch(`/api/ocorrencias/${ocorrenciaId}/thread`), fetch(`/api/ocorrencias/${ocorrenciaId}/anexos`)])
      .then(async ([resposta, respostaAnexos]) => ({ resposta, dados: await resposta.json(), anexos: respostaAnexos.ok ? await respostaAnexos.json() : [] }))
      .then(({ resposta, dados, anexos }) => {
        if (!resposta.ok) {
          setErro(dados.detail ?? "Não foi possível abrir a conversa.");
          return;
        }
        setThread(dados);
        setAnexos(anexos);
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

  function iniciarEdicao() {
    if (!thread) return;
    setTitulo(thread.titulo);
    setLocal(thread.local);
    setDescricao(thread.descricao);
    setErro("");
    setEditando(true);
  }

  async function salvarEdicao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!titulo.trim() || !local.trim() || !descricao.trim()) return;

    setSalvandoEdicao(true);
    setErro("");
    const resposta = await fetch(`/api/ocorrencias/${ocorrenciaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, local, descricao }),
    });
    const dados = await resposta.json();
    setSalvandoEdicao(false);

    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível editar a ocorrência.");
      return;
    }

    setThread((atual) =>
      atual
        ? {
            ...atual,
            titulo: dados.titulo,
            local: dados.local,
            descricao: dados.descricao,
          }
        : atual,
    );
    onOcorrenciaAlterada?.({
      titulo: dados.titulo,
      local: dados.local,
      descricao: dados.descricao,
    });
    setEditando(false);
  }

  async function enviarFotos() {
    if (fotos.length === 0) return;
    setEnviandoFotos(true); setErro("");
    const dados = new FormData(); fotos.forEach((foto) => dados.append("arquivos", foto));
    const resposta = await fetch(`/api/ocorrencias/${ocorrenciaId}/anexos`, { method: "POST", body: dados });
    setEnviandoFotos(false);
    if (!resposta.ok) { const retorno = await resposta.json().catch(() => null); setErro(retorno?.detail ?? "Não foi possível enviar as fotos."); return; }
    setFotos([]); await carregar();
  }

  async function excluirAnexo(anexo: Anexo) {
    if (!window.confirm(`Excluir a foto “${anexo.nome}”?`)) return;
    const resposta = await fetch(`/api/ocorrencias/${ocorrenciaId}/anexos/${anexo.id}`, { method: "DELETE" });
    if (!resposta.ok) { setErro("Não foi possível excluir a foto."); return; }
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
            Reabrir ocorrência
          </button>
        ) : null}
      </div>
      {editando ? (
        <form
          onSubmit={salvarEdicao}
          className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Título
              <input
                value={titulo}
                maxLength={160}
                required
                onChange={(event) => setTitulo(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Local
              <input
                value={local}
                maxLength={160}
                required
                onChange={(event) => setLocal(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Descrição
            <CampoComReferencias
              value={descricao}
              maxLength={4000}
              required
              rows={5}
              onChange={setDescricao}
              className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={salvandoEdicao}
              onClick={() => setEditando(false)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvandoEdicao}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {salvandoEdicao ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      ) : (
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
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {thread.autor_nome ? `Aberto por ${thread.autor_nome}` : "Autor protegido"}
              </span>
              {thread.pode_editar && (
                <button
                  type="button"
                  onClick={iniciarEdicao}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
                >
                  Editar ocorrência
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Local: {thread.local}
          </p>
          <TextoComReferencias texto={thread.descricao} className="mt-2 block text-sm leading-6 text-slate-700" />
        </div>
      </div>
      )}

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="text-sm font-bold text-slate-900">Fotos da ocorrência</h3><p className="mt-1 text-xs text-slate-500">Armazenadas no espaço conectado pelo condomínio.</p></div><div className="flex flex-wrap gap-2"><input aria-label="Selecionar fotos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFotos(Array.from(e.target.files ?? []).slice(0, 5))} className="max-w-56 text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" /><button type="button" disabled={fotos.length === 0 || enviandoFotos} onClick={() => void enviarFotos()} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{enviandoFotos ? "Enviando..." : `Anexar${fotos.length ? ` (${fotos.length})` : ""}`}</button></div></div>
        {anexos.length > 0 ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{anexos.map((anexo) => <div key={anexo.id} className="group relative overflow-hidden rounded-xl border border-slate-200"><a href={anexo.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${anexo.nome}`}><span className="block aspect-square bg-cover bg-center" style={{ backgroundImage: `url("${anexo.url}")` }} /><span className="block truncate px-2 py-2 text-xs font-semibold text-slate-600">{anexo.nome}</span></a>{anexo.pode_excluir && <button type="button" onClick={() => void excluirAnexo(anexo)} className="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-bold text-rose-600 shadow">Excluir</button>}</div>)}</div> : <p className="mt-4 text-center text-sm text-slate-400">Nenhuma foto anexada.</p>}
      </section>

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
                <TextoComReferencias texto={item.conteudo} className="mt-2 block text-sm leading-6 text-slate-700" />
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
          <CampoComReferencias
            ref={campoMensagem}
            value={mensagem}
            onChange={setMensagem}
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
