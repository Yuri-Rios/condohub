import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
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
  const destino = new URL("/solicitar-acesso", request.url);
  destino.searchParams.set("condominio", slug);
  return Response.redirect(destino);
}
