# Atualização — 02/11/2026

## Alterações

- Interface mobile: atalhos e notificações, menu lateral compacto, filtros alinhados, modais e estruturas do estádio/CT.
- Escalação: geometria das 15 formações baseada nas referências, cartas e modificadores sem sobreposição, nomes abreviados, condição legível e controles reorganizados no mobile.
- Convocações: marcadores da Data FIFA, lista de convocados, previsão de retorno em jogos e reposição automática dos titulares e reservas.
- Detalhes das partidas: modal desktop compacto, placar sem sobreposição, probabilidades apenas para o próximo jogo e pênaltis nos últimos resultados.
- Dinheiro: valores abaixo de mil sem K e remoção da casa decimal quando ela for zero.

## Validação

- `pnpm build`: seis pacotes compilados, incluindo interface e preparação do Worker.
- Tipos do cliente e Worker, lint dos arquivos alterados e formatação: aprovados.
- Testes selecionados do cliente, domínio e Worker: 110 aprovados, um ignorado e uma falha preexistente de recuperação médica em `packages/domain/tests/tactics.test.ts`.
- Essa falha de recuperação foi reproduzida com a versão anterior de `tactics.ts`, antes das alterações de seleção automática.
- Dois testes Playwright de calendário, finanças, estruturas, mercado e elenco: aprovados.
- Verificações adicionais no navegador: 60 combinações de formação/largura, placares desktop com dois dígitos e pênaltis e navegação mobile em quatro tamanhos.

## Publicação

Destinos existentes: Worker `football-hype-game` para o servidor e Worker `football-hype` para a interface. Não há novas migrações, bindings ou serviços nesta atualização.

Os resultados locais não representam medição de consumo faturável nem garantia de cobrança zero na Cloudflare.

## Correção posterior: avanço e reabertura da carreira

- O registro de produção confirmou reinício do Durable Object por excesso de memória durante o carregamento.
- Envio compactado passou a serializar o histórico em partes, sem criar uma cópia JSON/UTF-8 completa antes da compactação.
- Leitura valida um ramo da carreira por vez. Eventos produzidos e validados pelo próprio serviço não são novamente clonados ao aplicar o comando; a validação pública de eventos externos permanece.
- Um índice SQLite pequeno guarda os dados necessários ao próximo agendamento. Carreiras existentes constroem esse índice uma vez; agendamentos seguintes não carregam todos os elencos e históricos. Não há novos serviços ou bindings.
- Coordenadas de jogadores em reposições ficam dentro dos limites aceitos pelo salvamento. A falha anterior foi reproduzida localmente como `Dados de domínio inválidos` ao avançar.
- Histórico e transações financeiras foram preservados; nenhuma carreira de produção foi alterada por testes.
- Base completa com 14.012 jogadores: oito avanços e oito reaberturas locais, todos válidos. Esses tempos e medições locais não comprovam consumo faturável.
- Build completo, tipos do Worker, lint dos arquivos alterados, testes de SQLite, sincronização com dez conexões, compactação, autenticação, salvamento incremental e reabertura: aprovados. Teste adicional validou relatórios de 100 simulações.
- Duas verificações adicionais falham também na versão anterior: posição de goleiro durante pênalti em `match-report.test.ts` e revisão de um tick em `league-service.test.ts`. Comparação com HEAD realizada antes da publicação; não fazem parte desta correção.
- Servidor publicado: `4ae148f1-c251-4ac5-88b0-d8f1651edc5b`. Saúde, catálogo, origem e autenticação obrigatória verificados após a publicação. O usuário confirmou que a mesma carreira carregou após a correção.
