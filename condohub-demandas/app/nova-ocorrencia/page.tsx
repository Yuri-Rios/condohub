"use client";

import { useState, type FormEvent } from "react";

import Titulo from "@/components/Titulo";
import Input from "@/components/Input";
import Navbar from "@/components/Navbar";
import CampoComReferencias from "@/components/CampoComReferencias";

export default function NovaOcorrenciaPage() {
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [fotos, setFotos] = useState<File[]>([]);

  async function salvarOcorrencia(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!titulo || !local || !descricao) {
      alert("Preencha todos os campos.");
      return;
    }

    setSalvando(true);

    try {
      const resposta = await fetch("/api/ocorrencias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ titulo, local, descricao }),
      });

      if (!resposta.ok) {
        throw new Error();
      }

      const chamado = await resposta.json() as { id: number };
      if (fotos.length > 0) {
        const dados = new FormData(); fotos.forEach((foto) => dados.append("arquivos", foto));
        const envio = await fetch(`/api/ocorrencias/${chamado.id}/anexos`, { method: "POST", body: dados });
        if (!envio.ok) {
          const detalhe = await envio.json().catch(() => null);
          alert(`Chamado criado, mas as fotos não foram enviadas: ${detalhe?.detail ?? "tente anexá-las na conversa."}`);
        } else alert("Chamado e fotos enviados com sucesso.");
      } else alert("Ocorrência salva com sucesso.");

      setTitulo("");
      setLocal("");
      setDescricao("");
      setFotos([]);
    } catch {
      alert("Erro ao salvar. Verifique sua sessão e tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
      <Navbar />

      <Titulo
        texto="Novo chamado"
        subtitulo="Conte o que aconteceu e informe onde a equipe deve verificar."
      />

      <form
        onSubmit={salvarOcorrencia}
        className="mt-8 max-w-2xl space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-8"
      >
        <Input
          label="Título"
          placeholder="Ex.: Vazamento próximo ao portão"
          value={titulo}
          onChange={setTitulo}
        />

        <Input
          label="Local"
          placeholder="Ex.: Garagem, próximo à vaga 12"
          value={local}
          onChange={setLocal}
        />

        <label className="block text-sm font-semibold text-slate-700">Descrição
          <CampoComReferencias rows={5} placeholder="Descreva o problema. Use # para chamados, @ para pessoas e $ para pedidos." value={descricao} onChange={setDescricao} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 font-normal text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
        </label>

        <label className="block text-sm font-semibold text-slate-700">Fotos <span className="font-normal text-slate-400">(opcional)</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(evento) => setFotos(Array.from(evento.target.files ?? []).slice(0, 5))} className="mt-2 block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" />
          <span className="mt-2 block text-xs font-normal text-slate-500">Até 5 imagens JPEG, PNG ou WebP, com no máximo 8 MB cada. No celular, você pode usar a câmera ou a galeria.</span>
          {fotos.length > 0 && <span className="mt-2 block text-xs font-semibold text-blue-700">{fotos.length} foto(s) selecionada(s)</span>}
        </label>

        <button
          type="submit"
          disabled={salvando}
          className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {salvando ? "Enviando chamado..." : "Enviar chamado"}
        </button>
      </form>
      </div>
    </main>
  );
}
