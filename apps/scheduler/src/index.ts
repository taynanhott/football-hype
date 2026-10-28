export interface SchedulerEnvironment {
  GAME_SERVER_URL: string;
  SCHEDULER_SECRET: string;
}

export async function runSeasonTick(environment: SchedulerEnvironment): Promise<void> {
  const url = new URL('/internal/tick', environment.GAME_SERVER_URL);
  if (url.protocol !== 'https:' || !environment.SCHEDULER_SECRET)
    throw new Error('Configure um servidor HTTPS e SCHEDULER_SECRET.');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${environment.SCHEDULER_SECRET}` },
    redirect: 'error',
    signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) throw new Error(`Agendamento recusado pelo servidor: ${response.status}`);
}

export default {
  async scheduled(_event: unknown, environment: SchedulerEnvironment): Promise<void> {
    await runSeasonTick(environment);
  },
};
