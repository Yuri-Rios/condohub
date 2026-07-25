import { auth, clerkClient } from "@clerk/nextjs/server";

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
  _request: Request,
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
  const convite = await client.invitations.createInvitation({
    emailAddress: solicitacao.email,
    publicMetadata: {
      roles: [solicitacao.tipo],
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
