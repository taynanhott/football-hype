# Publicação de produção — 31/10/2026

Backend publicado antes da interface, usando os Workers existentes e sem novas migrações ou bindings.

- Backend: `football-hype-game`, versão `047b7047-1628-453e-aca7-4811c199e687`.
- Interface: `football-hype`, versão `6f810505-3a45-4c3b-9669-104da8e9de43`.
- Site: https://football-hype.taynanzhott.workers.dev

## Verificação após publicação

Saúde do backend, catálogo, autenticação obrigatória, rejeição de origem não autorizada e WebSocket sem autenticação passaram. Site, JavaScript principal e worker do cache retornaram HTTP 200. O HTML publicado referencia o mesmo bundle da compilação local (`index-DpXmv5LA.js`), que carrega `snapshot-cache.worker-Bts4ncLr.js`.

Não foi criada nem alterada uma liga real durante essa verificação. Login e ações com contas reais não foram exercitados em produção.

## Validação e ressalvas

Compilações compartilhada, domínio e interface passaram. Verificações de tipos do cliente e Worker e lint dos arquivos alterados passaram. Testes específicos de cache, sincronização, fila e planejamento do elenco passaram, incluindo os testes em navegador.

A execução ampla de testes terminou com 352 testes aprovados, 31 falhas e dois ignorados, além de um timeout de comunicação do executor. Algumas falhas envolveram conexões locais bloqueadas pelo ambiente. Não se trata de uma suíte totalmente aprovada.

Foi feita uma comparação isolada com `git HEAD` dos grupos financial-management, regulations-2026 e football-data-import. As mesmas sete falhas ocorreram antes e depois, sem novas falhas nesses grupos. Detalhes em `deployment-baseline-comparison.json`. As demais falhas da suíte ampla não foram todas comparadas individualmente com HEAD.

O lint geral também encontrou arquivos temporários e artefatos gerados fora do código da aplicação. O lint direcionado aos arquivos desta implementação passou. O fixture incompleto de stadium-balance permanece como problema conhecido da verificação global de tipos de testes.

Não foi alterado o plano Cloudflare nem contratado outro serviço. A publicação não comprova orçamento diário ou custo adicional zero; o consumo continua sujeito às franquias e à configuração da conta.
