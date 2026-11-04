# Análise de melhoria — peso da força do elenco

## Conclusão

A proposta aumenta o retorno de melhorar jogadores e torna os elencos superiores mais consistentes, sem favorecer nomes de clubes. Ainda não está pronta para publicação: a geometria do 4-3-1-2 apresentou vantagem excessiva e a frequência de empates precisa de um refinamento. Os ajustes experimentais foram retirados do motor de trabalho ao final da análise; o código anterior foi preservado.

## Problemas encontrados

1. O peso coletivo na qualidade do chute é pequeno: diferença de 10 pontos na força acrescenta cerca de 1,54 ponto percentual ao xG antes dos ajustes individuais e limites. A proposta moderada eleva para 2,86 pontos percentuais.
2. A vantagem individual era de 12% relativos por 10 pontos de qualidade; a proposta usa 18%, limitada entre 0,55 e 1,65 vezes a probabilidade-base. Isso não é aumento de 18 pontos percentuais.
3. A seleção de titulares e reservas bloqueia automaticamente atletas de overall 80 ou mais em janelas FIFA, sem exigir registro de convocação. O calendário usado contém 100 de 380 jogos nessas janelas. Na base, Flamengo possui seis jogadores nessa faixa e Palmeiras quatro. A proposta experimental retirou o bloqueio para medir seu efeito no conjunto; a implementação definitiva deve compatibilizar calendário e convocações reais/modeladas.
4. Em elencos de mesma qualidade, a distribuição espacial das formações já produz diferenças fortes, antes de acrescentar os confrontos de estratégia. Isso pode superar a vantagem técnica do elenco.
5. Moral e condição física entram como multiplicadores da força coletiva; efeitos temporários, posição aprendida e adaptação alteram o overall efetivo antes da partida. Esses fatores devem continuar relevantes, mas precisam ser auditados para não apagar vantagens técnicas moderadas. Não foram todos alterados nesta proposta.

## Experimentos e limites

Comparação de cinco temporadas completas no motor atual e em cada uma de duas propostas, usando as mesmas cinco sementes (20261026 a 20261030), com 1.900 jogos por variante. A referência atual foi reaproveitada da calibração anterior. Apenas Série A, sem copas, compras e vendas, decisões humanas ou intervenções durante a temporada. A formação inicial maximiza o encaixe/overall efetivo do elenco; os bots mudam estilos conforme o histórico. Buffs, debuffs, lesões, desgaste e evolução ativos. Não é previsão do futebol real nem amostra independente de validação.

Além disso: 500 partidas por diferença de overall em campo neutro, com lados alternados, formações iguais, moral 80 e condição 100; e 300 partidas por confronto entre formações com jogadores de overall 70. As pequenas diferenças no teste de elencos iguais são ruído amostral, não evidência de qualidade diferente.

## Retorno de melhorar o elenco

Vantagem de overall aplicada a todos os 11 jogadores, contra equipe de overall 70. Não representa contratar apenas um jogador.

| Vantagem média | Vitórias atuais | Vitórias propostas | Empates propostos | Derrotas propostas | Pontos/jogo atuais | Pontos/jogo propostos |
| -------------- | --------------: | -----------------: | ----------------: | -----------------: | -----------------: | --------------------: |
| +5             |           45,4% |              51,0% |             29,2% |              19,8% |               1,63 |                  1,82 |
| +10            |           56,0% |              67,0% |             21,4% |              11,6% |               1,94 |                  2,22 |
| +15            |           69,8% |              84,6% |             11,6% |               3,8% |               2,28 |                  2,65 |

A proposta forte inicial, descartada, dava 75% de vitórias com +10 e 89,6% com +15. A proposta moderada reduz esses extremos, preservando zebras. Não foi medido neste relatório o retorno marginal de uma única contratação ou de cada posição isoladamente.

## Médias do campeonato

| Indicador         | Atual | Só força maior | Proposta moderada + disponibilidade |
| ----------------- | ----: | -------------: | ----------------------------------: |
| Vitória mandante  | 49,3% |          50,1% |                               49,7% |
| Empate            | 25,9% |          23,2% |                               25,0% |
| Vitória visitante | 24,7% |          26,7% |                               25,3% |
| Gols por jogo     |  2,54 |           2,61 |                                2,49 |

A proposta melhora a hierarquia técnica, mas não supera a calibração atual em todos os indicadores: os empates ficam em 25% e os gols em 2,49. Aumentar apenas a força deixa os empates em 23,2%. Precisamos preservar a referência de aproximadamente 26–27% de empates e 2,5–2,7 gols em uma amostra maior e com sementes novas.

## Resultado por clube

Médias de cinco temporadas, ordenadas pelos pontos médios da proposta. Posição média não é uma classificação única.

