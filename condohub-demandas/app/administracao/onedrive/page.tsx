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
  pastas?: Partial<Record<TipoDocumento, string | null>>;
};
type TipoDocumento = "atas" | "balancete" | "orcamento" | "contrato" | "certificado" | "memorial";
const categorias: Array<{tipo: TipoDocumento; rotulo: string; padrao: string}> = [
  {tipo:"atas",rotulo:"Atas",padrao:"/Atas"}, {tipo:"balancete",rotulo:"Balancetes",padrao:"/Balancetes"},
  {tipo:"orcamento",rotulo:"Orçamentos",padrao:"/Orçamentos"}, {tipo:"contrato",rotulo:"Contratos",padrao:"/Contratos"},
  {tipo:"certificado",rotulo:"Certificados",padrao:"/Certificados"}, {tipo:"memorial",rotulo:"Memorial",padrao:"/Memorial"},
];
function mensagemErro(dados:unknown,padrao:string){if(!dados||typeof dados!=="object")return padrao;const detalhe=(dados as {detail?:unknown}).detail;if(typeof detalhe==="string")return detalhe;if(Array.isArray(detalhe)){const mensagens=detalhe.map(item=>item&&typeof item==="object"&&typeof (item as {msg?:unknown}).msg==="string"?(item as {msg:string}).msg.replace(/^Value error,\s*/,""):null).filter(Boolean);if(mensagens.length)return mensagens.join(" ")}return padrao}

