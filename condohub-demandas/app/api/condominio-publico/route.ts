import { chamarApiPublica } from "@/src/lib/backend";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const condominio = url.searchParams.get("condominio");
  return chamarApiPublica("/condominio-publico", {
    headers: condominio ? { "X-Condominio-Slug": condominio } : {},
  });
}
