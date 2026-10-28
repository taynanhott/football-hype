# Publicação

O jogo funciona localmente com dados fictícios, sem contas externas. Estes arquivos preparam a publicação; nenhum serviço foi publicado automaticamente.

## Firebase

1. Crie um projeto próprio no Firebase e registre um aplicativo Web.
2. Ative Authentication com o provedor Google, Firestore e Hosting. Cadastre o domínio do Hosting nos domínios autorizados do Authentication.
3. Registre o aplicativo Web no App Check com Fraud Defense (antigo reCAPTCHA Enterprise). Use uma chave Web baseada em pontuação, sem desafio de checkbox, e autorize o domínio de produção. A mesma chave pública registrada nesse provedor deve estar em `VITE_FIREBASE_APPCHECK_SITE_KEY` na configuração de build da interface. Habilite a proteção do Firestore após validar as métricas do App Check.
4. Preencha `apps/client/.env.local` com sua configuração Web Firebase, `VITE_USE_EMULATORS=false`, `VITE_FIREBASE_APPCHECK_SITE_KEY` e o endereço WSS do servidor Render.
5. Execute `pnpm build` e `pnpm exec firebase deploy --project SEU_PROJETO --only hosting,firestore`.

As regras do Firestore permitem leitura somente a participantes e impedem todas as escritas feitas por clientes. Alterações de jogo passam pelo servidor autoritativo. Nunca coloque credenciais de serviço em variáveis `VITE_`.

## Render

1. Publique o repositório Git em sua conta e conecte-o ao Render usando `render.yaml`.
2. Configure `GCLOUD_PROJECT`, `CLIENT_ORIGIN` com a origem HTTPS do Hosting e `SCHEDULER_SECRET` com uma chave aleatória de pelo menos 32 caracteres.
3. Adicione um secret file `firebase-service-account.json` com uma conta de serviço dedicada ao Firestore, Authentication e App Check. O caminho `/etc/secrets/firebase-service-account.json` já está configurado.
4. Mantenha `NODE_ENV=production`, `STORE=firestore` e `REQUIRE_APP_CHECK=true`. O servidor recusa um início de produção com proteção desativada.
5. Após obter o endereço HTTPS do Render, use o mesmo endereço com `wss://` em `VITE_GAME_SERVER_URL` e refaça o build do front.

O plano gratuito do Render pode suspender o servidor quando ocioso. Não há garantia de disponibilidade contínua nem de pontualidade exata de rodadas nessa modalidade. O estado fica no Firestore, não no disco efêmero do Render. Em múltiplas instâncias, use Presence e Matchmaker Driver Redis compartilhados; este blueprint prevê uma única instância.

## Agendamento

Nas ligas online, o calendário da temporada é independente do relógio real. Os lotes de partidas são distribuídos nos horários **08h, 10h30, 13h, 15h30, 18h, 20h30, 22h e 23h30 de Brasília**. A rodada inteira de uma competição acontece junta. Competições com clubes em comum ocupam horários distintos. Competições simultâneas sem clubes em comum podem compartilhar um horário. Assim, cada clube tem no máximo oito partidas automáticas por dia real.

O estado persistido guarda `seasonClock` e `nextScheduledAt` (horário real); `lastProcessedAt` e as datas das partidas continuam representando o calendário da temporada. Descanso, treino, finanças, geração de propostas e vencimento de negociações são processados com as datas da temporada, inclusive quando o administrador ou a maioria antecipa uma rodada. A antecipação realoca os próximos jogos nos horários disponíveis a partir daquele momento. A ausência não libera o clube do participante.

O servidor verifica rodadas vencidas a cada 30 segundos enquanto está ativo, sem depender de conexões de jogadores. O processamento revalida a revisão e o horário para evitar simulação duplicada. Após uma interrupção, recupera até oito horários vencidos por liga a cada chamada, inclusive de madrugada, preservando os horários originais nos resultados. Novas chamadas continuam a recuperação. Isso não substitui a disponibilidade do servidor: durante uma indisponibilidade os resultados só serão calculados quando ele voltar.

Ligas online antigas recebem o novo relógio na primeira verificação, com início no próximo horário real disponível; partidas já realizadas são preservadas. O modo offline continua sob avanço manual. O fim de temporada continua exigindo iniciar a próxima temporada.

## Cloudflare: interface e agendador

A interface pode ser publicada no Cloudflare Pages. Use a raiz do repositório, comando `pnpm --filter @football/client build` (após instalar as dependências da raiz) e diretório de saída `apps/client/dist`. Configure as mesmas variáveis `VITE_FIREBASE_*`, `VITE_USE_EMULATORS=false`, `VITE_FIREBASE_APPCHECK_SITE_KEY` e `VITE_GAME_SERVER_URL` descritas acima. Autorize o domínio Pages no Firebase Authentication, no App Check e em `CLIENT_ORIGIN` do servidor.

O Worker em `apps/scheduler` chama o servidor uma vez por minuto, mesmo sem usuários conectados. Para prepará-lo:

1. Em `apps/scheduler/wrangler.jsonc`, troque `GAME_SERVER_URL` pelo endereço HTTPS do servidor.
2. Na pasta `apps/scheduler`, execute `pnpm dlx wrangler secret put SCHEDULER_SECRET` e forneça a mesma chave configurada no servidor. Nunca grave essa chave no repositório nem nas variáveis da interface.
3. Execute `pnpm dlx wrangler deploy` nessa pasta, autenticado na conta Cloudflare desejada.
4. Consulte os registros do Worker e verifique uma rodada automática sem clientes conectados. Respostas de erro do servidor aparecem como falhas do Worker.

Essa preparação hospeda a interface e o agendamento na Cloudflare; o servidor autoritativo atual (Node/Colyseus) e o Firestore continuam externos. Hospedar todo o backend em Workers exige adaptar as salas e a persistência; este Worker não é essa migração. O plano gratuito de Workers tem limites de CPU e requisições: não há garantia de custo zero para toda a infraestrutura ou de execução exatamente no segundo do horário. O agendamento por minuto e a verificação local introduzem uma pequena tolerância de execução.

Referências: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [limites de Workers](https://developers.cloudflare.com/workers/platform/limits/).

Para Cloud Functions agendadas, o Firebase exige Blaze e Cloud Scheduler, mesmo que o consumo fique dentro de cotas sem custo. Não é possível garantir custo zero com essa combinação de serviços.

```sh
pnpm exec firebase functions:secrets:set SCHEDULER_SECRET --project SEU_PROJETO
pnpm exec firebase deploy --project SEU_PROJETO --only functions
```

Informe `GAME_SERVER_URL` com o endereço HTTPS do servidor durante a configuração. A secret deve ter o mesmo valor no Render. A função chama `/internal/tick` de cinco em cinco minutos; o servidor usa os horários persistidos para executar as rodadas vencidas. Funções de Scheduler devem ser testadas pelo endpoint antes da ativação. Escolha Cloudflare ou Firebase como agendador externo; não é necessário ativar ambos.

## CI e preview

O workflow CI verifica formatação, lint, tipos, cobertura, builds, navegador, multiplayer e regras de segurança nos emuladores. O workflow manual Firebase preview usa o environment `preview`, variáveis `FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_APPCHECK_SITE_KEY`, `VITE_GAME_SERVER_URL` e o secret `FIREBASE_SERVICE_ACCOUNT`.

## Referências

- [Cloud Functions agendadas](https://firebase.google.com/docs/functions/schedule-functions)
- [Render gratuito](https://render.com/docs/free)
- [App Check para Web](https://firebase.google.com/docs/app-check/web/recaptcha-provider)
