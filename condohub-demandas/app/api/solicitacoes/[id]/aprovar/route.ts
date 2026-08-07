import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import { chamarApi } from "@/src/lib/backend";

type Solicitacao = {
  id: number;
  nome: string;
  email: string;
  tipo: "morador" | "funcionario";
  bloco: string | null;
  apartamento: string | null;
  status: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  const { id } = await params;
  const resposta = await chamarApi(`/solicitacoes-acesso/${encodeURIComponent(id)}`);

  if (!resposta.ok) return resposta;

  const solicitacao = (await resposta.json()) as Solicitacao;
  if (solicitacao.status !== "pendente") {
    return Response.json({ detail: "Solicitação já decidida." }, { status: 409 });
  }

  const client = await clerkClient();
  const usuariosExistentes = await client.users.getUserList({
    emailAddress: [solicitacao.email],
    limit: 1,
  });
  const usuarioExistente = usuariosExistentes.data[0];
  if (usuarioExistente) {
    return chamarApi(
      `/solicitacoes-acesso/${encodeURIComponent(id)}/confirmar`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerk_user_id: usuarioExistente.id }),
      },
    );
  }

  const armazenados = await cookies();
  const condominioSlug =
    armazenados.get("condohub_condominio")?.value ?? "camila-barbosa";
  const urlPublica = process.env.NEXT_PUBLIC_APP_URL;
  if (!urlPublica) {
    return Response.json(
      { detail: "NEXT_PUBLIC_APP_URL não configurada no frontend." },
      { status: 503 },
    );
  }

  const cadastroUrl = new URL("/cadastro", urlPublica);
  cadastroUrl.searchParams.set("condominio", condominioSlug);
  const convite = await client.invitations.createInvitation({
    emailAddress: solicitacao.email,
    redirectUrl: cadastroUrl.toString(),
    publicMetadata: {
      condominio: condominioSlug,
      papelSolicitado: solicitacao.tipo,
      nome: solicitacao.nome,
      bloco: solicitacao.bloco,
      apartamento: solicitacao.apartamento,
    },
  });

  return chamarApi(
    `/solicitacoes-acesso/${encodeURIComponent(id)}/confirmar`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitation_id: convite.id }),
    },
  );
}
