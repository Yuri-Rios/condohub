"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Navbar from "@/components/Navbar";
import Titulo from "@/components/Titulo";
import ArvoreArquivos from "@/components/ArvoreArquivos";
import { useAcesso } from "@/src/hooks/useAcesso";

type Ata = {
  id: number;
  titulo: string;
  tipo: string;
  data_assembleia: string | null;
  descricao: string | null;
  nome_arquivo: string;
  caminho_relativo: string;
  mime_type: string | null;
  tamanho: number | null;
  modificado_em: string | null;
  publicada: boolean;
  pode_gerenciar: boolean;
};

function tamanhoLegivel(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function dataParaInput(data: string | null) {
  return data ? new Date(data).toISOString().slice(0, 10) : "";
}

export default function AtasPage() {
  const acesso=useAcesso(); const podeEditarDrive=acesso?.papeis.some(p=>["sindico","admin"].includes(p))??false;
  const [atas, setAtas] = useState<Ata[]>([]);
  const [editando, setEditando] = useState<Ata | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [pastas,setPastas]=useState<string[]>([]); const [caminhoUpload,setCaminhoUpload]=useState(""); const inputArquivo=useRef<HTMLInputElement>(null);

  async function carregar() {
    const resposta = await fetch("/api/atas", { cache: "no-store" });
    const dados = await resposta.json();
    setCarregando(false);
    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível carregar as atas.");
      return;
    }
    setAtas(dados);
    const estrutura=await fetch("/api/documentos-estrutura/atas",{cache:"no-store"});if(estrutura.ok)setPastas((await estrutura.json()).pastas??[]);
  }

  useEffect(() => {
    void fetch("/api/documentos-estrutura/atas",{cache:"no-store"}).then(async resposta=>{if(resposta.ok)setPastas((await resposta.json()).pastas??[])});
    void fetch("/api/atas", { cache: "no-store" })
      .then(async (resposta) => ({ resposta, dados: await resposta.json() }))
      .then(({ resposta, dados }) => {
        setCarregando(false);
        if (!resposta.ok) setErro(dados.detail ?? "Não foi possível carregar as atas.");
        else setAtas(dados);
      });
  }, []);

  async function criarPasta(){const valor=window.prompt("Caminho da nova pasta (ex.: Assembleias/2026):")?.trim().replace(/^\/+|\/+$/g,"");if(!valor)return;const partes=valor.split("/");const nome=partes.pop()!;const resposta=await fetch("/api/documentos-pastas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tipo:"atas",caminho_pai:partes.join("/"),nome})});if(!resposta.ok){const dados=await resposta.json();setErro(dados.detail??"Não foi possível criar a pasta.");return}await carregar()}
  function escolherUpload(){const caminho=window.prompt("Pasta de destino relativa à raiz (deixe vazio para a raiz):","");if(caminho===null)return;setCaminhoUpload(caminho.trim().replace(/^\/+|\/+$/g,""));window.setTimeout(()=>inputArquivo.current?.click())}
  async function enviarArquivo(arquivo:File){const form=new FormData();form.append("caminho",caminhoUpload);form.append("arquivo",arquivo);const resposta=await fetch("/api/documentos-upload/atas",{method:"POST",body:form});if(!resposta.ok){const dados=await resposta.json();setErro(dados.detail??"Não foi possível enviar o arquivo.");return}await carregar()}

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!editando) return;
    const formulario = new FormData(evento.currentTarget);
    const data = formulario.get("data_assembleia") as string;
    const resposta = await fetch(`/api/atas/${editando.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: formulario.get("titulo"),
        tipo: formulario.get("tipo"),
        data_assembleia: data ? `${data}T12:00:00-03:00` : null,
        descricao: formulario.get("descricao") || null,
        publicada: formulario.get("publicada") === "on",
      }),
    });
    const dados = await resposta.json();
    if (!resposta.ok) {
      setErro(dados.detail ?? "Não foi possível salvar a ata.");
      return;
    }
    setEditando(null);
    await carregar();
  }

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Navbar />
        <Titulo texto="Atas do condomínio" subtitulo="Consulte as deliberações e registros publicados pela gestão." />
        {podeEditarDrive&&<div className="mt-6 flex flex-wrap gap-2"><button onClick={()=>void criarPasta()} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Nova pasta</button><button onClick={escolherUpload} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">Enviar arquivo</button><input ref={inputArquivo} type="file" className="sr-only" onChange={e=>{const arquivo=e.target.files?.[0];if(arquivo)void enviarArquivo(arquivo);e.target.value=""}}/></div>}
        {erro && <p className="mt-6 rounded-xl bg-rose-50 p-4 text-rose-700">{erro}</p>}
        {carregando ? <p className="mt-8 text-slate-500">Carregando atas…</p> : atas.length === 0 && pastas.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Nenhuma ata publicada ou importada.</div>
        ) : (
          <div className="mt-8">
            <ArvoreArquivos arquivos={atas} pastas={pastas} renderArquivo={(ata) => (
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ata.publicada ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{ata.publicada ? "Publicada" : "Pendente de revisão"}</span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{ata.tipo.replaceAll("_", " ")}</span>
                    </div>
                    <h2 className="mt-1.5 truncate font-bold text-slate-950">{ata.titulo}</h2>
                    <p className="mt-1 text-sm text-slate-500">{ata.data_assembleia ? new Date(ata.data_assembleia).toLocaleDateString("pt-BR") : "Data da assembleia não informada"} · {ata.nome_arquivo} {tamanhoLegivel(ata.tamanho) && `· ${tamanhoLegivel(ata.tamanho)}`}</p>
                    {ata.descricao && <p className="mt-3 text-sm text-slate-600">{ata.descricao}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a href={`/api/atas/${ata.id}/arquivo`} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">Abrir</a>
                    {ata.pode_gerenciar && <button onClick={() => setEditando(ata)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Revisar</button>}
                  </div>
                </div>
            )}/>
          </div>
        )}

        {editando && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
            <form onSubmit={salvar} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-slate-950">Revisar ata</h2>
              <div className="mt-5 grid gap-4">
                <label className="text-sm font-bold">Título<input name="titulo" required minLength={3} maxLength={255} defaultValue={editando.titulo} className="input mt-1" /></label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold">Tipo<select name="tipo" defaultValue={editando.tipo} className="input mt-1"><option value="assembleia_ordinaria">Assembleia ordinária</option><option value="assembleia_extraordinaria">Assembleia extraordinária</option><option value="reuniao_conselho">Reunião do conselho</option><option value="assembleia">Assembleia</option></select></label>
                  <label className="text-sm font-bold">Data<input name="data_assembleia" type="date" defaultValue={dataParaInput(editando.data_assembleia)} className="input mt-1" /></label>
                </div>
                <label className="text-sm font-bold">Descrição<textarea name="descricao" maxLength={4000} defaultValue={editando.descricao ?? ""} className="input mt-1 min-h-24" /></label>
                <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm font-bold"><input name="publicada" type="checkbox" defaultChecked={editando.publicada} className="h-5 w-5" />Disponibilizar para os moradores</label>
              </div>
              <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditando(null)} className="rounded-xl px-4 py-2 font-semibold text-slate-600">Cancelar</button><button className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white">Salvar</button></div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
