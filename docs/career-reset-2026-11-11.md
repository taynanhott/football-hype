# Exclusão autorizada das carreiras — 11/11/2026

O proprietário solicitou explicitamente no chat que todas as carreiras existentes fossem excluídas para recomeçar com as ligas europeias desde a primeira temporada.

## Escopo e backup

O backend atual é o Worker `football-hype-game`, classe SQLite `GameHubV2`, objeto `football-hub-v1`. A operação ficou restrita ao armazenamento do Football Hype. Outros projetos da conta Cloudflare não foram alterados. Não foram encontrados arquivos de carreiras nos diretórios locais de persistência consultados.

Antes da exclusão havia duas carreiras ativas e um registro de carreira já excluída. Foram preservadas as seis tabelas de dados do jogo, incluindo os estados financeiros e os eventos, em:

`.local/backups/careers-2026-11-11T13-57-13-455Z/`

O backup contém arquivos NDJSON compactados por tabela, manifesto com quantidades e SHA-256, versões/configurações publicadas anteriores e recibo da exclusão. Cada arquivo de dados foi descompactado e lido novamente para verificar as linhas antes da exclusão.

| Tabela       | Linhas no backup | Linhas após exclusão |
| ------------ | ---------------: | -------------------: |
| leagues      |                3 |                    0 |
| members      |                2 |                    0 |
| chunks       |            1.342 |                    0 |
| events       |               67 |                    0 |
| draws        |                0 |                    0 |
| league_wakes |                3 |                    0 |

## Execução e publicação

Um código temporário de manutenção foi publicado no mesmo Worker, com atualização imediata da classe, encerramento das conexões e cancelamento do alarme. Isso impediu gravações concorrentes durante a cópia e a exclusão. A consulta administrativa oficial da Cloudflare foi usada para acessar o SQLite. Nenhuma rota administrativa, credencial de manutenção ou desvio de autenticação foi acrescentado à aplicação final.

Após a verificação do backup, os registros das seis tabelas foram excluídos, e suas contagens foram novamente verificadas como zero. O código normal foi republicado e a manutenção encerrada.

- Backend: versão `559d4417-4252-4428-beee-cc625b607e28`.
- Interface: versão `144f82cc-4fc3-46c5-81bd-d1494536ec99`.
- Site: https://football-hype.taynanzhott.workers.dev
- Bundle principal verificado no site: `/assets/index-Dcn22ai9.js`.

Nenhum namespace, plano ou serviço novo foi criado. Observabilidade continua desabilitada, e `USAGE_METRICS` continua `false`. A manutenção realizou consultas e gravações reais na conta; testes locais não foram usados como prova de custo ou capacidade em produção.

## Validação

- Dez testes de ligas europeias e um teste de persistência SQLite passaram. O novo teste confirma as cinco ligas já na primeira temporada ao importar a base real para uma carreira nova, sem exigir mudança de temporada.
- Compilações de shared, domínio e interface passaram; a verificação de tipos do Worker, lint direcionado e verificação do diff passaram.
- Em produção, saúde, catálogo, autenticação obrigatória, rejeição de origem não autorizada e WebSocket sem autenticação passaram.
- A interface pública serviu o bundle da compilação local, contendo as cinco ligas e a nova estrutura de dados. O arquivo do cache também respondeu com sucesso.
- Não foi criada uma carreira real para testar o login autenticado ou disputar partidas em produção. A conferência administrativa após a exclusão encontrou zero carreiras.
- Permanecem as ressalvas de falhas preexistentes na suíte geral documentadas em `european-leagues.md` e nos registros anteriores de publicação.

Novas carreiras criadas nessa versão incluem as cinco ligas desde a primeira temporada. É necessário recarregar a página para carregar a interface publicada e abandonar referências locais a carreiras excluídas.
