import { extractPlayerAppearance } from './extract-player-appearance.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import ts from 'typescript';
const html = readFileSync(process.argv[2], 'utf8');
writeFileSync(
  'packages/shared/src/config/player-looks.json',
  JSON.stringify(extractPlayerAppearance(html)),
);
const json = html.match(/<script\b[^>]*\bid="data"[^>]*>([\s\S]*?)<\/script>/i);
if (!json) throw Error('JSON de jogadores não encontrado');
const data = JSON.parse(json[1]);
mkdirSync('data', { recursive: true });
writeFileSync('data/player-source.json', JSON.stringify(data));
const js = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((m) => !m[1].includes('application/json'))
  .map((m) => m[2])
  .join('\n');
// Parse static literals only. Never execute any script from the supplied HTML.
const tree = ts.createSourceFile('source.js', js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS),
  decl = new Map();
function walk(n) {
  if (
    ts.isVariableDeclaration(n) &&
    ts.isIdentifier(n.name) &&
    n.initializer &&
    !decl.has(n.name.text)
  )
    decl.set(n.name.text, n.initializer);
  ts.forEachChild(n, walk);
}
walk(tree);
const colors = {
  W: '#F4F4F4',
  B: '#141414',
  RED: '#D0102C',
  GRN: '#0B6B3A',
  BLU: '#1B3F9A',
  YEL: '#FFD200',
  SKY: '#6CB4EE',
  NAVY: '#0B1F4B',
  WINE: '#7A1230',
  ORG: '#FF7A00',
  GOLD: '#E0B000',
};
function literal(n, depth = 0) {
  if (!n || depth > 10) return null;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isNumericLiteral(n)) return Number(n.text);
  if (ts.isIdentifier(n)) return colors[n.text] ?? literal(decl.get(n.text), depth + 1);
  if (ts.isArrayLiteralExpression(n)) return n.elements.map((x) => literal(x, depth + 1));
  if (ts.isObjectLiteralExpression(n)) {
    const o = {};
    for (const p of n.properties)
      if (ts.isPropertyAssignment(p))
        o[p.name.text ?? p.name.getText(tree)] = literal(p.initializer, depth + 1);
    return o;
  }
  if (ts.isCallExpression(n) && n.expression.getText(tree) === 'K') {
    const a = n.arguments.map((x) => literal(x, depth + 1));
    return { abbreviation: a[0], pattern: a[1], colors: a[2], support: a[5], ...(a[6] ?? {}) };
  }
  return null;
}
const clubs = {};
for (const [name, n] of decl)
  if ((name.startsWith('CLUBS_') || name === 'INT_CLUBS') && ts.isObjectLiteralExpression(n))
    for (const [club, meta] of Object.entries(literal(n)))
      if (meta) clubs[club] = { ...meta, group: name };
const excluded = decl.get('EXCLUDE');
writeFileSync(
  'data/player-exclusions.json',
  JSON.stringify(
    excluded && ts.isNewExpression(excluded) ? (literal(excluded.arguments?.[0]) ?? []) : [],
  ),
);
writeFileSync('data/clubs-source.json', JSON.stringify(clubs, null, 2));
console.log(
  JSON.stringify({ groups: Object.keys(data), clubDefinitions: Object.keys(clubs).length }),
);
