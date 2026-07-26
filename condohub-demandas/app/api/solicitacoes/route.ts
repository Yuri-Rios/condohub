import { chamarApi, chamarApiPublica } from "@/src/lib/backend";

export async function GET() {
  return chamarApi("/solicitacoes-acesso");
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const condominio = url.searchParams.get("condominio");
  return chamarApiPublica("/solicitacoes-acesso", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(condominio ? { "X-Condominio-Slug": condominio } : {}),
    },
    body: await request.text(),
  });
}
