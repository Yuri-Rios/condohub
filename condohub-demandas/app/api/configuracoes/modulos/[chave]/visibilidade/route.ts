import { chamarApi } from "@/src/lib/backend";

export async function PATCH(request: Request, { params }: { params: Promise<{ chave: string }> }) {
  const { chave } = await params;
  return chamarApi(`/configuracoes/modulos/${encodeURIComponent(chave)}/visibilidade`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
