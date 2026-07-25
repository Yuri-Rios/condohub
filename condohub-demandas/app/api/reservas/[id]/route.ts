import { chamarApi } from "@/src/lib/backend";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return chamarApi(`/reservas/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return chamarApi(`/reservas/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
