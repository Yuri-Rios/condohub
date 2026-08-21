import { chamarApi } from "@/src/lib/backend";

export async function PUT(request: Request) {
  return chamarApi("/integracoes/onedrive/pasta", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
