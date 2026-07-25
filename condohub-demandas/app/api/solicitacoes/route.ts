import { chamarApi, chamarApiPublica } from "@/src/lib/backend";

export async function GET() {
  return chamarApi("/solicitacoes-acesso");
}

export async function POST(request: Request) {
  return chamarApiPublica("/solicitacoes-acesso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
