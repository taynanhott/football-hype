/* global document */
/* Cole este arquivo inteiro no console da página original e pressione Enter. */
(() => {
  const scripts = [...document.querySelectorAll('script')]
    .map((node) => node.textContent || '')
    .join('\n');
  const dataNode = document.querySelector('script#data');
  if (!dataNode) throw Error('Abra a página original que contém a base de jogadores.');
  const jogadores = JSON.parse(dataNode.textContent);
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
  // Leitor de valores estáticos: não executa o código da página.
  function readLiteral(text, start = 0) {
    let i = start;
    const skip = () => {
      while (i < text.length) {
        if (/\s/.test(text[i])) {
          i++;
          continue;
        }
        if (text.slice(i, i + 2) === '//') {
          i = text.indexOf('\n', i);
          if (i < 0) i = text.length;
          continue;
        }
        if (text.slice(i, i + 2) === '/*') {
          const end = text.indexOf('*/', i + 2);
          if (end < 0) throw Error('Comentário incompleto');
          i = end + 2;
          continue;
        }
        break;
      }
    };
    function value(depth = 0) {
      if (depth > 30) throw Error('Estrutura muito profunda');
      skip();
      const c = text[i];
      if (c === '"' || c === "'") {
        const quote = c;
        i++;
        let out = '';
        while (i < text.length) {
          const ch = text[i++];
          if (ch === quote) return out;
          if (ch === '\\') {
            const next = text[i++];
            out += { n: '\n', r: '\r', t: '\t' }[next] ?? next;
          } else out += ch;
        }
        throw Error('Texto incompleto');
      }
      if (c === '[') {
        i++;
        const out = [];
        skip();
        while (text[i] !== ']') {
          out.push(value(depth + 1));
          skip();
          if (text[i] === ',') {
            i++;
            skip();
          } else if (text[i] !== ']') throw Error('Lista inválida');
        }
        i++;
        return out;
      }
      if (c === '{') {
        i++;
        const out = {};
        skip();
        while (text[i] !== '}') {
          let key;
          if (text[i] === "'" || text[i] === '"') key = value(depth + 1);
          else {
            const m = text.slice(i).match(/^[\w$-]+/);
            if (!m) throw Error('Chave inválida');
            key = m[0];
            i += key.length;
          }
          skip();
          if (text[i++] !== ':') throw Error('Objeto inválido');
          const entry = value(depth + 1);
          Object.defineProperty(out, key, {
            value: entry,
            enumerable: true,
            writable: true,
            configurable: true,
          });
          skip();
          if (text[i] === ',') {
            i++;
            skip();
          } else if (text[i] !== '}') throw Error('Objeto inválido');
        }
        i++;
        return out;
      }
      const number = text.slice(i).match(/^-?\d+(?:\.\d+)?/);
      if (number) {
        i += number[0].length;
        return Number(number[0]);
      }
      const word = text.slice(i).match(/^[A-Za-z_$][\w$]*/);
      if (!word) throw Error('Valor não suportado perto de ' + text.slice(i, i + 35));
      i += word[0].length;
      skip();
      if (word[0] === 'K' && text[i] === '(') {
        i++;
        const args = [];
        skip();
        while (text[i] !== ')') {
          args.push(value(depth + 1));
          skip();
          if (text[i] === ',') {
            i++;
            skip();
          } else if (text[i] !== ')') throw Error('Uniforme inválido');
        }
        i++;
        return {
          abbreviation: args[0],
          pattern: args[1],
          colors: args[2],
          support: args[5],
          ...(args[6] ?? {}),
        };
      }
      if (word[0] === 'null') return null;
      if (word[0] === 'true') return true;
      if (word[0] === 'false') return false;
      if (Object.hasOwn(colors, word[0])) return colors[word[0]];
      throw Error('Referência não suportada: ' + word[0]);
    }
    return value();
  }
  const clubes = {};
  for (const m of scripts.matchAll(/\b(?:const|let|var)\s+(CLUBS_[\w]+|INT_CLUBS)\s*=\s*/g)) {
    const records = readLiteral(scripts, m.index + m[0].length);
    for (const [name, meta] of Object.entries(records)) clubes[name] = { ...meta, group: m[1] };
  }
  if (!Object.keys(clubes).length) throw Error('Nenhum clube encontrado; exportação cancelada.');
  const appearanceStart = scripts.indexOf('// aparência medida nas fotos do Transfermarkt');
  const appearanceBlock = scripts.slice(appearanceStart);
  const compact =
    appearanceStart < 0
      ? null
      : appearanceBlock.match(/for\s*\(const it of '([0-9a-f,]+)'\.split\(','\)\)/);
  if (!compact) throw Error('Tabela de aparência não encontrada; exportação cancelada.');
  const players = {};
  for (const item of compact[1].split(',')) {
    const tail = item.slice(-3);
    players[parseInt(item.slice(0, -3), 16)] = [+tail[0], +tail[1], 9, +tail[2]];
  }
  const override = appearanceBlock.match(/Object\.assign\(m,\s*/);
  if (override)
    Object.assign(players, readLiteral(appearanceBlock, override.index + override[0].length));
  const palette = (name) => {
    const match = scripts.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*`));
    if (!match) throw Error('Paleta ausente: ' + name);
    return readLiteral(scripts, match.index + match[0].length);
  };
  const exclusion = scripts.match(/\b(?:const|let)\s+EXCLUDE\s*=\s*new Set\s*\(\s*/);
  if (!exclusion) throw Error('Lista EXCLUDE não encontrada; exportação cancelada.');
  const excluidos = readLiteral(scripts, exclusion.index + exclusion[0].length);
  const result = {
    version: 1,
    exportedAt: new Date().toISOString(),
    jogadores,
    clubes,
    aparencia: { skin: palette('SKIN'), hair: palette('HAIR'), players },
    excluidos,
  };
  const json = JSON.stringify(result, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'source-update.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  console.log('Exportação concluída. Salve source-update.json na pasta data do projeto.', {
    clubes: Object.keys(clubes).length,
    aparencias: Object.keys(players).length,
    excluidos: excluidos.length,
  });
  return result;
})();
