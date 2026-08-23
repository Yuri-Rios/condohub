import { chamarApi } from "@/src/lib/backend";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; anexoId: string }> }) {
  const { id, anexoId } = await params;
  return chamarApi(`/pedidos-compra/${encodeURIComponent(id)}/anexos/${encodeURIComponent(anexoId)}/arquivo`);
}
