# Publicação — estádios e partidas — 12/11/2026

## Entrega

- Modelos próprios de Allianz Parque, Morumbi, Vila Belmiro, Arena da Baixada, Maracanã, Mineirão, Arena MRV, Neo Química Arena, São Januário, Arena do Grêmio e Nilton Santos; estádio genérico de nível 2 revisado conforme as referências.
- Mapas de torcida compartilham as superfícies das arquibancadas. Amostragem fracionária evita setores vazios em curvas curtas; validação de apoio, folga e inclinação evita posições dentro das estruturas. Escadas da MRV e do Grêmio limitadas a 1,1 m.
- Redes hexagonais com profundidade, bandeirinhas de escanteio e bola em escala intermediária, apoiada acima do gramado.
- Árbitro de magenta com corrida e gesto de apito; áudio do apito refeito.
- Sinalizadores com cores separadas entre mandantes e visitantes, posições irregulares em alturas variadas e fumaça maior seguindo a subida das fileiras. Menos plumas e partículas na tela pequena; animação executada no navegador.
- Confetes menores, com orientação fixa e queda com deslocamento suave, apenas em estádios de nível 4 ou 5.
- Novas simulações distinguem encaixes, espalmadas para escanteio e rebotes; enfiadas adiantam o destino para permitir a corrida ao espaço. Reprodução distribui mais tempo às ações importantes, mantendo 90 segundos e o intervalo. Resultados já persistidos não são refeitos.

## Validação

- Testes focados em 11 arquivos: aprovados, incluindo tipos de testes, cobertura das curvas, cores, inclinação, limites dos efeitos, posse do goleiro, rebotes e tempo de apresentação.
- Lint de todos os arquivos TypeScript alterados: aprovado.
- Builds de shared, domain, client e empacotamento do worker: aprovados; tipos do client e worker aprovados.
- Cena completa conferida no Edge local, em resolução de computador e de celular, sem erros de execução. Confetes ausentes no nível 2 e presentes no nível 4; duas cores de fumaça e direção inclinada verificadas nos buffers da cena.
- Suíte geral não declarada integralmente aprovada: uma verificação ampliada durante o desenvolvimento encontrou oito falhas anteriores em ingressos e relatórios, reproduzidas sem as alterações desta entrega. Nenhuma regra financeira foi alterada.

## Produção

- Interface: https://football-hype.taynanzhott.workers.dev
- Versão da interface: `df6a9195-da68-41f8-9058-50fe58fa81eb`.
- Servidor: https://football-hype-game.taynanzhott.workers.dev
- Versão do servidor: `160c9092-02ac-4a8f-af4b-aaa08343ce6b`.
- Verificação HTTP: interface e arquivo JavaScript esperado respondem 200; `/health` responde 200 com `status: ok` e persistência `durable-sqlite`.

Publicação nos serviços existentes, sem novos bindings, migrações ou serviços. Observabilidade continua desativada e `USAGE_METRICS` permanece `false`. Não foram realizados testes de escrita em carreiras de produção. Testes locais não comprovam consumo faturável nem garantem custo zero.

## Correção da fumaça sob as coberturas

- A seleção dos emissores considera a posição inicial e o volume inteiro da pluma, incluindo largura e dispersão, em relação às folhas de cobertura e tetos da geometria transformada.
- Emissores sem folga são substituídos por posições viáveis; o percurso e o crescimento ficam limitados e a fumaça se dissipa dentro do espaço disponível.
- O índice geométrico existente é reutilizado na montagem, sem consultas de colisão por quadro nem chamadas ao servidor.
- Revisão local dos 13 modelos, testes de teto baixo, origem acima da cobertura, invalidação do cache e arquibancadas: executados. Tipos, lint e build da interface aprovados.
- Correção publicada apenas na interface, versão `9093f023-629d-43e8-9d72-8a8e6666ce95`; servidor e carreiras preservados.
