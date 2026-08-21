import { chamarApi } from "@/src/lib/backend";

export async function GET() {
  return chamarApi("/cronogramas");
}

export async function POST(request: Request) {
  return chamarApi("/cronogramas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
