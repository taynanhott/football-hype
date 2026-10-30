# Consumo do jogo — 30/10/2026

Versão publicada: servidor 2a208001-f8b7-4605-ab9b-e7667b93eff0 e interface 6ee33b48-8488-4beb-bac8-4c2b7ec4bffd.
Jogo: https://football-hype.taynanzhott.workers.dev

## Resultado e alcance

A meta de reduzir pelo menos 90% foi atingida no cenário definido de chamadas de aplicação, com redução modelada de **94,42%**. Isso não é uma comparação de faturas nem uma medição de 24 horas de tráfego humano em produção. A contagem da Cloudflare distingue HTTP de Workers, mensagens WebSocket, alarmes, CPU e linhas SQL; não existe uma cota única que reúna esses contadores.

Carga: uma liga, dez treinadores, base real de **14.012 jogadores**, 24 horas virtuais de calendário, **113 partidas**, **1.000 operações de mercado** (alterações reais de disponibilidade/interesse) e **480 ajustes de clube**. As ações passaram pelas mesmas validações e persistência do serviço de produção. Não foram simuladas 1.000 transferências concluídas, ataques, múltiplas ligas ou cliques ilimitados.

| Medida                                                           |                              Antes / referência |                                                 Depois |
| ---------------------------------------------------------------- | ----------------------------------------------: | -----------------------------------------------------: |
| Verificações do calendário por dia                               |                                1.440 por minuto |                           36 eventos; redução de 97,5% |
| Presença em quatro horas, dez jogadores                          | 4.800 mensagens e 16.613 linhas em SQLite local | Zero mensagens periódicas e zero gravações de presença |
| Ajustes repetidos do mesmo clube                                 |       1.000 alterações enviadas individualmente |                 10 mensagens; redução de 99% no ensaio |
| Chamadas de aplicação por dia no perfil definido                 |                                          31.990 |                               1.786; redução de 94,42% |
| Linhas gravadas no ensaio local completo                         |                                               — |                                                 74.461 |
| Linhas gravadas no runtime Cloudflare, excluindo criação inicial |                                               — |                                                 21.483 |
| Linhas de criação no runtime Cloudflare                          |                                               — |                                                    675 |
| Consultas SQL no runtime Cloudflare                              |                                               — |                                                 49.065 |
| Linhas SQL lidas no runtime Cloudflare                           |                                               — |                                                280.059 |

A estimativa de 1.786 inclui 270 conexões HTTP (27 por jogador/dia), 1.000 mensagens de mercado, 480 envios de ajustes e 36 eventos de calendário. Autenticação WebSocket e consultas iniciais também têm custo; essa soma é um orçamento de chamadas de aplicação, não uma fórmula exata de requisições faturáveis. Mesmo somando essas chamadas de entrada, o perfil continua com larga margem abaixo de 100 mil chamadas/dia. O plano pago continua permitindo excedentes se o tráfego real exceder a franquia.

## Mudanças

- Presença é mantida pelas conexões, sem gravar a liga a cada minuto. O cliente atualizado não envia mensagens automáticas em repouso.
- O agendamento usa os horários reais dos eventos e respeita os 90 segundos de apresentação das partidas. Dias, recuperação, sorteios e ciclos individuais continuam avançando.
- Escalação, aparência, plano financeiro e ingressos são projetados e salvos na fila local. Ajustes substituíveis são consolidados; o servidor valida o lote atomicamente antes de persistir. O envio ocorre em até 30 segundos, antecipado antes do jogo e antes de ações compartilhadas.
- Mercado, dinheiro, propriedade dos jogadores, resultados e calendário mantêm validação autoritativa. Mover essas decisões para um cliente sem validação permitiria divergência entre jogadores e adulteração de resultados.
- Classificações, busca, filtros, reprodução e renderização 3D rodam no navegador. A cena 3D não gera chamadas por quadro e foi preservada. Resultados são calculados uma vez por evento compartilhado.
- Atualizações enviam ramos alterados, com snapshot completo apenas na entrada/recuperação. Atualizações duplicadas da mesma ação são consolidadas.
- SQL atualiza apenas os chunks alterados e os vínculos realmente modificados. O histórico do Worker conserva metadados e identificadores, sem duplicar enormes patches que não eram usados para recuperar o estado.

## Evidência e limites

- [Ensaio local de calendário e ações](calendar-benchmark.json).
- [Ensaio local de fila e presença](network-benchmark.json).
- [Ensaio no runtime Cloudflare](cloudflare-benchmark.json): Worker temporário protegido, namespace separado, identidades sintéticas e HTTP em lotes de até 20 ações para reduzir o custo do próprio teste. Não reproduz a quantidade exata de WebSockets/bytes de dez navegadores. O Worker e o namespace temporários foram removidos; a lista de namespaces confirmou a limpeza.
- [Consulta de requisições da conta](cloudflare-day-usage.json) e [CPU/memória](cloudflare-resource-usage.json): abrangem o período consultado, incluindo versões anteriores e testes; não atribuir esses totais à versão nova. O namespace de produção é 424580380b9c43b686fed965aac124ec. A consulta de armazenamento retornou uma série vazia, não armazenamento zero.
- [Consulta curta após publicação](cloudflare-account-after.json): um Worker request, zero erros na amostra. É uma amostra pequena, não validação estatística de disponibilidade.
- O relógio performance.now da Cloudflare pode não avançar durante CPU síncrona; os elapsedMs do teste remoto não medem CPU. CPU e memória são consultados na API oficial e permanecem habilitados na observabilidade.

Validação: 61 testes de conexão, fila, presença, serviço, persistência e autenticação passaram; o ensaio adicional de 24 horas também passou. TypeScript dos pacotes e testes, lint dos arquivos alterados e build de produção passaram. A suíte geral de regras do domínio ainda possui falhas anteriores de expectativas de calendário, competições e treino, também reproduzidas em cópia sem as novas alterações de comando; não são apresentadas como testes aprovados. As duas alterações que já existiam em daily-calendar.ts e management.ts foram preservadas.

Após a publicação, foram conferidos saúde, catálogo, bloqueio de origem não autorizada, autenticação HTTP/WebSocket e o arquivo da interface servido pelo endereço público. O teste local com dez conexões validou atualização diferencial única, ressincronização completa e rejeição de execução duplicada.

Não há promessa de custo fixo para qualquer carga. Novas ligas, uso intenso do mercado, bots, armazenamento e CPU têm seus próprios limites. As cotas gratuitas foram usadas como referência de capacidade; esta entrega não alterou nem cancelou a assinatura.
