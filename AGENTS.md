# Diretrizes e Contexto Consolidado — Football Hype

Este documento define as regras obrigatórias de produto, interface, arquitetura, orçamento e engenharia do projeto **Football Hype**.

## 1. O jogo

- Jogo de gestão de futebol em português, com carreira solo, ligas multiplayer, elenco, escalação, táticas, transferências, empréstimos, contratos, competições, calendário, finanças, estádio 3D e centro de treinamento.
- O treinador administra um clube ao longo das temporadas, com consequências esportivas e financeiras coerentes.
- Existem regulamentos personalizados do projeto. Não substituir automaticamente pelas regras oficiais do futebol real.

## 2. Regras obrigatórias de interface

- Todos os componentes devem seguir a temática de futebol, com referências visuais, ícones e efeitos que valorizem o jogo.
- Não usar `alert`, `confirm` ou `prompt` nativos. Usar modais personalizados na identidade visual do jogo.
- Modais devem acomodar o máximo possível de conteúdo na área visível: aproveitar a largura, usar colunas e espaçamentos compactos, preservando legibilidade e acesso aos controles. Usar rolagem apenas quando o tamanho da tela ou do conteúdo realmente exigir.
- Não exibir cabeçalhos de apresentação nas páginas (evitar slogans, títulos enormes e subtítulos introdutórios). Priorizar conteúdo, filtros, indicadores e ações úteis em áreas compactas.
- Adaptar os layouts para computador e celular.
- Preservar a resposta imediata das interações, inclusive quando a sincronização ocorrer em segundo plano.

## 3. Infraestrutura e orçamento Cloudflare

- **Regra principal:** Usar as franquias gratuitas da Cloudflare como teto do projeto, inclusive se a conta estiver no plano pago.
- Não adicionar recursos ou serviços que gerem cobrança.
- Considerar consumo agregado da conta: requisições, CPU, armazenamento, operações de banco, WebSockets, alarmes, logs e margem de segurança (não analisar apenas o custo de uma ação isolada ou de uma única liga).
- Não tratar o plano pago como autorização para consumir além das franquias gratuitas.
- Não confundir teste local com consumo faturável, não prometer cobrança zero com base em estimativas/testes locais e não inventar quantidade garantida de jogadores ou ligas suportadas.
- Ao citar cotas ou preços, consultar a documentação oficial atual da Cloudflare e indicar a data da consulta.
- **Nenhuma transação financeira pode ser descartada para economizar recursos.**
- Não criar bloqueios artificiais que deixem ações lentas apenas para reduzir chamadas; economizar via consolidação de ajustes substituíveis, cache, atualizações incrementais e processamento orientado a eventos.

## 4. Arquitetura atual

- `apps/client`: interface React e visualização 3D.
- `packages/domain`: regras de negócio, simulação, competições, mercado e finanças (independente de React, Three.js e Firebase).
- `packages/shared`: contratos, schemas, configurações e estruturas compartilhadas.
- `apps/worker`: backend Cloudflare Workers com Durable Objects e SQLite (caminho atual do backend).
- Implementações alternativas ou anteriores em `apps/server`, Firebase, Render e Oracle/PostgreSQL (Firestore e Render não são necessários para novas carreiras no fluxo Cloudflare).
- Firebase Authentication e App Check permanecem para login Google e proteção do app.
- O coordenador Durable Object preserva consistência das ligas e vínculos de usuários (não presumir escala ilimitada).
- Observabilidade nos Workers está desabilitada e `USAGE_METRICS` é `false`. Não habilitar logs extensos automaticamente.

## 5. Autoridade, segurança e persistência

- O servidor é a autoridade sobre: dinheiro e movimentações financeiras, propriedade e contratos de jogadores, contratações/vendas/empréstimos, resultados das partidas, calendário/evolução da carreira, e permissões/participação nas ligas.
- O navegador calcula apresentações e prévias, mas nunca decide sozinho o resultado definitivo.
- Validar usuário, liga, clube, saldo e condições aplicáveis; operações concorrentes ou reenviadas não podem duplicar compras, pagamentos ou resultados.
- Dinheiro é representado internamente em centavos inteiros seguros (preservar precisão em rateios e arredondamentos).
- Salvar o estado antes da confirmação definitiva; reconexões devem recuperar o estado persistido.
- Não apagar, reiniciar ou migrar carreiras silenciosamente. Alterações de regulamento devem respeitar temporadas existentes e prever compatibilidade.

