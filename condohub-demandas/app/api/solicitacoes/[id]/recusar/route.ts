import { chamarApi } from "@/src/lib/backend";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return chamarApi(`/solicitacoes-acesso/${encodeURIComponent(id)}/recusar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
