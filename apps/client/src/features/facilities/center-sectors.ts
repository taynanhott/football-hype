export const SECTORS: Record<
  string,
  { icon: string; avatar: string; person: string; tip: string }
> = {
  fitness: {
    icon: 'training',
    avatar: '🏃🏽',
    person: 'Preparador físico',
    tip: 'Um elenco descansado rende mais. A partir do nível 3, reserve um atendimento Plus para quem precisa recuperar o fôlego.',
  },
  medical: {
    icon: 'recovery',
    avatar: '👩🏽‍⚕️',
    person: 'Médica do clube',
    tip: 'Cada nível ajuda a prevenir lesões e reduzir sua gravidade. O tratamento Plus acelera a recuperação de quem está no departamento médico.',
  },
  scouting: {
    icon: 'search',
    avatar: '🕵🏽',
    person: 'Observador',
    tip: 'Nossa rede trabalha automaticamente para tornar o clube mais atraente aos jogadores.',
  },
  coaching: {
    icon: 'tactics',
    avatar: '🧑🏽‍🏫',
    person: 'Coordenador técnico',
    tip: 'Ajuste a carga do elenco e invista em ciclos individuais de 60 dias. Cada ciclo concluído garante +1 de overall, até o limite de 99.',
  },
  marketing: {
    icon: 'megaphone',
    avatar: '👩🏽‍💼',
    person: 'Diretora de marketing',
    tip: 'Sua marca cresce com a estrutura. Os benefícios de cada nível são cumulativos e entram em ação automaticamente.',
  },
};
export const MARKETING_BENEFITS = [
  'Patrocínio na camisa',
  'Patrocínio também no calção',
  'Sócio-torcedor e organizada própria',
  'Bônus de 20% na receita de produtos',
  'Torcida aceita ingressos 30% mais caros, em qualquer fase',
];
