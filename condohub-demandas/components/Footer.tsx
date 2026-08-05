import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white/70 px-4 py-6 text-sm text-slate-600">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <p>© {new Date().getFullYear()} CondoHub</p>
        <nav aria-label="Informações legais" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link className="hover:text-blue-700" href="/privacidade">Privacidade</Link>
          <Link className="hover:text-blue-700" href="/suporte">Suporte</Link>
          <Link className="hover:text-blue-700" href="/excluir-conta">Excluir conta</Link>
        </nav>
      </div>
    </footer>
  );
}
