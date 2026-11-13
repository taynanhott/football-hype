# Publicação — 13/11/2026 — maior desgaste e minutos inteiros

## Alterações

- Desgaste-base por partida completa de 28 para 36; recuperação-base diária de 3 para 2 e recuperação adicional por nível de preparação física de 1 para 0,5.
- Preservados minutos efetivamente jogados, idade, posição, intensidade, sequência, CT e atendimento direcionado.
- Minutos de substituição no relatório, descrição acessível e tooltip apresentados como inteiros, com o arredondamento usado por gols e cartões. Horários precisos da simulação e resultados existentes não são recalculados.
- O ajuste de 36 pontos ainda não havia sido publicado na entrega anterior.

## Validação

- Build completo: seis tarefas aprovadas, incluindo interface e pacote do servidor. Os pacotes gerados contêm os novos valores de desgaste e recuperação.
- Testes direcionados de gestão da partida, expulsões, contratos, pausa de treinamento e quatro cenários de calendário aprovados, incluindo idade, CT, folga, avanço em lote e idempotência.
- Novo teste de integração acompanha a partida até o estado da carreira, confirma o desconto de `fitnessSpent`, serializa/restaura o estado e verifica cansaço restante quatro dias depois.
- Tipos dos testes direcionados, lint e formatação dos arquivos alterados aprovados.
- A suíte geral não foi repetida nesta entrega: na execução anterior, 1391 verificações passaram e 75 falharam, com quatro ignoradas e dois erros não tratados por timeout. Não se afirma aprovação integral da suíte.
- Ambiente local Node 26, enquanto o projeto declara Node 22–24.

## Infraestrutura

Publicação nos serviços existentes `football-hype-game` e `football-hype`. Sem novas migrações, bindings ou serviços; sem reset de carreiras ou alterações financeiras. Observabilidade desativada e `USAGE_METRICS=false` preservados. Ajuste numérico nos cálculos existentes, sem novas chamadas, alarmes ou processamento periódico. Os testes locais não comprovam capacidade ou custo em produção.

Versões e verificação pública serão registradas após a publicação.
