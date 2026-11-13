# Publicação — 13/11/2026

## Entrega

- Retomada da aba recebe confirmação mesmo sem mudança no snapshot, evitando reconexão por silêncio do servidor.
- Falha nas três tentativas de reconexão preserva o snapshot visível da carreira.
- Bloqueio da navegação consulta o relógio atual e mantém apenas um temporizador para o fim da apresentação.
- Incluídas todas as alterações pendentes de torcida, bandeiras, gramado, jogadores, escudos, interação e reprodução das partidas. Novas ações opcionais registram bola na trave e vítima da falta; resultados salvos não são recalculados.

## Validação

- Build completo: seis tarefas aprovadas. Tipos: nove tarefas aprovadas.
- Dez arquivos de testes direcionados aprovados: 41 testes de execução e suas verificações de tipos.
- Lint e formatação dos arquivos alterados aprovados.
- Suíte geral: 1323 testes aprovados, 71 falhas, quatro ignorados e um erro não tratado; não está integralmente aprovada. Inclui falhas de finanças, regulamentos, persistência, aparência e proxy, além de limites de tempo. A origem de todas essas falhas não foi isolada nesta entrega.
- Lint geral bloqueado por variável sem uso em arquivo temporário `.test-temp/elencos-report/build.mjs`. Formatação geral apontou quatro arquivos fora desta entrega.
- Ambiente local usa Node 26, enquanto o projeto declara Node 22–24.

## Produção verificada

- Interface: https://football-hype.taynanzhott.workers.dev
- Versão: `441bb2b2-073f-4fc5-a041-0276a4c9a37e`.
- Servidor: https://football-hype-game.taynanzhott.workers.dev
- Versão: `fd114e62-980f-417c-8d83-74431ff7214a`.
- Página e JavaScript `index-CdBUPEWC.js` respondem 200; HTML referencia o novo pacote. `/health` responde 200, `status: ok`, `persistence: durable-sqlite`, `demo: false`.

Sem novos serviços, bindings ou migrações. Observabilidade desativada e `USAGE_METRICS=false` preservados. A confirmação de retomada ocorre somente ao retornar à aba, sem heartbeat periódico. Não foram feitos testes de escrita em carreiras de produção. Testes locais não demonstram consumo faturável nem capacidade de produção.
