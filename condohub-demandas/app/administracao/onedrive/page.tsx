"use client";

import { useEffect, useState, type FormEvent } from "react";
import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";
import { useAcesso } from "@/src/hooks/useAcesso";

type Integracao = {
  conectada: boolean;
  status?: string;
  email?: string;
  pasta?: string;
  ultima_sincronizacao_em?: string | null;
  erro_ultima_sincronizacao?: string | null;
};

export default function OneDrivePage() {
  const acesso = useAcesso();
  const podeConectar = acesso?.papeis.some((papel) => ["sindico", "admin"].includes(papel)) ?? false;
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [pasta, setPasta] = useState("/Atas");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    const resposta = await fetch("/api/integracoes/onedrive", { cache: "no-store" });
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível consultar a integração.");
      return;
    }
    setIntegracao(dados);
    if (dados.pasta) setPasta(dados.pasta);
  }

  useEffect(() => {
    void fetch("/api/integracoes/onedrive", { cache: "no-store" })
      .then(async (resposta) => ({ resposta, dados: await resposta.json() }))
      .then(({ resposta, dados }) => {
        if (!resposta.ok) setErro(dados.detail ?? "Não foi possível consultar a integração.");
        else {
          setIntegracao(dados);
          if (dados.pasta) setPasta(dados.pasta);
        }
        const estado = new URLSearchParams(window.location.search).get("onedrive");
        if (estado === "conectado") setMensagem("Conta Microsoft conectada. Agora confirme a pasta das atas.");
        if (estado === "erro") setErro("A conexão com a Microsoft não foi concluída.");
      });
  }, []);

  async function conectar() {
    setOcupado(true);
    setErro("");
    const resposta = await fetch("/api/integracoes/onedrive/conectar", { method: "POST" });
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível iniciar a conexão.");
      setOcupado(false);
      return;
    }
    window.location.assign(dados.authorization_url);
  }

  async function salvarPasta(evento: FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setErro("");
    setMensagem("");
    const resposta = await fetch("/api/integracoes/onedrive/pasta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caminho: pasta }),
    });
    const dados = await resposta.json();
    setOcupado(false);
    if (!resposta.ok) {
      setErro(dados.detail ?? "Pasta não encontrada no OneDrive.");
      return;
    }
    setIntegracao(dados);
    setMensagem("Pasta das atas configurada.");
  }

  async function sincronizar() {
    setOcupado(true);
    setErro("");
    setMensagem("");
    const resposta = await fetch("/api/atas/sincronizar", { method: "POST" });
    const dados = await resposta.json();
    setOcupado(false);
    if (!resposta.ok) {
      setErro(dados.detail ?? "Falha ao sincronizar as atas.");
      return;
    }
    setMensagem(`${dados.importados} nova(s) ata(s) importada(s) e ${dados.atualizados} atualizada(s).`);
    await carregar();
  }

  async function desconectar() {
    if (!window.confirm("Desconectar o OneDrive? As atas já catalogadas permanecerão, mas os arquivos não poderão ser abertos.")) return;
    const resposta = await fetch("/api/integracoes/onedrive", { method: "DELETE" });
    if (!resposta.ok) {
      const dados = await resposta.json();
      setErro(dados.detail ?? "Não foi possível desconectar.");
      return;
    }
    setIntegracao({ conectada: false });
    setMensagem("OneDrive desconectado.");
  }

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Navbar />
        <Titulo texto="OneDrive das atas" subtitulo="Conecte a conta do condomínio e importe documentos sem transferir sua propriedade para o CondoHub." />

        {erro && <p className="mt-6 rounded-xl bg-rose-50 p-4 text-rose-700">{erro}</p>}
        {mensagem && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-700">{mensagem}</p>}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {!integracao ? (
            <p className="text-slate-500">Carregando integração…</p>
          ) : !integracao.conectada ? (
            <div>
              <h2 className="text-lg font-bold text-slate-950">Nenhuma conta conectada</h2>
              <p className="mt-2 text-sm text-slate-600">A Microsoft exibirá exatamente quais permissões serão concedidas. A senha nunca é compartilhada com o CondoHub.</p>
              {podeConectar ? (
                <button disabled={ocupado} onClick={() => void conectar()} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
                  Conectar conta Microsoft
                </button>
              ) : <p className="mt-4 text-sm font-semibold text-amber-700">A conexão deve ser feita por síndico ou administrador.</p>}
            </div>
          ) : (
            <div className="grid gap-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Conectado</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">{integracao.email}</h2>
                  <p className="mt-1 text-sm text-slate-500">Última sincronização: {integracao.ultima_sincronizacao_em ? new Date(integracao.ultima_sincronizacao_em).toLocaleString("pt-BR") : "ainda não realizada"}</p>
                </div>
                {podeConectar && <button onClick={() => void desconectar()} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700">Desconectar</button>}
              </div>

              <form onSubmit={salvarPasta} className="rounded-xl bg-slate-50 p-4">
                <label className="text-sm font-bold text-slate-800" htmlFor="pasta">Pasta raiz das atas</label>
                <p className="mt-1 text-xs text-slate-500">Informe o caminho existente a partir da raiz, como /Atas ou /Documentos/Atas.</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input id="pasta" required value={pasta} onChange={(evento) => setPasta(evento.target.value)} className="input" placeholder="/Atas" />
                  {podeConectar && <button disabled={ocupado} className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50">Salvar pasta</button>}
                </div>
              </form>

              {integracao.erro_ultima_sincronizacao && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Último erro: {integracao.erro_ultima_sincronizacao}</p>}
              <div>
                <button disabled={ocupado || integracao.pasta === "/"} onClick={() => void sincronizar()} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
                  {ocupado ? "Processando…" : "Sincronizar agora"}
                </button>
                {integracao.pasta === "/" && <p className="mt-2 text-xs text-amber-700">Escolha a pasta das atas antes da primeira sincronização.</p>}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
