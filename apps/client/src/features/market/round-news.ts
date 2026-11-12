import { scheduledFixtures } from '@football/domain';
import type { WorldState } from '@football/shared';

const JOKES = [
  'O auxiliar pediu um tablet novo. O antigo já decorou todos os passes para trás.',
  'O zagueiro chamou a bola de minha. A bola pediu uma segunda opinião.',
  'O massagista foi eleito craque do treino: foi o único que desatou um nó.',
  'O clube contratou um especialista em bola parada. Na entrevista, ele não saiu do lugar.',
  'O roupeiro pediu direito de imagem: apareceu mais na transmissão que o centroavante.',
  'A bola do treino sumiu. O lateral garante que o cruzamento ainda está descendo.',
  'A diretoria prometeu um reforço de peso. Chegou uma geladeira nova ao vestiário.',
  'O goleiro pediu silêncio no treino: estava tentando ouvir os conselhos da trave.',
  'O gandula recebeu proposta para renovar depois de liderar as assistências no aquecimento.',
  'O técnico escondeu a escalação até do próprio quadro tático. Nem os ímãs sabem quem joga.',
  'O atacante treinou finalizações escondido. A vizinhança pediu a devolução das bolas.',
  'A torcida pediu raça. O mascote interpretou literalmente e entrou com um cachorro.',
];
const NETO_JOKES = [
  'O atacante está esperando a bola perfeita. Meu filho, ela já vem redonda da fábrica!',
  'O treinador falou que faltou detalhe. O detalhe era botar a bola dentro do gol!',
  'Esse meio-campo troca tanto passe que daqui a pouco pede comprovante de transferência!',
  'Porra, o cara marcou a sombra! E ainda perdeu a sombra no segundo tempo!',
  'Porra, Corinthians! Eu pedi uma jogada ensaiada, não um ensaio de como perder a bola na lateral!',
  'Caralho, o atacante recebeu livre e resolveu dar mais um toque. Era para finalizar, não para parcelar a jogada!',
  'Puta que pariu, esse escanteio não passou do primeiro homem! Se a ideia era acertar o marcador, foi uma cobrança perfeita.',
  'Que merda de recuo foi esse? O goleiro pediu a bola no pé, não um teste de sobrevivência!',
  'Neymar, o controle de videogame já está aquecido. Agora falta aquecer a chuteira! A torcida quer o drible no campo, não no menu.',
  'Se cada rumor de volta do Neymar valesse um gol, o placar precisava de mais dois dígitos. Deixa a bola falar agora!',
  'Corinthians, meu coração não tem banco de reservas! Resolve esse jogo antes que eu precise pedir substituição no sofá.',
  'No Corinthians até o café do intervalo vem com emoção. Eu pedi três pontos, não três sustos e um pão de queijo!',
];

const PILHADO_JOKES = [
  'A mesa pediu uma análise fria. O replay esquentou a discussão de novo.',
  'O time está construindo desde o primeiro minuto. Falta avisar quando fica pronto.',
  'O treinador disse que o grupo está fechado. Pela dificuldade de entrar na área, eu acredito.',
  'Porra, esse contra-ataque tinha endereço! O último passe conseguiu errar até o bairro!',
  'Eu vim debater futebol com calma. A calma viu a primeira substituição e foi embora do estúdio.',
  'O time prometeu intensidade. Quem terminou suando fui eu explicando a escalação.',
  'Tem treinador que guarda substituição como se desse para levar para o próximo campeonato.',
  'O debate estava equilibrado até alguém perguntar quem marcava o lateral. Agora ninguém lembra a pergunta e todo mundo está gritando.',
  'Porra, isso era um contra-ataque! Quando o time decidiu acelerar, a defesa adversária já tinha até tomado água.',
  'Caralho, três jogadores olhando a bola passar! É defesa de futebol ou visita guiada ao gramado?',
  'Puta que pariu, mais um passe para trás! A torcida pagou ingresso para ver o ataque, não o goleiro organizar excursão.',
  'Que merda de saída de bola! O adversário nem precisou pressionar: recebeu em domicílio e sem taxa de entrega.',
];

