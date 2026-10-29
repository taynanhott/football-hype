# Publicação Cloudflare: servidor e carreiras

Este é o destino atual do backend. Oracle/PostgreSQL ficam como alternativa, sem necessidade de criar uma VM. A interface existente continua na Cloudflare. Firebase Authentication e App Check continuam responsáveis pelo login Google e proteção do aplicativo; Firestore e Render deixam de ser necessários para as novas carreiras.

## Preparar

1. Instale as dependências com `pnpm install --frozen-lockfile`.
2. Compile os pacotes compartilhados: `pnpm --filter @football/domain... build`.
3. Confira `apps/worker/wrangler.jsonc`: `CLIENT_ORIGIN` deve ser a origem exata do site, sem barra final. O projeto Firebase e seu número público já foram preenchidos a partir da configuração existente.
4. Execute `pnpm --filter @football/worker exec wrangler login` e autorize sua conta Cloudflare no navegador. Se houver várias contas, informe o `account_id` correto no arquivo Wrangler.
5. Mantenha o plano Workers Free se não quiser cobrança. Durable Objects SQLite funcionam nesse plano. Atingir as cotas gratuitas causa falhas, não capacidade ilimitada. Não é usado crédito promocional nem bucket R2.

## Publicar

Para publicar a interface pelo Workers Builds, mantenha a raiz do repositório como diretório de trabalho e use `pnpm --filter @football/client... build` no build e `pnpm run deploy` na publicação. O Wrangler é uma dependência da raiz, que utiliza `wrangler.jsonc` para publicar os arquivos em `apps/client/dist`. O comando padrão `npx wrangler deploy` também encontra essa dependência após a instalação. O backend usa o comando separado abaixo.

Execute `pnpm --filter @football/worker run deploy`. O comando prepara a base de jogadores como asset e publica código, binding e migração SQLite. Anote a URL `https://football-hype-game.SEUSUBDOMINIO.workers.dev` retornada. Não precisa de domínio comprado, chave de serviço Firebase, Docker ou senha de banco.

Confira `https://URL_DO_WORKER/health`. No build da interface, configure:

```dotenv
VITE_GAME_SERVER_URL=wss://football-hype-game.SEUSUBDOMINIO.workers.dev
VITE_GAME_TRANSPORT=cloudflare
```

Preserve as variáveis Firebase existentes. Refaça o build e a publicação da interface. Para desenvolvimento conectado, use a URL do Worker no proxy e `VITE_GAME_TRANSPORT=cloudflare`; o proxy deve preservar a origem autorizada.

Alarms do Durable Object verificam rodadas a cada minuto enquanto há ligas ativas. O agendador externo deixa de ser necessário. Desative o Worker agendador antigo e Cloud Functions de agendamento se estiverem ativos. Mantenha o Render até validar a troca; desligue-o depois.

## Validação

Crie uma liga nova, altere escalação, teste outra conta e a admissão multiplayer, processe uma rodada e reconecte. Valide também a execução automática sem jogadores e após uma nova publicação. As ligas antigas não são importadas nem apagadas.

Testes locais:

```sh
pnpm exec vitest run apps/worker/tests --typecheck.enabled=false
pnpm --filter @football/worker typecheck
pnpm --filter @football/client typecheck
pnpm --filter @football/worker build
```

Para verificar o runtime, inicie `pnpm --filter @football/worker dev --port 8788` e, em outro terminal, rode `node scripts/test-worker-runtime.mjs`. Esse teste verifica saúde, catálogo, CORS e rejeição de WebSocket sem autenticação. O fluxo completo de login Google exige uma sessão real e App Check válido.

## Arquitetura e limites desta versão

O Durable Object `GameHub` usa SQLite embutido para ligas, vínculos de usuários, sorteios e eventos. Um coordenador único preserva a atomicidade entre ligas para impedir inscrições concorrentes acima do limite. Esta primeira versão é adequada para validar o jogo e medir carga; não é uma arquitetura de escala ilimitada. O coordenador serializa ações e compartilha o limite de memória e CPU do runtime. Separar cada liga em um objeto independente exigirá coordenação distribuída dos vínculos e é uma evolução posterior, se os testes de carga mostrarem necessidade.

O estado é persistido por ramificações, divididas em partes pequenas para respeitar o limite de tamanho das linhas SQLite. Cada comando atualiza apenas os ramos alterados e confirma tudo em transação. Os últimos 100 eventos são retidos para histórico e repetição segura de ações. Há cache somente do último estado carregado; ele é reconstruído ao despertar.

WebSockets usam a API de hibernação e guardam apenas identidade e liga no attachment. Snapshots completos são enviados nesta versão; reduzir o tráfego para atualizações diferenciais é uma otimização futura. Não são mantidos snapshots individuais de todos os jogadores na memória. Sessões expiram após 55 minutos e pedem reconexão. Tokens são validados por assinatura, expiração, emissor, audiência, Google e App Check; a checagem administrativa de revogação imediata do Firebase Admin não é executada. Uma revogação pode demorar até o token/sessão expirar para surtir efeito.

O catálogo de jogadores é um asset interno da aplicação, não uma consulta ao Firestore. O endpoint público não expõe a base inteira. O runtime ainda precisa carregar e validar a base e simular partidas; o plano gratuito tem limites de CPU e memória, portanto o desempenho e a quantidade de ligas suportadas precisam ser medidos com partidas reais. Não há ganho percentual garantido.

Referências: https://developers.cloudflare.com/durable-objects/platform/pricing/ e https://developers.cloudflare.com/durable-objects/platform/limits/

## Uso local em um comando

Com apps/client/.env.development.local apontando DEV_GAME_SERVER_TARGET para http://127.0.0.1:8788 e VITE_GAME_TRANSPORT=cloudflare, execute pnpm dev:local na raiz. O comando inicia a interface em http://localhost:5173 e o Worker local em 8788. As carreiras ficam em apps/worker/.wrangler/state, separadas da produção. Login Google e App Check ainda precisam de internet e configuração Firebase para localhost. Para encerrar, pressione Ctrl+C no terminal.

## Participantes e sorteios de novas ligas

As listas iniciais das sete copas são definidas em `packages/shared/src/config/fixed-cup-entrants.ts`, conforme a seleção do proprietário do jogo. Nenhum clube ausente é substituído silenciosamente por outro. Os grupos e confrontos dependem da semente persistida de cada liga e não seguem a ordem das listas.

Cada sorteio tem um evento datado no calendário e um modal para consultar os participantes e o resultado. O avanço dos dias registra a realização do sorteio; reconexões não refazem o resultado. As tabelas e partidas dessas copas são ocultadas na interface enquanto o sorteio está pendente.

Os dois vencedores da pré-Libertadores vão aos grupos da Libertadores e os dois perdedores à Sul-Americana. Os sorteios continentais aguardam o término da pré. O campeão da Sul-Americana recebe a vaga na Libertadores apenas na temporada seguinte. As listas fixas são usadas ao criar uma liga; as temporadas seguintes usam a classificação esportiva e os títulos.

Ligas anteriores sem os eventos de sorteio mantêm sua estrutura; esta alteração não reinicia carreiras existentes.
