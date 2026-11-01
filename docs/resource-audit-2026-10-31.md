# Auditoria de recursos — 31/10/2026

## Restrição permanente

Toda mudança deve respeitar como teto as franquias gratuitas da Cloudflare, mesmo com Workers Paid ativo. Não adicionar serviços pagos, persistência ou telemetria sem orçamento explícito. Considerar o consumo agregado da conta, bots, reconexões, logs e margem operacional. Limites mensais e armazenamento não podem ser tratados como crédito diário. Não prometer ausência de cobrança com base em projeções locais. Domínio registrado possui renovação própria.

## Mapa das entradas do backend atual

- `apps/client/src/features/leagues/api.ts`: credentials (Firebase Auth/App Check), request (HTTP autenticado), createLeague, listLeagues, searchPlayers; loadCatalog só consulta servidor no modo de teste.
- `apps/client/src/store/worker-transport.ts`: conexão WebSocket, auth, send, fechamento/reconexão.
- `apps/client/src/store/game-store.ts`: command, sync inicial/recuperação, heartbeat do transporte legado. Cloudflare usa presença sem polling periódico.
- `apps/worker/src/index.ts`: /health, /api/catalog, /api/draw, /api/leagues e rotas profile, preview, request, decide, kick, reset, leave/delete, players; upgrade /socket, auth, command, sync e alarm.
- `LeagueService`: catalog, draw, create, list, join, touch, updateCoach, invitation, requestEntry, decide, kick, reset, leave, snapshot, command, tick, search. Commit e avanço de calendário acionam persistência e distribuição de estado.
- Comandos: customize, admission, financial-plan, ready, advance, home-ticket-price, ticket-price, lineup, lineup-preset, upgrade, offer, sign-free, salary, management (inclusive renew), new-season, club-settings. Todos passam pela mesma entrada command, com custos distintos.
- `apps/worker/src/dataset.ts`: carregamento do asset de jogadores. Autenticação verifica tokens e pode consultar chaves externas.
- `apps/scheduler/src/index.ts`: chamada externa de agendamento legado; confirmar no painel que está desativado. Firebase Functions e servidor legado existem no repositório; presença no código não comprova implantação ativa.

## Ranking preliminar por risco (não é medição de CPU em produção)

1. Advance, alarm/tick e new-season: simulações, calendário e alterações de muitos ramos. CPU, memória e escrita são os riscos principais.
2. Create/reset/draw: criação/importação do mundo e persistência volumosa; risco de abuso e inicialização fria.
3. Snapshot completo/sync/reconexão: serialização, leituras e multiplicação por dez clientes. Reconexão em massa agrava o custo.
4. Offer/sign-free/management renew/salary: concorrência, validações, escrita e distribuição aos participantes; nunca consolidar transações financeiras como ajustes substituíveis.
5. Busca de jogadores: consulta repetida por digitação pode saturar a fila global mesmo sem escrever.
6. Ajustes de orçamento, ingresso, escalação: custo individual menor, frequência potencialmente alta. Agrupar somente versões ainda não enviadas.
7. Listagem, convites, admissão e presença: custo acumulado, especialmente com polling ou tentativas repetidas.

## Fila e métricas aplicadas

A janela de agrupamento de ajustes no cliente caiu de 30 segundos para 150 ms. A projeção otimista existente mantém resposta visual imediata; comandos de mercado forçam envio dos ajustes anteriores. Preservada escrita ordenada e confirmação autoritativa para evitar compras duplicadas. Logs game.usage agora incluem queueWaitMs, separado de elapsedMs (tempo decorrido, NÃO CPU faturável). Já existem contadores SQL, linhas lidas/escritas, bytes, mensagens, snapshots, alarmes e erros.

Não paralelizar escritas no mesmo mundo. Próxima evolução: objeto por liga com coordenação de vínculos; deduplicar pesquisas em voo; limitar reconexão com jitter; admissão com limites por identidade e tamanho máximo de fila. Validar justiça entre ligas antes de migrar.

## Evidência e limites

Os relatórios calendar-benchmark.json, network-benchmark.json e cloudflare-benchmark.json possuem escopos diferentes. O relatório Cloudflare anterior é de 30/10 e não representa consumo atual. SQLite local mede alterações e consultas, mas não reproduz linhas faturadas por índices, CPU ou duração Cloudflare.
O cenário existente de calendário cobre 24 horas, dez treinadores, 1.000 ajustes de política e 480 ajustes de ingresso; não cobre temporada completa, renovações e disputas reais. Não deve ser apresentado como pior caso solicitado.
Não existe pior caso finito sem limites de frequência, quantidade de ligas e conexões. Estabelecer esses limites é requisito para uma garantia de orçamento.

## Proteção financeira ainda necessária

No Workers Paid, franquia excedida pode gerar cobrança. CPU limits limita cada execução, não o gasto agregado. Um contador dentro do aplicativo também não impede cobrança de requisições bloqueadas ou tráfego anterior à aplicação. Exigir limites do provedor e conferir todos os serviços ativos e faturamento da conta antes de afirmar custo adicional zero. Logs integrais também consomem franquia: preferir amostragem de sucessos e retenção limitada, preservando erros sem tokens ou dados pessoais.

Referências oficiais: https://developers.cloudflare.com/workers/platform/pricing/ e https://developers.cloudflare.com/durable-objects/platform/pricing/
