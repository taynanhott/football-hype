import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
export function extractPlayerAppearance(html) {
  const start = html.indexOf('// aparência medida nas fotos do Transfermarkt');
  if (start < 0) throw Error('Tabela de aparência não encontrada');
  const block = html.slice(start);
  const compact = block.match(/for \(const it of '([0-9a-f,]+)'\.split\(','\)\)/);
  if (!compact) throw Error('Registros de aparência não encontrados');
  const players = {};
  for (const entry of compact[1].split(',')) {
    const tail = entry.slice(-3);
    const id = parseInt(entry.slice(0, -3), 16);
    const row = [+tail[0], +tail[1], 9, +tail[2]];
    if (!Number.isSafeInteger(id) || row[0] > 5 || row[1] > 6 || row[3] > 1)
      throw Error('Registro inválido');
    players[id] = row;
  }
  const overrides = block.match(/Object\.assign\(m,\s*(\{[\s\S]*?\})\s*\)/);
  if (overrides) {
    const ast = ts.createSourceFile(
      'overrides.js',
      `const data=${overrides[1]}`,
      ts.ScriptTarget.Latest,
      true,
    );
    const obj = ast.statements[0].declarationList.declarations[0].initializer;
    for (const prop of obj.properties) {
      players[prop.name.text] = prop.initializer.elements.map((value) =>
        ts.isNumericLiteral(value)
          ? Number(value.text)
          : ts.isStringLiteral(value)
            ? value.text
            : undefined,
      );
    }
  }
  const palette = (name) => {
    const match = html.match(new RegExp(`const ${name} = (\\[[^;]+\\]);`));
    if (!match) throw Error(`Paleta ${name} ausente`);
    return [...match[1].matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1]);
  };
  return { skin: palette('SKIN'), hair: palette('HAIR'), players };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2]) {
  const result = extractPlayerAppearance(readFileSync(process.argv[2], 'utf8'));
  writeFileSync('packages/shared/src/config/player-looks.json', JSON.stringify(result));
  console.log(`Aparência importada: ${Object.keys(result.players).length} jogadores`);
}
