# Publicação — 13/11/2026 — elenco, recuperação e finanças

## Entrega

- Desgaste proporcional aos minutos efetivamente jogados, posição, idade, intensidade, sequência e inferioridade numérica; folga com recuperação gradual e influência do CT, sem restaurar automaticamente 100%.
- Gestão de substituições e goleiros, impacto do físico nos lances e histórico opcional de desgaste e mudanças no gol, preservando resultados anteriores.
- Entrosamento por eventos, pausa do treino individual durante lesões e remoção dos atendimentos individuais.
- Interface de escalação, médias do elenco, condição física, CT e apresentação das partidas, com comemorações, torcida e áudio de gol.
- Remoção do gráfico financeiro mensal e do texto de estimativa; quatro cartões abaixo dos indicadores mensais. Texto da diretora e explicações do orçamento ampliados.

## Validação

- Build completo: seis tarefas aprovadas. Tipos: nove tarefas aprovadas e verificação das ferramentas concluída.
- Lint geral e formatação geral aprovados.
- Nove arquivos direcionados: 77 testes de execução e 71 verificações de tipos aprovados (148 no relatório combinado).
- Navegador Edge, carreira local isolada: layout financeiro conferido em 1440×900, 1280×800 e 390×844; cartões abaixo do resumo, sem cortes horizontais ou rolagem horizontal.
- Suíte geral: 1391 verificações aprovadas, 75 falhas, quatro ignoradas e dois erros não tratados por timeout. Sem erros de tipos. A suíte não está integralmente aprovada; há falhas já registradas anteriormente e a origem de todas as falhas não foi isolada nesta entrega.
- Ambiente local Node 26; o projeto declara Node 22–24. O navegador padrão da automação não estava instalado; a conferência visual usou o Edge existente. A configuração de teste local foi ajustada somente no processo de execução, sem alterar as variáveis de produção.

## Infraestrutura

Serviços existentes: `football-hype` (interface) e `football-hype-game` (servidor). Sem novos serviços, bindings ou migrações. Observabilidade desativada e `USAGE_METRICS=false` preservados. A lógica usa os eventos e a sincronização existentes; nenhuma chamada por quadro ou heartbeat periódico foi adicionado. O histórico opcional de desgaste e goleiros aumenta o tamanho dos resultados proporcionalmente às partidas; não se infere custo ou capacidade de produção pelos testes locais. Nenhuma carreira de produção foi apagada ou usada para teste de escrita.

A confirmação de versões e respostas públicas será registrada após a publicação.
