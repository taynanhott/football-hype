# Publicação de produção — 13/11/2026

Atualização posterior: [correções, validação aprovada e nova publicação](deployment-fixes-2026-11-13.md). O registro abaixo descreve a publicação inicial.

Todas as seis alterações pendentes foram publicadas nos Workers existentes: sincronização de snapshots serializada por liga durante reconexão e comandos simultâneos, estado de avanço com proteção contra cliques duplicados, indicador de progresso e remoção do redimensionamento automático da tela financeira.

- Backend: `60790935-7abd-413a-8848-88369483eb4c`.
- Interface: `ddbbe2ef-6b3a-443c-b213-a0156d19ba7f`.
- Site: https://football-hype.taynanzhott.workers.dev

Saúde, catálogo, autenticação obrigatória, CORS e rejeição de WebSocket sem login foram verificados em produção. HTML e sete bundles publicados correspondem à compilação local e retornaram HTTP 200. Nenhuma carreira real foi alterada para testar.

Formatação, lint, tipos e build completo passaram. A execução focada de sincronização, fila e deltas passou com 17 testes. A execução mais ampla do Worker e contratos teve 42 testes aprovados, dois ignorados e um timeout de comunicação do executor.

O check geral não passou: 1.391 testes aprovados, 79 falhas, quatro ignorados e dois erros de comunicação do executor. Há falhas de expectativas, restrições de conexões/arquivos locais e timeouts; não foi feita comparação integral com HEAD. A cobertura final não foi aprovada. O ambiente utilizou Node 26.13.0, acima da faixa declarada pelo projeto.

Não houve alteração de serviços, plano, bindings, migrações ou configuração de observabilidade; USAGE_METRICS permanece false. As validações locais não comprovam consumo ou custo em produção.

O teste Playwright de ações não foi concluído: a primeira execução ficou bloqueada nas conexões locais; após liberar as portas e iniciar os servidores, faltou o executável Chromium exigido pelo Playwright. O fluxo autenticado completo em produção não foi exercitado.
