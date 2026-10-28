# Dados e regulamentos

## Base local atual

Novas ligas usam data/player-database.json, extraído do JSON do HTML fornecido pelo usuário. A base contém 14.012 jogadores ativos e 697 clubes. O servidor não utiliza mais a atualização automática da API-Football na criação; as chaves existentes não são consultadas para carregar elencos. Carreiras existentes permanecem intactas. A origem, o relatório e os comandos de reimportação estão documentados em data/README.md. As seções sobre provedores abaixo descrevem ferramentas de importação alternativas, sem ativação automática.

Sem uma importação configurada, a base padrão é fictícia e reproduzível pela seed: 76 clubes brasileiros, 28 clubes internacionais e 48 atletas de mercado, além dos elencos de 16 jogadores de cada clube. Retratos, nomes e escudos não usam fotografias ou marcas licenciadas.

As competições são versões de jogo configuráveis. Os arquivos `competitions.json` e `gameplay.json` não reproduzem integralmente os regulamentos oficiais da CBF e da Conmebol. A Série C usa pontos corridos, e as copas continentais usam mata-mata em duas partidas. Estaduais e regionais têm chaves demonstrativas; as regiões geográficas reais ainda não são particionadas na base padrão.

O calendário padrão distribui campeonatos aos domingos e copas no meio da semana, omite as janelas FIFA configuradas em 2026 e respeita 08h–23h30 de Brasília. Não é uma importação do calendário oficial. Atualize as janelas FIFA antes de temporadas futuras. Atletas com overall a partir de 80 são tratados como convocados se um calendário importado mantiver jogos em datas FIFA.

## Feed substituível

`DataProvider` é a porta de dados. `HttpDataProvider` carrega um feed JSON normalizado, validado por `worldDatasetSchema`. Configure `DATASET_URL` e opcionalmente `DATASET_TOKEN` apenas no servidor. O feed se aplica à criação de novas ligas; ligas existentes preservam seus snapshots e eventos.

O contrato exige `source`, `license`, `clubs`, `players`, `stadiums` e `centers`. As quatro coleções usam `ids` e `byId`, com UUIDs estáveis e referências consistentes. `fixtures` é opcional e substitui o calendário gerado; nesse modo o feed precisa conter todos os jogos previstos e seus horários. Não são aceitos jogos de um clube contra ele mesmo nem horários fora da janela permitida.

Um adaptador deve converter os identificadores e as respostas dos provedores ao contrato interno, incluindo país, posição, aparência fictícia, valores monetários em centavos, salários e níveis de estruturas. O comando `pnpm data:import` converte os clubes e elencos da Série A brasileira do football-data.org em um arquivo normalizado. As demais APIs continuam exigindo adaptadores específicos.

Fontes previstas para esse mapeamento:

