# Avaliação do loading — 05/11/2026

## Escopo e método

Inspeção do caminho cliente → fila → comando/calendário → validação do evento → SQLite → snapshot → diferença/compressão → cliente. Diagnóstico com a base real do repositório: 14.012 jogadores, 697 clubes e dez conexões representadas pela preparação sequencial de dez mensagens. Três amostras consecutivas de avanço diário e três de avanço com partidas, no início da temporada. Resultados brutos: `loading-profile.json`.

Tempos abaixo são medianas locais em Node e SQLite em memória. Não incluem rede, renderização React/WebGL, navegador de celular, concorrência real entre ligas, duração de uma carreira longa nem execução Cloudflare. Etapas extras de diagnóstico são medidas separadamente; não somar todas as linhas como se fossem uma requisição. Não são CPU faturável nem evidência de custo zero.

Reprodução em PowerShell:

```powershell
$env:FOOTBALL_PROFILE_LOADING='1'
pnpm exec vitest run --typecheck.enabled false apps/worker/tests/loading-profile.test.ts
```

O diagnóstico é ignorado nas execuções normais. A opção desliga a verificação global de tipos dos testes, que apresentou erros preexistentes em outros arquivos na investigação anterior.

## Medições

| Etapa                                                        |      Dia | Avanço com partidas |
| ------------------------------------------------------------ | -------: | ------------------: |
| Regras de calendário e treino / lote de partidas             |   124 ms |              338 ms |
| Registro e validação do evento                               |   121 ms |              187 ms |
| Persistência completa no repositório                         |    54 ms |               79 ms |
| Preparar dez snapshots do serviço, sem diferenças/compressão |     9 ms |               10 ms |
| Calcular diferença para um aparelho                          |    73 ms |               97 ms |
| Serializar/comprimir uma mensagem                            |    83 ms |               76 ms |
| Calcular diferenças e comprimir para dez aparelhos           | 1.334 ms |            1.732 ms |
| Descomprimir no cliente                                      |    13 ms |               13 ms |
| Interpretar JSON no cliente                                  |     7 ms |                7 ms |
| Validar envelope de diferenças                               |    29 ms |               30 ms |
| Aplicar diferenças                                           |    23 ms |               32 ms |
| Recalcular classificações                                    |     2 ms |                3 ms |
| Carregar estado com repositório sem cache                    |   161 ms |              236 ms |
| Copiar snapshot para cache — aproximação com structuredClone |    77 ms |              110 ms |
| Calcular manifesto integral para cache — hash local          |   325 ms |              442 ms |

O hash local usa SHA-256 de Node; no navegador o código usa Web Crypto em um worker. Essa linha indica trabalho integral existente, sem reproduzir sua duração em celular. O cache não bloqueia diretamente a confirmação da rodada: a cópia é solicitada após 1,5 s, mas pode criar travadas posteriores. Durante reconexão, a leitura/validação/hash do cache antecedem a abertura do socket e podem acrescentar espera; o timeout local da leitura é de dois segundos.

## Gargalos e intervenções prioritárias

### 1. Repetição por aparelho e fila compartilhada

`apps/worker/src/index.ts` percorre os sockets com `await this.snapshot` sequencial. Cada execução refaz a diferença e a compressão. O snapshot retornado pelo serviço contém o mesmo mundo e ledger para usuários autorizados da liga; a base e as opções de protocolo podem diferir entre sockets.

Preparar uma mensagem por grupo com a mesma base, revisão e protocolo e reutilizar seus bytes elimina a repetição dominante. A redução esperada nessa etapa com dez bases equivalentes aproxima-se de nove das dez preparações; isso não equivale a reduzir 90% do loading total. Preservar snapshots de recuperação para bases diferentes e notificações de presença.

Todas as requisições são encaminhadas para o mesmo `football-hub-v1`, com uma fila `pending`. A distribuição de uma liga pode, portanto, atrasar comandos de outras. O custo por espera não foi medido sob concorrência. Primeiro reduzir o trabalho na fila e medir `queueWaitMs`; depois avaliar separação por liga, preservando a coordenação de reservas e o limite de carreiras por usuário. Criar objetos por liga exige revisão do consumo agregado e migração, não apenas trocar a chave.

### 2. Atualização diária volumosa

As amostras diárias produziram 4,3–6,0 MB de JSON e aproximadamente 217–427 KB comprimidos por aparelho. Numa amostra sem sorteio, centros de treinamento responderam por cerca de 3,29 MB das operações e desenvolvimento por 1 MB. Eram mais de 32 mil operações de diferença, com caminhos de campo repetidos.

Usar alterações agrupadas por entidade e campos, com versões por clube/centro, reduz nomes e caminhos repetidos. Separar resumo global das informações detalhadas de treino, transmitindo detalhes de outros clubes quando necessários, é a intervenção com maior potencial para reduzir bytes. O mundo autoritativo continua completo no servidor; visões carregadas sob demanda precisam de revisões e invalidação para preservar consistência entre telas e aparelhos.

A 1 Mb/s efetivo, 217–427 KB sozinhos exigem aproximadamente 1,7–3,4 segundos de transmissão. É uma ilustração aritmética, não uma medição da conexão do usuário.

### 3. Validação e mudanças sem efeito

O evento considera alterado todo ramo cuja referência mudou. O schema valida e copia integralmente esses ramos. Nos três avanços diários o patch incluiu cerca de 7,24 MB de jogadores; nenhuma dessas amostras gerou operações de diferença em `players`. Assim, objetos foram reconstruídos e validados mesmo sem alteração efetiva dos dados finais dos jogadores.

