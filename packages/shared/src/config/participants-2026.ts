/** Participants verified against CBF REC Série C 2026, Annex A. */
export const SERIE_C_2026 = Object.freeze([
  'Anápolis',
  'Amazonas',
  'Barra',
  'Botafogo-PB',
  'Brusque',
  'Caxias',
  'Confiança',
  'Ferroviária',
  'Figueirense',
  'Floresta',
  'Guarani',
  'Inter de Limeira',
  'Itabaiana',
  'Ituano',
  'Maranhão',
  'Maringá',
  'Paysandu',
  'Santa Cruz',
  'Volta Redonda',
  'Ypiranga',
]);
export const competitionClubKey = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
export function isSerieC2026(name: string) {
  return SERIE_C_2026.some((club) => competitionClubKey(club) === competitionClubKey(name));
}

/** Official entry lists; missing clubs must not be replaced with unrelated clubs. */
export const CUP_PARTICIPANTS_2026: Readonly<Record<string, readonly string[]>> = {
  'copa-nordeste': [
    'ABC',
    'América-RN',
    'ASA',
    'Botafogo-PB',
    'Ceará',
    'Confiança',
    'CRB',
    'Ferroviário',
    'Fluminense-PI',
    'Fortaleza',
    'Imperatriz',
    'Itabaiana',
    'Jacuipense',
    'Juazeirense',
    'Maranhão',
    'Piauí',
    'Retrô',
    'Sousa',
    'Sport',
    'Vitória',
  ],
  'copa-sul-sudeste': [
    'América-MG',
    'Operário-PR',
    'Volta Redonda',
    'Internacional',
    'Avaí',
    'São Bernardo',
    'Tombense',
    'Cianorte',
    'Sampaio Corrêa-RJ',
    'Juventude',
    'Chapecoense',
    'Novorizontino',
  ],
  'copa-verde': [
    'Remo',
    'Paysandu',
    'Águia de Marabá',
    'Amazonas',
    'Nacional-AM',
    'Porto Velho',
    'Guaporé',
    'Independência-AC',
    'Galvez',
    'GAS',
    'Monte Roraima',
    'Trem',
    'Vila Nova',
    'Anápolis',
    'Atlético-GO',
    'Primavera',
    'Cuiabá',
    'Gama',
    'Capital',
    'Araguaína',
    'Tocantinópolis',
    'Rio Branco-ES',
    'Porto Vitória',
    'Operário-MS',
  ],
  'estadual-mg': [
    'Atlético-MG',
    'América-MG',
    'Cruzeiro',
    'Uberlândia',
    'Tombense',
    'Athletic',
    'Democrata-GV',
    'Betim',
    'Itabirito',
    'URT',
    'Pouso Alegre',
    'North',
  ],
  'estadual-rj': [
    'Fluminense',
    'Flamengo',
    'Vasco',
    'Botafogo',
    'Volta Redonda',
    'Madureira',
    'Sampaio Corrêa-RJ',
    'Maricá',
    'Portuguesa-RJ',
    'Boavista',
    'Bangu',
    'Nova Iguaçu',
  ],
};

export function knockoutLegs(competitionId: string, round: number, finalRound: number): 1 | 2 {
  if (
    ['copa-brasil', 'libertadores', 'copa-nordeste', 'copa-verde', 'copa-sul-sudeste'].includes(
      competitionId,
    )
  )
    return 1;
  if (competitionId === 'pre-libertadores') return 2;
  if (competitionId === 'intercontinental') return 1;
  if (['libertadores', 'sul-americana', 'europa'].includes(competitionId))
    return round === finalRound ? 1 : 2;
  return 2;
}
