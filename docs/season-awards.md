# Premiações da temporada

Resultados persistidos em `seasonAwards` no dia da cerimônia, após o pagamento dos campeonatos, e preservados na troca de temporada. Sem chamadas periódicas ou novos serviços.

Calendário: sete dias de recuperação antes da Intercontinental; dois dias até os pagamentos; mais dois até o Ballon D'or; encerramento no dia seguinte. Cada avanço processa e salva o evento correspondente. Eventos já ocorridos e seus pagamentos não são reescritos ao ajustar datas futuras. Nova temporada exige maioria estrita dos participantes marcando Pronto; os votos são limpos ao encerrar e ao iniciar a temporada.

Pagamentos em `competitionPayments`, com temporada, competição, clube, centavos e data. Crédito e registro são persistidos junto ao evento, sem pagamentos duplicados na repetição. Regionais acumulam participação e fases atingidas. Séries seguem as tabelas configuradas; copas e ligas europeias premiam o campeão nos valores informados.

Critérios individuais: mínimo de 12 participações com nota, redução do peso de amostras pequenas, nota média, gols e assistências limitados, títulos com bônus limitado. Goleiros usam notas, jogos sem sofrer gols e gols sofridos por partida. Treinadores usam aproveitamento, volume de jogos e títulos. Desempate determinístico por identificador. Seleções 4-3-3 sem atletas duplicados ou em posições diferentes.

Comparação mundial: coeficiente 0,72 para clubes brasileiros e 1,18 para estrangeiros. Critério personalizado inicial, sujeito à calibração com temporadas completas.

Limitação: ligas europeias persistem placares resumidos sem notas e participação individuais. Prêmios mundiais consideram apenas partidas com dados individuais registrados. Nenhum número é inventado para preencher as listas; posições sem candidato elegível são identificadas.

Carreiras já encerradas não são recalculadas silenciosamente. O histórico da carreira registra o técnico premiado; notícias e indicadores são derivados dos resultados persistidos.
