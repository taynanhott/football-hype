export type CoachProfile = {
  name: string;
  skin: string;
  hair: string;
  beard: string;
  outfit: string;
  hairColor: string;
  beardColor: string;
  eyeColor: string;
  secondary: string;
  outfitStyle: string;
  glasses: string;
  glassesColor: string;
};
export const defaultCoach = {
  name: '',
  hairColor: '#3c3129',
  beardColor: '#3c3129',
  eyeColor: '#234c40',
  secondary: '#339c6b',
  outfitStyle: 'agasalho',
  glasses: 'nenhum',
  glassesColor: '#222b30',
  skin: '#c58d65',
  hair: 'curto',
  beard: 'nenhuma',
  outfit: '#193e32',
};
export function readCoach(key: string): CoachProfile {
  try {
    return { ...defaultCoach, ...JSON.parse(localStorage.getItem(key) || '{}') };
  } catch {
    return { ...defaultCoach };
  }
}
