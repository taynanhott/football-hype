# Football Hype · Football Manager Brasil

Jogo de gestão de futebol com interface em português, cartas de atletas e estádio 3D. A versão local inclui carreira solo, ligas multiplayer, temporadas, mercado, finanças e melhorias de estádio e CT. Há integração Firebase e importação de dados reais. Arquivos de publicação estão preparados; nenhum deploy foi realizado.

## Começar

Requisitos: Node.js 24 e pnpm 11.25.0. Java 21 é necessário somente para os emuladores Firebase.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Configure o Firebase Web em apps/client/.env.local, ative o provedor Google e autorize localhost no Firebase Authentication. Abra http://localhost:5173, entre com Google, escolha a divisão e o escudo de um clube, e clique em **Começar minha história**. Carreiras vinculadas à conta aparecem para continuar. Na primeira execução, os pacotes compartilhados são compilados antes de iniciar os aplicativos.

No PowerShell com scripts bloqueados, use `pnpm.cmd` em vez de `pnpm`. O servidor usa a porta 2567, e o client usa 5173. O endpoint `GET /health` informa o estado do servidor.

A criação e o acesso às carreiras exigem Google. A sessão local pode continuar sem internet enquanto a conexão e a sessão permanecerem válidas. O progresso fica em `apps/server/.local/leagues`, em arquivos compactados. Não apague essa pasta para preservar suas carreiras. Uma liga solo e uma multiplayer podem ser mantidas simultaneamente por treinador. A identidade do treinador é o UID da conta Google. O diretório de dados pode ser alterado com DATA_DIR; a base real desta instalação usa .local/real-leagues, mantendo as carreiras anteriores intactas.

## Desenvolver a interface usando a carreira online

Para usar a mesma carreira do site publicado, execute somente a interface:

```powershell
cd "C:\Users\tayna\OneDrive\Área de Trabalho\football-hype"
pnpm install --frozen-lockfile
pnpm dev:online
```

Se a instalação copiada apresentar módulos ausentes, reinstale no PowerShell com um cache fora do OneDrive:

```powershell
pnpm install --force --frozen-lockfile --virtual-store-dir "$env:LOCALAPPDATA\football-hype\pnpm-virtual-store"
```

Abra http://localhost:5173 e entre com a mesma conta Google usada no site. As ações afetam a carreira real no servidor; a interface local não cria uma cópia dos dados.

Em `apps/client/.env.development.local` (arquivo local ignorado pelo Git), configure:

```dotenv
VITE_USE_DEV_GAME_PROXY=true
DEV_GAME_SERVER_TARGET=https://football-hype-server.onrender.com
DEV_GAME_SERVER_ORIGIN=https://football-hype.taynanzhott.workers.dev
VITE_FIREBASE_APPCHECK_DEBUG=true
VITE_USE_EMULATORS=false
```

Mantenha a configuração pública do Firebase em `apps/client/.env`. O proxy de desenvolvimento encaminha HTTP e WebSocket para o servidor publicado, mantendo os tokens de login e App Check. A chave privada de administrador não é necessária para desenvolver somente a interface.

Na primeira execução, autorize `localhost` em Firebase Authentication → Configurações → Domínios autorizados. Abra o console do navegador (F12) e copie o valor de `App Check debug token` diretamente para Firebase App Check → Aplicativos → menu do aplicativo → Gerenciar tokens de depuração. Guarde esse token somente no seu ambiente; não publique nem envie para o repositório. Recarregue a página após registrar o token. Esse modo de depuração é ativado apenas em desenvolvimento e não faz parte do build de produção.

Para desenvolver o servidor e usar dados locais separados, o comando continua sendo `pnpm dev`. O servidor local com `STORE=file` não contém as carreiras salvas no Firestore de produção.

## Como jogar

- **Visão geral:** saldo, força do elenco, posição no campeonato e próximo compromisso.
- **Elenco:** clique em uma carta para virar e ver os atributos; alterne entre cartas e lista.
- **Transferências:** negocie valor e interesse antes do salário. A contratação atualiza caixa, elenco, salário e clube vendedor em uma operação.
- **Competições:** tabelas e chaves presentes na base ativa. A importação atual contém somente a Série A e calendário simulado. Acessos e descensos exigem as outras divisões cadastradas.
- **Estádio:** melhore gramado, entorno, estrutura completa do estádio, lojas e camarotes. As melhorias alteram a arena e a receita.
- **Centro de treinamento:** cinco setores, cada um com cinco níveis, afetam recuperação, lesões, interesse, evolução e patrocínio.
- **Finanças:** folha salarial, patrocínios, dívidas e histórico de movimentações do clube.

Para multiplayer local, crie uma liga com amigos e compartilhe o código de convite. A maioria dos participantes marcando pronto antecipa a rodada. O administrador também pode avançá-la. As partidas ocorrem entre 08h e 23h30 de Brasília; fora da janela, o avanço é reagendado para 08h. Todos os participantes da mesma liga recebem o mesmo resultado autoritativo.

