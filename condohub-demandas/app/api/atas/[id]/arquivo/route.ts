import { chamarApi } from "@/src/lib/backend";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return chamarApi(`/atas/${id}/arquivo`);
}
