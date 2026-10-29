# Oracle + PostgreSQL

O servidor suporta `STORE=postgres`. A interface continua na Cloudflare. Firebase Authentication e App Check continuam ativos; carreiras, eventos e sorteios passam ao PostgreSQL. Nenhum dado existente é apagado ou importado.

## Preparar a máquina

Use uma VM ARM Always Free dentro dos limites exibidos na sua conta, Ubuntu com Docker Engine e Compose instalados. A gratuidade depende das cotas da Oracle e da disponibilidade regional; instâncias ociosas podem ser recolhidas. Configure DNS do subdomínio do jogo para o IP da VM. Libere TCP 80/443 no firewall da VM e na rede Oracle; não exponha 5432 ou 2567.

1. Clone o repositório na VM.
2. Em `deploy/oracle`, copie `.env.example` para `.env`. Defina senha PostgreSQL hexadecimal aleatória, domínio, projeto Firebase, origem da interface e `SCHEDULER_SECRET` aleatório de pelo menos 32 caracteres. Preserve o segredo do agendador se ele continuar em uso.
3. Salve a conta de serviço Firebase em `deploy/oracle/firebase-service-account.json`. Ela continua necessária para validar autenticação e App Check; não precisa acessar Firestore nesta instalação. Não versione credenciais.
4. Execute `docker compose --env-file .env up -d --build` nessa pasta. Caddy provisiona HTTPS e encaminha WebSocket. O banco só fica acessível na rede interna.
5. Confira `https://SEU_DOMINIO/health` e os registros com `docker compose logs --tail=100 server`.
6. Na Cloudflare, atualize `VITE_GAME_SERVER_URL=wss://SEU_DOMINIO` e publique novamente a interface. Atualize `GAME_SERVER_URL=https://SEU_DOMINIO` no agendador, caso continue usando-o. O servidor também verifica rodadas a cada 30 segundos.
7. Para desenvolvimento conectado, atualize `DEV_GAME_SERVER_TARGET=https://SEU_DOMINIO` no arquivo local da interface.
8. Valide login, criação, escalação, rodada, reinício e continuidade da nova carreira antes de desligar o Render. Desative o agendador antigo se não for utilizado.

## Persistência e desempenho

Tabelas e índices são criados no primeiro início. Cada ação grava as ramificações alteradas do estado e o evento na mesma transação. São retidos os últimos 100 eventos; o estado atual é completo e não depende dos eventos antigos. Consultas de lista retornam apenas resumos e o agendamento usa índice de horário. Esta primeira implementação ainda lê o estado completo para operações que precisam da liga; não promete ganho percentual sem medição.

Uma trava transacional coordena alterações de vínculos e sorteios entre processos. O desenho de publicação é de uma instância do jogo; escalar salas Colyseus para várias instâncias exige configuração própria. O pool tem até oito conexões.

## Backup

Na pasta da publicação, execute `docker compose exec -T db pg_dump -U football -d football -Fc > football.dump` em shell Linux. Copie o backup para fora da VM e valide restauração periodicamente. O volume Docker preserva dados em reinícios, mas não substitui backup. Nunca execute `docker compose down -v` se quiser manter as carreiras.

## Testes PostgreSQL

Use exclusivamente um banco descartável. Na raiz do projeto, configure `POSTGRES_TEST_URL` e execute `pnpm exec vitest run apps/server/tests/postgres-repository.test.ts`. Os testes criam e removem suas ligas de teste. Não aponte para produção.
