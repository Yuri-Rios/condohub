"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import Navbar from "@/components/Navbar";

type Patrimonio = {
  id: number; numero: string; nome: string; categoria: string; localizacao: string;
  descricao: string | null; valor_aquisicao: number | null; data_aquisicao: string | null;
  nota_fiscal: string | null; estado: string; foto_data_url: string | null; foto_url: string | null; criado_em: string;
};

const categorias = ["Equipamento", "Móvel", "Eletrônico", "Ferramenta", "Segurança", "Lazer", "Outro"];
const estados = [{ valor: "novo", texto: "Novo" }, { valor: "bom", texto: "Bom" }, { valor: "regular", texto: "Regular" }, { valor: "manutencao", texto: "Em manutenção" }];
const estadoVisual: Record<string, string> = { novo: "bg-blue-50 text-blue-700", bom: "bg-emerald-50 text-emerald-700", regular: "bg-amber-50 text-amber-700", manutencao: "bg-rose-50 text-rose-700" };
const estadoTexto: Record<string, string> = Object.fromEntries(estados.map((item) => [item.valor, item.texto]));
const dataLocalHoje = () => { const agora = new Date(); agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset()); return agora.toISOString().slice(0, 10); };

function IconeCamera() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8" aria-hidden="true"><path d="M4 8.5h3l1.3-2h7.4l1.3 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="14" r="3.5"/></svg>; }

