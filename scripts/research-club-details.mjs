import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Offline maintenance only; never invoked by the game or its build.
const root = new URL('../', import.meta.url);
const dataset = JSON.parse(await readFile(new URL('data/player-database.json', root), 'utf8'));
const output = new URL('.tmp/club-research.json', root);
await mkdir(new URL('.tmp/', root), { recursive: true });
const results = await readFile(output, 'utf8')
  .then(JSON.parse)
  .catch(() => ({}));
const aliases = {
  Abha: 'Abha Club',
  'Casa Pia': 'Casa Pia A.C.',
  Tijuana: 'Club Tijuana',
  'Universidad de Chile': 'Club Universidad de Chile',
  'San Antonio Bulo Bulo': 'C.D. San Antonio Bulo Bulo',
  Charleroi: 'Royal Charleroi S.C.',
  'FC Imishli': 'İmişli FK',
  'FC Shamakhi': 'Shamakhi FK',
  '2 de Mayo': 'Club 2 de Mayo',
  Aalesund: 'Aalesunds FK',
  'ACSC Arges': 'FC Argeș Pitești',
  'AEK Atenas': 'AEK Athens F.C.',
  Águilas: 'Águilas Doradas',
  AIK: 'AIK Fotboll',
  'Al-Ahli SC': 'Al Ahli SC (Doha)',
  'Al-Arabi SC': 'Al-Arabi SC (Qatar)',
  'Al-Dhafra FC': 'Al Dhafra FC',
  'Al-Faisaly': 'Al Faisaly FC',
  'Al-Fateh': 'Al Fateh SC',
  'Al-Fayha': 'Al-Fayha FC',
  'Al-Hazem Sport': 'Al-Hazem FC',
  'Al-Hilal Saudi': 'Al Hilal SFC',
  'Al-Ittihad': 'Al-Ittihad Club (Jeddah)',
  'Al-Khaleej (Saihat)': 'Al-Khaleej FC',
  'Al-Nasr SC (UAE)': 'Al Nasr SC (Dubai)',
  'Al-Okhdood': 'Al-Okhdood Club',
  'Al-Qadsiah Saudi': 'Al Qadsiah FC',
  'Al-Riyadh Saudi': 'Al-Riyadh SC',
  'Al-Shabab': 'Al Shabab FC (Riyadh)',
  'Al-Taawoun': 'Al Taawoun FC',
  'Al-Wahda FC': 'Al Wahda FC',
  'Alianza FC': 'Alianza F.C. (Colombia)',
  'Always Ready': 'Club Always Ready',
  América: 'Club América',
  'APOEL Nicósia': 'APOEL FC',
  'Araz-Nakhchivan': 'Araz-Naxçıvan PFK',
  'Aris Thessalonikis': 'Aris Thessaloniki F.C.',
  'Asteras Aktor': 'Asteras Tripolis F.C.',
  'Atlas Guadalajara': 'Atlas F.C.',
  'Atromitos Atenas': 'Atromitos F.C.',
  Augsburg: 'FC Augsburg',
  Austin: 'Austin FC',
  Banfield: 'Club Atlético Banfield',
  'Baník Ostrava a.s': 'FC Baník Ostrava',
  'Basaksehir FK': 'İstanbul Başakşehir F.K.',
  'Basel 1893': 'FC Basel',
  Belgrano: 'Club Atlético Belgrano',
  Beşiktaş: 'Beşiktaş J.K.',
  Blooming: 'Club Blooming',
  Bolívar: 'Club Bolívar',
  'Bologna 1909': 'Bologna FC 1909',
  Bournemouth: 'AFC Bournemouth',
  Braga: 'S.C. Braga',
  'Bröndby IF': 'Brøndby IF',
  'Brugge KV': 'Club Brugge KV',
  Bucaramanga: 'Atlético Bucaramanga',
  'Central Córdoba': 'Central Córdoba de Santiago del Estero',
  Charlotte: 'Charlotte FC',
  'Chicago Fire Soccer': 'Chicago Fire FC',
  Cincinnati: 'FC Cincinnati',
  Copenhagen: 'F.C. Copenhagen',
  'Çorum FK': 'Çorum F.K.',
  'CSKA Moscou': 'PFC CSKA Moscow',
  Dallas: 'FC Dallas',
  'de Foot Montréal': 'CF Montréal',
  'Dínamo Moscou': 'FC Dynamo Moscow',
  Djurgården: 'Djurgårdens IF Fotboll',
  Elversberg: 'SV Elversberg',
  Envigado: 'Envigado F.C.',
  Estudiantes: 'Estudiantes de La Plata',
  'Estudiantes RC': 'Estudiantes de Río Cuarto',
  Fenerbahce: 'Fenerbahçe S.K. (football)',
  'FK IMT Belgrad': 'FK IMT',
  'FK Nizhny Novgorod': 'FC Pari Nizhny Novgorod',
  'FK Polissya Zhytomyr': 'FC Polissya Zhytomyr',
  'FK Sochi': 'PFC Sochi',
  'FK Zeleznicar Pancevo': 'FK Železničar Pančevo',
  Fredrikstad: 'Fredrikstad FK',
  Freiburg: 'SC Freiburg',
  Galatasaray: 'Galatasaray S.K. (football)',
  'Gimnasia Mendoza': 'Gimnasia y Esgrima de Mendoza',
  Göztepe: 'Göztepe S.K.',
  Groningen: 'FC Groningen',
  'Guaraní (PAR)': 'Club Guaraní',
  Hamburger: 'Hamburger SV',
  'Hammarby IF': 'Hammarby Fotboll',
  'Hapoel Tel Aviv': 'Hapoel Tel Aviv F.C.',
  Heerenveen: 'SC Heerenveen',
  Heidenheim: '1. FC Heidenheim',
  'Hradec Kralove': 'FC Hradec Králové',
  Huracán: 'Club Atlético Huracán',
  'Ind. Medellín': 'Independiente Medellín',
  'Ind. Rivadavia': 'Independiente Rivadavia',
  Independiente: 'Club Atlético Independiente',
  Instituto: 'Instituto Atlético Central Córdoba',
  'Internacional Bogotá': 'Internacional de Bogotá',
  'Internacional Miami': 'Inter Miami CF',
  Juárez: 'FC Juárez',
  Junior: 'Atlético Junior',
  Juventud: 'Juventud de Las Piedras',
  'Kairat Almaty': 'FC Kairat',
  Kasimpasa: 'Kasımpaşa S.K.',
  'Khor Fakkan SSC': 'Khor Fakkan Club',
  Köln: '1. FC Köln',
  Kristiansund: 'Kristiansund BK',
  'Kryvbas Kryvyi Rig': 'FC Kryvbas Kryvyi Rih',
  Lanús: 'Club Atlético Lanús',
  'Le Havre': 'Le Havre AC',
  Lens: 'RC Lens',
  León: 'Club León',
  Libertad: 'Club Libertad',
  'Libertad (EQU)': 'Libertad F.C. (Ecuador)',
  Lillestrøm: 'Lillestrøm SK',
  'Livyi Bereg Kyiv': 'FC Livyi Bereh Kyiv',
  Llaneros: 'Llaneros F.C.',
  'Lokomotiv Moscou': 'FC Lokomotiv Moscow',
  'Los Angeles': 'Los Angeles FC',
  Macará: 'C.D. Macará',
  'Maccabi Haifa': 'Maccabi Haifa F.C.',
  Melgar: 'FBC Melgar',
  Middlesbrough: 'Middlesbrough F.C.',
  Milan: 'AC Milan',
  Mjällby: 'Mjällby AIF',
  Monaco: 'AS Monaco FC',
  Monterrey: 'C.F. Monterrey',
  Nacional: 'Club Nacional de Football',
  Napoli: 'SSC Napoli',
  Nashville: 'Nashville SC',
  'Neom Sports': 'Neom SC',
  'New York City': 'New York City FC',
  "Newell's": "Newell's Old Boys",
  Nice: 'OGC Nice',
  Nordsjaelland: 'FC Nordsjælland',
  "O'Higgins": "O'Higgins F.C.",
  'Okzhetpes Kokshetau': 'FC Okzhetpes',
  Oleksandriya: 'FC Oleksandriya',
  Olimpia: 'Club Olimpia',
  Olympiacos: 'Olympiacos F.C.',
  'Omónia Nicósia': 'AC Omonia',
  'Ordabasy Tschimkent': 'FC Ordabasy',
  Orense: 'Orense S.C.',
  Paderborn: 'SC Paderborn 07',
  Palestino: 'Club Deportivo Palestino',
  Panathinaikos: 'Panathinaikos F.C.',
  PAOK: 'PAOK FC',
  Paris: 'Paris FC',
  'Parma 1913': 'Parma Calcio 1913',
  'Piast Gliwice KS': 'Piast Gliwice',
  'Pisa Sporting': 'Pisa SC',
  Platense: 'Club Atlético Platense',
  Pyramids: 'Pyramids FC',
  'Qingdao West Coast': 'Qingdao West Coast F.C.',
  Racing: 'Racing Club de Avellaneda',
  Rangers: 'Rangers F.C.',
  'Rapid 1923': 'FC Rapid București',
  'RCD Espanyol Barcelona': 'RCD Espanyol',
  Recoleta: 'Deportivo Recoleta',
  'RFK Akhmat Grozny': 'FC Akhmat Grozny',
  Riestra: 'Deportivo Riestra',
  'River Plate': 'Club Atlético River Plate',
  Roma: 'AS Roma',
  'Saint-Étienne': 'AS Saint-Étienne',
  'San Diego': 'San Diego FC',
  'San Lorenzo': 'San Lorenzo de Almagro',
  'Santa Fe': 'Independiente Santa Fe',
  Sarmiento: 'Club Atlético Sarmiento',
  'SK Sigma Olomouc, a.s': 'SK Sigma Olomouc',
  'Società Lazio S.p.A': 'SS Lazio',
  'Sönderjyske Fodbold': 'Sønderjyske Fodbold',
  'Spartak Moscou': 'FC Spartak Moscow',
  'St. Gallen 1879': 'FC St. Gallen',
  'St. Louis City Soccer': 'St. Louis City SC',
  'St. Pauli': 'FC St. Pauli',
  'Strasbourg Alsace': 'RC Strasbourg Alsace',
  Stuttgart: 'VfB Stuttgart',
  'Sumqayit PFK': 'Sumgayit FK',
  Talleres: 'Talleres de Córdoba',
  Tigre: 'Club Atlético Tigre',
  Toronto: 'Toronto FC',
  Trinidense: 'Sportivo Trinidense',
  'Ulsan Hyundai': 'Ulsan HD FC',
  'UNAM Pumas': 'Club Universidad Nacional',
  Unión: 'Unión de Santa Fe',
  'Union Berlin': '1. FC Union Berlin',
  'Universidad Católica': 'Club Deportivo Universidad Católica',
  'Universidad Católica (EQU)': 'C.D. Universidad Católica del Ecuador',
  Universitario: 'Club Universitario de Deportes',
  'Universitatea Cluj': 'FC Universitatea Cluj',
  'Universitatea Craiova': 'CS Universitatea Craiova',
  'US Cremonese': 'US Cremonese',
  'US Lecce': 'US Lecce',
  'US Sassuolo': 'US Sassuolo Calcio',
  Utrecht: 'FC Utrecht',
  'Vancouver Whitecaps': 'Vancouver Whitecaps FC',
  'Vélez Sarsfield': 'Club Atlético Vélez Sarsfield',
  'Viking Fotballklubb': 'Viking FK',
  'Viktoria Plzen': 'FC Viktoria Plzeň',
  'Vitória Guimarães': 'Vitória S.C.',
  'Volos FC': 'Volos F.C.',
  'Widzew Lodz': 'Widzew Łódź',
  'Wieczysta Krakow': 'Wieczysta Kraków',
  'Wisla Plock': 'Wisła Płock',
  Wolfsberger: 'Wolfsberger AC',
  Wolfsburg: 'VfL Wolfsburg',
  Wolverhampton: 'Wolverhampton Wanderers F.C.',
  'Yelimay Semey': 'FC Elimai',
  'Yunnan Yukun': 'Yunnan Yukun F.C.',
  'Zaglebie Lubin': 'Zagłębie Lubin',
  Zamalek: 'Zamalek SC',
  Zenit: 'FC Zenit Saint Petersburg',
  'Zhenis Astana': 'FC Zhenis',
  'Zira FK': 'Zira FK',
  'Zorya Lugansk': 'FC Zorya Luhansk',
  'Zulte Waregem': 'S.V. Zulte Waregem',
  Zürich: 'FC Zürich',
  Chapecoense: 'Associação Chapecoense de Futebol',
  'Athletico-PR': 'Club Athletico Paranaense',
  'Atlético-MG': 'Clube Atlético Mineiro',
  Bahia: 'Esporte Clube Bahia',
  Botafogo: 'Botafogo de Futebol e Regatas',
  Bragantino: 'Red Bull Bragantino',
  Corinthians: 'Sport Club Corinthians Paulista',
  Coritiba: 'Coritiba Foot Ball Club',
  Cruzeiro: 'Cruzeiro Esporte Clube',
  Flamengo: 'CR Flamengo',
  Fluminense: 'Fluminense FC',
  Grêmio: 'Grêmio FBPA',
  Internacional: 'Sport Club Internacional',
  Mirassol: 'Mirassol Futebol Clube',
  Palmeiras: 'Sociedade Esportiva Palmeiras',
  Remo: 'Clube do Remo',
  Santos: 'Santos FC',
  'São Paulo': 'São Paulo FC',
  Vasco: 'CR Vasco da Gama',
  Vitória: 'Esporte Clube Vitória',
  'América-MG': 'América Futebol Clube (MG)',
  Athletic: 'Athletic Club (MG)',
  'Atlético-GO': 'Atlético Clube Goianiense',
  Avaí: 'Avaí FC',
  'Botafogo-SP': 'Botafogo Futebol Clube (SP)',
  Ceará: 'Ceará Sporting Club',
  CRB: 'Clube de Regatas Brasil',
  Criciúma: 'Criciúma Esporte Clube',
  Cuiabá: 'Cuiabá Esporte Clube',
  Fortaleza: 'Fortaleza Esporte Clube',
  Goiás: 'Goiás Esporte Clube',
  Juventude: 'Esporte Clube Juventude',
  Londrina: 'Londrina Esporte Clube',
  Náutico: 'Clube Náutico Capibaribe',
  Novorizontino: 'Grêmio Novorizontino',
  'Operário-PR': 'Operário Ferroviário Esporte Clube',
  'Ponte Preta': 'Associação Atlética Ponte Preta',
  'São Bernardo': 'São Bernardo Futebol Clube',
  Sport: 'Sport Club do Recife',
  'Vila Nova': 'Vila Nova Futebol Clube',
  ABC: 'ABC Futebol Clube',
  'Águia de Marabá': 'Águia de Marabá Futebol Clube',
  Altos: 'Associação Atlética de Altos',
  Amazonas: 'Amazonas Futebol Clube',
  'América-RN': 'América Futebol Clube (RN)',
  Anápolis: 'Anápolis Futebol Clube',
  Araguaína: 'Araguaína Futebol e Regatas',
  Barra: 'Barra Futebol Clube (SC)',
  'Botafogo-PB': 'Botafogo Futebol Clube (PB)',
  Brasiliense: 'Brasiliense FC',
  Brusque: 'Brusque Futebol Clube',
  Capital: 'Capital Clube de Futebol',
  Caxias: 'Sociedade Esportiva e Recreativa Caxias do Sul',
  Cianorte: 'Cianorte Futebol Clube',
  Confiança: 'Associação Desportiva Confiança',
  CSA: 'Centro Sportivo Alagoano',
  Ferroviária: 'Associação Ferroviária de Esportes',
  Ferroviário: 'Ferroviário Atlético Clube (CE)',
  Figueirense: 'Figueirense FC',
  Floresta: 'Floresta Esporte Clube',
  Gama: 'Sociedade Esportiva do Gama',
  GAS: 'Grêmio Atlético Sampaio',
  Guarani: 'Guarani FC',
  'Independência-AC': 'Independência Futebol Clube',
  'Inter de Limeira': 'Associação Atlética Internacional (Limeira)',
  Itabaiana: 'Associação Olímpica de Itabaiana',
  Ituano: 'Ituano FC',
  Juazeirense: 'Sociedade Desportiva Juazeirense',
  Luverdense: 'Luverdense Esporte Clube',
  Maranhão: 'Maranhão Atlético Clube',
  Maringá: 'Maringá Futebol Clube',
  'Moto Club': 'Moto Club de São Luís',
  'Nacional-AM': 'Nacional Futebol Clube',
  'Operário-MS': 'Operário Futebol Clube (MS)',
  Paysandu: 'Paysandu Sport Club',
  'Porto Velho': 'Porto Velho Esporte Clube',
  Portuguesa: 'Associação Portuguesa de Desportos',
  Primavera: 'Esporte Clube Primavera',
  'Sampaio Corrêa': 'Sampaio Corrêa Futebol Clube',
  'Santa Cruz': 'Santa Cruz Futebol Clube',
  Sergipe: 'Club Sportivo Sergipe',
  Trem: 'Trem Desportivo Clube',
  Treze: 'Treze Futebol Clube',
  'Volta Redonda': 'Volta Redonda FC',
  Ypiranga: 'Ypiranga Futebol Clube',
};
async function api(params) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', format: 'json', ...params }).toString();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'FootballHypeDataResearch/1.0 (club metadata maintenance)' },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw Error(data.error.info);
      return data;
    } catch (error) {
      console.log('Retry', attempt + 1, String(error));
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10000 * (attempt + 1)));
    }
  }
}
function fields(text) {
  text = text.replace(/<!--[^]*?-->/g, '');
  const start = text.search(
    /\{\{\s*(?:Infobox (?:football|soccer) club|(?:Football|Soccer) club infobox)/i,
  );
  if (start < 0) return null;
  let depth = 1,
    end = start + 2;
  for (; end < text.length && depth; end++) {
    if (text.slice(end, end + 2) === '{{') {
      depth++;
      end++;
    } else if (text.slice(end, end + 2) === '}}') {
      depth--;
      end++;
    }
  }
  const box = text.slice(start, end);
  return Object.fromEntries(
    [...box.matchAll(/^[ \t]*\|[ \t]*(\w+)[ \t]*=[ \t]*([\s\S]*?)(?=\n[ \t]*\||\n\}\}|$)/gm)].map(
      (m) => [m[1].toLowerCase(), m[2].trim()],
    ),
  );
}
function clean(text = '') {
  return text
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<ref\b[^]*?<\/ref\s*>|<ref\b[^>]*\/\s*>/gi, '')
    .replace(
      /\{\{(?:flagicon|flag|small|nowrap|ubl|plainlist|hlist|lang|langx|sortname|sort)\|([^{}]*)\}\}/gi,
      (_m, value) => {
        const parts = value.split('|').filter((p) => !p.includes('='));
        return /flag/.test(_m) ? '' : parts.at(-1);
      },
    )
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<br\s*\/?\s*>/gi, '; ')
    .replace(/<[^>]*>/g, '')
    .replace(/'{2,}/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
function record(club, page) {
  const revision = page.revisions?.[0];
  const raw = fields(revision?.slots.main['*'] ?? '');
  return {
    title: page.title,
    country: club.country,
    source: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${revision?.revid}`,
    retrievedAt: new Date().toISOString(),
    revisionAt: revision?.timestamp,
    fields: raw,
    coachName: clean(raw?.head_coach || raw?.headcoach || raw?.coach || raw?.manager),
    stadiumName: clean(raw?.ground || raw?.stadium),
  };
}
// Resolve exact titles and redirects in batches before resorting to search.
if (process.argv.includes('--batch')) {
  const clubs = Object.values(dataset.clubs.byId);
  for (let offset = 0; offset < clubs.length; offset += 5) {
    const batch = clubs.slice(offset, offset + 5).filter((c) => !results[c.name]?.fields);
    if (!batch.length) continue;
    const data = await api({
      titles: batch.map((c) => aliases[c.name] || c.name).join('|'),
      redirects: '1',
      prop: 'revisions',
      rvprop: 'content|ids|timestamp',
      rvslots: 'main',
      rvsection: '0',
    });
    const pages = Object.values(data.query.pages);
    const redirects = new Map(
      [...(data.query.normalized || []), ...(data.query.redirects || [])].map((r) => [
        r.from,
        r.to,
      ]),
    );
    for (const club of batch) {
      let title = aliases[club.name] || club.name;
      for (let i = 0; i < 5 && redirects.has(title); i++) title = redirects.get(title);
      const page = pages.find((p) => p.title === title);
      if (page?.revisions) {
        const item = record(club, page);
        if (item.fields) results[club.name] = item;
      }
    }
    await writeFile(output, JSON.stringify(results, null, 2) + '\n');
    console.log(`Batch ${Math.min(offset + 5, clubs.length)}/${clubs.length}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
if (process.argv.includes('--batch')) {
  const remaining = Object.values(dataset.clubs.byId).filter((c) => !results[c.name]?.fields);
  for (let offset = 0; offset < remaining.length; offset += 8) {
    const batch = remaining.slice(offset, offset + 8);
    const titles = batch.flatMap((c) => [
      `${c.name} F.C.`,
      `FC ${c.name}`,
      `${c.name} FC`,
      `${c.name} S.C.`,
      `${c.name} Calcio`,
    ]);
    const data = await api({
      titles: titles.join('|'),
      redirects: '1',
      prop: 'revisions',
      rvprop: 'content|ids|timestamp',
      rvslots: 'main',
      rvsection: '0',
    });
    const pages = Object.values(data.query.pages);
    const redirects = new Map(
      [...(data.query.normalized || []), ...(data.query.redirects || [])].map((r) => [
        r.from,
        r.to,
      ]),
    );
    for (const club of batch)
      for (let title of [
        `${club.name} F.C.`,
        `FC ${club.name}`,
        `${club.name} FC`,
        `${club.name} S.C.`,
        `${club.name} Calcio`,
      ]) {
        for (let i = 0; i < 5 && redirects.has(title); i++) title = redirects.get(title);
        const page = pages.find((p) => p.title === title);
        if (page?.revisions) {
          const item = record(club, page);
          if (item.fields) {
            results[club.name] = item;
            break;
          }
        }
      }
    await writeFile(output, JSON.stringify(results, null, 2) + '\n');
    console.log(`Title variants ${Math.min(offset + 8, remaining.length)}/${remaining.length}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
const todo = Object.values(dataset.clubs.byId).filter((c) => !results[c.name]?.fields);
let next = 0,
  completed = 0;
async function worker() {
  while (next < todo.length) {
    const club = todo[next++];
    try {
      let title = aliases[club.name];
      if (!title) {
        const search = await api({
          list: 'search',
          srsearch: `${club.name} football club`,
          srlimit: '1',
        });
        title = search.query.search[0]?.title;
      }
      if (!title) throw Error('No matching page');
      const data = await api({
        titles: title,
        redirects: '1',
        prop: 'revisions',
        rvprop: 'content|ids|timestamp',
        rvslots: 'main',
        rvsection: '0',
      });
      const page = Object.values(data.query.pages)[0];
      const revision = page.revisions?.[0];
      const raw = fields(revision?.slots.main['*'] ?? '');
      results[club.name] = {
        title: page.title,
        country: club.country,
        source: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${revision?.revid}`,
        retrievedAt: new Date().toISOString(),
        revisionAt: revision?.timestamp,
        fields: raw,
        coachName: clean(raw?.head_coach || raw?.headcoach || raw?.coach || raw?.manager),
        stadiumName: clean(raw?.ground || raw?.stadium),
      };
    } catch (error) {
      results[club.name] = { error: String(error) };
    }
    completed++;
    if (completed % 15 === 0) {
      await writeFile(output, JSON.stringify(results, null, 2) + '\n');
      console.log(`${completed}/${todo.length}: ${club.name}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
await worker();
await writeFile(output, JSON.stringify(results, null, 2) + '\n');
console.log(`Saved ${Object.keys(results).length} club research records`);
