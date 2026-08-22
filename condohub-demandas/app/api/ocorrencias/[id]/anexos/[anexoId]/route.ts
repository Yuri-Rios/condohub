import { chamarApi } from "@/src/lib/backend";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; anexoId: string }> }) {
  const { id, anexoId } = await params;
  return chamarApi(`/ocorrencias/${encodeURIComponent(id)}/anexos/${encodeURIComponent(anexoId)}`, { method: "DELETE" });
}
