# Documentação do Projeto: Plataforma GEASS

## Visão Geral
A Plataforma GEASS é um sistema de cursos focado em infoprodutos, estilo Kiwify. A interface é responsiva, possui suporte a modo claro e escuro (baseado no preto puro e cinza médio) com design glassmorphism.

## Stack Tecnológica
- **Frontend**: React, Vite, TypeScript
- **Estilização**: CSS Puro com Variáveis (Glassmorphism), suporte a Dark Mode (Pure Black) e substituição da cor verde por Cinza Médio. A sidebar no desktop é estática com largura fixa de 80px e comportamento overlay (position: fixed) para estabilidade visual com zoom, rolagem ou redimensionamentos.
- **Backend/Database**: Supabase
- **Roteamento**: React Router v6
- **PWA & Favicon**: Configuração de manifesto PWA (`manifest.json`) com suporte a ícones nos formatos PNG e JPEG (resoluções de 192x192 e 512x512 com propósitos `any` e `maskable` para Android) e tags de compatibilidade `apple-touch-icon` com múltiplos tamanhos no `index.html` usando `/GEASS1.png` para perfeita exibição de ícones na tela inicial do iOS.

## Estrutura do Supabase
As seguintes tabelas foram criadas e estão protegidas por Row Level Security (RLS) (podem ser configuradas executando o script `node supabase/cria_metas_tabelas.js`):
1. `perfis` (id, email, confirmado) - Gerado automaticamente via trigger após Auth no Supabase.
2. `cursos` (id, nome_curso, descricao)
3. `modulos` (id, curso_id, nome_modulo, ordem)
4. `aulas` (id, modulo_id, nome_aula, youtube_id, ordem, pdf_url)
5. `permissoes` (id, user_email, curso_id)
6. `progresso` (user_id, aula_id, tempo_segundos, duracao_total, updated_at)
7. `metas_estudo` (id, user_id, curso_id, meta_minutos, streak_atual, ultimo_estudo, updated_at)
8. `progresso_diario` (id, user_id, curso_id, data_estudo, segundos_estudados, updated_at)

## Fluxos Principais
- **Aluno**: Realiza login/cadastro na rota `/login`. O formulário conta com a opção de exibir/ocultar a senha digitada para facilitar o preenchimento. O fluxo de cadastro é otimizado sem exigência de confirmação de e-mail por padrão (se desativado no Supabase), logando o usuário imediatamente. Há também um fluxo de **Esqueci a Senha** com envio de link de recuperação para definir nova senha na rota isolada `/reset-password`. Só enxerga cursos liberados na tabela `permissoes`. O player do YouTube roda na rota `/curso/:id` e salva o progresso na tabela `progresso` e acumula o tempo da sessão atual na tabela `progresso_diario`. Na tela de aula, há um widget minimalista e interativo de **Meta Diária do Curso** com barra de progresso em tempo real que enche a cada 5 segundos enquanto o vídeo roda. Ao bater a meta na sessão atual, a borda do player (seja de vídeo or leitura de PDF) recebe um brilho verde/cinza sutil por 4 segundos, um Toast no canto inferior da tela é exibido e o streak ("foguinho") é atualizado uma única vez no banco. Se o aluno já iniciou a aula com a meta cumprida no dia, a barra de progresso permanece em 100% com o distintivo "Meta Batida! 🏆" sem re-disparar efeitos incômodos. A navegação das aulas é feita pelo acordeão inferior. A aula ativa em reprodução é destacada e, ao finalizar uma aula, a próxima aula é reproduzida automaticamente. Se houver um PDF de material de apoio atrelado à aula, é disponibilizado um botão para download. Há uma rota de Dashboard em `/stats` com gráficos interativos. Também há a rota de **Metas e Cronogramas** em `/metas`, onde o usuário pode definir minutos de estudo diários por curso. Esta página possui gamificação informando dias seguidos de meta ("foguinho") e quanto falta para bater a meta de estudo no dia atual.
- **Administrador**: Acesso restrito ao e-mail `nelsonvilhasantos@gmail.com`. A rota `/admin` permite a criação, edição (inline) e exclusão (com cascata) de toda a estrutura (cursos, módulos, aulas) na árvore de conteúdo (com suporte a link ou upload de arquivos PDF de materiais de apoio por aula, onde o campo do YouTube é opcional para apostilas). A inserção de e-mails na tabela `permissoes` permite liberar acessos.
  - *Gerenciamento de Acessos*: Há um painel retrátil de gerenciamento de acessos ativos, que lista todos os alunos com acesso a cada curso e permite excluir esses acessos individualmente.
  - *Visualizar como Aluno (Impersonate)*: Na aba "Todos os Usuários Cadastrados", o administrador pode clicar no botão **"Ver como"** ao lado de qualquer usuário. Isso ativa o modo de visualização (impersonate), onde um Proxy intercepta o cliente do Supabase no frontend. O administrador passa a ver a plataforma exatamente como o aluno (cursos liberados, progresso de aulas, metas, dashboard `/stats`), permitindo acompanhar a evolução do aluno em tempo real. Um banner de destaque no topo da tela sinaliza o modo de visualização e contém um botão para retornar instantaneamente ao painel administrativo.
  - *Armazenamento (Storage)*: Para permitir uploads de PDF pelo painel, o bucket `materiais` no Supabase Storage deve ser público e conter uma política RLS para a operação **INSERT** habilitada para a role `authenticated` com a regra `(bucket_id = 'materiais')`. Como o bucket é público, os downloads funcionam de forma imediata por qualquer usuário via link de acesso público.