## 6. Economia de chamadas e sincronização

- Sem heartbeat periódico do cliente em repouso; usar WebSockets com hibernação.
- Agendar o próximo evento necessário em vez de consultar o calendário a cada minuto.
- Enviar snapshot completo ao conectar/recuperar sincronização e, depois, apenas os blocos alterados. Persistir apenas as partes do estado que mudaram.
- Busca, filtros, classificações, renderização 3D e reprodução visual dos lances rodam no navegador (a cena 3D nunca gera chamadas ao servidor por quadro).
- Calcular o resultado compartilhado uma vez por evento.
- Ajustes substituíveis (escalação, aparência, ingressos, plano financeiro) podem ser consolidados em fila local por até 30s, com flush antecipado antes de ações compartilhadas e do horário da partida. A fila deve sobreviver a reconexões, ser separada por conta e liga, e jamais descartar transações financeiras ou negociações.

## 7. Competições e temporadas

- **Séries A, B e C:** 20 clubes, turno e returno (38 rodadas), 4 rebaixados, 4 promovidos (B->A e C->B). Série A sem divisão superior.
- **Série D:** Liga nacional em turno e returno, sem rebaixamento; somente os 4 primeiros da tabela sobem para a Série C. Seletivas e copas regionais não dão acesso nacional (ignorar docs antigos que davam acesso via regionais).
- **Copa do Brasil:** 32 participantes (20 da A + 12 da B), jogos únicos até a semifinal, final em ida e volta, pênaltis em caso de empate decisivo (registrados separadamente dos gols da partida).
- **Regionais (Nordeste, Sul-Sudeste, Verde):** Modelo recente de 16 participantes por copa (4 grupos de 4), sem clubes da Série A. Seletivas regionais definem vagas restantes para clubes da Série D (considerando campeão regional elegível e classificação anterior de B e C nas entradas diretas). Seletivas em turno único, sem mata-mata, rodadas a cada 3 dias de jogo, folgas se número ímpar, sem duração artificial de 21 dias. Sorteio aguarda fim das seletivas e preserva histórico. (Verificar código atual se encontrar menção antiga a 32 clubes).
- **Continentais (Libertadores, Pré-Libertadores, Sul-Americana):** Vagas pela classificação nacional e títulos para a temporada seguinte. Prioridade Libertadores: G4 da Série A + campeões da Copa do Brasil, Libertadores e Sul-Americana. Prioridade Pré-Libertadores: 5º e 6º + vice da Copa do Brasil. Depois, até 5 vagas para Sul-Americana. Apenas uma vaga por clube (a melhor), repasses limitados até o 16º da tabela, sem duplicar clubes ou usar inelegíveis. Na Pré: 2 vencedores vão à Libertadores e 2 perdedores à Sul-Americana; sorteios aguardam fim da pré.
- **Intercontinental:** Campeão da Libertadores vs campeão europeu, jogo único em campo neutro, sem vantagem de mandante, escalação/tática resolvidas no momento da partida, temporada seguinte liberada somente após a disputa e apresentação de 90s.
- Participantes iniciais seguem listas configuradas (não substituir clubes ausentes silenciosamente); temporadas seguintes usam mérito esportivo.

## 8. Sorteios e calendário

- Fuso horário `America/Sao_Paulo`.
- Sorteios têm eventos datados e resultados persistidos (reconexão não refaz sorteio). Ocultar tabelas e partidas enquanto o sorteio estiver pendente.
- Distinguir tempo real, data do jogo e duração da apresentação da partida.
- Respeitar recuperação, treinamento, vencimentos e eventos do calendário sem cobrar nem processar duas vezes o mesmo período/evento.

## 9. Elenco e atletas

- Escalação de 11 titulares respeitando disponibilidade; servidor usa a escalação salva e resolve indisponíveis (ou usa seleção automática se não houver).
- Desempenho influenciado por posição, condição física, moral, entrosamento, tática e qualidade; sequência de jogos eleva fadiga e risco de lesão; jovens evoluem com participação e treino.
- Overall entre 1 e 99; moral e condição física entre 0 e 100.
- **Categorias das cartas:** Bronze (até 69), Prata (70–77), Ouro (78–85), Diamante (86–99).
- **Potencial em estrelas:** 1★ (50–59), 2★ (60–69), 3★ (70–79), 4★ (80–89), 5★ (90–99).
- **Scout:** descobre subconjunto determinístico de jovens até 23 anos com potencial de 3 a 5 estrelas (melhorias ampliam cobertura e priorizam potencial).
- Favoritos ficam armazenados no navegador por carreira e clube.