- [football-data.org](https://www.football-data.org/documentation/api): equipes e elencos, com token de acesso.
- [API-Football](https://api-sports.io/documentation/football/v3): jogadores, clubes e calendários, com chave de API.
- [TheSportsDB](https://www.thesportsdb.com/docs/api): catálogo esportivo, sujeito às cotas e licenças do provedor.
- [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access): metadados e identificadores.
- [Open-Meteo](https://open-meteo.com/en/docs), [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) e [Frankfurter](https://frankfurter.dev/): clima, entorno e câmbio.

`ExternalSources` implementa consultas tipadas aos sete provedores, com timeout, validação Zod e erros controlados. Os conectores são ferramentas de ingestão e não alteram a simulação automaticamente. Para consultá-los explicitamente:

```sh
pnpm data:fetch football-data 90
pnpm data:fetch api-football 33
pnpm data:fetch sportsdb 133604
pnpm data:fetch wikidata Q42
pnpm data:fetch weather -23.55 -46.63
pnpm data:fetch surroundings -23.55 -46.63
pnpm data:fetch fx EUR BRL
```

Configure `FOOTBALL_DATA_TOKEN`, `API_FOOTBALL_KEY` e, quando necessário, `SPORTSDB_KEY` no `.env` do servidor. As consultas devolvem DTOs dos provedores; transformar esses dados em atributos de jogo calibrados e em um feed licenciado continua sendo uma etapa explícita de ingestão. Clima, mapas e câmbio não estão ligados à interface ou às fórmulas de partida nesta versão.

Não há consumo oculto de APIs comerciais. Não carregue fotografias, escudos e nomes licenciados sem verificar os direitos de uso.

## Limites de execução

A carreira solo exige login Google inicial. A partida local pode continuar sem internet enquanto a sessão e a conexão ao servidor local permanecerem válidas. Ela continua autoritativa no servidor; não há simulação no navegador nem funcionamento apenas com o arquivo HTML. O estado local fica em `apps/server/.local/leagues` quando iniciado com `pnpm dev`. Copie essa pasta para fazer backup das carreiras locais.

A área Escalação permite editar onze titulares e escolher dez formações. O servidor respeita a escalação salva e troca automaticamente atletas indisponíveis. Sem escalação salva, escolhe por adequação à posição, força e condição física. Horários adiantados obedecem à janela real de Brasília, e a data virtual da próxima partida avança simultaneamente para os participantes da liga.

## Modelos 3D

Há cinco modelos glTF comprimidos por Meshopt, gerados por `pnpm assets`, um para cada nível de arquibancada. O renderizador usa ECS por setores, arquibancadas compostas, torcida com InstancedMesh e partículas com pool de objetos. A estrutura é evoluída em conjunto: campo de bairro, estádio municipal, caldeirão urbano, arena contemporânea e estádio monumental. Os níveis 4 e 5 usam anéis elípticos instanciados e fachadas próprias. O gramado tem textura procedural: terra exposta, recuperação, tons naturais, verde uniforme e faixas profissionais. Entorno e prédios do CT também mudam conforme os níveis. Retratos dos atletas são SVG em pixel art. A prévia de níveis não altera o estado da carreira.

O carregador KTX2 e seus decodificadores estão configurados. Os modelos atuais usam materiais de cores sólidas, sem texturas KTX2. Imagens comprimidas poderão ser acrescentadas sem alterar o carregador. Os arquivos de decodificação mantêm o código original de terceiros.

## Importação da Série A real

Configure FOOTBALL_DATA_TOKEN em apps/server/.env e execute pnpm data:import. O comando consulta competitions/BSA/teams, confirma o clube atual de jogadores duplicados pelo recurso persons e grava apps/server/.local/datasets/football-data-BSA.json. O relatório adjacente informa registros incompletos excluídos. Não são criados atletas substitutos fictícios. A resposta precisa conter 20 clubes com pelo menos 11 atletas válidos e um goleiro em cada elenco.

Ative DATASET_FILE=.local/datasets/football-data-BSA.json no servidor. O catálogo da tela inicial vem do servidor e passa a mostrar somente clubes da base importada. Novas carreiras usam o clube escolhido e todos os atletas válidos recebidos. A importação é um snapshot: repetir o comando atualiza a base de futuras carreiras, sem sobrescrever temporadas em andamento.

Os nomes, vínculos, idades e posições vêm do provedor. Overalls, potenciais, salários, valores, números de camisa, aparência, finanças e níveis das instalações são parâmetros de simulação; não são atributos oficiais dos atletas ou clubes. Escudos e fotos não são importados. O calendário é simulado. A importação inicial contém somente a Série A, sem misturar clubes fictícios de outras divisões. Não há rebaixamento para uma divisão ausente, nem copas artificiais nessa base.

Para preservar carreiras demonstrativas separadas, use DATA_DIR=.local/real-leagues; o diretório antigo .local/leagues permanece intacto. Para voltar, restaure DATA_DIR=.local/leagues e remova DATASET_FILE. Não coloque tokens no front-end nem no Git. O aplicativo exibe a atribuição exigida pelo provedor na origem da base.

Referências: https://docs.football-data.org/general/v4/team.html e https://docs.football-data.org/general/v4/person.html.

## Escalação e preparação

As dez formações usam onze posições, incluindo goleiro. O editor mantém os titulares ao reorganizar uma formação e permite trocar atletas entre posições e banco. Escalações enviadas ao servidor precisam conter onze jogadores distintos e disponíveis do próprio clube.

A posição correta mantém 100% do fator posicional; funções próximas usam 85%, funções distantes 65% e trocas entre goleiro e linha 35%. Esses fatores afetam o overall de partida sem modificar o cadastro original. O entrosamento é registrado por clube e jogador: 20% por aparição, atingindo 100% após cinco partidas, sem influência de nacionalidade ou liga. Ele multiplica a força entre 90% e 100%. As configurações ficam em packages/shared/src/config/tactics.json.

O risco de lesão aumenta com fadiga, jogos consecutivos e intervalo inferior a 72 horas. Rodar o elenco zera a sequência do atleta que descansa; o departamento médico reduz o risco e a gravidade. A duração das lesões corresponde a partidas perdidas pelo clube: a lesão não desaparece antes de impedir a primeira escalação seguinte.

O CT possui modelos diferentes por departamento: academia, equipamentos e piscinas; ambulatório, hospital e heliponto; observação e antenas; campos de treinamento e pavilhões cobertos; escritórios e praça de patrocínios. O entorno evolui para praça, iluminação, estacionamento, estátua, conveniências, boulevard e parque do torcedor. Prévias não alteram níveis nem caixa.

## Login e escolha de clube

A criação e a continuação de ligas exigem conta Google. O catálogo inicial mostra escudos em uma grade e filtra por divisão, com ícones em pixel art. Os escudos do provedor são desenhados em canvas de 32 pixels e ampliados sem suavização. Não há formulário de texto na seleção inicial; nomes das ligas são gerados a partir do clube. Convites têm uma janela própria. As divisões sem dados importados são indicadas explicitamente.

O servidor valida assinatura, projeto, validade e provedor Google dos tokens; em produção também verifica revogação e exige as credenciais administrativas configuradas. Visitantes são aceitos somente pelo servidor em NODE_ENV=test. O bypass visual de E2E exige simultaneamente o modo Vite test e VITE_TEST_AUTH=true; ele não habilita visitantes nos servidores de desenvolvimento ou produção.

## Ligas online, partidas e identidade

O convite completo contém o identificador da liga e um código independente. Um treinador autenticado consulta os clubes disponíveis pelo convite, solicita entrada e aguarda aprovação. O administrador pode restringir a divisão e sortear o clube ao aprovar. Reconexões de participantes aprovados dispensam o código. Sair para o menu mantém o vínculo; abandonar a liga ou sair da conta libera a vaga e deixa o clube sob controle automático. O administrador que sai transfere a administração ao próximo participante. Sem participantes, a liga continua simulada por bots, mas novas aprovações exigem um administrador presente.

A presença é renovada pela conexão a cada 30 segundos e persistida em intervalos de um minuto. Após 48 horas sem presença, o agendador libera a vaga; uma tentativa de acesso também verifica esse prazo. O agendador do servidor deve permanecer ativo. A exclusão é lógica: remove os vínculos e bloqueia acesso e agendamento, preservando os registros persistidos.

Cada rodada gera uma sequência determinística comum a todos. A central reproduz 90 minutos em 90 segundos, no estádio do mandante, com jogadores 3D estilizados e lances de passes, retomadas, chutes, escanteios, faltas, gols e cartões. A torcida usa áudio sintetizado, habilitado por um botão devido às permissões de áudio do navegador. Uma vitória do mandante dispara partículas de fogos. O relógio da apresentação usa o horário enviado pelo servidor. Os resultados são calculados e persistidos pelo servidor antes da reprodução; a apresentação não é um motor físico de futebol.

As estatísticas são derivadas dos lances. Notas individuais são mantidas no histórico mesmo na troca de temporada. Os títulos são registrados uma vez por competição e temporada, com modelos visuais distintos para campeonatos nacionais, copas e continentais. Todos os participantes podem consultar a galeria dos clubes da mesma liga.

As cores de estádio, paredes do CT e uniforme são personalizáveis. Os padrões de camisa incluem liso, listras verticais, horizontais e faixa diagonal.

O adaptador de clubes reais usa **perfis econômicos estimados para o jogo**, não balanços auditados ou informações atuais de capacidade e patrimônio. Esses perfis determinam caixa, capacidade, estádio e CT iniciais. Um feed normalizado pode fornecer valores e níveis próprios. Alterações na importação só afetam novas ligas criadas com o novo dataset; não reescrevem carreiras existentes. O repositório Firestore divide payloads comprimidos maiores em documentos menores para acomodar os históricos.

A simulação espacial registra as posições dos atletas e os destinos da bola. A reprodução usa essas coordenadas diretamente. Goleiros permanecem na própria área e distribuem a bola; atletas de linha oferecem apoio, avançam, pressionam e recompõem. A escolha de passes considera distância, avanço e espaço no destino; chutes exigem chegada ao terço final e distância máxima de 26 metros. A partida mantém 90 segundos, com 180 decisões e conduções entre passes para evitar períodos de jogadores parados. As novas trajetórias se aplicam às próximas partidas; resultados antigos preservam a sequência que foi salva.

As trajetórias distinguem gols, defesas, bloqueios e chutes para fora. A separação entre atletas também é corrigida nos quadros interpolados. Passes são dirigidos a companheiros; interceptações registram o defensor que corta a trajetória e uma mudança explícita de posse. Faltas próximas à área têm preparação de barreira (faltas dentro da área viram pênalti). Escanteios têm posicionamento dos atletas, cruzamento aéreo e disputa na área. Goleiros executam saltos laterais e recuperam a posição após defender. O relatório permite rever cada bola parada ou defesa.

A câmera de acompanhamento aproxima chutes e bolas paradas; o botão de visão geral permite voltar à vista do estádio. O placar e o som de gol aguardam a bola concluir a trajetória até a rede.

## API-Football: uma consulta por criação e reserva local

A chave fica somente em API_FOOTBALL_KEY no .env do servidor. Com DATASET_FILE configurado, o servidor usa ApiFootballDataProvider por cima da base local existente. O catálogo, a abertura de carreiras, a busca e o avanço de rodadas não consultam a API-Football. Uma criação nova pode fazer no máximo uma chamada; repetir a criação de uma carreira existente não faz outra. Não há paginação automática nem repetição em caso de erro.

Execute pnpm data:bootstrap para inicializar a reserva. Essa operação faz no máximo uma chamada inicial; o registro persistente impede que executar novamente gaste mais consultas. A reserva é gravada em apps/server/.local/datasets/api-football/default.json. quota.json registra tentativas e cota diária, e latest-response.json guarda a última resposta para diagnóstico. Não apague esses arquivos para preservar o controle após reiniciar o servidor. A reserva é validada e as gravações são atômicas; chamadas concorrentes compartilham um bloqueio de arquivo. A cota local é de no máximo 100 por dia UTC, conciliada com o restante informado pelo provedor.

Limite, HTTP 429, indisponibilidade, resposta inválida ou restrição de temporada acionam a base local sem impedir a criação. Um bloqueio por cota ou plano evita novas tentativas naquele dia. Consultas já reservadas não são repetidas para a mesma criação, inclusive após reiniciar. Testes usam respostas simuladas e não consomem a chave real.

A consulta padrão é /players?league=71&season=2026&page=1 (Série A). API_FOOTBALL_LEAGUE e API_FOOTBALL_SEASON alteram essa seleção. Uma chamada entrega apenas uma página, não todos os elencos de todas as competições. Apenas perfis identificados por nome e clube são atualizados; uma página parcial nunca remove jogadores ou substitui um elenco completo. Os dados originais de jogo são mantidos, incluindo as posições detalhadas, em vez de trocar laterais e meias por categorias genéricas.

Na inicialização de 27/10/2026, a única chamada autorizada retornou restrição do plano gratuito: esse recurso permitia temporadas de 2022 a 2024, recusando 2026. Nenhum dado antigo foi ativado. A reserva preservou os 20 clubes e 721 atletas da Série A anteriormente importados. Ela ainda não contém as Séries B, C, D ou clubes estrangeiros. O controle de cota não resolve essa lacuna de cobertura; para obter todos os elencos de 2026 será necessário acesso a esses dados e uma importação inicial com múltiplas páginas, ou uma base completa pronta. Carreiras existentes preservam seus dados.

Referências: https://www.api-football.com/pricing e https://www.api-football.com/documentation-v3.
