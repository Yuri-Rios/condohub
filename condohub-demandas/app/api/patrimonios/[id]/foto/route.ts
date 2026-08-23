import { chamarApi } from "@/src/lib/backend";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return chamarApi(`/patrimonios/${encodeURIComponent(id)}/foto`, {
    method: "POST",
    headers: { "Content-Type": request.headers.get("content-type") ?? "multipart/form-data" },
    body: await request.arrayBuffer(),
  });
}