const CAZE_JOKES = [
  'O Vasco ganhou um escanteio e eu já sentei diferente. A esperança tem ajuste de postura.',
  'Pedi para acompanhar o Vasco de forma racional. Meu coração recusou os termos de uso.',
  'O Vasco tem treino de recuperação amanhã. Eu precisava de um hoje, depois do apito.',
  'Meteu essa? Disseram que o Vasco estava administrando. Aqui em casa ninguém autorizou esse sofrimento.',
  'O Vasco ainda vai me fazer comemorar lateral no campo de ataque como se fosse título. É uma construção emocional por etapas.',
  'O cara falou que acompanha o Vasco sem passar nervoso. Meteu essa? Eu fico tenso até na divulgação dos relacionados.',
  'Fui assistir ao Vasco tranquilo. Durou até a primeira bola recuada para o goleiro.',
  'Que papinho, hein? Me falaram que era só um jogo do Vasco. Então explica por que eu terminei fazendo promessa para o próximo domingo.',
  'A vantagem de torcer para o Vasco é que o relógio da academia passa rápido. Dez minutos de jogo já equivalem a quarenta de cardio.',
  'O forte! Muito forte esse meu otimismo com o Vasco. Sobrevive até à bola recuada aos quarenta e nove.',
  'O Vasco pode até controlar a posse. Quem não controla nada sou eu andando pela sala.',
  'Falaram para eu trocar de time para ter paz. Esquisito… Eu pedi uma vitória do Vasco, não uma nova identidade.',
  'Prometi analisar o Vasco com calma. A calma pediu substituição antes do intervalo.',
  'Na minha simulação mental, o Vasco deu um amasso. Agora falta combinar com a realidade e com o lateral adversário.',
  'No jogo do Vasco, meu sofá tem mapa de calor. Eu já ocupei todas as posições.',
  'O Vasco tá muito grandudo na minha expectativa. Já a tranquilidade para assistir continua pequenininha.',
  'O Vasco sai jogando e eu saio da cadeira. Sincronia perfeita.',
  'Ih! O Vasco vai sair tocando dentro da área. Vou levantar aqui, porque sofrer sentado já não está dando vazão.',
  'Hoje eu só queria um jogo tranquilo do Vasco. Meu pedido continua em análise no departamento de milagres.',
  'A bola parada do Vasco tem dois especialistas: quem cobra e eu, que fico parado sem respirar.',
  'Se acreditar no Vasco desse ponto no campeonato, a gente já estava escolhendo a faixa.',
  'Meu planejamento para o Vasco era simples: fazer o gol e respirar. A segunda parte exige negociação.',
  'O Vasco entra em campo com onze. Aqui em casa entram mais três: esperança, ansiedade e o vizinho reclamando do grito.',
];
const FORMIGA_JOKES = [
  'O Flamengo não demorou a finalizar. Estendeu a fase de elaboração da hipótese ofensiva.',
  'A bola saiu pela lateral, mas a intenção permaneceu em campo. Precisamos separar os indicadores.',
  'O Flamengo ocupou todos os espaços. Infelizmente, alguns eram os mesmos.',
  'A arbitragem não interrompeu o ritmo. Sugeriu uma pausa para contemplar a dinâmica do jogo.',
  'O Flamengo não perdeu a bola. Transferiu temporariamente a responsabilidade da construção para o adversário. É diferente.',
  'Antes de reclamar do passe para trás do Flamengo, precisamos entender a progressão territorial em sentido filosófico.',
  'A finalização do Flamengo foi para fora, mas o conceito entrou. Falta o placar incorporar essa métrica.',
  'O Flamengo não estava desorganizado: testava um sistema que ainda não foi descoberto pelos próprios jogadores.',
  'O árbitro não demorou para decidir. Abriu uma janela de reflexão coletiva sobre as regras.',
  'O VAR levou oito minutos? Prefiro chamar de análise aprofundada com intervalo para maturação da imagem.',
  'O juiz não inverteu o lateral. Propôs uma redistribuição democrática da posse.',
  'O acréscimo pareceu exagerado, mas o relógio também precisa ter liberdade interpretativa.',
  'O Flamengo recuou demais? Era um convite à pressão. O problema foi o adversário aceitar com tanta educação.',
  'O cartão saiu tarde porque o árbitro estava respeitando o tempo de processamento emocional do atleta.',
  'Não foi um cruzamento errado do Flamengo. Foi uma inversão tão ambiciosa que saiu do campo de análise.',
  'O apito interrompeu uma boa jogada, mas precisamos valorizar a participação do árbitro na circulação da bola.',
];

