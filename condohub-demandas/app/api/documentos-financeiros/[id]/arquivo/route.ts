import { chamarApi } from "@/src/lib/backend";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const intervalo = request.headers.get("range");
  return chamarApi(`/documentos-financeiros/${encodeURIComponent(id)}/arquivo`, {
    headers: intervalo ? { Range: intervalo } : undefined,
    redirect: "manual",
  });
}
