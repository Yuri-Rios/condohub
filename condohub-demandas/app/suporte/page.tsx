import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Suporte | CondoHub",
  description: "Ajuda e contato do CondoHub.",
};

const EMAIL_SUPORTE =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "fyuriosb@icloud.com";

export default function SuportePage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <Link href="/" className="font-bold text-blue-700">← CondoHub</Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950">Suporte</h1>
        <p className="mt-3 leading-7 text-slate-600">
          Para problemas de acesso, dúvidas sobre seus dados ou funcionamento
          do aplicativo, fale com o suporte do CondoHub.
        </p>
        <a href={`mailto:${EMAIL_SUPORTE}?subject=Suporte%20CondoHub`} className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">
          Enviar e-mail para {EMAIL_SUPORTE}
        </a>
        <div className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="font-bold text-slate-950">Antes de entrar em contato</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-600">
            <li>Informe o condomínio e descreva o problema.</li>
            <li>Não envie senhas ou códigos de autenticação.</li>
            <li>Para excluir a conta, use a opção disponível no próprio app.</li>
          </ul>
        </div>
        <div className="mt-7 flex flex-wrap gap-4 text-sm font-semibold">
          <Link className="text-blue-700 underline" href="/privacidade">Política de Privacidade</Link>
          <Link className="text-blue-700 underline" href="/excluir-conta">Exclusão de conta</Link>
        </div>
      </section>
    </main>
  );
}
