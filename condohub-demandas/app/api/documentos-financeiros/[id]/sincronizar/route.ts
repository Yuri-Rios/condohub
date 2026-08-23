import { chamarApi } from "@/src/lib/backend";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return chamarApi(`/documentos-financeiros/${encodeURIComponent(id)}/sincronizar`, { method: "POST" });
}
