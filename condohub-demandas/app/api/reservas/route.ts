import { chamarApi } from "@/src/lib/backend";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return chamarApi(`/reservas?${url.searchParams.toString()}`);
}

export async function POST(request: Request) {
  return chamarApi("/reservas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
