# Entrega — interface e disponibilidade — 11/11/2026

## Conteúdo

- Partículas e iluminação compartilhadas nos menus, com movimento reduzido e menor quantidade no celular. Anéis dos botões expandem no hover e recolhem ao sair.
- Save mobile compacto, escudo à esquerda e grupo de informações centralizado. Engrenagem padronizada, com hover localizado no botão do save.
- Carreira com placares compactos, escudo e nome dos adversários, indicadores reorganizados e histórico do clube em tema escuro. Técnico do mês anunciado somente no noticiário, com contagem na carreira.
- Convocados, lesionados e suspensos saem dos titulares/reservas, ficam desativados nos não relacionados e não entram nas substituições. Vagas recebem as melhores opções disponíveis, preservando preferências para o retorno sem alterações manuais.
- Convocação considera a data atual do jogo, sem antecipar a próxima janela FIFA. A simulação revalida a disponibilidade na data e competição efetivas.
- Regra solicitada de cartões: três amarelos ou um vermelho geram um jogo de suspensão na mesma competição. Contagem nova, sem punição retroativa; amarelos zeram na virada da temporada, suspensões pendentes permanecem.
- Ajustes visuais e padronização dos ícones no CT, finanças, relatórios, cartas e perfil do treinador; cabelo longo do avatar refinado.

## Validação

- Build de produção de shared, domain, client e empacotamento do Worker aprovado: quatro tarefas.
- Revisão estática dos 31 arquivos de código alterados aprovada; arquivos da entrega formatados.
- Testes focados de disponibilidade, disciplina, interface, retornos, premiação mensal e notícias aprovados durante a implementação.
- Suíte geral de execução, sem typecheck: 655 aprovados, 76 falhas e quatro ignorados. Não está integralmente verde.
- Comparação isolada com `b096096`: os mesmos 28 arquivos com falhas foram executados no commit anterior, com 114 aprovados e 77 falhas nesse subconjunto. Duas falhas antigas de escalação passam nesta entrega.
- Uma falha apareceu apenas na execução ampla atual: transferência de snapshot acima de 32 MB. O arquivo foi repetido isoladamente, com um processo, e seus três testes passaram. Não foi identificada nova falha reproduzível nessa comparação.
- As verificações de tipos da interface, domínio e Worker passaram. O projeto geral de tipos dos testes ainda apresenta 33 erros em arquivos anteriores; os testes acrescentados não apresentam erros nessa checagem.
- Layouts conferidos em computador e celular; textos, contraste, áreas desativadas e bloqueio de arraste verificados. Não foram feitos testes de escrita em carreiras de produção.

## Publicação

Esta entrega utiliza os serviços existentes `football-hype-game` e `football-hype`, sem novas migrações, bindings, endpoints ou serviços. Observabilidade continua desabilitada e `USAGE_METRICS` permanece `false`. Disponibilidade, disciplina e prêmio mensal usam eventos e sincronização existentes; as animações rodam somente no cliente.

Estado, finanças e carreiras de produção são preservados. Nenhuma rotina de reset ou manutenção destrutiva faz parte da publicação. As medições e validações locais não demonstram capacidade ou custo de produção.

Versões consultadas antes da entrega: backend `fecceaa8-3e31-4916-a282-4d00b38de00e`; interface `90994d16-75ad-4eae-a0a1-be3098b67c55`. A conclusão da publicação depende da saída do deploy e da verificação pública dos serviços; este arquivo registra a preparação e os resultados de validação.
