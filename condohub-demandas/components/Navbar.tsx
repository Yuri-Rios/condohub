"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const ativo = (rota: string) =>
    pathname === rota
      ? "bg-blue-700 text-white"
      : "bg-white text-blue-700 hover:bg-blue-100";

  return (
    <nav className="mb-6 flex gap-3">
      <Link
        href="/nova-ocorrencia"
        className={`rounded px-4 py-2 border ${ativo("/nova-ocorrencia")}`}
      >
        Nova Ocorrência
      </Link>

      <Link
        href="/ocorrencias"
        className={`rounded px-4 py-2 border ${ativo("/ocorrencias")}`}
      >
        Ocorrências
      </Link>
    </nav>
  );
}