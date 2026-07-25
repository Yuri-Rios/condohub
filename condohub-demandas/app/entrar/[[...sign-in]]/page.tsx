import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

import AquecerApi from "@/components/AquecerApi";

export default function EntrarPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <AquecerApi />
      <div className="absolute left-[-8rem] top-[-8rem] h-80 w-80 rounded-full bg-blue-200/50 blur-3xl" />
      <div className="absolute bottom-[-10rem] right-[-8rem] h-96 w-96 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="relative flex w-full max-w-md flex-col items-center gap-5">
        <div className="mb-2 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-base font-black text-white shadow-lg shadow-blue-200">
            CH
          </span>
          <div>
            <p className="text-xl font-bold tracking-tight text-slate-950">CondoHub</p>
            <p className="text-xs font-medium text-slate-500">Chamados do condomínio</p>
          </div>
        </div>
        <SignIn
          path="/entrar"
          routing="path"
          signUpUrl="/solicitar-acesso"
          forceRedirectUrl="/ocorrencias"
          appearance={{
            variables: {
              colorPrimary: "#2563eb",
              borderRadius: "0.875rem",
            },
            elements: {
              rootBox: "w-full",
              cardBox: "w-full shadow-[0_16px_50px_rgba(15,23,42,0.12)]",
              card: "w-full border border-slate-200/80",
              headerTitle: "text-slate-950",
              headerSubtitle: "text-slate-500",
              formButtonPrimary: "bg-blue-600 hover:bg-blue-700",
            },
          }}
        />

        <section className="w-full rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Ainda não tem acesso?
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Envie seus dados para análise do síndico. Após a aprovação, você
            receberá o convite por e-mail.
          </p>
          <Link
            href="/solicitar-acesso"
            className="mt-4 block w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Solicitar acesso
          </Link>
        </section>
      </div>
    </main>
  );
}
