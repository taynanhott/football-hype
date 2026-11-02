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
