export function cardPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? '';
  return `${Array.from(parts[0]!)[0]}.${parts.at(-1)}`;
}