Na área **Escalação**, edite os onze titulares e escolha uma das dez formações. O servidor respeita a escalação salva e troca indisponíveis; sem escalação salva, faz a seleção automática. Posição e entrosamento influenciam o desempenho, e a sequência de partidas aumenta o risco de lesão. Jovens evoluem conforme as partidas disputadas; envelhecimento, lesões, salários e condições físicas são processados no servidor.

## Verificação

```sh
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:emulators
```

`pnpm check` verifica formatação, ESLint, tipos de aplicações e testes, cobertura e builds. A cobertura mínima exigida é 98% de linhas e instruções, 100% de funções e 90% de ramificações do domínio e schemas executáveis. O relatório fica em `coverage/index.html`.

Vitest e fast-check cobrem objetos de valor, round-robin, heap, mata-mata, calendário, simulação determinística, temporada inteira, finanças, transferências, dados e persistência local. Playwright cobre desktop, celular, carta flip, melhorias, rodada e dois treinadores conectados. Os emuladores testam autenticação, Security Rules, snapshots, eventos e vínculos transacionais no Firestore.

Para regenerar os cinco níveis glTF/Meshopt e os decodificadores KTX2:

```sh
pnpm assets
```

## Firebase local e produção

A aplicação local usa um repositório em disco por padrão. `STORE=memory` é destinado a testes. `STORE=firestore` ativa o repositório Firebase. Copie os arquivos `.env.example` para `.env` no servidor e `.env.local` no client para configurar suas próprias integrações; os valores demonstrativos não conectam uma conta real.

```sh
pnpm build
pnpm emulators
```

O projeto `demo-football-manager` é local. Portas: Emulator UI 4000, Hosting 5000, Functions 5001, Firestore 8080 e Authentication 9099. A função agendada precisa de `GAME_SERVER_URL` e do secret `SCHEDULER_SECRET` para chamar o servidor.

Nesta máquina existe um Java portátil em `.local/java21`. Se ainda não houver Java no PATH do PowerShell:

```powershell
$taskJava = Get-ChildItem -Path '.local/java21' -Filter java.exe -Recurse | Select-Object -First 1
$env:PATH = $taskJava.Directory.FullName + [IO.Path]::PathSeparator + $env:PATH
```

Em produção, o servidor exige projeto Firebase próprio, origem HTTPS, Firestore e App Check. Login Google, leitura em tempo real com onSnapshot e regras de acesso estão implementados e precisam da configuração da sua conta. Clientes nunca escrevem diretamente em finanças ou estado da liga.

## Arquitetura

| Caminho           | Responsabilidade                                                  |
| ----------------- | ----------------------------------------------------------------- |
| `packages/domain` | Domínio puro, competições, simulação, finanças, mercado e eventos |
| `packages/shared` | Contratos Zod, snapshots e configurações JSON                     |
| `apps/server`     | Salas Colyseus, autenticação, comandos, agendador e repositórios  |
| `apps/functions`  | Rotina Cloud Scheduler protegida por secret                       |
| `apps/client`     | React, Zustand, TanStack Query, Framer Motion e React Three Fiber |
| `tests/e2e`       | Fluxos completos no Chromium                                      |
| `tests/emulators` | Firestore, autenticação e persistência                            |

O domínio não importa Firebase, React ou Three.js. Dinheiro usa centavos inteiros seguros, erros de negócio usam Result e a simulação usa PRNG com seed. As ligas são isoladas; revisões, filas e transações protegem operações concorrentes. O agendador revalida vencimento dentro da fila para impedir processamento duplicado.

## Dados e publicação

A base padrão, os retratos e os escudos são fictícios. Regulamentos e calendário são versões demonstrativas configuráveis, não uma reprodução integral do calendário oficial. O importador aceita um feed normalizado licenciado. APIs esportivas reais, clima, mapas e câmbio ainda não estão sincronizados.

Consulte [dados, modelos e limites](docs/data.md) e [publicação no Firebase e Render](docs/deploy.md). O Render gratuito pode suspender o servidor ocioso. Cloud Functions agendadas exigem o plano Blaze; custo zero não pode ser garantido. Os arquivos `render.yaml`, `Dockerfile` e o workflow manual de preview estão preparados.

Os modelos atuais usam materiais sólidos e Meshopt; o carregamento de texturas KTX2 está preparado, mas não há texturas KTX2 na base atual. Não há simulação autoritativa dentro de um navegador desconectado do servidor.

A área **Escalação** tem dez formações, trocas de titulares, penalidade por posição e entrosamento por partidas no clube. O acesso às carreiras exige Google; o catálogo de clubes usa escudos em pixel art e filtros por divisão.
