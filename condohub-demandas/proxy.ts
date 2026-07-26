import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(async (auth, request) => {
  const caminho = request.nextUrl.pathname;
  const solicitacaoPublica =
    caminho === "/solicitar-acesso" ||
    caminho.startsWith("/cadastro") ||
    caminho === "/api/health" ||
    (caminho === "/api/solicitacoes" && request.method === "POST");

  if (!caminho.startsWith("/entrar") && !solicitacaoPublica) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
