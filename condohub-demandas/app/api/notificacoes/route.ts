import { chamarApi } from "@/src/lib/backend";

export async function GET() {
  return chamarApi("/notificacoes-ocorrencias/contagem");
}
