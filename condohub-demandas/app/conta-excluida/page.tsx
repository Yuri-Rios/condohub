import Link from "next/link";

export default function ContaExcluidaPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">Conta excluída</h1>
        <p className="mt-3 leading-7 text-slate-600">
          Seu acesso e seus dados pessoais foram removidos. Registros
          operacionais compartilhados foram anonimizados.
        </p>
        <Link href="/privacidade" className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">
          Consultar política de privacidade
        </Link>
      </section>
    </main>
  );
}
