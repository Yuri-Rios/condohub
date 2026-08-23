import { chamarApi } from "@/src/lib/backend";

export async function PUT(request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  return chamarApi(`/integracoes/onedrive/pastas/${encodeURIComponent(tipo)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: await request.text() });
}
