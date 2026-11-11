# Ligas europeias paralelas

## Regulamento e dados

- Premier League, Ligue 1, Bundesliga, La Liga e Serie A italiana: 20 clubes fixos, 38 rodadas, turno e returno, sem acesso ou rebaixamento.
- As listas explícitas estão em `packages/shared/src/config/european-leagues.ts`. A Alemanha inclui St. Pauli e Wolfsburg além dos 18 clubes da lista de referência de 2026/27. A França usa os 20 clubes com elenco suficiente da base, incluindo Auxerre e Metz. São participantes do regulamento personalizado do jogo, não uma afirmação de que as ligas reais têm 20 equipes.
- São reaproveitados os clubes, IDs, jogadores, contratos, instalações e valores da base local de 2026. Esta funcionalidade não importa novas transferências reais nem certifica que todos os elencos estão atualizados em 11/11/2026. Nenhum jogador é inventado para completar elenco.
- Se faltar um dos clubes configurados ou ele tiver menos de 11 jogadores na criação da liga, essa competição fica indisponível, com explicação na interface. Não se escolhe um substituto silenciosamente.
- Os quatro primeiros de cada liga classificam-se para a Champions League seguinte. A primeira edição usa 20 cabeças de entrada explicitamente configurados; as 12 vagas restantes usam clubes europeus elegíveis de outros países já presentes na base, em rodízio determinístico por temporada. Não há duplicação nem preenchimento com clubes sem elenco suficiente.
- O identificador interno `europa` é preservado para manter referências e históricos; o nome público passa a ser Champions League. Seu fluxo existente de grupos, mata-mata e campeão para a Intercontinental permanece. O processamento resumido descrito aqui é o das cinco ligas nacionais.

## Processamento e persistência

O bloco opcional `europeanLeagues` contém a temporada, os 20 IDs ordenados de cada competição, a versão do calendário e pares de placares por rodada concluída. Datas e confrontos são reconstruídos no navegador e no domínio, sem gravar 1.900 objetos de partidas completas por temporada.

O calendário de versão 1 usa 38 rodadas entre 28 de janeiro e 13 de novembro do ano do jogo, alinhado ao ciclo anual brasileiro. É um calendário do Football Hype, não o calendário oficial europeu. A ordem dos confrontos é parte do contrato dos placares persistidos: futuras mudanças no algoritmo de turno e returno devem preservar a reconstrução da versão 1.

O servidor calcula placares por semente, força dos 11 melhores atletas e moral, com vantagem de mandante. Não executa o motor de lances, não escolhe autores de gols, não cria notas, replay, escalações utilizadas ou movimentações financeiras dessas ligas. Nenhuma transação financeira existente é removida; contratos, salários e negociações seguem seus fluxos atuais.

As rodadas vencidas são processadas junto ao avanço já existente dos dias. Em avanços longos, o processamento acompanha os dias para considerar os atletas disponíveis naquela data. Avançar novamente ou recuperar um snapshot persistido não repete resultados. Não existem novos alarmes, heartbeat, chamadas por partida, serviços pagos ou consultas externas em tempo de execução. Os sinalizadores de observabilidade e métricas não foram alterados.

O bloco fica separado dos jogadores, resultados completos e calendário principal. Uma rodada europeia, por si só, não modifica ou reenvia o bloco de atletas. A sincronização e a persistência usam o mecanismo existente de alterações de blocos; filtros e montagem de tabelas ocorrem no navegador, com cache por referência do estado. O custo agregado continua dependendo do número de carreiras, usuários e atualizações; nenhuma capacidade ou gratuidade em produção é garantida por este teste local.

A posição do vendedor acrescenta ao interesse nas transferências um efeito limitado a oito pontos, crescente após cinco rodadas. G4 reduz disposição para sair; a parte inferior aumenta. O motivo aparece na mesma função de contexto usada pelas prévias e pela validação do servidor. Políticas impeditivas, saldo e elenco mínimo continuam valendo.

## Interface e compatibilidade

Em Torneios, o seletor oferece as cinco ligas. Há classificação, indicação das quatro vagas na Champions e consulta dos dez jogos de cada rodada, incluindo resultados anteriores. Não há botão de assistir ou replay. Esses jogos não entram em `scheduledFixtures`, `pendingFixtures`, resultados completos, central de partidas ou bloqueio de navegação durante transmissões.

Novas carreiras importadas recebem as ligas imediatamente. Carreiras anteriores, sem esse bloco, recebem as ligas na próxima temporada; a interface informa isso. Não há reset ou substituição de elencos e nenhuma competição já disputada é redesenhada. Arquivos de temporadas guardam os placares europeus para consulta histórica. Um reset esportivo explicitamente solicitado também limpa esses placares se a carreira já possuir as ligas.

## Validação

- Dez testes de domínio: inclusão das cinco ligas na primeira temporada de uma nova carreira importada, participantes, calendário equilibrado, determinismo, recuperação após persistência, reenvios, integridade financeira/propriedade, isolamento da central, tamanho do bloco, vagas, rodízio, interesse e mudança de temporada com arquivo.
- Teste de navegador com uma carreira isolada carregada diretamente: cinco tabelas de 20 clubes, rodadas de dez jogos, placares históricos, ausência de replay, computador e celular. Não é uma validação do login nem da conexão do servidor legado.
- Os testes de sincronização, filtros do mercado e relógio de temporada foram executados junto aos novos testes.
- A comparação com os arquivos anteriores confirmou falhas preexistentes nos testes `requested-rules.test.ts` (Copa do Brasil em mundo fictício), `season.test.ts` (valores arredondados no arquivo) e `daily-calendar.test.ts` (ganho de overall em treino individual). Não foram alteradas regras de outras competições para fazer esses testes passar.

Na medição local, o bloco completo das cinco ligas ocupou aproximadamente 16 KB em JSON ao final da temporada, sem os elencos que já existiam. Isso não mede latência de rede, carregamento total da carreira, consumo faturável ou capacidade em produção.
