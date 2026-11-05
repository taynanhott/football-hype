/** Parse a stored JSON array one object at a time without retaining its raw tree. */
export function* jsonObjectArray(chunks: Iterable<string>): Generator<unknown> {
  let phase: 'start' | 'value' | 'object' | 'separator' | 'done' = 'start';
  const complete = () => phase === 'done';
  let allowEnd = true,
    depth = 0,
    quoted = false,
    escaped = false;
  let pieces: string[] = [];
  const invalid = () => new Error('Histórico de partidas inválido');
  for (const chunk of chunks) {
    let start = phase === 'object' ? 0 : -1;
    for (let index = 0; index < chunk.length; index++) {
      const char = chunk[index]!;
      if (phase === 'object') {
        if (quoted) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') quoted = false;
        } else if (char === '"') quoted = true;
        else if (char === '{' || char === '[') depth++;
        else if (char === '}' || char === ']') depth--;
        if (depth === 0) {
          pieces.push(chunk.slice(start, index + 1));
          yield JSON.parse(pieces.join('')) as unknown;
          pieces = [];
          start = -1;
          phase = 'separator';
        }
        continue;
      }
      if (char === ' ' || char === '\n' || char === '\r' || char === '\t') continue;
      if (phase === 'start' && char === '[') phase = 'value';
      else if (phase === 'value' && char === '{') {
        phase = 'object';
        depth = 1;
        quoted = false;
        escaped = false;
        start = index;
      } else if (phase === 'value' && allowEnd && char === ']') phase = 'done';
      else if (phase === 'separator' && char === ',') {
        phase = 'value';
        allowEnd = false;
      } else if (phase === 'separator' && char === ']') phase = 'done';
      else throw invalid();
    }
    if (phase === 'object') pieces.push(chunk.slice(start));
  }
  if (!complete()) throw invalid();
}