async function reduzirImagem(arquivo: File): Promise<string> {
  const origem = await new Promise<string>((resolve, reject) => { const leitor = new FileReader(); leitor.onload = () => resolve(String(leitor.result)); leitor.onerror = () => reject(leitor.error); leitor.readAsDataURL(arquivo); });
  const imagem = await new Promise<HTMLImageElement>((resolve, reject) => { const img = new window.Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = origem; });
  const limite = 1200; const escala = Math.min(1, limite / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(imagem.width * escala); canvas.height = Math.round(imagem.height * escala);
  canvas.getContext("2d")?.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", .78);
}

export default function PatrimonioPage() {
  const [itens, setItens] = useState<Patrimonio[]>([]); const [foto, setFoto] = useState<string | null>(null);
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null);
  const [nome, setNome] = useState(""); const [categoria, setCategoria] = useState(""); const [localizacao, setLocalizacao] = useState("");
  const [valor, setValor] = useState(""); const [data, setData] = useState(dataLocalHoje); const [nota, setNota] = useState("");
  const [estado, setEstado] = useState("bom"); const [descricao, setDescricao] = useState("");
  const [busca, setBusca] = useState(""); const [salvando, setSalvando] = useState(false); const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(""); const [sucesso, setSucesso] = useState<Patrimonio | null>(null); const inputFoto = useRef<HTMLInputElement>(null);

  useEffect(() => { let ativo = true; void fetch("/api/patrimonios", { cache: "no-store" }).then(async (r) => { const d = await r.json().catch(() => []); if (!ativo) return; if (r.ok) setItens(d); else setErro(d.detail ?? "Não foi possível carregar o patrimônio."); setCarregando(false); }); return () => { ativo = false; }; }, []);

  async function escolherFoto(evento: ChangeEvent<HTMLInputElement>) { const arquivo = evento.target.files?.[0]; if (!arquivo) return; setErro(""); if (!arquivo.type.startsWith("image/")) { setErro("Selecione um arquivo de imagem."); return; } if (arquivo.size > 8 * 1024 * 1024) { setErro("A foto pode ter no máximo 8 MB."); return; } try { setFoto(await reduzirImagem(arquivo)); setArquivoFoto(arquivo); } catch { setErro("Não foi possível preparar essa foto."); } }

  async function salvar(evento: FormEvent) {
    evento.preventDefault(); setSalvando(true); setErro(""); setSucesso(null);
    const resposta = await fetch("/api/patrimonios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, categoria, localizacao, descricao: descricao || null, valor_aquisicao: valor ? Number(valor.replace(",", ".")) : null, data_aquisicao: data || null, nota_fiscal: nota || null, estado }) });
    const dados = await resposta.json().catch(() => null); setSalvando(false);
    if (!resposta.ok) { setErro(dados?.detail ?? "Não foi possível cadastrar o item."); return; }
    let itemSalvo = dados as Patrimonio;
    if (arquivoFoto) { const formulario = new FormData(); formulario.append("arquivo", arquivoFoto); const envio = await fetch(`/api/patrimonios/${dados.id}/foto`, { method: "POST", body: formulario }); if (envio.ok) itemSalvo = await envio.json(); else { const falha = await envio.json().catch(() => null); setErro(`O patrimônio foi cadastrado, mas a foto não foi enviada. ${falha?.detail ?? "Verifique o armazenamento do condomínio."}`); } }
    setItens((atuais) => [itemSalvo, ...atuais]); setSucesso(itemSalvo); setNome(""); setCategoria(""); setLocalizacao(""); setValor(""); setData(dataLocalHoje()); setNota(""); setEstado("bom"); setDescricao(""); setFoto(null); setArquivoFoto(null); if (inputFoto.current) inputFoto.current.value = "";
  }

  const filtrados = itens.filter((item) => `${item.numero} ${item.nome} ${item.localizacao}`.toLowerCase().includes(busca.toLowerCase()));

  return <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><Navbar />
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700"><span className="h-2 w-2 rounded-full bg-blue-500" />Gestão de bens</div><h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Cadastrar patrimônio</h1><p className="mt-2 max-w-2xl leading-7 text-slate-600">Registre e identifique os bens do condomínio em poucos passos.</p></div><div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Itens cadastrados</p><p className="mt-1 text-2xl font-black text-slate-900">{itens.length.toLocaleString("pt-BR")}</p></div></header>

    {erro && <div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{erro}</div>}
    {sucesso && <div className="mt-6 flex flex-col justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center"><div><p className="font-bold text-emerald-900">Patrimônio cadastrado com sucesso</p><p className="mt-1 text-sm text-emerald-700">O número <strong>{sucesso.numero}</strong> foi reservado para {sucesso.nome}.</p></div><button type="button" onClick={() => navigator.clipboard?.writeText(sucesso.numero)} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-200">Copiar número</button></div>}

    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,.75fr)]">
      <form onSubmit={salvar} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,.06)]">
        <div className="border-b border-slate-100 p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-sm font-black text-white">1</span><div><h2 className="font-bold text-slate-950">Foto e identificação</h2><p className="text-sm text-slate-500">Comece com uma foto nítida do bem.</p></div></div>
          <div className="mt-5 grid gap-5 sm:grid-cols-[220px_1fr]">
            <button type="button" onClick={() => inputFoto.current?.click()} className={`group relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed ${foto ? "border-blue-200 bg-slate-100" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"}`}>{foto ? <Image unoptimized fill sizes="220px" src={foto} alt="Prévia do patrimônio" className="object-cover" /> : <span className="flex flex-col items-center px-4 text-center text-slate-500"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm"><IconeCamera /></span><strong className="mt-3 text-sm text-slate-800">Tirar ou enviar foto</strong><span className="mt-1 text-xs">JPG ou PNG</span></span>}{foto && <span className="absolute bottom-2 right-2 rounded-lg bg-slate-950/75 px-2.5 py-1.5 text-xs font-bold text-white backdrop-blur">Trocar foto</span>}</button>
            <input ref={inputFoto} type="file" accept="image/*" capture="environment" onChange={(e) => void escolherFoto(e)} className="sr-only" />
            <div className="grid content-start gap-4"><label className="text-sm font-semibold text-slate-700">Nome do item <span className="text-rose-500">*</span><input required maxLength={160} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Furadeira de impacto" className="input mt-2 font-normal" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Categoria <span className="text-rose-500">*</span><select required value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input mt-2 font-normal"><option value="">Selecione</option>{categorias.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Localização <span className="text-rose-500">*</span><input required maxLength={160} value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} placeholder="Ex.: Depósito B1" className="input mt-2 font-normal" /></label></div></div>
          </div>
        </div>
        <div className="p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-sm font-black text-slate-600">2</span><div><h2 className="font-bold text-slate-950">Dados do patrimônio</h2><p className="text-sm text-slate-500">Informações para controle e prestação de contas.</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Valor de aquisição<input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="R$ 0,00" className="input mt-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Data de aquisição<input type="date" value={data} onChange={(e) => setData(e.target.value)} className="input mt-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Nota fiscal / documento<input maxLength={100} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Número ou referência" className="input mt-2 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Estado de conservação<select value={estado} onChange={(e) => setEstado(e.target.value)} className="input mt-2 font-normal">{estados.map((item) => <option key={item.valor} value={item.valor}>{item.texto}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Observações<textarea value={descricao} maxLength={2000} onChange={(e) => setDescricao(e.target.value)} placeholder="Marca, modelo, número de série ou detalhes relevantes..." rows={3} className="input mt-2 resize-none font-normal" /></label></div>
          <div className="mt-6 flex flex-col-reverse items-center justify-between gap-3 border-t border-slate-100 pt-6 sm:flex-row"><p className="text-xs leading-5 text-slate-500"><strong className="text-slate-700">Número automático:</strong> será gerado ao concluir o cadastro.</p><button disabled={salvando} className="w-full rounded-xl bg-blue-600 px-6 py-3.5 font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto">{salvando ? "Cadastrando..." : "Cadastrar patrimônio"}</button></div>
        </div>
      </form>

      <aside className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-28"><div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-950">Patrimônio recente</h2><div className="relative mt-4"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item ou número" className="input pl-10 text-sm" /><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></div></div>
        <div className="max-h-[620px] divide-y divide-slate-100 overflow-y-auto">{carregando ? <p className="p-5 text-sm text-slate-500">Carregando itens...</p> : filtrados.length === 0 ? <div className="p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-xl">🏷️</div><p className="mt-3 font-semibold text-slate-700">Nenhum item encontrado</p><p className="mt-1 text-sm text-slate-500">O primeiro cadastro aparecerá aqui.</p></div> : filtrados.map((item) => <article key={item.id} className="flex gap-3 p-4 hover:bg-slate-50">{item.foto_url || item.foto_data_url ? <Image unoptimized width={64} height={64} src={item.foto_url ?? item.foto_data_url!} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-2xl">📦</div>}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate font-bold text-slate-900">{item.nome}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${estadoVisual[item.estado]}`}>{estadoTexto[item.estado]}</span></div><p className="mt-1 font-mono text-xs font-bold text-blue-700">{item.numero}</p><p className="mt-1 truncate text-xs text-slate-500">{item.localizacao}{item.valor_aquisicao != null ? ` · ${item.valor_aquisicao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}</p></div></article>)}</div>
      </aside>
    </div>
  </div></main>;
}
