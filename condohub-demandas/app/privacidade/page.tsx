import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade | CondoHub",
  description: "Como o CondoHub coleta, usa, protege e exclui dados pessoais.",
};

const EMAIL_SUPORTE =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "fyuriosb@icloud.com";

export default function PrivacidadePage() {
  return (
    <main className="px-4 py-10 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="font-bold text-blue-700">← CondoHub</Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-slate-500">Última atualização: 5 de agosto de 2026</p>

        <div className="mt-8 space-y-8 leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-bold text-slate-950">1. Responsável</h2>
            <p className="mt-2">
              O CondoHub, disponibilizado por Francisco Yuri Rios Barroso, é
              responsável pelo tratamento descrito nesta política. Dúvidas e
              solicitações podem ser enviadas para <a className="font-semibold text-blue-700 underline" href={`mailto:${EMAIL_SUPORTE}`}>{EMAIL_SUPORTE}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-950">2. Dados tratados</h2>
            <p className="mt-2">Conforme as funcionalidades utilizadas, tratamos:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>identificação e contato, como nome, e-mail e foto de perfil;</li>
              <li>dados do vínculo condominial, como condomínio, função, bloco e apartamento;</li>
              <li>conteúdo enviado no app, incluindo chamados, mensagens, reações e solicitações;</li>
              <li>reservas, pedidos de compra e registros administrativos relacionados ao condomínio;</li>
              <li>dados técnicos essenciais de sessão, segurança e diagnóstico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-950">3. Finalidades</h2>
            <p className="mt-2">
              Os dados são usados para autenticar usuários, validar o acesso ao
              condomínio, operar chamados e reservas, permitir a gestão
              condominial, manter a segurança e prestar suporte. Não vendemos
              dados pessoais nem os utilizamos para publicidade comportamental.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-950">4. Serviços utilizados</h2>
            <p className="mt-2">
              Utilizamos prestadores necessários à operação: Clerk para
              autenticação, Render para hospedagem da aplicação e Neon/Postgres
              para banco de dados. Esses prestadores tratam dados conforme suas
              próprias políticas e nossas instruções operacionais.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-950">5. Compartilhamento</h2>
            <p className="mt-2">
              Informações condominiais são visíveis somente a usuários
              autorizados, conforme seus papéis. Dados podem ser disponibilizados
              a autoridades quando houver obrigação legal. Não compartilhamos
              dados com redes de anúncios ou corretores de dados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-950">6. Retenção e exclusão</h2>
            <p className="mt-2">
              Mantemos dados enquanto a conta estiver ativa e pelo período
              necessário à operação, segurança e obrigações legais. Ao excluir
              a conta, removemos a identidade de login, vínculos, reservas,
              reações e solicitações de acesso. Registros operacionais
              compartilhados podem ser conservados de forma anonimizada para
              preservar o histórico e a prestação de contas do condomínio.
            </p>
            <p className="mt-3">
              A exclusão pode ser iniciada em <strong>Conta → Excluir conta</strong> no app ou pela <Link className="font-semibold text-blue-700 underline" href="/excluir-conta">página pública de exclusão</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-950">7. Segurança e direitos</h2>
            <p className="mt-2">
              Adotamos conexões criptografadas, autenticação e controles de
              acesso por condomínio. Você pode solicitar acesso, correção ou
              exclusão de dados pelo suporte. Algumas informações poderão ser
              mantidas quando exigidas por lei ou necessárias ao exercício de direitos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-950">8. Alterações</h2>
            <p className="mt-2">
              Esta política poderá ser atualizada para refletir mudanças no app
              ou em requisitos legais. A data da versão vigente será indicada no topo.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
