import { z } from 'zod';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const clubCrestSchema = z.strictObject({
  version: z.literal(1),
  shape: z.enum(['round', 'oval', 'shield', 'pointed', 'diamond', 'pennant']),
  pattern: z.enum(['solid', 'stripes', 'hoops', 'sash', 'cross', 'split', 'quarters']),
  symbol: z.enum([
    'monogram',
    'star',
    'stars',
    'anchor',
    'cross',
    'cannon',
    'ball',
    'crown',
    'tower',
    'bird',
    'lion',
    'tree',
  ]),
  primary: color,
  secondary: color,
  accent: color,
  initials: z.string().min(1).max(4),
});
export type ClubCrest = z.infer<typeof clubCrestSchema>;
