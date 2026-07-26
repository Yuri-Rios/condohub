import { chamarApi } from "@/src/lib/backend";

export async function GET() {
  return chamarApi("/admin/condominios");
}

export async function POST(request: Request) {
  return chamarApi("/admin/condominios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
