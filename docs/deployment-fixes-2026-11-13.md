# Correções e publicação — 13/11/2026

Atualização posterior à publicação inicial registrada em `deployment-2026-11-13.md` e ao commit `8acbe4a`.

## Correções

- Escalação entra imediatamente na fila existente, evitando perder edições ao trocar rapidamente de página. A consolidação e a recuperação da fila continuam preservadas.
- Reservas de propostas, folha, manutenção e dívidas são consideradas nos limites financeiros. Revisar ou concluir uma proposta libera somente a própria reserva; o aceite revalida o orçamento.
- Saldos, dívidas, bilheteria, movimentações e histórico financeiro preservam centavos na persistência. A venda de instalações devolve exatamente 50% do upgrade correspondente.
- Manutenção cresce 65% por nível. Novas finais da Copa do Brasil têm ida e volta; formatos já persistidos são preservados, sem deslocar o calendário a cada avanço.
- Jogadores não se sobrepõem no reposicionamento de pênaltis e na movimentação para receber passes em profundidade. Interesse permanece entre 1 e 100, mantendo os bloqueios de propriedade e política.
- A página deixa de impor largura mínima de 360 px, permitindo o mercado em 320 px sem rolagem horizontal.
- Testes foram alinhados à interface e às regras atuais, incluindo o mínimo de 18 atletas, valores em HC$, filas, contratos e formatos antigos de competições.

## Validação

- Node 24.13.0, dentro da faixa declarada pelo projeto.
- `pnpm check` aprovado: formatação, lint, tipos, cobertura e compilação. Resultado: **1.546 testes aprovados, quatro opcionais ignorados, nenhum erro de tipos**.
- Cobertura: **98,14% de linhas e instruções, 100% de funções e 90,02% de caminhos condicionais**. Os limites originais foram mantidos.
- **43 cenários de navegador validados**: 34 aprovados na execução integral e nove aprovados nas reexecuções após as correções. Incluem reconexão, avanço e encerramento real da transmissão, dois treinadores, recuperação do relatório após recarregar, empréstimos e telas de 320 a 1280 px.
- A precisão monetária teve uma verificação focada adicional: 12 testes e verificações de tipos aprovados.
- Após a correção de largura e os últimos ajustes dos testes, formatação, lint, tipos dos testes de navegador e compilação foram verificados novamente.
- O limite do job de qualidade no GitHub passou a 30 minutos para acomodar as transmissões reais de 90 segundos. Os comandos e os critérios de aprovação permanecem os mesmos.

Os quatro testes opcionais dependem de PostgreSQL externo ou da ativação explícita de benchmarks extensos. Os emuladores Firebase não foram executados localmente. A compilação mantém um aviso de tamanho do bundle principal, aproximadamente 1,75 MB sem compressão e 488 KB com gzip.

## Produção

- Backend `football-hype-game`: `fcb6155f-8309-4454-b50e-730c35ae3fa5`.
- Interface `football-hype`: `daa2ede8-7d1b-4a04-a4cd-84fca19c3818`.
- Site: https://football-hype.taynanzhott.workers.dev

Saúde, catálogo, autenticação obrigatória, CORS e rejeição de WebSocket sem login foram verificados no backend publicado. O HTML e sete arquivos iniciais retornaram HTTP 200; os arquivos publicados têm o mesmo SHA-256 dos arquivos locais validados.

Não houve exclusão, reset ou migração de carreiras, alteração de bindings, serviços ou observabilidade. `USAGE_METRICS` permanece `false`. Não foram adicionados processos periódicos ao backend. Os testes de consumo usam SQLite e relógio local; não comprovam cobrança, CPU ou capacidade agregada em produção. Nenhuma carreira real foi alterada para testar, e o fluxo autenticado completo em produção não foi exercitado.
