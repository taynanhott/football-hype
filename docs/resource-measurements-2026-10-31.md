# Medições de recursos — 31/10/2026

## Escopo

Consulta de leitura à conta Cloudflare inteira. Arquivos brutos: `cloudflare-account-measured.json` (dia UTC) e `cloudflare-account-month-measured.json` (mês UTC). Analytics pode ter atraso e amostragem; estes valores não são uma fatura. O ciclo UTC mensal consultado pode diferir do ciclo de cobrança contratado.

## Franquias compartilhadas

Somar todos os Workers para requisições e CPU de Workers. Somar todos os namespaces Durable Objects para sua duração, requisições e SQLite. Logs de todos os scripts compartilham a franquia de logs. Não somar requisições Worker com requisições DO como se fossem uma única franquia: a mesma ação pode consumir ambas. CPU do DO e CPU do Worker também são dimensões distintas.

Não há D1 nem namespaces Workers KV na conta consultada. R2, assinatura e consulta de logs retornaram 403: não assumir consumo zero. O usuário foi informado dos dados necessários do painel. A fila de ações do navegador não é Cloudflare Queues.

## Conta inteira: dados parciais do dia UTC

Janela iniciada às 21h de 30/10 no horário de Brasília; coleta aproximadamente às 18h50 de 31/10.

| Dimensão                     |              Medido |                                                              Referência Free |
| ---------------------------- | ------------------: | ---------------------------------------------------------------------------: |
| Requisições Workers          |                 201 |                                                                  100.000/dia |
| CPU Workers                  |          166,685 ms |                        10 ms por invocação; não há pacote diário equivalente |
| Invocações DO reportadas     |                 178 | 100.000/dia; métrica bruta não equivale necessariamente à cobrança WebSocket |
| Duração DO                   |         36,018 GB-s |                                                              13.000 GB-s/dia |
| CPU DO                       |       147.036,55 ms |                                diagnóstico; não somar à franquia CPU Workers |
| Leituras SQLite              |              66.416 |                                                                5.000.000/dia |
| Escritas SQLite              |               5.851 |                                                                  100.000/dia |
| Respostas HTTP Workers       | 4.277.335.154 bytes |         volume informativo; não converter diretamente em cobrança de tráfego |
| Mensagens WebSocket de saída |                 140 |                         mensagens de saída não têm cobrança de requisição DO |

Armazenamento: soma dos máximos por namespace no período = 23.461.888 bytes (23,46 MB decimais), dos quais 17.674.240 bytes são do jogo. Soma de máximos é uma aproximação conservadora do pico agregado; não prova ocupação simultânea nem GB-mês faturado.

## Mês UTC até a coleta

| Dimensão           |       Total da conta | Incluído Workers Paid padrão |
| ------------------ | -------------------: | ---------------------------: |
| Requisições Worker |                1.730 |               10 milhões/mês |
| CPU Worker         |          1.553,23 ms |         30 milhões de ms/mês |
| Duração DO         |         587,534 GB-s |             400 mil GB-s/mês |
| Leituras SQLite    |               68.202 |               25 bilhões/mês |
| Escritas SQLite    |               25.226 |               50 milhões/mês |
| Respostas HTTP     | 14.260.146.480 bytes |                  informativo |

As franquias são referências públicas do plano padrão; assinatura e saldo de cobrança não foram acessíveis. Valores SQL disponíveis no Analytics não devem ser usados para inferir histórico anterior à disponibilidade da métrica.

## Comunicação medida localmente

`socket-resource-benchmark.json`: dez clientes, mundo gerado menor que a base real, autenticação, alteração de ingresso, repetição idempotente e sync completo. 13 mensagens recebidas, 80 enviadas, 17.831.031 bytes enviados, 11 snapshots completos e 57 deltas. 27 eventos próprios `game.usage`; logs automáticos da plataforma não são simulados. Espera máxima local da fila: aproximadamente 10,5 ms. O teste não é rede real nem execução no Cloudflare.

## Faturamento fornecido pelo usuário e exportação real de logs

