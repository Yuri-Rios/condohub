"use client";

import { useEffect, useState } from "react";
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
  pastas?: { atas?: string | null; balancete?: string | null; orcamento?: string | null };
};
type TipoDocumento = "atas" | "balancete" | "orcamento";

export default function OneDrivePage() {
  const acesso = useAcesso();
  const podeConectar = acesso?.papeis.some((papel) => ["sindico", "admin"].includes(papel)) ?? false;
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [pasta, setPasta] = useState("/Atas");
  const [pastaBalancetes, setPastaBalancetes] = useState("/Balancetes");
  const [pastaOrcamentos, setPastaOrcamentos] = useState("/Orçamentos");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<TipoDocumento>>(new Set());

  async function carregar() {
    const resposta = await fetch("/api/integracoes/onedrive", { cache: "no-store" });
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível consultar a integração.");
      return;
    }
    setIntegracao(dados);
    if (dados.pasta) setPasta(dados.pasta);
    if (dados.pastas?.balancete) setPastaBalancetes(dados.pastas.balancete);
    if (dados.pastas?.orcamento) setPastaOrcamentos(dados.pastas.orcamento);
  }

  useEffect(() => {
    void fetch("/api/integracoes/onedrive", { cache: "no-store" })
      .then(async (resposta) => ({ resposta, dados: await resposta.json() }))
      .then(({ resposta, dados }) => {
        if (!resposta.ok) setErro(dados.detail ?? "Não foi possível consultar a integração.");
        else {
          setIntegracao(dados);
          if (dados.pasta) setPasta(dados.pasta);
          if (dados.pastas?.balancete) setPastaBalancetes(dados.pastas.balancete);
          if (dados.pastas?.orcamento) setPastaOrcamentos(dados.pastas.orcamento);
        }
        const estado = new URLSearchParams(window.location.search).get("onedrive");
        if (estado === "conectado") setMensagem("Conta Microsoft conectada. Agora configure as pastas dos documentos que deseja integrar.");
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

  async function salvarPastaAtas() {
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

  async function salvarPastaFinanceira(tipo: "balancete" | "orcamento", caminho: string) {
    setOcupado(true); setErro(""); setMensagem("");
    const resposta = await fetch(`/api/integracoes/onedrive/pastas/${tipo}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({caminho}) });
    const dados = await resposta.json(); setOcupado(false);
    if (!resposta.ok) { setErro(dados.detail ?? "Pasta não encontrada no OneDrive."); return; }
    setIntegracao(dados); setMensagem(`Pasta de ${tipo === "balancete" ? "balancetes" : "orçamentos"} configurada.`);
  }

  function alternarSelecao(tipo: TipoDocumento) {
    setSelecionados((atuais) => { const proximos = new Set(atuais); if (proximos.has(tipo)) proximos.delete(tipo); else proximos.add(tipo); return proximos; });
  }

  async function sincronizarSelecionados() {
    setOcupado(true); setErro(""); setMensagem("");
    const rotulos: Record<TipoDocumento,string> = { atas:"Atas", balancete:"Balancetes", orcamento:"Orçamentos" };
    const resultados:string[]=[]; const falhas:string[]=[];
    for (const tipo of selecionados) {
      const url = tipo === "atas" ? "/api/atas/sincronizar" : `/api/documentos-financeiros/${tipo}/sincronizar`;
      const resposta = await fetch(url,{method:"POST"}); const dados=await resposta.json().catch(()=>null);
      if (resposta.ok) resultados.push(`${rotulos[tipo]}: ${dados.importados} novo(s), ${dados.atualizados} atualizado(s)`);
      else falhas.push(`${rotulos[tipo]}: ${dados?.detail ?? "falha na sincronização"}`);
    }
    setOcupado(false); if(resultados.length)setMensagem(resultados.join(" · ")); if(falhas.length)setErro(falhas.join(" · ")); await carregar();
  }

  async function desconectar() {
    if (!window.confirm("Desconectar o OneDrive? Os documentos já catalogados permanecerão, mas os arquivos não poderão ser abertos.")) return;
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
        <Titulo texto="Documentos no OneDrive" subtitulo="Integre atas, balancetes e orçamentos sem transferir a propriedade dos arquivos para o CondoHub." />

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
                  <p className="mt-1 text-sm text-slate-500">Última sincronização de documentos: {integracao.ultima_sincronizacao_em ? new Date(integracao.ultima_sincronizacao_em).toLocaleString("pt-BR") : "ainda não realizada"}</p>
                </div>
                {podeConectar && <button onClick={() => void desconectar()} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700">Desconectar</button>}
              </div>

              <div><h3 className="font-bold text-slate-950">Pastas integradas</h3><p className="mt-1 text-sm text-slate-500">Configure somente as categorias que o condomínio utiliza.</p></div>
              <div className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">Atas</h3><p className="mt-1 text-xs text-slate-500">PDF ou Word; busca recursiva.</p><input value={pasta} onChange={(e)=>setPasta(e.target.value)} className="input mt-3" placeholder="/Atas"/>{podeConectar&&<button type="button" disabled={ocupado} onClick={()=>void salvarPastaAtas()} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar pasta</button>}</section>
                <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">Balancetes</h3><p className="mt-1 text-xs text-slate-500">PDF, Word ou Excel; busca recursiva.</p><input value={pastaBalancetes} onChange={(e)=>setPastaBalancetes(e.target.value)} className="input mt-3" placeholder="/Balancetes"/>{podeConectar&&<button type="button" disabled={ocupado} onClick={()=>void salvarPastaFinanceira("balancete",pastaBalancetes)} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar pasta</button>}</section>
                <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">Orçamentos</h3><p className="mt-1 text-xs text-slate-500">PDF, Word ou Excel; busca recursiva.</p><input value={pastaOrcamentos} onChange={(e)=>setPastaOrcamentos(e.target.value)} className="input mt-3" placeholder="/Orçamentos"/>{podeConectar&&<button type="button" disabled={ocupado} onClick={()=>void salvarPastaFinanceira("orcamento",pastaOrcamentos)} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar pasta</button>}</section>
              </div>

              {integracao.erro_ultima_sincronizacao && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Último erro: {integracao.erro_ultima_sincronizacao}</p>}
              <div className="rounded-xl bg-blue-50 p-4"><h3 className="font-bold text-slate-900">O que deseja sincronizar?</h3><p className="mt-1 text-xs text-slate-600">Marque apenas as categorias que devem ser verificadas agora.</p><div className="mt-4 flex flex-wrap gap-3">
                {([{tipo:"atas",rotulo:"Atas",disponivel:Boolean(integracao.pasta&&integracao.pasta!=="/")},{tipo:"balancete",rotulo:"Balancetes",disponivel:Boolean(integracao.pastas?.balancete)},{tipo:"orcamento",rotulo:"Orçamentos",disponivel:Boolean(integracao.pastas?.orcamento)}] as const).map(item=><label key={item.tipo} className={`flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold ${item.disponivel?"cursor-pointer border-blue-200 text-slate-800":"cursor-not-allowed border-slate-200 text-slate-400"}`}><input type="checkbox" disabled={!item.disponivel||ocupado} checked={selecionados.has(item.tipo)} onChange={()=>alternarSelecao(item.tipo)} className="h-5 w-5 accent-blue-600"/>{item.rotulo}{!item.disponivel&&<span className="text-[10px] font-normal">pasta não configurada</span>}</label>)}
              </div><button disabled={ocupado||selecionados.size===0} onClick={()=>void sincronizarSelecionados()} className="mt-4 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{ocupado?"Sincronizando…":`Sincronizar selecionados${selecionados.size?` (${selecionados.size})`:""}`}</button></div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
