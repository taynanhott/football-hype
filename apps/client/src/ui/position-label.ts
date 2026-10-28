const labels: Record<string, string> = {
  GK: 'GOL',
  CB: 'ZAG',
  LB: 'LE',
  RB: 'LD',
  DM: 'VOL',
  CM: 'MC',
  AM: 'MEI',
  LW: 'PE',
  RW: 'PD',
  ST: 'CA',
  LM: 'ME',
  RM: 'MD',
};
export function positionLabel(position: string | undefined): string {
  return position ? (labels[position] ?? position) : '—';
}
