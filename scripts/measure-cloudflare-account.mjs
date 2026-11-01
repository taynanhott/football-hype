import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const account = '4aa81463169a1610e9aa5881364d860e';
const config = readFileSync(
  join(process.env.APPDATA, 'xdg.config/.wrangler/config/default.toml'),
  'utf8',
);
const token = /oauth_token\s*=\s*"([^"]+)"/.exec(config)?.[1];
if (!token) throw new Error('OAuth credential unavailable');
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const now = new Date(),
  since = new Date(now);
since.setUTCHours(0, 0, 0, 0);
if (process.env.CF_MEASURE_MONTH === '1') since.setUTCDate(1);
if (process.env.CF_MEASURE_HOURS === '24') since.setTime(now.getTime() - 86400000);
const report = {
  measuredAt: now.toISOString(),
  since: since.toISOString(),
  scope:
    'Whole account, exact time window in since/measuredAt, read-only API; datasets may be delayed or unavailable',
  rest: {},
  analytics: {},
};
for (const path of [
  'workers/scripts',
  'workers/durable_objects/namespaces',
  'd1/database',
  'storage/kv/namespaces',
  'r2/buckets',
  'subscriptions',
]) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`, {
    headers,
  });
  const data = await response.json();
  report.rest[path] = { status: response.status, ...data };
}
const filter = `accountTag: "${account}"`;
const time = `datetime_geq: "${since.toISOString()}", datetime_leq: "${now.toISOString()}"`;
const selections = {
  workers: `workersInvocationsAdaptive(limit:10000,filter:{${time}}) { dimensions { scriptName } sum { requests errors cpuTimeUs responseBodySize } quantiles { cpuTimeP50 cpuTimeP99 } }`,
  objects: `durableObjectsInvocationsAdaptiveGroups(limit:10000,filter:{${time}}) { dimensions { namespaceId } sum { requests } }`,
  duration: `durableObjectsPeriodicGroups(limit:10000,filter:{${time}}) { dimensions { namespaceId } sum { cpuTime duration rowsRead rowsWritten inboundWebsocketMsgCount outboundWebsocketMsgCount } quantiles { memoryUsageBytesP99 } }`,
  storage: `durableObjectsSqlStorageGroups(limit:10000,filter:{${time}}) { dimensions { namespaceId } max { storedBytes } }`,
};
const logsResponse = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}/workers/observability/telemetry/query`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      queryId: 'resource-audit-read-only',
      timeframe: { from: since.getTime(), to: now.getTime() },
      view: 'calculations',
      dry: true,
      ignoreSeries: true,
      parameters: {
        datasets: ['cloudflare-workers'],
        calculations: [{ operator: 'count' }],
        groupBys: [{ type: 'string', value: '$workers.scriptName' }],
      },
    }),
  },
);
report.logs = { status: logsResponse.status, ...(await logsResponse.json()) };
for (const [name, selection] of Object.entries(selections)) {
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: `{ viewer { accounts(filter:{${filter}}) { ${selection} } } }` }),
  });
  report.analytics[name] = { status: response.status, ...(await response.json()) };
}
const workers =
  report.analytics.workers?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
const objects =
  report.analytics.duration?.data?.viewer?.accounts?.[0]?.durableObjectsPeriodicGroups ?? [];
report.sharedTotals = {
  workerRequests: workers.reduce((n, x) => n + x.sum.requests, 0),
  workerCpuMs: workers.reduce((n, x) => n + x.sum.cpuTimeUs / 1000, 0),
  httpResponseBytes: workers.reduce((n, x) => n + x.sum.responseBodySize, 0),
  objectDurationGbSeconds: objects.reduce((n, x) => n + x.sum.duration, 0),
  objectCpuMs: objects.reduce((n, x) => n + x.sum.cpuTime / 1000, 0),
  sqliteRowsRead: objects.reduce((n, x) => n + x.sum.rowsRead, 0),
  sqliteRowsWritten: objects.reduce((n, x) => n + x.sum.rowsWritten, 0),
  inboundSocketMessages: objects.reduce((n, x) => n + x.sum.inboundWebsocketMsgCount, 0),
  outboundSocketMessages: objects.reduce((n, x) => n + x.sum.outboundWebsocketMsgCount, 0),
  storageSumOfNamespaceDailyMaxBytes: (
    report.analytics.storage?.data?.viewer?.accounts?.[0]?.durableObjectsSqlStorageGroups ?? []
  ).reduce((n, x) => n + x.max.storedBytes, 0),
};
// An unavailable dataset is unknown, never zero consumption.
for (const [dataset, keys] of Object.entries({
  workers: ['workerRequests', 'workerCpuMs', 'httpResponseBytes'],
  duration: [
    'objectDurationGbSeconds',
    'objectCpuMs',
    'sqliteRowsRead',
    'sqliteRowsWritten',
    'inboundSocketMessages',
    'outboundSocketMessages',
  ],
  storage: ['storageSumOfNamespaceDailyMaxBytes'],
})) {
  if (!report.analytics[dataset]?.data?.viewer?.accounts)
    for (const key of keys) report.sharedTotals[key] = null;
}
delete report.schema;
writeFileSync(
  new URL(
    process.env.CF_MEASURE_MONTH === '1'
      ? '../docs/cloudflare-account-month-measured.json'
      : process.env.CF_MEASURE_HOURS === '24'
        ? '../docs/cloudflare-account-24h-measured.json'
        : '../docs/cloudflare-account-measured.json',
    import.meta.url,
  ),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      measuredAt: report.measuredAt,
      rest: Object.fromEntries(
        Object.entries(report.rest).map(([k, v]) => [
          k,
          { status: v.status, success: v.success, count: v.result?.length },
        ]),
      ),
      analytics: report.analytics,
    },
    null,
    2,
  ),
);