A captura do faturamento é a referência de cobrança mais direta, em `cloudflare-billing-screenshot.json`. Mostra 67,5 mil escritas, 2,16 milhões de leituras, 177,95 GB-s de duração DO, 308 requisições DO, 303 requisições Worker, 236 ms CPU Worker, 0,01 GB-mês SQL e 5 minutos de build. Todas as linhas mostram excedente zero e US$ 0 de uso adicional. O intervalo do ciclo não está visível: não rotular esses números como consumo de hoje. Não somar a captura aos números do Analytics, pois são fontes sobrepostas com janelas e atrasos distintos.

A captura R2 mostra oferta de ativação. Não comprova uma assinatura ativa ou armazenamento existente; o jogo não vincula R2. Não ativar esse produto apenas para medir.

Os dois arquivos de logs enviados são cópias idênticas, comprovadas pelo SHA-256. `cloudflare-export-measured.json` conta 100 eventos únicos entre 18h13 e 18h40 de Brasília. São 50 registros próprios de uso e 50 execuções da plataforma, não 100 execuções. A CPU das execuções soma 40.265 ms; mediana 482 ms e maior valor 4.479 ms. Há 42 resultados `ok` e 8 `canceled`; cancelamento não deve ser rotulado automaticamente como erro. Os contadores da aplicação registram 9 erros tratados.

Na amostra, a aplicação enviou 293.768.534 bytes em 42 mensagens, com 14 snapshots completos e 13 deltas. A distribuição de snapshots responde por 293.766.914 bytes. O maior lote de envio registrado mede 51.750.969 bytes, podendo conter múltiplas mensagens. Esse é um risco de CPU, memória e latência. O campo elapsedMs dos logs próprios aparece frequentemente como zero e não serve para inferir CPU faturável: usar cpuTimeMs dos eventos da plataforma.

A exportação parcial não revela quantos eventos foram armazenados no dia ou mês. A consulta agregada de logs continua sem autorização no login atual. Não extrapolar a amostra como se fosse uma observação de 24 horas.

O usuário informou 4.561 sucessos e 6.794 erros, corrigindo o intervalo para **últimas 24 horas**. Total de 11.355 ocorrências, 59,83% na classificação de erro. Sem o campo/filtro da tela, não equiparar isso a execuções únicas, erros de comandos ou eventos faturados de logs. O intervalo móvel também não é o mesmo dia UTC usado pela franquia Free.

## Temporada completa medida

`full-season-resource-benchmark.json`: concluída, 2.305 partidas, 509 despertares, dez treinadores, 14.012 jogadores na base, 18,584 dias virtuais. Foram 15.000 pesquisas, 1.500 alterações de ingresso, 1.500 alterações de orçamento, 1.500 tentativas de renovação, 1.500 propostas e 1.500 snapshots completos de reconexão. As renovações e propostas desse cenário foram todas rejeitadas pelas regras; por isso foi executado o complemento válido descrito abaixo.

| Medida local                                       |                                                                        Resultado |
| -------------------------------------------------- | -------------------------------------------------------------------------------: |
| Escritas SQLite na temporada, incluindo preparação |                                                               182.320 alterações |
| Pico de escritas em um dia UTC virtual             |                                                                           11.708 |
| Média de escritas por 24h virtual                  |                                                                            9.811 |
| Consultas SQL na execução                          |                                                                          282.588 |
| Linhas retornadas                                  |                                   1.178.154; não são linhas faturadas/escaneadas |
| Banco inicial / final                              |                                                              9,57 MB / 181,86 MB |
| Crescimento do banco                               |                                      172,29 MB; média de 9,27 MB por dia virtual |
| Payloads completos de reconexão serializados       |                                 152,67 GB no total; média de 8,22 GB/dia virtual |
| Tamanho médio do snapshot completo                 |                                                        101,78 MB, sem compressão |
| Pico de memória do processo local de teste         | 3,97 GB; inclui runtime, instrumentação e dados, não equivale à memória de um DO |

