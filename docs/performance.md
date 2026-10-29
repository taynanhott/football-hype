# Cache, ações e salvamentos

O catálogo de clubes é gerado de `data/player-database.json` antes de iniciar ou
compilar a interface. A seleção de time usa esse catálogo pequeno, incluído no
projeto. A base de jogadores permanece no servidor e é reutilizada em memória.
Atualizações da base exigem gerar e publicar novamente o catálogo.

Depois de entrar numa carreira, a interface usa os jogadores já carregados para
pesquisar no mercado. A conexão da sala envia as alterações da liga; não há um
segundo observador do Firestore solicitando snapshots completos a cada gravação.

## Fila de ações

A interface calcula uma prévia local de ações como propostas, ingressos,
escalações e melhorias. Os botões continuam disponíveis durante a sincronização.
A fila envia uma ação por vez, preserva sua identificação ao reconectar e mantém
os comandos pendentes no armazenamento local, separados por conta e liga.
O indicador da interface distingue ações pendentes de uma carreira sincronizada.

O servidor usa as regras do jogo para produzir o estado compartilhado a partir
do comando. A confirmação identifica a ação e a revisão gravada. A interface
reconcilia sua prévia com essa revisão antes de enviar a próxima ação. Reenvios
recentes são reconhecidos pelo histórico; o identificador único do evento também
impede que um reenvio antigo grave a mesma operação duas vezes.

Quando uma ação é recusada, sua prévia é retirada e as ações restantes são
reavaliadas. Se a conexão não confirmar a operação, a fila fica pausada e pode
ser recuperada ao reconectar. Se o navegador bloquear ou esgotar o armazenamento
local, a fila continua em memória, mas não sobreviverá ao fechamento da página.
Rodadas e novas temporadas aguardam a simulação compartilhada, sem duplicá-la no
navegador.

## Persistência incremental no Firestore

A criação ainda gera uma carreira completa para simular suas competições. Seu
snapshot inicial comprimido fica preservado. Cada ação posterior grava apenas o
patch no evento e atualiza `patchRefs`: um mapa que indica o último evento para
cada campo alterado do estado. Campos inalterados não são recomprimidos nem
reenviados. A transação verifica a revisão e publica o evento junto das novas
referências. Uma instância reiniciada reconstrói a carreira pela base e pelos
campos referenciados, sem reproduzir todo o histórico.

Os eventos referenciados por `patchRefs` fazem parte do salvamento, mesmo que
sejam anteriores aos últimos cem registros exibidos. Não devem ser removidos
por uma rotina de limpeza do histórico. Os campos de payload e referências não
precisam de índices de consulta; suas isenções estão em `firestore.indexes.json`.

O leitor aceita os snapshots anteriores. Após a primeira gravação incremental,
um backend antigo que desconhece `patchRefs` não deve ser usado para rollback.
Publique o backend compatível, os índices e a interface desta versão; alterações
apenas na interface local não atualizam o servidor remoto.
