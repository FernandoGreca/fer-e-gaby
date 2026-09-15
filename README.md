# Fer + Gaby

Lista de presentes pública de Fer e Gaby, com edição por uma única conta administrativa.

- **Site:** https://fernandogreca.github.io/lista-de-presentes/
- **Repositório:** https://github.com/FernandoGreca/lista-de-presentes
- **Supabase:** projeto `gbhnuttdygjhdkulnpmi`

## Desenvolvimento

Requisitos: Node.js 22 e npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000/lista-de-presentes/`. O caminho também é usado na exportação, nos testes e no GitHub Pages.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:public
```

`npm run build` gera `out/`. Para conferir exatamente os arquivos publicados, execute `node scripts/serve-static.mjs`.

## Uso

Escolha **Lista presentes Fer** ou **Lista presentes Gaby**. Os desejos são ordenados por prioridade e, em caso de empate, pelos mais recentes. Combine filtros de prioridade, preço e etiqueta. Preços desconhecidos ficam fora de filtros numéricos. O preço é filtrado no valor da moeda cadastrada; não há conversão cambial.

**Já ganhamos** abre o histórico, ordenado pela data de recebimento. **Modo de edição** solicita somente a senha compartilhada. A sessão persiste neste navegador; use **Sair** ao terminar em dispositivos compartilhados.

No modo de edição é possível cadastrar, editar, excluir e marcar como ganho. O formulário aceita cadastro manual completo. Colar um link inicia a tentativa de extração; **Preencher pelo link** permite repetir. Dados preenchidos manualmente e alterações feitas durante a busca são preservados. Imagens indisponíveis exibem um placeholder.

## Arquitetura

Next.js App Router + TypeScript, exportação estática, Tailwind CSS, TanStack Query, React Hook Form + Zod, Radix Dialog, Supabase Auth/Postgres e Edge Function.

Não há servidor Next.js na hospedagem. As imagens são URLs externas sem otimização de servidor. O cliente consulta diretamente o Supabase com a chave publicável. Não há reservas nem intenção de compra.

## Banco e autenticação

A migration em `supabase/migrations/` cria:

- Exatamente duas listas fixas e presentes com enums, restrições, índices e normalização de etiquetas.
- RLS com leitura pública. Escrita de presentes limitada ao UUID administrativo; outras contas autenticadas também são bloqueadas.
- Trigger que define datas no banco, preserva criação e limpa `received_at` ao voltar para desejado.

As listas são fixas e não permitem escrita pelo cliente, inclusive administrativo. A migration resolve o UUID administrativo pelo e-mail existente em `auth.users`; não cria nem altera senha.

A conta `fernando.greca@integra.do` já existia no projeto. Novos cadastros e login anônimo estão desabilitados. A URL do site no Supabase Auth é a URL do GitHub Pages.

Para instalar em outro projeto:

1. Crie a conta administrativa no painel **Authentication → Users → Add user**, com e-mail confirmado e senha definida diretamente pelo proprietário.
2. Desabilite **Allow new users to sign up** e **Allow anonymous sign-ins** em **Sign In / Providers**.
3. Ajuste e-mail na migration e UUID/e-mail em `src/lib/config.ts`; ajuste o UUID em `supabase/functions/extract-product/index.ts`.
4. Aplique as migrations por conexão administrativa autorizada e publique a função.
5. Ajuste URL/chave publicável, basePath e origens da função. Não use chaves secretas no cliente.

`supabase/tests/rls.sql` executa INSERT/UPDATE/DELETE como administrador e testa bloqueio para visitante e outro UUID. Tudo ocorre numa transação terminada com `ROLLBACK`. Nenhum dado de teste é mantido.

## Extração de metadados

`supabase/functions/extract-product/` contém parser e transporte testáveis:

1. JSON-LD `Product` (incluindo arrays e `@graph`).
2. Open Graph.
3. Metatags de preço e moeda.
4. Título HTML.

Aceita somente HTTP/HTTPS nas portas padrão, sem credenciais. Bloqueia hosts locais, IPs privados/reservados e DNS que retorne qualquer IP não público. Conecta diretamente ao IP verificado, preservando Host e TLS/SNI, para impedir nova resolução DNS. Revalida cada redirecionamento (até três), limita a leitura a 2 MB e nove segundos e rejeita conteúdo não HTML/comprimido.

A função valida o JWT em **Auth `/user`** e confere o UUID administrativo antes de ler a URL. `verify_jwt = false` desliga somente a validação legada do gateway; a autenticação é obrigatória no handler, compatível com as chaves atuais. Não se usa chave administrativa. CORS aceita somente `https://fernandogreca.github.io`, `http://localhost:3000` e `http://127.0.0.1:3000`.

Não são copiados arquivos para Storage. Texto extraído é convertido em texto puro, URLs são validadas e React não renderiza HTML de lojas.

## Publicação

GitHub Pages usa **Settings → Pages → Source → GitHub Actions**. O workflow `.github/workflows/pages.yml` roda lint, unitários, build e E2E antes de publicar `out/` em pushes para `main`. Pull requests executam as verificações sem publicar.

O workflow usa `GITHUB_TOKEN` fornecido automaticamente pelo GitHub, com `contents: read`, e `pages: write` / `id-token: write` apenas no job de deploy. Não exige segredo adicional. URL e chave publicável são configurações públicas, também presentes em `.env.example`.

Migrations e Edge Functions não são publicadas pelo Pages; aplique-as separadamente pelo conector Supabase ou CLI autenticada. Nunca configure senha administrativa, chave secreta, chave de serviço ou token de gestão como variável `NEXT_PUBLIC_*`.

## Testes e limites

- Unitários: validação, normalização, filtros combinados, ordenação, parser, SSRF, redirecionamentos, limite de resposta, timeout e tipo de conteúdo.
- E2E: navegador desktop e celular, consulta, administração, histórico, falha de extração, validação, falha de API, recarga, logout e auditoria Axe WCAG A/AA. Os testes repetíveis usam API/Auth simulados, sem senha real.
- Integração real: `npm run test:public` verifica leituras, bloqueio de escrita anônima, cadastro desabilitado, login inválido, autenticação e CORS da função. RLS é exercitada diretamente no banco com o arquivo SQL transacional.

O plano gratuito pode pausar o Supabase por inatividade; reative pelo painel se necessário. Lojas podem bloquear extração ou hotlink de imagens. O preenchimento manual continua disponível. O Security Advisor alerta sobre proteção contra senhas vazadas; essa opção não foi habilitada para preservar o escopo gratuito.

## Referências

- [Next.js: Static Exports](https://nextjs.org/docs/app/guides/static-exports)
- [GitHub Pages: Custom Workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: API keys e Edge Functions](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase: segurança de senhas](https://supabase.com/docs/guides/auth/password-security)