Tempo médio local por operação: calendário 1.827 ms, snapshot completo 488 ms, pesquisa 5,8 ms, orçamento 43,6 ms, ingresso 0,94 ms. Não converter esses tempos em CPU Cloudflare. A serialização de snapshots está incluída no tempo do medidor local.

O teste marcou a temporada concluída e gravou o relatório, mas o executor Vitest terminou com erro de comunicação `Timeout calling onTaskUpdate`. Portanto não houve execução integral sem ressalvas. O harness passou a ceder o event loop entre lotes para evitar monopolizar a comunicação; a temporada inteira não foi repetida após essa correção. O complemento menor passou separadamente.

## Transações válidas e margem diária

`valid-transactions-resource-benchmark.json`: base real com caixa sintético ampliado para isolar o custo de transações aceitas. Foram 50 renovações aceitas, 90 propostas concorrentes aceitas para análise, dez ajustes de orçamento e uma política de venda. Só as 50 renovações geraram 8.180 alterações de linhas: **163,6 por renovação**, em média. As 90 propostas geraram 420 alterações: 4,67 por proposta. Os detalhes de revisão e fechamento salarial são registrados no mesmo relatório quando executados.

O complemento também avançou 11 eventos de calendário até a análise da disputa, aprovou a negociação salarial e confirmou a mudança de clube do jogador. O fechamento salarial consumiu 82 alterações de linhas no SQLite local. Revisão de calendário, assinatura e preparação aparecem separadas no relatório; não atribuir todo o custo de 11 mil alterações apenas às ofertas.

O pico de 11.708 escritas do cenário principal representa apenas 11,7% da referência Free em alterações locais; **não é uma garantia de 11,7% de consumo faturável**, pois índices, alarmes, outros projetos e diferenças de runtime importam. Adicionar 50 renovações e 90 propostas como no complemento acrescenta 8.600 alterações locais. Uma rajada de 1.000 renovações ao custo médio observado, distribuídas entre jogadores/ligas elegíveis, acrescentaria aproximadamente 163.600 alterações e ultrapassaria a referência diária de 100 mil. Trata-se de projeção aritmética, não de outra carga executada.

O cenário principal não transmite deltas para dez WebSockets reais após cada comando; snapshots completos e o teste de sockets são medições separadas. Não somar bytes de reconexão e de broadcast como se ambos tivessem sido executados na mesma carga. Não existe pior caso absoluto finito sem limitar frequência, conexões e ligas. A faixa anterior de 75–150 mil escritas/dia era margem preliminar, não resultado desta simulação.

## Limitações de acesso e verificação

A tentativa de alinhar o Analytics às últimas 24h retornou HTTP 429 em 31/10 às 20h de Brasília: `cloudflare-account-24h-measured.json` mantém os totais indisponíveis como null, jamais zero. Permanecem válidas apenas as consultas anteriores com sucesso, nos intervalos registrados. Não repetir agressivamente consultas ao atingir rate limit.

Lint dos arquivos de medição passou. A verificação global de tipos de testes encontra um erro existente em `packages/domain/tests/stadium-balance.test.ts` (fixture incompleta de estádio), fora do escopo desta medição. Nenhum serviço foi publicado ou contratado nesta etapa.

## Reprodução

Consultar conta: `node scripts/measure-cloudflare-account.mjs`, com login Wrangler existente e acesso de rede. Credencial é lida em memória e nunca impressa ou gravada no relatório. Para mês UTC, definir `CF_MEASURE_MONTH=1`.

Temporada pesada: definir `FULL_SEASON_BENCHMARK=1` e executar `pnpm exec vitest run apps/worker/tests/full-season-resource.test.ts --typecheck.enabled=false`. É opt-in para não acrescentar vários minutos aos testes comuns. Resultados incluem ações rejeitadas explicitamente; rejeição não comprova sucesso de renovação/contratação.

Referências: https://developers.cloudflare.com/workers/platform/pricing/ e https://developers.cloudflare.com/durable-objects/platform/pricing/.
