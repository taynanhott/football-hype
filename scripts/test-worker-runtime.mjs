import assert from 'node:assert/strict';
const base = process.env.WORKER_TEST_URL ?? 'http://127.0.0.1:8788';
const health = await fetch(base + '/health');
assert.equal(health.status, 200);
assert.equal((await health.json()).persistence, 'durable-sqlite');
const catalog = await fetch(base + '/api/catalog');
assert.equal(catalog.status, 200);
assert.ok((await catalog.json()).clubs.length > 0);
const privateResponse = await fetch(base + '/api/leagues');
assert.equal(privateResponse.status, 400);
const forbidden = await fetch(base + '/health', { headers: { Origin: 'https://invalid.example' } });
assert.equal(forbidden.status, 403);
await new Promise((resolve, reject) => {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/socket');
  const timer = setTimeout(() => {
    ws.close();
    reject(new Error('WebSocket timeout'));
  }, 10000);
  ws.onopen = () =>
    ws.send(JSON.stringify({ type: 'auth', data: { leagueId: crypto.randomUUID() } }));
  ws.onmessage = (event) => {
    try {
      assert.equal(JSON.parse(String(event.data)).type, 'error');
      clearTimeout(timer);
      ws.close();
      resolve();
    } catch (error) {
      reject(error);
    }
  };
  ws.onerror = reject;
});
console.log(
  'Cloudflare runtime: saúde, catálogo, autenticação obrigatória, origem e WebSocket verificados.',
);
