import { NextRequest } from "next/server";
import { chamarApi } from "@/src/lib/backend";

export async function GET(request: NextRequest) {
  const caminho = request.nextUrl.searchParams.get("caminho") ?? "/";
  return chamarApi(`/integracoes/onedrive/pastas?caminho=${encodeURIComponent(caminho)}`);
}
