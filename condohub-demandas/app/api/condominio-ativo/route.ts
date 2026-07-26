import { cookies } from "next/headers";

export async function POST(request: Request) {
  const dados = (await request.json()) as { slug?: string };
  const slug = dados.slug?.trim().toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return Response.json({ detail: "Condomínio inválido." }, { status: 422 });
  }

  const armazenados = await cookies();
  armazenados.set("condohub_condominio", slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return Response.json({ slug });
}
