import { clerkClient } from "@clerk/nextjs/server";
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
  clerk_invitation_id: string | null;
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resposta = await chamarApi(
    `/solicitacoes-acesso/${encodeURIComponent(id)}`,
  );
  if (!resposta.ok) return resposta;

  const solicitacao = (await resposta.json()) as Solicitacao;
  if (solicitacao.status !== "aprovada" || !solicitacao.clerk_invitation_id) {
    return Response.json(
      { detail: "Esta solicitação não possui um convite para reenviar." },
      { status: 409 },
    );
  }

  const urlPublica = process.env.NEXT_PUBLIC_APP_URL;
  if (!urlPublica) {
    return Response.json(
      { detail: "NEXT_PUBLIC_APP_URL não configurada no frontend." },
      { status: 503 },
    );
  }

  const armazenados = await cookies();
  const condominioSlug =
    armazenados.get("condohub_condominio")?.value ?? "camila-barbosa";
  const cadastroUrl = new URL("/cadastro", urlPublica);
  cadastroUrl.searchParams.set("condominio", condominioSlug);

  const client = await clerkClient();
  const usuariosExistentes = await client.users.getUserList({
    emailAddress: [solicitacao.email],
    limit: 1,
  });
  if (usuariosExistentes.data.length > 0) {
    return Response.json(
      { detail: "Este usuário já concluiu o cadastro e não precisa de outro convite." },
      { status: 409 },
    );
  }

  const novoConvite = await client.invitations.createInvitation({
    emailAddress: solicitacao.email,
    redirectUrl: cadastroUrl.toString(),
    ignoreExisting: true,
    publicMetadata: {
      condominio: condominioSlug,
      papelSolicitado: solicitacao.tipo,
      nome: solicitacao.nome,
      bloco: solicitacao.bloco,
      apartamento: solicitacao.apartamento,
    },
  });

  const atualizacao = await chamarApi(
    `/solicitacoes-acesso/${encodeURIComponent(id)}/atualizar-convite`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitation_id: novoConvite.id }),
    },
  );

  if (!atualizacao.ok) {
    await client.invitations.revokeInvitation(novoConvite.id).catch(() => null);
    return atualizacao;
  }

  await client.invitations
    .revokeInvitation(solicitacao.clerk_invitation_id)
    .catch(() => null);

  return atualizacao;
}
