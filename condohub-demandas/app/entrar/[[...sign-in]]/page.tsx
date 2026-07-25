import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function EntrarPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-5">
        <SignIn
          path="/entrar"
          routing="path"
          signUpUrl="/solicitar-acesso"
          forceRedirectUrl="/ocorrencias"
        />

        <section className="w-full rounded-xl border border-blue-200 bg-white p-5 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Ainda não tem acesso?
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Envie seus dados para análise do síndico. Após a aprovação, você
            receberá o convite por e-mail.
          </p>
          <Link
            href="/solicitar-acesso"
            className="mt-4 block w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-800"
          >
            Solicitar acesso
          </Link>
        </section>
      </div>
    </main>
  );
}