| Clube         | Pontos atuais | Pontos propostos | Diferença | Posição média proposta | Títulos em 5 temporadas |
| ------------- | ------------: | ---------------: | --------: | ---------------------: | ----------------------: |
| Corinthians   |          80,8 |             81,0 |      +0,2 |                    1,4 |                       3 |
| Flamengo      |          59,8 |             75,4 |     +15,6 |                    2,8 |                       1 |
| Palmeiras     |          59,0 |             67,2 |      +8,2 |                    5,0 |                       0 |
| Vasco         |          57,4 |             66,4 |      +9,0 |                    5,2 |                       0 |
| Cruzeiro      |          55,2 |             62,4 |      +7,2 |                    6,8 |                       0 |
| Santos        |          56,4 |             60,6 |      +4,2 |                    7,6 |                       0 |
| Bahia         |          54,4 |             59,6 |      +5,2 |                    7,6 |                       0 |
| Botafogo      |          54,2 |             57,2 |      +3,0 |                    8,2 |                       0 |
| Atlético-MG   |          57,0 |             57,2 |      +0,2 |                    8,8 |                       0 |
| Fluminense    |          64,4 |             56,0 |      -8,4 |                    9,6 |                       1 |
| Internacional |          56,6 |             52,4 |      -4,2 |                   11,0 |                       0 |
| Bragantino    |          52,2 |             50,2 |      -2,0 |                   11,6 |                       0 |
| Grêmio        |          50,4 |             48,8 |      -1,6 |                   12,0 |                       0 |
| São Paulo     |          54,0 |             46,8 |      -7,2 |                   12,8 |                       0 |
| Remo          |          44,4 |             38,8 |      -5,6 |                   14,8 |                       0 |
| Athletico-PR  |          34,0 |             36,4 |      +2,4 |                   15,4 |                       0 |
| Vitória       |          40,2 |             35,6 |      -4,6 |                   16,4 |                       0 |
| Coritiba      |          40,6 |             35,4 |      -5,2 |                   16,2 |                       0 |
| Chapecoense   |          30,8 |             30,8 |      +0,0 |                   17,8 |                       0 |
| Mirassol      |          39,6 |             26,8 |     -12,8 |                   19,0 |                       0 |

Flamengo: colocações atuais 4º, 16º, 5º, 4º e 3º; proposta 3º, 3º, 4º, 3º e 1º. Palmeiras: atuais 10º, 9º, 9º, 2º e 10º; proposta 2º, 4º, 5º, 10º e 4º. Não há garantia de título nem favorecimento por identidade. A correlação de Pearson entre a força efetiva inicial dos titulares e os pontos médios sobe de 0,752 para 0,886; isso é associação observada nesta amostra, não isolamento causal.

## Pendência: vantagem espacial das formações

Teste neutro, jogadores de overall 70, moral e condição iguais, estilo equilibrado para os dois lados; sem o bônus explícito de confronto tático usado pelo processamento da rodada.

| Formação | Adversária | Vitórias | Empates | Derrotas |
| -------- | ---------- | -------: | ------: | -------: |
| 4-4-2    | 4-3-3      |    49,0% |   30,3% |    20,7% |
| 4-3-1-2  | 4-3-3      |    57,0% |   27,0% |    16,0% |
| 3-2-4-1  | 4-3-3      |    33,0% |   31,3% |    35,7% |

O Corinthians foi campeão em três das cinco temporadas propostas, apesar de a força efetiva inicial dos seus titulares ser cerca de 73,8, contra 77,7 do Flamengo e 76,5 do Palmeiras. O resultado é compatível com uma vantagem excessiva de formação, mas não prova que ela seja a única causa. A amostra não testa todas as combinações de formação e estilo.

## Recomendação de implementação

1. Compatibilizar partidas do calendário com as janelas FIFA e substituir a indisponibilidade automática por overall por uma regra de convocação explícita.
2. Corrigir a vantagem estrutural de algumas formações: ocupação de espaços, criação de chances pelos lados, escolha de receptores e cobertura defensiva. Preservar vantagens contextuais entre estratégias, sem criar uma formação universalmente superior.
3. Adotar a intensidade moderada de força testada: divisor coletivo 350 em vez de 650 e ganho individual de 0,018 em vez de 0,012 por ponto de qualidade. Testar junto da correção das formações, porque os resultados mudarão.
4. Na proposta, equipes atrás no placar têm fator ofensivo 1,4 e equipes à frente 0,6, em lugar de 1,3/0,7. É uma compensação experimental para conter a queda dos empates, excluindo pênaltis; precisa ser revisada após corrigir a geometria, sem mascarar problemas de criação de chances. A escala geral de finalizações usada foi 2,05, em vez de 2,12.
5. Validar o conjunto em pelo menos 20 temporadas com sementes novas, medir o ganho de +5 e +10 de overall e comparar todos os confrontos de formação. Reavaliar também com copas e rotação do elenco.
6. Só então aplicar e publicar o conjunto. Esta análise não publicou nem manteve os ajustes experimentais ativos.

O objetivo é que melhores jogadores gerem vantagem consistente, enquanto tática, mando e fase ainda decidam partidas equilibradas. Os dados apresentados são resultados medidos dos protótipos; os efeitos das etapas ainda não implementadas permanecem estimativas qualitativas.