## 10. Mercado, salários e contratos

- Negociação avalia interesse (1 a 100; baixo interesse não é proibição automática), disposição do vendedor, importância no elenco, rivalidade, finanças e histórico. Respeitar bloqueios/políticas impeditivas.
- Jogador livre sem taxa de transferência; com clube, taxa mínima parte de 70% do valor de mercado podendo superar conforme contexto. Salário mínimo negociável depende do interesse. Interface e servidor aplicam os mesmos critérios.
- Contratação atualiza caixa, elenco, salário, contrato (3 anos para novos; 1 a 3 anos determinístico para legados) e propriedade.
- Bots avaliam carência por posição, melhoria de elenco e reserva financeira, revalidando saldo/políticas no aceite.
- Renovação exige ao menos `max(salário atual, valor de mercado / 240)`; moral < 30 e aposentadoria a partir de 37 anos podem impedir.
- Empréstimos, devoluções, vencimentos e propostas pendentes respeitam vínculos sem duplicar atletas ou pagamentos.

## 11. Finanças do clube

- Dia 1 à meia-noite de Brasília no calendário do jogo processa folha integral e manutenção (meses pulados processados uma vez cada). Atrasados quitados no fechamento seguinte ou manualmente com prioridade salarial. Distinguir despesa devida de pagamento realizado.
- Limites de verba de transferências e teto de folha mensal: soma não ultrapassa caixa atual; teto salarial inclui folha existente (apenas a sobra financia novos salários/reajustes); propostas pendentes reservam recursos; verba cai após contratações; revalidar tudo na conclusão; proteger recursos da próxima folha, manutenção e dívidas mesmo sem limites definidos.
- **Bilheteria:** 70% mandante / 30% visitante nos ingressos (preservando todos os centavos); receita comercial 100% do mandante.
- Calibração em HC$ com contratos comerciais mensais proporcionais aos dias e componente limitado pela fase do time; custos de referência do patrocínio não sobem porque o treinador gastou mais.

## 12. Estádio e centro de treinamento

- Instalações de nível 1 a 5 com investimento e manutenção próprios por departamento (estádio, hospital, lojas, alimentação, camarotes e CT possuem custos distintos).
- Manutenção cresce 65% por nível; venda de nível devolve 50% do upgrade correspondente e reduz manutenção.
- CT afeta recuperação, lesões, interesse, desenvolvimento e patrocínio.
- Proibir benefícios duplicados, upgrades gratuitos ou gastos sem validação financeira.

## 13. Táticas e simulação

- Estilos: equilíbrio, pontas, gegenpress, recuo total, posse e contra-ataque.
- Simulação determinística com semente, considerando qualidade, adequação à função, posição, físico, moral, entrosamento, mando de campo vs campo neutro, expulsões/inferioridade numérica, sem tática universalmente vencedora. Salvar formação, estilo e titulares utilizados.
- Vantagem tática limitada a ~3 pontos por equipe conforme regras documentadas.
- Notas de atletas baseadas na participação completa (passes, perdas, interceptações, desarmes, dribles, cruzamentos, finalizações, defesas, gols sofridos, clean sheets, gols e assistências).
- Overall temporário reflete fase, atraso salarial, sequência, inatividade, vitória importante e título, sem alterar indevidamente o overall base ou o valor de mercado.

## 14. Preservação de dados e método de trabalho

- Não apagar dados de produção para testar; usar ambientes/carreiras de teste separados e fazer backup antes de manutenção destrutiva.
- Em reset apenas esportivo, preservar jogadores, transferências e instalações.
- Não apresentar teste local como prova de custo/capacidade em produção nem declarar publicado apenas por existir config de deploy.
- Não afirmar que todos os testes passaram se apenas parte foi executada.
- **Fluxo de trabalho obrigatório antes de propor/implementar mudanças:**
  1. Entender o comportamento atual.
  2. Verificar o código e os testes envolvidos (confirmar fórmulas, exceções e detalhes diretamente nos arquivos, priorizando implementação e regras recentes sobre documentação antiga).
  3. Preservar as regras personalizadas do projeto.
  4. Avaliar o impacto no consumo agregado da Cloudflare.
  5. Preservar consistência financeira e resposta imediata na UI.
  6. Explicar o que muda e como foi validado.
