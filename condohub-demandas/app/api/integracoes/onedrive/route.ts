import { chamarApi } from "@/src/lib/backend";

export async function GET() {
  return chamarApi("/integracoes/onedrive");
}

export async function DELETE() {
  return chamarApi("/integracoes/onedrive", { method: "DELETE" });
}