## Setup Local
Para rodar a plataforma de forma interativa (com o terminal aberto):
1. Preencher o `.env` (baseado no `.env.example`) com as chaves do Supabase.
2. Executar `npm install`.
3. Executar `npm run dev`.

Para rodar em segundo plano (podendo fechar o terminal):
- Dê dois cliques em [iniciar_plataforma.vbs](file:///c:/IA%20ZOOM/GEASS_PLATAFORMA/iniciar_plataforma.vbs) na raiz do projeto. Ele iniciará o servidor Vite de forma 100% invisível em segundo plano.
- Para parar o servidor, dê dois cliques em [parar_plataforma.bat](file:///c:/IA%20ZOOM/GEASS_PLATAFORMA/parar_plataforma.bat) na raiz do projeto.


## Scripts Utilitários
- **`ENVIAR YOUTUBE AUTOMATICO .py`**: Script de automação em Python (Selenium) que realiza upload de vídeos para o YouTube Studio sob o perfil logado (`Profile 15`). 
  - Organiza a fila cronologicamente por data de modificação absoluta dos arquivos.
  - Clona o perfil do Chrome para uma pasta temporária isolada (`C:\temp_chrome_profile_yt`) evitando conflitos com instâncias ativas do navegador.
  - Lê o arquivo `aulas_youtube.csv` para carregar o histórico de envios e pular automaticamente os vídeos já enviados, permitindo retomar de onde parou.
  - Aguarda a conclusão real do upload para os servidores do YouTube antes de prosseguir com o próximo vídeo, evitando a perda do envio por recarregamento da página.
  - Pergunta no terminal quantos vídeos o usuário deseja enviar na execução atual, permitindo limitar a fila de forma interativa.
  - Detecta automaticamente se o limite diário de uploads do YouTube foi atingido (parando a execução imediatamente para não gerar loops de erro/timeouts).
  - Organiza os links no arquivo `links_ordenados.txt` separando-os por cabeçalhos de módulos e linhas de sobra com base na estrutura de subpastas do curso.
  - Salva os links em `links_ordenados.txt` e a tabela geral em `aulas_youtube.csv`.

## Segurança e Auditoria
A aplicação passou por uma auditoria de segurança rigorosa focada no OWASP Top 10 para codebases geradas por IA. As principais práticas adotadas incluem:
- **Gestão de Segredos**: Credenciais do banco de dados (PostgreSQL) nunca são "hardcoded" em scripts. Elas são injetadas via arquivo `.env` (usando `dotenv`), que está protegido pelo `.gitignore`. O único prefixo exposto é `VITE_` para chaves públicas intencionais do Supabase (`VITE_SUPABASE_ANON_KEY`). A chave `service_role` nunca é utilizada no frontend ou em scripts expostos.
- **Fail-Fast no Startup**: A inicialização do cliente Supabase (`src/lib/supabase.ts`) falha imediatamente (fail-fast) com um erro claro se as variáveis de ambiente necessárias não estiverem definidas, evitando bugs silenciosos em chamadas de banco.
- **Segurança de Roteamento e Bundling**: O painel administrativo (`/admin`) utiliza *Code-Splitting* (via `React.lazy` e `Suspense`) para garantir que o código sensível (~48KB) não seja entregue aos usuários comuns no bundle principal. O frontend implementa um modelo de allowlist (apenas a rota `/login` é pública por padrão).
- **Validação de Uploads**: Os envios de materiais de apoio (PDFs) no painel admin possuem validação *client-side* rígida de tipo MIME (`application/pdf`) e tamanho máximo (50MB).
- **Isolamento e RLS**: Todas as 8 tabelas possuem *Row Level Security* (RLS) habilitado. As políticas garantem isolamento absoluto dos dados de progresso e metas por usuário (`auth.uid() = user_id`). 
- **Políticas RLS de Admin e WITH CHECK**: Todas as políticas de admin possuem cláusulas `WITH CHECK` ativas para evitar a persistência de dados incorretos e violações de autorização (CWE-863).
- **Verificação de Acesso Admin e Funções de Roteamento Seguras**: A função `is_admin()` foi atualizada para consultar a tabela de usuários via `auth.uid()` em uma função com privilégios `SECURITY DEFINER` protegida. Criou-se também a função `get_user_email()` para gerenciar as permissões dos alunos nas políticas RLS sem expor a tabela `auth.users` diretamente nem depender de dados obsoletos do JWT.
- **Segurança de Storage**: O bucket de armazenamento público `materiais` foi restringido via RLS para permitir uploads (`INSERT`) apenas ao Admin, prevenindo o envio de arquivos não autorizados por alunos autenticados.
- **Monitoramento de Sessões e Dispositivos (Exclusivo Admin)**: O painel administrativo possui uma aba para monitorar contas conectadas e sessões de dispositivos ativos. Essa funcionalidade utiliza as RPCs `obter_sessoes_ativas()`, `encerrar_sessao(sessao_id)` e `encerrar_todas_sessoes_usuario(target_user_id)` configuradas de forma segura com `SECURITY DEFINER` e validação do e-mail administrativo. O frontend renderiza de forma amigável o dispositivo (User-Agent decodificado), o endereço IP capturado nativamente pelo Supabase, a data de atividade, e sinaliza alertas visuais de "Compartilhamento Suspeito" para contas com 3 ou mais dispositivos ativos, permitindo ao administrador deslogar dispositivos específicos ou derrubar todas as sessões da conta com um clique.


## Deploy e Produção
- **Coolify**: A plataforma está configurada para deploy automatizado na VPS via Coolify.
  - Repositório Remoto: [Ervilhasantos/geass-plataforma-vps](https://github.com/Ervilhasantos/geass-plataforma-vps)
  - URL da API do Coolify: `http://161.153.107.203:8000`
  - URL Temporária Ativa: `http://t22vxbftv3bh5ptvvjzdjpfc.161.153.107.203.sslip.io`
  - A integração com a IA (MCP do Coolify) foi atualizada e está funcional para gerenciar os deploys diretamente pelo agente.

## Próximos Passos
- **AÇÃO URGENTE**: Alterar a senha do banco de dados no console online do Supabase, pois as credenciais antigas (`ALNelmacl5446()`) estavam expostas nos scripts utilitários antigos antes de movermos para o `.env`.
- Configuração do projeto no painel online do Supabase (atualização da senha no `.env` do servidor/deploy).

