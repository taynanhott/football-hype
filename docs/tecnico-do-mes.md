# Técnico do mês

Premiação nacional de técnicos de clubes brasileiros, separada da gala anual. O contador aparece na carreira; o anúncio aparece somente no noticiário.

- O calendário do servidor fecha o mês à meia-noite de Brasília no dia 1. Não existe consulta periódica, novo alarme ou requisição exclusiva da premiação.
- Contam partidas oficiais concluídas no mês, com data verificável no calendário. Jogos duplicados não contam duas vezes. São necessárias pelo menos três partidas.
- Vitória vale três pontos, empate um e derrota zero. Pênaltis não alteram o aproveitamento do jogo empatado.
- Os pesos já definidos no domínio são A = 80, B = 65, C = 50 e D = 35. Na liga vale a divisão da competição; em copas vale a divisão do clube.
- Pontuação = soma dos pontos ponderados / [3 × (jogos + 2)]. Isso combina aproveitamento, peso da liga e regularidade sem premiar apenas o volume de jogos. O peso não garante vitória sobre um treinador de divisão inferior com melhor desempenho.
- Desempates: vitórias, saldo de gols e identificador estável do técnico/clube.
- A identidade do técnico humano vem do resultado salvo, sem atribuir jogos antigos ao atual ocupante. Sem identidade histórica, o mérito permanece associado ao técnico do clube.
- Nome, clube, mês e campanha do vencedor são persistidos em `monthlyCoachAwards`, junto ao estado já sincronizado. O histórico atravessa temporadas; reenvios não repetem o prêmio. Carreiras antigas continuam válidas sem esse campo, sem reconstrução silenciosa de meses passados.
- Não há prêmio financeiro, alteração de saldo, cerimônia ou modal para esta premiação.

O consumo adicional é uma leitura local do calendário/resultados por fechamento de mês e um registro compacto do vencedor. A infraestrutura continua usando os eventos, persistência e deltas existentes, sem novas chamadas do cliente nem logs. Isso não constitui medição de capacidade ou custo em produção.
