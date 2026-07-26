import { SignUp } from "@clerk/nextjs";

import AquecerApi from "@/components/AquecerApi";

export default function CadastroPage() {
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
            <p className="text-xl font-bold tracking-tight text-slate-950">
              CondoHub
            </p>
            <p className="text-xs font-medium text-slate-500">
              Conclua seu cadastro
            </p>
          </div>
        </div>

        <SignUp
          path="/cadastro"
          routing="path"
          signInUrl="/entrar"
          forceRedirectUrl="/ocorrencias"
          appearance={{
            variables: {
              colorPrimary: "#2563eb",
              borderRadius: "0.875rem",
            },
            elements: {
              rootBox: "w-full",
              cardBox:
                "w-full shadow-[0_16px_50px_rgba(15,23,42,0.12)]",
              card: "w-full border border-slate-200/80",
              headerTitle: "text-slate-950",
              headerSubtitle: "text-slate-500",
              formButtonPrimary: "bg-blue-600 hover:bg-blue-700",
            },
          }}
        />
      </div>
    </main>
  );
}
