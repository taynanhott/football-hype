import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret, defineString } from 'firebase-functions/params';
import { z } from 'zod';

const gameServerUrl = defineString('GAME_SERVER_URL');
const schedulerSecret = defineSecret('SCHEDULER_SECRET');

export const health = onRequest({ region: 'southamerica-east1' }, (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

export const simulateScheduledMatches = onSchedule(
  {
    schedule: '*/5 8-23 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    secrets: [schedulerSecret],
    maxInstances: 1,
    retryCount: 3,
  },
  async () => {
    const url = z
      .url()
      .refine((value) => value.startsWith('https://') || process.env.FUNCTIONS_EMULATOR === 'true')
      .parse(gameServerUrl.value());
    const response = await fetch(`${url.replace(/\/$/, '')}/internal/tick`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${schedulerSecret.value()}` },
      signal: AbortSignal.timeout(50000),
    });
    if (!response.ok) throw new Error(`Agendador recusado: ${response.status}`);
  },
);
