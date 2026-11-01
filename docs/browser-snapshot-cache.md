# Reaproveitamento do estado no navegador

Implementado e publicado em 31/10/2026 para o transporte Cloudflare. Versões e verificações em `deployment-2026-10-31.md`.

- Um checkpoint confirmado é armazenado em IndexedDB, identificado por usuário e liga. Somente um checkpoint é mantido no dispositivo, com validade de sete dias. As projeções otimistas da fila não são persistidas como estado confirmado.
- O navegador prepara e verifica as assinaturas SHA-256 das partes do estado em um Web Worker. As assinaturas são calculadas por blocos pequenos para evitar strings temporárias do tamanho de uma temporada no servidor.
- Ao conectar, o navegador oferece a revisão e as assinaturas, nunca o mundo inteiro. A autenticação e a participação na liga continuam obrigatórias. O servidor compara o conteúdo atual e envia apenas as partes diferentes. Revisão isolada não prova igualdade, pois a presença pode mudar sem alterar a revisão.
- Durante a conexão, o novo protocolo envia alterações por campo/entidade. Arrays com prefixo preservado recebem apenas os itens acrescentados. Exclusões e substituições continuam suportadas.
- Ao perder seu histórico em memória, inclusive após hibernação, o servidor pode solicitar as assinaturas da cópia confirmada no navegador. A resposta é deduplicada enquanto está em preparação.
- Cache indisponível, antigo, corrompido, incompatível ou sincronização sem base válida permite recuperação por snapshot completo. Se o navegador não conseguir ler o cache em dois segundos, a conexão segue sem ele.
- Clientes antigos continuam usando o protocolo anterior. Publicar o servidor antes do cliente preserva essa compatibilidade.

O servidor continua carregando o estado oficial, validando comandos e persistindo transações. O cache não reduz essas operações a zero e não garante ausência de cobrança. Não foram criados novos serviços ou bindings Cloudflare. O armazenamento é local ao navegador.

## Validação

Testes de protocolo cobrem alteração de um jogador sem reenviar a coleção, acréscimo de partidas, exclusões, imutabilidade e rejeição de caminhos inválidos. O teste do Worker cobre reconexão com cache, atualizações posteriores, perda de memória por hibernação e recuperação completa explícita. O teste em navegador cobre persistência após reload, isolamento por usuário e rejeição de cache corrompido.

No cenário gerado do teste de Worker, o snapshot completo media aproximadamente 1,6 MB e a retomada cerca de 2,6 KB; os números exatos estão em `socket-resource-benchmark.json`, campo `cacheResume`. Não é uma medição de temporada completa nem de faturamento Cloudflare.

## Limites atuais

Na reconexão, as partes cujo conteúdo mudou ainda são substituídas inteiras; o protocolo por entidade opera quando existe a base anterior no servidor. O primeiro acesso e a recuperação completa ainda podem transferir bastante conteúdo. Checkpoints grandes exigem memória e cópia inicial no navegador; o worker desloca hashing e persistência para segundo plano, mas não torna esses custos inexistentes. As métricas de uma temporada inteira em produção precisam ser comparadas após a publicação.
