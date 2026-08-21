import { chamarApi } from "@/src/lib/backend";

export async function POST() {
  return chamarApi("/atas/sincronizar", { method: "POST" });
}
