# Checklist de revisão da App Store — CondoHub

## URLs públicas

- Política de privacidade: `https://condohub-app.onrender.com/privacidade`
- Suporte: `https://condohub-app.onrender.com/suporte`
- Exclusão de conta: `https://condohub-app.onrender.com/excluir-conta`

As três URLs precisam responder publicamente após o deploy.

## Informações para App Review

Preencher uma conta de demonstração que tenha acesso a um condomínio de teste,
com dados suficientes para navegar pelos chamados, mensagens e demais recursos.

- Usuário de demonstração: `[PREENCHER NO APP STORE CONNECT]`
- Senha: `[PREENCHER NO APP STORE CONNECT]`
- Condomínio: `[PREENCHER NO APP STORE CONNECT]`

Notas sugeridas para o revisor:

> O CondoHub é uma plataforma de gestão condominial. O acesso aos dados exige
> vínculo com um condomínio. Use a conta de demonstração fornecida para acessar
> todas as telas. A exclusão da conta está disponível em Conta > Excluir conta.
> A política de privacidade e o suporte estão disponíveis no rodapé, inclusive
> sem autenticação.

O backend e o frontend devem permanecer ativos durante toda a revisão.

## Privacidade no App Store Connect

Declarar somente o que corresponde à configuração de produção. Para a versão
atual, os dados tratados e vinculados à identidade incluem:

- Informações de contato: nome e e-mail;
- Conteúdo do usuário: chamados, mensagens, solicitações e informações enviadas;
- Identificadores: identificador interno da conta;
- Outros dados: vínculo, função, bloco e apartamento no condomínio;
- Foto de perfil, quando fornecida pelo usuário.

Finalidade: **App Functionality**. O app não usa esses dados para rastreamento,
publicidade de terceiros ou venda de dados. Confirmar no Clerk e no Render se
nenhum recurso adicional de analytics ou monitoramento foi habilitado antes de
responder definitivamente ao questionário.

## Outros formulários

- Criptografia: o app não implementa algoritmos próprios ou não isentos;
- Anúncios: não contém anúncios;
- Criação de conta: sim;
- Exclusão dentro do app: sim, em `Conta > Excluir conta`;
- Classificação etária: responder conforme o conteúdo real, sem conteúdo adulto;
- Login social: se Google, Facebook ou outro login social estiver habilitado no
  Clerk, habilitar também Sign in with Apple ou confirmar documentalmente uma
  exceção aplicável antes da revisão.

## Verificações antes de enviar

1. Fazer deploy do frontend e da API.
2. Abrir as três URLs públicas em janela anônima.
3. Criar uma conta descartável e testar a exclusão ponta a ponta.
4. Confirmar que a conta desapareceu do Clerk e que o login antigo não funciona.
5. Testar o build no TestFlight.
6. Capturar telas reais do app para iPhone e, se mantido o suporte, iPad.
7. Selecionar o build na versão 1.0 e preencher as credenciais do revisor.

