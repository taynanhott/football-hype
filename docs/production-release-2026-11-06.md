# Atualização de produção — 06/11/2026

## Alterações

- Tema em carvão, cinza e dourado, mantendo os campos verdes e as cores dos setores e das táticas. Texturas, cartas, listas de jogadores e controles receberam os ajustes de contraste solicitados.
- CT e estádio em duas colunas no desktop, com visualização 3D e estruturas com abas. Modais compactos, auxiliares, indicadores de evolução e manutenção revisados.
- Divisão do orçamento preservada ao soltar o controle e trocar de aba. Removido o arredondamento antigo dos comandos financeiros para múltiplos de HC$ 500.000.
- Menor frequência de lesões em jogos e treinos e penalidades menores nas posições próximas, mantendo as mudanças distantes.
- Avanços entre treinos permitem outras ações ordenadas, mantendo a proteção contra avanços concorrentes.
- Noticiário com destaques dos três maiores placares por lote de jogos, resenhas fictícias, mais comentaristas, links de clubes/jogadores e rolagem ajustada.
- Relatórios financeiros mantêm o mês anterior e calculam médias sobre meses encerrados.

## Validação

- Build completo de produção e tipos de todos os pacotes: aprovados.
- Lint dos arquivos de implementação e testes alterados: aprovado.
- 21 novos testes unitários de orçamento, posições e noticiário: aprovados.
- Teste de orçamento no navegador Edge: aprovado, incluindo saída da aba antes do fim da edição e liberação do ponteiro fora do controle.
- Suíte completa: 582 aprovados, 74 falhas e 4 ignorados na execução restrita. Comparação isolada do HEAD anterior: 572 aprovados, 63 falhas e 4 ignorados. As 11 falhas exclusivas da execução restrita passaram com acesso local; nenhuma falha nova permaneceu nessa comparação. A suíte geral continua com falhas anteriores.
- A verificação global de formatação encontra diferenças anteriores em arquivos de dados, configuração e teste não alterados nesta entrega. A formatação dos arquivos desta atualização foi verificada.

## Publicação

Destinos existentes:

- Interface: https://football-hype.taynanzhott.workers.dev
- Servidor: https://football-hype-game.taynanzhott.workers.dev

Sem novos serviços, bindings ou migrações. Sem testes de escrita em carreiras de produção. Medições locais não comprovam consumo faturável nem garantem custo zero.
