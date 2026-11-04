# Atualização de produção — 04/11/2026

## Conteúdo

- Ajustes responsivos de elenco, escalação, mercado, calendário, CT, personalização e relatórios das partidas.
- Salários por overall e idade, promoção direta da base, renovação voluntária, pedidos recorrentes e recusa definitiva; efeitos de contrato e moral.
- Lesões medidas em jogos e limpeza de buffs/debuffs ao mudar de clube, preservando desenvolvimento e posições aprendidas.
- Pressão total e equilíbrio tático; indicadores de renovação nas cartas e no elenco.
- Carregamento central com fundo a 50%, ônibus para dia de partida e animação de treinamento para outros avanços.
- Reprodução visual por quadro para jogadores e bola, pausa do 3D encoberto/fora da tela e remoção de trabalho de recorte obsoleto na rolagem.

## Validação

- Build de produção, tipos do cliente/Worker, lint dos arquivos de implementação e formatação: aprovados.
- Suíte completa com dois workers: 516 testes aprovados e 44 falhas. Das falhas, 43 foram reproduzidas em cópia isolada de HEAD anterior; a restante (proxy de desenvolvimento) passou ao repetir com rede local liberada. A suíte completa não está verde.
- Calendário/noticiário no Playwright: aprovado. O teste de estruturas exige espaçamento de 7 px onde HEAD anterior e versão atual usam 4 px; a divergência foi confirmada no CSS anterior.
- Testes específicos de contratos, promoção, disponibilidade, escalação, reprodução e fila de ações passaram durante a implementação.
- As medições locais não comprovam FPS em todos os aparelhos nem consumo faturável na Cloudflare.

## Destinos

Interface: https://football-hype.taynanzhott.workers.dev
Servidor: https://football-hype-game.taynanzhott.workers.dev

Publicação nos Workers existentes, sem alterações de infraestrutura, novos bindings ou migrações. Nenhuma carreira de produção foi usada para testes de escrita.
