# Publicação de áudio e lances — 13/11/2026

- Grito de gol limitado a 5,5 segundos, com redução gradual do volume nos dois segundos finais.
- Aba “Lance a lance” reúne gols, cartões e substituições em ordem cronológica; as notas permanecem na área de avaliações.
- Teste de navegador atualizado para o nome da aba. ESLint ignora arquivos temporários gerados em `.wrangler`, já excluídos do Git.

## Validação

`pnpm check` aprovado com Node 24.13.0: formatação, lint, tipos, cobertura e build completo. Foram 1.546 testes aprovados e quatro opcionais ignorados, sem erros de tipos. Cobertura: 98,14% de linhas/instruções, 100% de funções e 90,02% de caminhos condicionais. Permanece o aviso de tamanho dos bundles.

O cenário Playwright `match-report.spec.ts` falhou nas duas tentativas por timeout ao clicar em “Carreira”, antes de iniciar a partida. Portanto, o fluxo de navegador completo não foi validado nesta publicação. Emuladores Firebase e fluxo autenticado completo de produção não foram executados.

## Produção

- Backend `football-hype-game`: `f441389c-b6ef-42a5-aa92-0baec2d573de`.
- Interface `football-hype`: `6d9eaa63-b498-49c8-8cc6-9ee070ef2d3c`.
- Site: https://football-hype.taynanzhott.workers.dev

Backend com saúde `ok`, persistência `durable-sqlite` e catálogo HTTP 200. HTML e sete arquivos iniciais publicados conferidos por SHA-256 contra a compilação local aprovada.

Nenhuma carreira foi alterada para testar; não houve reset ou mudança de bindings, migrações, serviços ou observabilidade. `USAGE_METRICS` permanece `false`. As alterações de interface não acrescentam chamadas ao servidor ou processamento periódico no backend. A validação local não comprova consumo agregado ou custo de produção.
