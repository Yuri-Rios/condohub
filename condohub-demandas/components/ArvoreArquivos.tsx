import type { ReactNode } from "react";

export type ArquivoOrganizado = {
  id: number;
  nome_arquivo: string;
  caminho_relativo: string;
  mime_type?: string | null;
};

type Pasta = { nome: string; caminho: string; arquivos: ArquivoOrganizado[]; pastas: Map<string, Pasta> };

function iconeArquivo(arquivo: ArquivoOrganizado) {
  const extensao = arquivo.nome_arquivo.split(".").pop()?.toLowerCase();
  if (extensao === "pdf") return { texto: "PDF", classe: "bg-rose-50 text-rose-700 ring-rose-100" };
  if (["xls", "xlsx"].includes(extensao ?? "")) return { texto: "XLS", classe: "bg-emerald-50 text-emerald-700 ring-emerald-100" };
  if (["doc", "docx"].includes(extensao ?? "")) return { texto: "DOC", classe: "bg-blue-50 text-blue-700 ring-blue-100" };
  return { texto: "ARQ", classe: "bg-slate-100 text-slate-600 ring-slate-200" };
}

function montarArvore(arquivos: ArquivoOrganizado[], caminhosPastas: string[]) {
  const raiz: Pasta = { nome: "", caminho: "", arquivos: [], pastas: new Map() };
  for (const caminhoPasta of caminhosPastas) {
    let atual=raiz;
    for(const nome of caminhoPasta.split("/").filter(Boolean)){
      const caminho=[atual.caminho,nome].filter(Boolean).join("/");
      if(!atual.pastas.has(nome))atual.pastas.set(nome,{nome,caminho,arquivos:[],pastas:new Map()});
      atual=atual.pastas.get(nome)!;
    }
  }
  for (const arquivo of arquivos) {
    let atual = raiz;
    for (const nome of (arquivo.caminho_relativo ?? "").split("/").filter(Boolean)) {
      const caminho = [atual.caminho, nome].filter(Boolean).join("/");
      if (!atual.pastas.has(nome)) atual.pastas.set(nome, { nome, caminho, arquivos: [], pastas: new Map() });
      atual = atual.pastas.get(nome)!;
    }
    atual.arquivos.push(arquivo);
  }
  return raiz;
}

export default function ArvoreArquivos<T extends ArquivoOrganizado>({ arquivos, renderArquivo, pastas=[] }: { arquivos:T[]; renderArquivo:(arquivo:T)=>ReactNode; pastas?:string[] }) {
  const raiz = montarArvore(arquivos,pastas) as Pasta;
  function linha(arquivo:ArquivoOrganizado) { const icone=iconeArquivo(arquivo); return <div key={arquivo.id} className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0 hover:bg-slate-50/80"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[10px] font-black ring-1 ${icone.classe}`}>{icone.texto}</span><div className="min-w-0 flex-1">{renderArquivo(arquivo as T)}</div></div> }
  function pasta(no:Pasta,nivel:number):ReactNode { return <details key={no.caminho} open className={nivel?"ml-3 border-l border-slate-200 pl-3":""}><summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 font-bold text-slate-800 hover:bg-slate-50"><span className="text-amber-500">▰</span><span className="truncate">{no.nome}</span><span className="ml-auto text-xs font-normal text-slate-400">{no.arquivos.length+Array.from(no.pastas.values()).reduce((s,p)=>s+p.arquivos.length,0)}</span></summary>{no.arquivos.length>0&&<div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{no.arquivos.sort((a,b)=>a.nome_arquivo.localeCompare(b.nome_arquivo,"pt-BR")).map(linha)}</div>}<div className="mt-2 grid gap-2">{Array.from(no.pastas.values()).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")).map(p=>pasta(p,nivel+1))}</div></details> }
  return <div className="grid gap-3">{raiz.arquivos.length>0&&<div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{raiz.arquivos.sort((a,b)=>a.nome_arquivo.localeCompare(b.nome_arquivo,"pt-BR")).map(linha)}</div>}{Array.from(raiz.pastas.values()).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")).map(p=>pasta(p,0))}</div>;
}
