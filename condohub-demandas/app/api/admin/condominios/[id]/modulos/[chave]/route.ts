import { chamarApi } from "@/src/lib/backend";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; chave: string }> }) {
  const { id, chave } = await params;
  return chamarApi(`/admin/condominios/${encodeURIComponent(id)}/modulos/${encodeURIComponent(chave)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
