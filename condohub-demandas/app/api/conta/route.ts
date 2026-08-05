import { auth, clerkClient } from "@clerk/nextjs/server";

import { chamarApi } from "@/src/lib/backend";

export async function DELETE() {
  const { userId } = await auth.protect();
  const resposta = await chamarApi("/me/dados", { method: "DELETE" });

  if (!resposta.ok) return resposta;

  try {
    const client = await clerkClient();
    await client.users.deleteUser(userId);
  } catch {
    return Response.json(
      {
        detail:
          "Seus dados do condomínio foram removidos, mas não foi possível encerrar o login. Tente novamente ou contate o suporte.",
      },
      { status: 502 },
    );
  }

  return new Response(null, { status: 204 });
}
