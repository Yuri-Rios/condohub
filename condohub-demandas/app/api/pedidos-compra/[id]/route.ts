import { chamarApi } from "@/src/lib/backend";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return chamarApi(`/pedidos-compra/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return chamarApi(`/pedidos-compra/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
