This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Criação

a pasta foi criada com o seguinte comando:

```
npx create-next-app@latest condohub-demandas
```

Notas:
------------------------------------------------------
Python         → JavaScript/TypeScript
Django/FastAPI → Next.js
pip            → npm
venv           → node_modules

------------------------------------------------------
Agora vem o conceito mais importante do React:
Componente = função que retorna interface.
Você já fez um componente (NovaOcorrencia). Agora vamos criar outro.

------------------------------------------------------

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Aplicativo Android (Capacitor)

O projeto Android fica em `android/` e carrega a aplicação Next.js hospedada.
Por padrão, usa `https://condohub-app.onrender.com`. Para apontar para outro
ambiente, defina `CAPACITOR_SERVER_URL` antes de sincronizar:

```bash
CAPACITOR_SERVER_URL=https://app.exemplo.com npm run android:sync
```

Para testar com o Next.js local no emulador Android:

```bash
npm run dev
CAPACITOR_SERVER_URL=http://10.0.2.2:3000 npm run android:sync
npm run android:open
```

Instale o Android Studio e, pelo SDK Manager, o Android SDK antes do primeiro
build. Depois, gere um APK de desenvolvimento com:

```bash
npm run android:build
```

O arquivo será criado em
`android/app/build/outputs/apk/debug/app-debug.apk`. Para publicar na Play
Store ainda é necessário configurar assinatura e gerar um Android App Bundle
de release.

Para gerar o Android App Bundle com a URL pública:

```bash
CAPACITOR_SERVER_URL=https://condohub-app.onrender.com npm run android:bundle
```

O `.aab` de release precisa ser assinado com uma chave de upload antes de ser
aceito pelo Play Console. Não versione arquivos `.jks`, `.keystore` ou suas
senhas.

## Privacidade e publicação nas lojas

O app disponibiliza publicamente `/privacidade`, `/suporte` e
`/excluir-conta`. Usuários autenticados podem excluir a conta em `/conta`; o
fluxo remove a identidade no Clerk, apaga dados pessoais dispensáveis e
anonimiza registros operacionais compartilhados no banco.

Antes de publicar, configure `NEXT_PUBLIC_SUPPORT_EMAIL`, faça deploy conjunto
do frontend e da API e siga o checklist em `docs/app-store-review.md`.

## Autenticação, condomínios e papéis

O frontend usa Clerk e a API FastAPI valida o mesmo token antes de ler ou
alterar dados. O Clerk mantém apenas a identidade e a sessão. Condomínios,
vínculos e papéis ficam no Postgres, pois uma pessoa pode ter funções diferentes
em condomínios distintos.

Os papéis aceitos por vínculo são combináveis:

- `morador`
- `sindico`
- `subsindico`
- `funcionario`
- `admin`

Um usuário sem vínculo ativo não tem acesso aos dados do condomínio. Toda
requisição de negócio recebe `X-Condominio-Slug`; o servidor valida o vínculo
antes de consultar chamados, solicitações ou reservas.

Somente `sindico`, `subsindico`, `funcionario` e `admin` podem atualizar ocorrências. Somente
`sindico` e `admin` podem decidir solicitações de acesso.

`admin` é um papel do condomínio. Administradores da plataforma são mantidos
separadamente em `administradores_plataforma`.

### Configurar o Clerk

1. Crie uma aplicação no Clerk e copie `.env.example` para `.env.local`.
2. Preencha `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY`.
3. Durante a migração dos usuários antigos, mantenha em
   **Sessions > Customize session token** o claim:

```json
{
  "metadata": "{{user.public_metadata}}"
}
```

4. Não configure papéis globais para usuários novos. A aprovação da solicitação
   cria o vínculo no condomínio correto.
5. Em **Restrictions**, ative o modo **Restricted**. Novas pessoas solicitam
   acesso em `/solicitar-acesso`; após a aprovação, o sistema cria o convite e
   o Clerk envia o e-mail de cadastro.

O condomínio inicial é `camila-barbosa`. Defina outro valor com
`CONDOMINIO_PADRAO_SLUG` quando necessário.

### Configurar o Render

No serviço do frontend, configure as mesmas variáveis do `.env.example`. Em
produção, `API_URL` deve conter a URL interna ou pública do FastAPI no Render.
Essa variável é acessada somente pelo servidor Next.js; o navegador sempre usa
o caminho único `/api/ocorrencias`.

No serviço FastAPI, configure:

- `CLERK_ISSUER`: domínio da instância, por exemplo
  `https://example.clerk.accounts.dev`
- `CLERK_SECRET_KEY`: chave usada pela API somente ao registrar com segurança
  o nome e a foto do autor de chamados e mensagens
- `CLERK_AUDIENCE`: opcional; use apenas se o claim `aud` tiver sido
  configurado no Clerk

Depois instale as dependências Python atualizadas de `condohub-api/requirements.txt`.
As migrações multi-tenant `006` e `007` são idempotentes e executadas na
inicialização da API, inclusive no Render.

## Integração com OneDrive para documentos

Os módulos `/atas`, `/balancetes` e `/orcamentos` catalogam documentos mantidos
no OneDrive pessoal do condomínio. Os arquivos continuam pertencendo ao cliente;
o CondoHub guarda metadados e controla quais documentos foram publicados.

Para configurar:

1. Registre um aplicativo na Microsoft identity platform aceitando contas
   Microsoft pessoais.
2. Cadastre como redirect URI do tipo Web a URL pública da API seguida de
   `/integracoes/onedrive/callback`.
3. Configure no serviço FastAPI as variáveis `MICROSOFT_CLIENT_ID`,
   `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`,
   `MICROSOFT_OAUTH_STATE_SECRET` e `MICROSOFT_TOKEN_ENCRYPTION_KEY`.
4. Gere a chave de criptografia uma única vez com o comando documentado em
   `.env.example`. Trocar essa chave invalida as conexões já armazenadas.
5. No aplicativo, um síndico ou administrador acessa `Administração > OneDrive`,
   conecta a conta e informa as pastas existentes de atas, balancetes e orçamentos.

A integração solicita os escopos delegados `Files.ReadWrite`, `User.Read` e
`offline_access`. A sincronização é manual e recursiva. Atas aceitam PDF e Word;
balancetes e orçamentos também aceitam Excel. Todo documento entra pendente de revisão.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
