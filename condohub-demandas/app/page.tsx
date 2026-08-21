import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { chamarApi } from "@/src/lib/backend";

export default async function Home() {
  await auth.protect();
  const resposta = await chamarApi("/me");
  if (!resposta.ok) redirect("/conta");
  const acesso = await resposta.json() as {
    papeis: string[];
    modulos: Record<string, { habilitado: boolean; visivel_moradores: boolean }>;
  };
  const gestor = acesso.papeis.some((papel) => ["sindico", "subsindico", "funcionario", "admin"].includes(papel));
  const rotas = [
    ["chamados", "/ocorrencias"], ["agendamentos", "/agendamentos"], ["atas", "/atas"],
    ["acompanhamento", "/acompanhamento"], ["compras", "/pedidos-compra"],
    ["estoque", "/estoque"], ["prestadores", "/prestadores"], ["cronogramas", "/cronogramas"],
  ];
  const primeira = rotas.find(([chave]) => {
    const modulo = acesso.modulos[chave];
    if (chave === "agendamentos" && !acesso.papeis.includes("morador")) return false;
    return modulo?.habilitado && (gestor || modulo.visivel_moradores);
  });
  redirect(primeira?.[1] ?? "/conta");
}