export default function OneDrivePage() {
  const acesso = useAcesso();
  const podeConectar = acesso?.papeis.some((papel) => ["sindico", "admin"].includes(papel)) ?? false;
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [caminhos, setCaminhos] = useState<Record<TipoDocumento,string>>(() => Object.fromEntries(categorias.map(c=>[c.tipo,c.padrao])) as Record<TipoDocumento,string>);
  const [seletor, setSeletor] = useState<{tipo:TipoDocumento;caminho:string}|null>(null);
  const [subpastas, setSubpastas] = useState<Array<{id:string;nome:string}>>([]);
  const [carregandoPastas, setCarregandoPastas] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<TipoDocumento>>(new Set());
  const [revisarTodos, setRevisarTodos] = useState(false);

  async function carregar() {
    const resposta = await fetch("/api/integracoes/onedrive", { cache: "no-store" });
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(mensagemErro(dados,"Não foi possível consultar a integração."));
      return;
    }
    setIntegracao(dados);
    setCaminhos(atuais=>Object.fromEntries(categorias.map(c=>[c.tipo,dados.pastas?.[c.tipo]??(c.tipo==="atas"?dados.pasta:null)??atuais[c.tipo]])) as Record<TipoDocumento,string>);
  }

  useEffect(() => {
    void fetch("/api/integracoes/onedrive", { cache: "no-store" })
      .then(async (resposta) => ({ resposta, dados: await resposta.json() }))
      .then(({ resposta, dados }) => {
        if (!resposta.ok) setErro(mensagemErro(dados,"Não foi possível consultar a integração."));
        else {
          setIntegracao(dados);
          setCaminhos(atuais=>Object.fromEntries(categorias.map(c=>[c.tipo,dados.pastas?.[c.tipo]??(c.tipo==="atas"?dados.pasta:null)??atuais[c.tipo]])) as Record<TipoDocumento,string>);
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
      setErro(mensagemErro(dados,"Não foi possível iniciar a conexão."));
      setOcupado(false);
      return;
    }
    window.location.assign(dados.authorization_url);
  }

  async function salvarPasta(tipo: TipoDocumento, caminho = caminhos[tipo]) {
    setOcupado(true);
    setErro("");
    setMensagem("");
    const resposta = await fetch(tipo === "atas" ? "/api/integracoes/onedrive/pasta" : `/api/integracoes/onedrive/pastas/${tipo}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caminho }),
    });
    const dados = await resposta.json();
    setOcupado(false);
    if (!resposta.ok) {
      setErro(mensagemErro(dados,"Pasta não encontrada no OneDrive."));
      return;
    }
    setIntegracao(dados);
    setCaminhos(atuais=>({...atuais,[tipo]:caminho}));
    setSeletor(null);
    setMensagem(`Pasta de ${categorias.find(c=>c.tipo===tipo)?.rotulo.toLowerCase()} configurada.`);
  }

  async function navegarPastas(tipo: TipoDocumento, caminho: string) {
    setSeletor({tipo,caminho}); setCarregandoPastas(true); setErro("");
    const resposta=await fetch(`/api/integracoes/onedrive/pastas?caminho=${encodeURIComponent(caminho)}`,{cache:"no-store"});
    const dados=await resposta.json(); setCarregandoPastas(false);
    if(!resposta.ok){setErro(mensagemErro(dados,"Não foi possível listar as pastas."));return}
    setSubpastas(dados.pastas);
  }

  function alternarSelecao(tipo: TipoDocumento) {
    setSelecionados((atuais) => { const proximos = new Set(atuais); if (proximos.has(tipo)) proximos.delete(tipo); else proximos.add(tipo); return proximos; });
  }

  async function sincronizarSelecionados() {
    setOcupado(true); setErro(""); setMensagem("");
    const rotulos = Object.fromEntries(categorias.map(c=>[c.tipo,c.rotulo])) as Record<TipoDocumento,string>;
    const resultados:string[]=[]; const falhas:string[]=[];
    for (const tipo of selecionados) {
      const url = tipo === "atas" ? "/api/atas/sincronizar" : `/api/documentos-financeiros/${tipo}/sincronizar`;
      const resposta = await fetch(url,{method:"POST"}); const dados=await resposta.json().catch(()=>null);
      if (resposta.ok) {
        let resumo=`${rotulos[tipo]}: ${dados.importados} novo(s), ${dados.atualizados} atualizado(s)`;
        if(revisarTodos){
          const revisao=await fetch(`/api/revisoes/${tipo}`,{method:"POST"}); const dadosRevisao=await revisao.json().catch(()=>null);
          if(revisao.ok) resumo+=`, ${dadosRevisao.revisados} aprovado(s)`;
          else falhas.push(`${rotulos[tipo]}: sincronizado, mas ${mensagemErro(dadosRevisao,"falha na aprovação em lote")}`);
        }
        resultados.push(resumo);
      } else falhas.push(`${rotulos[tipo]}: ${mensagemErro(dados,"falha na sincronização")}`);
    }
    setOcupado(false); if(resultados.length)setMensagem(resultados.join(" · ")); if(falhas.length)setErro(falhas.join(" · ")); await carregar();
  }

  async function desconectar() {
    if (!window.confirm("Desconectar o OneDrive? Os documentos já catalogados permanecerão, mas os arquivos não poderão ser abertos.")) return;
    const resposta = await fetch("/api/integracoes/onedrive", { method: "DELETE" });
    if (!resposta.ok) {
      const dados = await resposta.json();
      setErro(mensagemErro(dados,"Não foi possível desconectar."));
      return;
    }
    setIntegracao({ conectada: false });
    setMensagem("OneDrive desconectado.");
  }

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Navbar />
        <Titulo texto="Sincronizar" subtitulo="Conecte serviços externos para manter documentos e informações do condomínio atualizados." />

        {erro && <p className="mt-6 rounded-xl bg-rose-50 p-4 text-rose-700">{erro}</p>}
        {mensagem && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-700">{mensagem}</p>}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-4 border-b border-slate-100 pb-5"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-sm font-black text-blue-700">OD</span><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Provedor disponível</p><h2 className="mt-1 font-bold text-slate-950">Microsoft OneDrive</h2><p className="mt-0.5 text-sm text-slate-500">Atas, documentos financeiros, contratos, certificados e memorial.</p></div></div>
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{categorias.map(c=><section key={c.tipo} className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold text-slate-900">{c.rotulo}</h3><p className="mt-1 text-xs text-slate-500">PDF, Word ou Excel; busca recursiva.</p><div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 break-all">{caminhos[c.tipo]}</div>{podeConectar&&<div className="mt-3 flex gap-2"><button type="button" disabled={ocupado} onClick={()=>void navegarPastas(c.tipo,"/")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">Escolher pasta</button><button type="button" disabled={ocupado} onClick={()=>void salvarPasta(c.tipo)} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar</button></div>}</section>)}</div>

              {integracao.erro_ultima_sincronizacao && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Último erro: {integracao.erro_ultima_sincronizacao}</p>}
              <div className="rounded-xl bg-blue-50 p-4"><h3 className="font-bold text-slate-900">O que deseja sincronizar?</h3><p className="mt-1 text-xs text-slate-600">Marque apenas as categorias que devem ser verificadas agora.</p><div className="mt-4 flex flex-wrap gap-3">
                {categorias.map(item=>{const disponivel=Boolean(item.tipo==="atas"?(integracao.pasta&&integracao.pasta!=="/"):integracao.pastas?.[item.tipo]);return <label key={item.tipo} className={`flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold ${disponivel?"cursor-pointer border-blue-200 text-slate-800":"cursor-not-allowed border-slate-200 text-slate-400"}`}><input type="checkbox" disabled={!disponivel||ocupado} checked={selecionados.has(item.tipo)} onChange={()=>alternarSelecao(item.tipo)} className="h-5 w-5 accent-blue-600"/>{item.rotulo}{!disponivel&&<span className="text-[10px] font-normal">pasta não configurada</span>}</label>})}
              </div>{podeConectar&&<label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-white p-4"><input type="checkbox" disabled={ocupado} checked={revisarTodos} onChange={e=>setRevisarTodos(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600"/><span><span className="block text-sm font-bold text-slate-800">Marcar todos como revisados</span><span className="mt-1 block text-xs leading-5 text-slate-500">Aprova e disponibiliza em lote todos os documentos pendentes das categorias sincronizadas.</span></span></label>}<button disabled={ocupado||selecionados.size===0} onClick={()=>void sincronizarSelecionados()} className="mt-4 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{ocupado?"Sincronizando…":`Sincronizar selecionados${selecionados.size?` (${selecionados.size})`:""}`}</button></div>
            </div>
          )}
        </section>
        {seletor&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-950">Escolher pasta de {categorias.find(c=>c.tipo===seletor.tipo)?.rotulo.toLowerCase()}</h2><div className="mt-2 flex flex-wrap items-center gap-1 text-sm">{["",...seletor.caminho.split("/").filter(Boolean)].map((parte,i,arr)=>{const caminho=i===0?"/":"/"+arr.slice(1,i+1).join("/");return <span key={caminho} className="flex items-center gap-1">{i>0&&<span className="text-slate-300">/</span>}<button onClick={()=>void navegarPastas(seletor.tipo,caminho)} className="rounded px-1.5 py-1 font-semibold text-blue-700 hover:bg-blue-50">{i===0?"Meu OneDrive":parte}</button></span>})}</div></div><button onClick={()=>setSeletor(null)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-xl">×</button></div><div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-slate-200">{carregandoPastas?<p className="p-5 text-sm text-slate-500">Carregando pastas…</p>:subpastas.length===0?<p className="p-5 text-sm text-slate-500">Esta pasta não possui subpastas.</p>:subpastas.map(p=><button key={p.id} onClick={()=>void navegarPastas(seletor.tipo,`${seletor.caminho.replace(/\/$/,"")}/${p.nome}`)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-800 last:border-0 hover:bg-slate-50"><span className="text-amber-500">▰</span>{p.nome}<span className="ml-auto text-slate-400">›</span></button>)}</div><div className="mt-4 flex items-center justify-between gap-3"><p className="truncate text-xs text-slate-500">Selecionada: {seletor.caminho}</p><button disabled={ocupado||carregandoPastas} onClick={()=>void salvarPasta(seletor.tipo,seletor.caminho)} className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Usar esta pasta</button></div></div></div>}
      </div>
    </main>
  );
}
