import { chamarApi } from "@/src/lib/backend";

export async function POST() {
  return chamarApi("/integracoes/onedrive/conectar", { method: "POST" });
}
