import { chamarApi } from "@/src/lib/backend";

export async function GET(request: Request) {
  const tipo = new URL(request.url).searchParams.get("tipo") ?? "";
  return chamarApi(`/documentos-financeiros?tipo=${encodeURIComponent(tipo)}`);
}
