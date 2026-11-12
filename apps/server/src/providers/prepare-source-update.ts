import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { z } from 'zod';
import { convertLocalPlayers } from './local-player-import.js';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const appearance = z.strictObject({
  skin: z.array(color).length(6),
  hair: z.array(color).length(7),
  players: z.record(
    z.string().regex(/^\d+$/),
    z.tuple([
      z.number().int().min(0).max(5),
      z.number().int().min(0).max(6),
      z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(9)]),
      z.number().int().min(0).max(1),
      z
        .enum([
          'short',
          'buzz',
          'quiff',
          'long',
          'fade',
          'curly',
          'afro',
          'twists',
          'braids',
          'bald',
        ])
        .optional(),
    ]),
  ),
});
const schema = z.strictObject({
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  jogadores: z.record(z.string(), z.unknown()),
  dadosExtras: z.record(z.string(), z.unknown()).optional(),
  clubes: z.record(z.string(), z.unknown()),
  aparencia: z.unknown(),
  excluidos: z.array(z.number().int().positive()),
});
const bundle = schema.parse(
  JSON.parse(await readFile(join(root, 'data/source-update.json'), 'utf8')),
);
const incomingAppearance = appearance.safeParse(bundle.aparencia);
const looks =
  incomingAppearance.success && Object.keys(incomingAppearance.data.players).length
    ? incomingAppearance.data
    : appearance.parse(
        JSON.parse(
          await readFile(join(root, 'packages/shared/src/config/player-looks.json'), 'utf8'),
        ),
      );
const clubs = {
  ...JSON.parse(await readFile(join(root, 'data/clubs-source.json'), 'utf8')),
  ...bundle.clubes,
};
if (!Object.keys(clubs).length) throw Error('A exportação deve conter clubes.');
const { dataset, report } = convertLocalPlayers(
  bundle.jogadores,
  clubs,
  bundle.excluidos,
  bundle.dadosExtras,
  JSON.parse(await readFile(join(root, 'data/club-details.json'), 'utf8')),
);
if (!dataset.players.ids.length || !dataset.clubs.ids.length)
  throw Error('A exportação não produziu jogadores e clubes válidos.');
if (process.argv.includes('--check')) {
  console.log(
    JSON.stringify({
      players: report.players,
      clubs: report.clubs,
      appearances: Object.keys(looks.players).length,
    }),
  );
  process.exit(0);
}
const files = [
  ['data/player-source.json', bundle.jogadores],
  ...(bundle.dadosExtras ? [['data/source-extras.json', bundle.dadosExtras] as const] : []),
  ['data/clubs-source.json', clubs],
  ['data/player-exclusions.json', bundle.excluidos],
  ['packages/shared/src/config/player-looks.json', looks],
] as const;
const backup = join(root, 'data/.backups', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(backup, { recursive: true });
for (const [index, file] of [
  ...files.map(([file]) => file),
  'data/player-database.json',
  'data/player-import-report.json',
].entries()) {
  try {
    await copyFile(join(root, file), join(backup, `${index}-${file.split('/').at(-1)}`));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
for (const [file, value] of files)
  await writeFile(join(root, file), JSON.stringify(value, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      message: 'JSON validado. Fontes atualizadas; a base será reconstruída a seguir.',
      players: report.players,
      clubs: report.clubs,
      appearances: Object.keys(looks.players).length,
      backup,
    },
    null,
    2,
  ),
);
