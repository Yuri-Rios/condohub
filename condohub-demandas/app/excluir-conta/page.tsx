import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Excluir conta | CondoHub",
  description: "Solicite a exclusão da sua conta e dos seus dados no CondoHub.",
};

const EMAIL_SUPORTE =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "fyuriosb@icloud.com";

export default function ExcluirContaPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <Link href="/" className="font-bold text-blue-700">← CondoHub</Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950">Exclusão de conta e dados</h1>
        <p className="mt-4 leading-7 text-slate-600">
          Entre na sua conta para confirmar a exclusão com segurança. O processo
          remove o login, vínculos condominiais, reservas, reações e solicitações
          de acesso. Registros compartilhados do condomínio são anonimizados.
        </p>
        <Link href="/conta" className="mt-6 inline-flex rounded-xl bg-rose-600 px-5 py-3 font-bold text-white">
          Entrar e excluir minha conta
        </Link>
        <p className="mt-6 text-sm leading-6 text-slate-500">
          Se você não consegue entrar, solicite a exclusão pelo e-mail <a className="font-semibold text-blue-700 underline" href={`mailto:${EMAIL_SUPORTE}?subject=Exclus%C3%A3o%20de%20conta%20CondoHub`}>{EMAIL_SUPORTE}</a>. Para proteger sua conta, poderemos pedir informações para confirmar sua identidade.
        </p>
      </section>
    </main>
  );
}
