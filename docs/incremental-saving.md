# Salvamento e sincronização incremental

O armazenamento local mantém o checkpoint existente (`<liga>.json.gz`) e um
registro incremental (`<liga>.json.gz.events`). Cada ação aguarda a gravação do
evento antes de ser confirmada. A cada 128 eventos, a próxima gravação consolida
o checkpoint e limpa o registro antigo. A leitura aceita arquivos antigos sem
registro e reaplica apenas eventos posteriores à revisão do checkpoint.

Para copiar ou restaurar uma carreira, preserve os dois arquivos juntos, com o
servidor parado. Uma linha incompleta ao final do registro, deixada por uma
gravação interrompida, é descartada na leitura. Lacunas entre revisões completas
são tratadas como erro. Os scripts de manutenção usam `readSavedLeague` para
incluir os eventos recentes na leitura e no backup.

A conexão envia um snapshot completo ao entrar ou ressincronizar. Depois envia
`snapshot-update` com a revisão de base e somente os blocos alterados do estado.
O cliente valida esses blocos e solicita ressincronização se a base divergir.
Campos inalterados preservam suas referências, evitando reconstruir a base de
jogadores durante uma proposta. Atualize servidor e cliente juntos.

O Firestore mantém o formato de documentos existente. A compressão passa a ser
assíncrona; leituras com a mesma revisão reutilizam o estado já validado, após
consultar a revisão publicada no documento.

Verificações: `incremental-saving.test.ts` cobre validação de alterações,
preservação de referências, retomada após interrupção, reinício e consolidação
do checkpoint. `negotiation-response.spec.ts` cobre orçamento, duas propostas
consecutivas e recuperação da conversa ao reconectar.