function mix(value: number) {
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    seed = mix(seed + i);
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function roundNews(state: WorldState) {
  const fixtures = new Map(scheduledFixtures(state).map((f) => [f.id, f]));
  const rounds = new Map<number, (typeof state.results)[number][]>();
  for (const result of state.results) {
    const fixture = fixtures.get(result.fixtureId);
    if (!fixture) continue;
    const group = rounds.get(fixture.scheduledAt) ?? [];
    if (!group.some((r) => r.fixtureId === result.fixtureId)) group.push(result);
    rounds.set(fixture.scheduledAt, group);
  }
  const columns = [
    { reporterName: 'Cazé', pool: CAZE_JOKES, tags: ['#Vasco', '#Caze'] },
    {
      reporterName: 'Bruno Formiga',
      pool: FORMIGA_JOKES,
      tags: ['#NaPrancheta', '#BrunoFormiga'],
    },
    { reporterName: 'Craque Neto', pool: NETO_JOKES, tags: ['#CraqueNeto'] },
    { reporterName: 'Pilhado', pool: PILHADO_JOKES, tags: ['#Pilhado', '#ResenhaDeBancada'] },
    { reporterName: undefined, pool: JOKES, tags: ['#Bastidores'] },
  ];

  const appearances = new Map<string | undefined, number>();
  const selections = new Map<number, { column: (typeof columns)[number]; body: string }[]>();
  for (const day of [...rounds.keys()].sort((a, b) => a - b)) {
    const seed = mix(Math.floor(day / 86400000));
    const dailyColumns = shuffled(columns, seed);
    selections.set(
      day,
      Array.from({ length: 2 + (seed % 3) }, (_, index) => {
        const column = dailyColumns[index]!;
        const occurrence = appearances.get(column.reporterName) ?? 0;
        appearances.set(column.reporterName, occurrence + 1);
        let pool = column.pool;
        let turn = occurrence;
        if (column.reporterName === 'Cazé') {
          const catchphrase = /Meteu essa|Que papinho|O forte!|Esquisito|amasso|grandudo|Ih!/;
          const useCatchphrase = occurrence % 3 === 2;
          pool = column.pool.filter((text) => catchphrase.test(text) === useCatchphrase);
          turn = useCatchphrase
            ? Math.floor(occurrence / 3)
            : occurrence - Math.floor(occurrence / 3);
        }
        if (column.reporterName === 'Craque Neto' || column.reporterName === 'Pilhado') {
          const profanity = /porra|caralho|puta que pariu|merda/i;
          const useProfanity = occurrence % 3 === 2;
          pool = column.pool.filter((text) => profanity.test(text) === useProfanity);
          turn = useProfanity
            ? Math.floor(occurrence / 3)
            : occurrence - Math.floor(occurrence / 3);
        }
        // Exhaust a shuffled category before repeating; reconnects preserve the feed.
        const randomPool = shuffled(
          pool,
          mix((columns.indexOf(column) + 1) * 7919 + column.pool.indexOf(pool[0]!)),
        );
        return { column, body: randomPool[turn % randomPool.length]! };
      }),
    );
  }
  return [...rounds]
    .sort(([a], [b]) => b - a)
    .slice(0, 8)
    .flatMap(([day, results]) => {
      // Use the fixture date: processing several rounds together must not reorder the feed.
      const at = day;
      const highlights = [...results]
        .sort(
          (a, b) =>
            Math.abs(b.homeGoals - b.awayGoals) - Math.abs(a.homeGoals - a.awayGoals) ||
            b.homeGoals + b.awayGoals - (a.homeGoals + a.awayGoals) ||
            a.fixtureId.localeCompare(b.fixtureId),
        )
        .slice(0, 3)
        .map((result, index) => {
          const fixture = fixtures.get(result.fixtureId)!;
          const home = state.clubs.byId[fixture.homeId]?.name ?? 'Mandante';
          const away = state.clubs.byId[fixture.awayId]?.name ?? 'Visitante';
          const score = `${home} ${result.homeGoals} × ${result.awayGoals} ${away}`;
          const margin = Math.abs(result.homeGoals - result.awayGoals);
          const shock = ['Que atropelo!', 'É de cair o queixo!', 'Virou um passeio!'];
          return {
            id: `score:${result.fixtureId}`,
            stadiumId: state.clubs.byId[fixture.homeId]?.stadiumId,
            homeId: fixture.homeId,
            awayId: fixture.awayId,
            reporterName: undefined as string | undefined,
            at: at - index,
            title: margin >= 3 ? `${shock[index]} ${score}` : `Destaque da rodada: ${score}`,
            body:
              margin >= 3
                ? 'A torcida mal teve tempo de comemorar um gol e já vinha outro! Uma goleada para ficar na memória da rodada.'
                : 'Um dos três maiores placares da rodada, em destaque no giro dos resultados.',
            tags: ['#GiroDaRodada', ...(margin >= 3 ? ['#Goleada'] : [])],
          };
        });
      const jokes = selections.get(day)!.map(({ column, body }, index) => {
        return {
          id: `resenha:${day}:${index}`,
          at: at + 0.5 + index,
          title: 'Resenha do Vestiário',
          body,
          reporterName: column.reporterName,
          tags: ['#ResenhaDaRodada', ...column.tags],
        };
      });
      return [...highlights, ...jokes];
    })
    .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}
