# Disponibilidade na escalação

Titulares, banco, opções de substituição e validação do servidor compartilham a disponibilidade. O editor usa a data atual do jogo para a convocação, sem antecipar a próxima janela FIFA; a simulação revalida na data e competição efetivas da partida. A suspensão permanece vinculada à competição da próxima partida.

- Convocação mantém o critério existente: atletas com overall base a partir de 80 durante a janela FIFA configurada.
- Lesões mantêm a recuperação por jogos e a exceção de liberação médica já existente.
- Indisponíveis aparecem em “Não relacionados”, com aparência desativada, sem arraste, toque para mover ou participação nas substituições. Os detalhes do afastamento continuam na lista de indisponíveis.
- A escalação e o banco resolvem as vagas com as melhores opções disponíveis pelos critérios já existentes de posição, qualidade e condição. Uma ausência temporária não sobrescreve automaticamente as preferências salvas. Sem alterações manuais, os titulares e reservas originais retornam quando elegíveis; alterações explícitas do treinador passam a ser as novas preferências.

## Cartões

Regra definida pelo usuário em 11/11/2026: três amarelos acumulados ou um vermelho geram um jogo de suspensão na mesma competição.

- A contagem é separada por atleta e competição. Apenas novos resultados processados pelo servidor alimentam a disciplina; partidas históricas não são reprocessadas para impor punições retroativas.
- O terceiro amarelo zera esse ciclo e gera uma suspensão. Uma expulsão gera uma única suspensão, sem somar outra pelos amarelos da mesma partida; a contagem anterior permanece.
- A suspensão é cumprida quando o clube atual disputa um jogo da competição correspondente, mesmo se o atleta também estiver lesionado ou convocado. Jogos de outra competição não bloqueiam nem cumprem a pena.
- Na temporada seguinte, os amarelos acumulados são zerados; suspensões pendentes permanecem na mesma competição.
- `discipline` é um campo opcional e versionado, compatível com carreiras antigas. Seus ajustes são persistidos na mesma transação do resultado e seguem os snapshots/deltas existentes. Repetir um evento não disputa nem contabiliza novamente a partida.

O cálculo acontece nos eventos já existentes. Não adiciona consultas periódicas, requisições, alarmes ou logs. A seleção usa cache por estado para consultar a próxima competição, sem consultar o servidor por atleta. Não altera dinheiro, contratos ou propriedade dos atletas.
