import { chamarApi } from "@/src/lib/backend";

export async function GET() {
  return chamarApi("/ocorrencias");
}

export async function POST(request: Request) {
  return chamarApi("/ocorrencias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
