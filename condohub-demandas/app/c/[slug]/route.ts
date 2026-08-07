import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

export async function GET(
  _request: Request,
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
  const urlPublica = process.env.NEXT_PUBLIC_APP_URL;
  if (!urlPublica) {
    return Response.json(
      { detail: "NEXT_PUBLIC_APP_URL não configurada no frontend." },
      { status: 503 },
    );
  }

  const { userId } = await auth();
  const destino = new URL(
    userId ? "/ocorrencias" : "/solicitar-acesso",
    urlPublica,
  );
  if (!userId) destino.searchParams.set("condominio", slug);
  return Response.redirect(destino);
}
