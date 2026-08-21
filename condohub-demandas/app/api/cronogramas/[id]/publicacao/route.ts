import { chamarApi } from "@/src/lib/backend";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return chamarApi(`/cronogramas/${encodeURIComponent(id)}/publicacao`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
