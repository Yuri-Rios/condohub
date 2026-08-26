import { chamarApi } from "@/src/lib/backend";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const intervalo = request.headers.get("range");
  return chamarApi(`/atas/${id}/arquivo`, {
    headers: intervalo ? { Range: intervalo } : undefined,
  });
}
