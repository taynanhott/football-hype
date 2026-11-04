import { execFileSync } from 'node:child_process';
for (const division of ['A', 'B', 'C', 'D']) {
  execFileSync(process.execPath, ['scripts/simulate-domestic-league.mjs'], {
    env: { ...process.env, SIMULATION_DIVISION: division, SIMULATION_SEED: '20261026' },
    stdio: 'ignore',
  });
  console.log('Série ' + division + ' concluída');
}
