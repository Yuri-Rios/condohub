import { chamarApi } from "@/src/lib/backend";

export async function GET() {
  return chamarApi("/patrimonios");
}

export async function POST(request: Request) {
  return chamarApi("/patrimonios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
