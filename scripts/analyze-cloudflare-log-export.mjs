import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const paths = process.argv.slice(2);
if (!paths.length) throw new Error('Pass exported JSON log files as arguments');
const hashes = new Set(),
  events = new Map();
let duplicateFiles = 0;
for (const path of paths) {
  const raw = readFileSync(path);
  const hash = createHash('sha256').update(raw).digest('hex');
  if (hashes.has(hash)) {
    duplicateFiles++;
    continue;
  }
  hashes.add(hash);
  for (const event of JSON.parse(raw.toString('utf8')))
    events.set(event.$metadata?.id ?? JSON.stringify(event), event);
}
const logs = [...events.values()];
const usage = logs.filter((x) => x.source?.event === 'game.usage');
const invocations = logs.filter((x) => x.$metadata?.type === 'cf-worker-event');
const sum = (xs, key) => xs.reduce((n, x) => n + (Number(x[key]) || 0), 0);
const cpu = invocations
  .map((x) => x.$workers?.cpuTimeMs)
  .filter((x) => typeof x === 'number')
  .sort((a, b) => a - b);
const totals = {};
for (const key of [
  'httpRequests',
  'webSocketMessages',
  'commands',
  'authentications',
  'alarms',
  'errors',
  'receivedBytes',
  'sqlStatements',
  'rowsRead',
  'rowsWritten',
  'sentMessages',
  'sentBytes',
  'fullSnapshots',
  'deltaSnapshots',
  'alarmWrites',
])
  totals[key] = sum(
    usage.map((x) => x.source),
    key,
  );
const byKind = {};
for (const entry of usage) {
  const s = entry.source,
    m = (byKind[s.kind] ??= { events: 0, rowsRead: 0, rowsWritten: 0, sentBytes: 0, elapsedMs: 0 });
  m.events++;
  for (const k of ['rowsRead', 'rowsWritten', 'sentBytes', 'elapsedMs']) m[k] += s[k] ?? 0;
}
const report = {
  scope:
    'User-provided partial export, not a whole-day count. Duplicate files and event IDs removed. Custom usage deltas and platform invocation CPU are separate to avoid double counting.',
  duplicateFiles,
  uniqueEvents: logs.length,
  from: logs.map((x) => x.timestamp).sort()[0],
  to: logs
    .map((x) => x.timestamp)
    .sort()
    .at(-1),
  platformInvocations: invocations.length,
  platformCpuMs: sum(
    invocations.map((x) => x.$workers ?? {}),
    'cpuTimeMs',
  ),
  platformWallMsSum: sum(
    invocations.map((x) => x.$workers ?? {}),
    'wallTimeMs',
  ),
  cpuP50Ms: cpu[Math.floor(cpu.length * 0.5)],
  cpuP99Ms: cpu[Math.min(cpu.length - 1, Math.floor(cpu.length * 0.99))],
  outcomes: Object.fromEntries(
    [...new Set(invocations.map((x) => x.$workers?.outcome))].map((k) => [
      k,
      invocations.filter((x) => x.$workers?.outcome === k).length,
    ]),
  ),
  usageEvents: usage.length,
  totals,
  byKind,
  maxMessageBatchBytes: Math.max(0, ...usage.map((x) => x.source.sentBytes ?? 0)),
  maxObservedStorageBytes: Math.max(0, ...usage.map((x) => x.source.storageBytes ?? 0)),
  logEventBytesSum: sum(
    logs.map((x) => x.$metadata ?? {}),
    'eventSize',
  ),
};
writeFileSync(
  new URL('../docs/cloudflare-export-measured.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