`advanceGameDaysInternal` cria mapas e objetos de jogadores, inclusive quando a condição final permanece igual. `settleMonthly` também retorna novos objetos de clubes, gestão e dívidas mesmo sem cruzar o mês. Esses ramos aumentam a validação e a comparação posterior.

Preservar referências quando não há mudança real e validar somente entidades alteradas, mantendo as invariantes cruzadas, é prioridade. Guardar o limite do próximo fechamento mensal permite evitar a reconstrução em dias comuns. Importação e recuperação continuam exigindo validação integral; transações financeiras continuam atômicas e identificadas.

### 4. Persistência por ramo grande

O repositório serializa cada ramo alterado, lê todos os seus fragmentos e compara texto antes de gravar. O mecanismo já evita sobrescrever fragmentos idênticos, mas ainda serializa o ramo completo. Os avanços diários registraram 144–201 instruções SQL e cerca de 3,7–5,4 MB de conteúdo escrito em fragmentos; as rodadas, 391–448 instruções e 11,4–13,2 MB. Não são linhas ou bytes faturáveis da Cloudflare.

Persistir dados dinâmicos por entidade ou blocos estáveis permite atualizar os jogadores/centros afetados. Separar dados estáticos do jogador de condição, desenvolvimento e efeitos reduz serialização e escrita repetida. Exige migração compatível e testes de recuperação, reenvio e fechamento mensal. O objetivo é reduzir bytes e CPU sem aumentar excessivamente a quantidade de operações e linhas.

### 5. Recuperação e processamento no aparelho

`sync` apaga a base conhecida do socket e solicita snapshot integral; usá-lo ao retornar à tela pode transformar uma atualização pequena em carregamento completo. Evoluir para retomada por revisão e manifesto incremental evita essa penalidade. Solicitar estado integral apenas quando a base realmente não puder ser recuperada.

O cache calcula hashes do mundo inteiro e salva um snapshot completo. Mantê-lo incremental e desacoplar sua leitura da abertura da conexão reduz o caminho de reconexão. Evitar múltiplos salvamentos em voo e conservar somente a versão mais recente limita o trabalho.

No cliente local, aplicar a atualização e validar o envelope custaram dezenas de milissegundos. Classificações custaram 2–3 ms, portanto não são a primeira prioridade. React, o carregamento tardio do estádio 3D, assets e renderização em celular precisam de perfil em aparelho real; não há evidência para atribuir a eles o maior custo atual.

## Ordem de execução e critérios

1. Compartilhar preparação/compressão entre sockets equivalentes e preservar referências em mudanças sem efeito.
2. Compactar mensagens e separar detalhes globais desnecessários ao clube/tela atual, mantendo as regras no servidor.
3. Tornar persistência e cache incrementais, incluindo recuperação por revisão.
4. Repetir o perfil com temporadas avançadas e concorrência; avaliar isolamento por liga com orçamento agregado.

Registrar por amostragem, sem payloads completos: espera na fila, regras, validação, gravação, preparação, bytes, recebimento e primeira renderização utilizável. Medir p50/p95 em PC e celular, com conexão ativa e após suspensão. A duração percebida precisa ser vinculada à revisão e ao requestId para distinguir tempo de processamento de falha de sincronização. Não adicionar uma plataforma paga de telemetria.

Metas de aceitação propostas: rotina diária abaixo de 500 ms em conexão ativa no cenário de referência; nenhuma interrupção da partida por treino; crescimento pequeno do preparo ao passar de um para dez aparelhos com a mesma base; estado e transações financeiros idênticos após reenvios e recuperação. São metas a validar, não ganhos já entregues nem garantia para qualquer rede.

## Implementação local posterior à auditoria

Aplicados: reutilização dos bytes de atualizações entre sockets com bases/revisões/protocolos equivalentes; filas de mensagens separadas por liga com agendamento serializado; compactação de mudanças densas; preservação de jogadores sem mudanças efetivas; fechamento mensal sem reconstrução em dias comuns; retomada do socket preservando a base; envio incremental de ramos ao worker de cache, reaproveitamento de hashes e consolidação de salvamentos pendentes.

O JSON de diagnóstico agora contém a medição posterior às alterações. Os valores da tabela inicial acima são a linha de base. Na medição posterior, validação diária: 28 ms; gravação diária: 18 ms; preparação compartilhada para dez bases equivalentes: 102 ms no avanço diário e 183 ms com partidas. A preparação compartilhada é medida isoladamente, sem executar sockets reais ou rede. O campo `fanout10` mantém o cenário de dez preparações independentes para comparação; `fanout10SharedPreparation` mede o reaproveitamento. Cache integral e carregamento frio continuam medidos separadamente como referência, sem representar o caminho incremental novo.

Passaram 25 testes direcionados, verificações de tipos de cliente/worker e lint dos arquivos alterados. Nove falhas nos testes de empréstimos foram reproduzidas também com os arquivos de domínio anteriores às alterações.

Ainda não implementados: novo formato de persistência por entidade, carregamento sob demanda dos detalhes de clubes e separação física em objetos por liga. As filas separadas permanecem no mesmo objeto e processo. A leitura inicial de cache ainda antecede a conexão. Nenhuma publicação foi realizada; a duração percebida em dois aparelhos e a concorrência real entre ligas ainda precisam de validação integrada.
