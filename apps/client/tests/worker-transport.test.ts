import { afterEach, expect, it, vi } from 'vitest';
import { connectWorker } from '../src/store/worker-transport';
import { encodeSnapshotMessage } from '../../worker/src/snapshot-wire';

it('processa o save compactado antes da atualização seguinte e mantém a ordem do buffer', async () => {
  class FakeSocket {
    static OPEN = 1;
    static instance: FakeSocket;
    readyState = 1;
    binaryType = '';
    onopen?: () => void;
    onmessage?: (event: { data: string | ArrayBuffer }) => void;
    onclose?: (event: { code: number; reason: string }) => void;
    send = vi.fn();
    constructor() {
      FakeSocket.instance = this;
    }
    close() {
      this.onclose?.({ code: 1000, reason: '' });
    }
  }
  vi.stubGlobal('WebSocket', FakeSocket);
  const connecting = connectWorker('wss://game.invalid', {});
  FakeSocket.instance.onopen?.();
  FakeSocket.instance.onmessage!({ data: JSON.stringify({ type: 'ready', data: {} }) });
  const room = await connecting;
  expect(FakeSocket.instance.binaryType).toBe('arraybuffer');
  const received: number[] = [];
  room.onMessage('snapshot', () => received.push(1));
  room.onMessage('snapshot-delta', () => received.push(2));
  const encoded = await encodeSnapshotMessage(
    'snapshot',
    { history: 'partida'.repeat(30000) },
    true,
  );
  FakeSocket.instance.onmessage!({ data: encoded });
  FakeSocket.instance.onmessage!({ data: JSON.stringify({ type: 'snapshot-delta', data: {} }) });
  await vi.waitFor(() => expect(received).toEqual([1, 2]));
  FakeSocket.instance.onmessage!({ data: JSON.stringify({ type: 'buffered', data: 3 }) });
  FakeSocket.instance.onmessage!({ data: JSON.stringify({ type: 'buffered', data: 4 }) });
  await new Promise((resolve) => setTimeout(resolve, 10));
  room.onMessage('buffered', (value) => received.push(Number(value)));
  expect(received).toEqual([1, 2, 3, 4]);
  await room.leave();
});
afterEach(() => vi.unstubAllGlobals());
