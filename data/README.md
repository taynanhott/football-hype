# Base local de jogadores

Esta é a base padrão para novas ligas, extraída do JSON do arquivo Untitled-1.html fornecido pelo usuário. Não há consulta ou atualização automática de elencos por API. O HTML é analisado como texto; seus scripts nunca são executados.

- player-source.json preserva os blocos de dados de jogadores e suas correções.
- clubs-source.json preserva definições estáticas de clubes, cores e grupos presentes no arquivo.
- player-exclusions.json preserva a lista estática de exclusões da configuração original.
- player-database.json contém os registros normalizados usados pelo servidor.
- player-import-report.json registra contagens, exclusões e elencos parciais.

A importação atual contém 14.012 jogadores ativos, 697 clubes e 124 agentes livres. Dois registros inativos permanecem na fonte, mas ficam fora do mercado e dos elencos ativos. Não foram criados jogadores para completar equipes. A idade mínima aceita passou a 14 anos para preservar os jovens existentes no arquivo.

Os blocos de transferências e de avaliação são aplicados sobre o identificador original. Identificadores normalizados são estáveis, e referências entre clubes e jogadores são verificadas. Nomes, vínculos, idades, posições e avaliações vêm da fonte; estruturas, salários, potenciais ausentes e conversão monetária são parâmetros de simulação. Elencos estrangeiros parciais são preservados para consulta e transferências. Países de clubes não identificáveis ficam como ZZ; as nacionalidades dos jogadores foram mapeadas.

O arquivo original distingue Série A, Série B e Regional. O importador identifica os 20 participantes oficiais da Série C de 2026 pela lista da CBF e os classifica como C. Os demais clubes regionais mantêm sua classificação na base; isso não representa uma lista oficial completa da Série D.

Para extrair novamente, execute pnpm data:extract seguido do caminho do HTML; depois execute pnpm data:local. A primeira etapa lê apenas o JSON e literais estáticos de configuração. Nenhuma etapa consulta a internet. A base normalizada fica no repositório e pode ser carregada sem o HTML original.

No servidor, DATASET_FILE=../../data/player-database.json seleciona esta base. Ela também é o padrão fora do modo de testes. O importador cria o calendário ao criar cada liga, incluindo Série A, Série B e copas; não reutiliza datas de outra carreira. Competições nacionais não incluem clubes estrangeiros, e as copas continentais selecionam clubes sul-americanos com elenco suficiente.

Carreiras já salvas mantêm seu snapshot. Não há migração ou substituição automática de elencos existentes.

## Técnicos e estádios

`club-details.json` mantém os nomes pesquisados dos técnicos e estádios, com fonte por campo e data de consulta. A pesquisa foi realizada em 11/11/2026, usando páginas dos clubes e das competições e notícias mais recentes encontradas para corrigir informações desatualizadas. `club-details-corrections.json` preserva essas correções sobre a coleta das páginas da Wikipédia; cargos comprovadamente vagos são identificados como `Sem técnico`.

Os nomes são aplicados por `pnpm data:local` e pelo fluxo de atualização da fonte. Para atualizar somente nomes na base normalizada, use `node scripts/apply-club-details.mjs`; esse comando também copia a base para os assets locais do Worker. Ele não acessa nem altera carreiras persistidas, jogadores, saldos, instalações ou capacidades dos estádios. A pesquisa é manutenção local explícita, sem consultas externas durante o jogo ou novas chamadas à Cloudflare.

Em clubes comandados por participantes, a interface prioriza o nome do perfil do treinador humano. O técnico real da base é usado nos clubes sem participante.
