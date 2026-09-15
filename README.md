# Fer + Gaby

Portal público do casal, com listas de presentes e galeria de fotos. Uma conta administrativa compartilhada cuida do conteúdo.

- [Site publicado](https://fernandogreca.github.io/fer-e-gaby/)
- [Repositório público](https://github.com/FernandoGreca/fer-e-gaby)
- Supabase: projeto `gbhnuttdygjhdkulnpmi`, plano gratuito.

## Desenvolvimento

Node.js 22 e npm, com versões fixadas no lockfile.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000/fer-e-gaby/`. As rotas são `/`, `/presentes/` e `/galeria/`, sempre dentro de `/fer-e-gaby`. Next.js gera `out/` com HTML por rota, compatível com acesso direto e recarga no GitHub Pages. Ícone, manifest, links e assets incluem o mesmo caminho.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:public
```

Para visualizar a exportação: `node scripts/serve-static.mjs`.

## Uso

A página inicial reúne **Lista de presentes** e **Galeria**. O menu permite voltar ao início ou trocar de serviço. Novos serviços podem ser registrados em `src/lib/services.ts`; cada registro alimenta os cards e a navegação.

### Presentes

As abas **Lista presentes Fer** e **Lista presentes Gaby** mantêm desejos, prioridades, preço/moeda, etiquetas, descrição, observações e histórico **Já ganhamos**. Filtros podem ser combinados; o preço é comparado na moeda cadastrada, sem conversão cambial. Presentes recebidos são ordenados pela data de recebimento.

O cadastro é inteiramente manual. Link HTTP/HTTPS é obrigatório. Colar ou modificar o link não busca informações em lojas. Nome, imagem e preço são informados pelo administrador. Imagens externas indisponíveis mostram uma alternativa visual.

### Galeria

Fotos são públicas, ordenadas por data da foto, criação e identificador, em ordem decrescente. Clique na imagem para ampliar; use **Fechar** ou Escape para sair. O foco volta ao controle de origem.

No **Modo de edição**, use **Adicionar foto**, **Editar foto** ou **Excluir**. Legenda é opcional (até 1.000 caracteres); data é obrigatória. JPEG, PNG e WebP são aceitos, até 20 MB na origem. O navegador aplica orientação EXIF e redesenha a imagem em Canvas, preserva proporção, limita o maior lado a 1920 px e gera WebP com qualidade 82%, sem os metadados originais. A saída deve ter até 5 MB; nomes usam UUID aleatório, sem o nome original. Navegadores sem suporte ao processamento recebem uma mensagem clara.

Operações refletem imediatamente na grade. Cada upload começa com uma intenção persistida em `gallery_cleanup`. Ao inserir a foto, um trigger apaga essa intenção na mesma transação. Se o registro falhar, o cliente remove o arquivo; se houver falha de rede, a intenção permanece recuperável.

A exclusão do registro cria uma tarefa de limpeza na mesma transação. O cliente remove o objeto e depois a tarefa. Falhas são informadas sem perder o caminho do objeto. Tarefas com mais de 15 minutos aparecem para o administrador em **Retomar limpeza**, inclusive após recarga ou em outro dispositivo. Esse intervalo evita interferir em uploads em andamento. A política do Storage impede remover uma imagem ainda ligada a uma foto. A fila é privada e não usa tarefas pagas ou chaves secretas.

## Autenticação e segurança

**Modo de edição** solicita a senha compartilhada existente. Use **Sair** em dispositivos compartilhados. Não há cadastro público nem login anônimo.

O cliente usa somente URL e chave publicável do Supabase. A função SQL `is_admin()` consulta o UID autenticado e o compara com a conta administrativa resolvida na migration. Ela é `SECURITY INVOKER`, como todos os triggers. A interface usa seu resultado para mostrar controles; a autorização definitiva é feita por RLS no banco e no Storage. Nenhuma chave privilegiada ou senha é necessária para build ou deploy.

## Migrations e políticas

- `20260915152047_initial_wishlists.sql`: duas listas fixas, tabela `gifts`, enums, índices, normalização e datas, leitura pública e escrita limitada ao administrador.
- `20260915172949_portal_gallery.sql`: `gallery_photos`, `gallery_cleanup`, índices, constraints, triggers e `is_admin()`. Resolve a conta existente por e-mail diretamente em `auth.users`, sem modificar credenciais ou presentes.

Em `gallery_photos`, `public_read` permite SELECT público; `admin_insert`, `admin_update` (USING + WITH CHECK) e `admin_delete` restringem escrita ao UID administrativo. Em `gallery_cleanup`, SELECT/INSERT/DELETE são exclusivos do administrador.

O bucket público `couple-gallery` limita arquivos a 5 MB e MIME types JPEG, PNG e WebP. As políticas `gallery_admin_select`, `gallery_admin_insert` e `gallery_admin_delete` atuam somente nesse bucket. Upload exige caminho UUID `.webp` com intenção registrada; exclusão exige tarefa pendente e ausência de foto vinculada. Não há UPDATE ou upsert de objetos.

As migrations foram aplicadas pelo conector Supabase. A função de extração antiga foi removida localmente e do Supabase após conferir que o formulário era seu único consumidor e que não existiam referências em funções do banco. Seu código anterior permanece no histórico Git.

Execute `supabase/tests/rls.sql` e `supabase/tests/gallery-rls.sql` por uma conexão administrativa autorizada. Ambos usam transação e ROLLBACK: exercitam papéis anon, não administrador e administrador sem deixar registros de teste. O teste do Storage insere apenas metadados dentro da transação; operações de arquivos devem sempre usar a API Storage.

## Publicação

Remote: `git@github.com:FernandoGreca/fer-e-gaby.git`. O repositório deve continuar público. GitHub Pages usa **Settings → Pages → Source → GitHub Actions**, com HTTPS.

O workflow `.github/workflows/pages.yml` executa lint, tipos, unitários, build e E2E. Após sucesso em `main`, publica `out/`. Usa `GITHUB_TOKEN` automático com permissões de deploy somente no job correspondente. Migrations são aplicadas separadamente via Supabase; não há backend Next.js no Pages.

A URL de Auth no Supabase é `https://fernandogreca.github.io/fer-e-gaby/`. Para outro projeto, crie a conta administrativa no painel, desabilite novos cadastros, ajuste o e-mail nas migrations/configuração e aplique as migrations. Nunca adicione segredos a `NEXT_PUBLIC_*`.

## Verificação agendada do Supabase

O workflow [Supabase public health check](https://github.com/FernandoGreca/fer-e-gaby/actions/workflows/supabase-health.yml) executa todos os dias às **00:17, 06:17, 12:17 e 18:17 de Brasília** (03:17, 09:17, 15:17 e 21:17 UTC). Também pode ser iniciado em **Actions → Supabase public health check → Run workflow** e roda quando seu script ou configuração são publicados em `main`.

Cada execução faz duas consultas GET: busca somente o `id` de, no máximo, uma linha pública de `wishlists` e de `gallery_photos`. Usa a chave publicável, sem sessão administrativa, alterações nos dados, download de fotos ou deploy. Aceita tabelas vazias, valida o formato da resposta e falha em erros HTTP, de rede ou conteúdo inválido. Há timeout e até duas novas tentativas para falhas transitórias. Os logs não exibem os registros retornados. Notificações de falha seguem as preferências de GitHub Actions da conta.

Essas consultas geram atividade no banco e ajudam a evitar a pausa do plano gratuito, sem garantir disponibilidade contínua. O [Supabase avalia a atividade durante sete dias](https://supabase.com/docs/guides/platform/free-project-pausing). Se o projeto já estiver pausado, reative-o no painel com **Resume project**; a consulta não o reativa.

O [GitHub pode atrasar execuções e desativa agendamentos após 60 dias sem atividade no repositório público](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Visitas ao site e cadastros de fotos não atualizam o repositório. Se isso acontecer, acesse o workflow em Actions e use **Enable workflow**. Nenhum commit artificial é gerado pela tarefa.

Para executar localmente, exporte `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` com os valores públicos do workflow e rode `bash scripts/check-supabase.sh`. Requer Bash, curl e jq, já disponíveis no runner Ubuntu do GitHub.

## Verificações e limites

- Unitários: presentes, datas, ordenação da galeria, tipos/tamanho de arquivo, proporção e caminhos seguros.
- E2E desktop e celular: home, navegação, recarga, permissões visuais, cadastro manual sem chamadas de função, CRUD de presentes/fotos, histórico, foco/Escape, Axe WCAG A/AA, falhas de API e limpeza de uploads.
- API real: leitura pública, escrita negada, Storage anônimo bloqueado, `is_admin()` falso sem sessão e cadastro desabilitado.
- Banco real: testes transacionais de RLS, triggers e fila; verificação de bucket e políticas; advisors de segurança e desempenho.

Os advisors não apontaram problemas de segurança novos. Permanece o aviso preexistente de [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), não habilitada no plano gratuito. [Índices ainda sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) são esperados enquanto as tabelas estão vazias. Supabase gratuito pode pausar por inatividade; reative no painel se necessário.
