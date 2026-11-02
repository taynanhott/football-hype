import { decodeSnapshotMessage } from './snapshot-wire';

export interface GameRoom {
  send(type: string, data?: unknown): void;
  onMessage(type: string, handler: (input: unknown) => void): void;
  onError(handler: () => void): void;
  onLeave(handler: () => void): void;
  leave(): Promise<unknown>;
}
export async function connectWorker(url: string, options: unknown): Promise<GameRoom> {
  const ws = new WebSocket(url.replace(/\/$/, '') + '/socket');
  ws.binaryType = 'arraybuffer';
  const handlers = new Map<string, ((input: unknown) => void)[]>();
  const errors: (() => void)[] = [];
  const leaves: (() => void)[] = [];
  const buffered: { type: string; data: unknown }[] = [];
  const room: GameRoom = {
    send(type, data) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, data }));
    },
    onMessage(type, handler) {
      handlers.set(type, [...(handlers.get(type) ?? []), handler]);
      for (let i = 0; i < buffered.length;)
        if (buffered[i]!.type === type) {
          const [message] = buffered.splice(i, 1);
          handler(message!.data);
        } else i++;
    },
    onError(handler) {
      errors.push(handler);
    },
    onLeave(handler) {
      leaves.push(handler);
    },
    async leave() {
      ws.close(1000);
    },
  };
  await new Promise<void>((resolve, reject) => {
    let ready = false;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Tempo de conexão excedido'));
    }, 20000);
    ws.onopen = () => room.send('auth', options);
    let incoming = Promise.resolve();
    ws.onmessage = (event) => {
      incoming = incoming.then(async () => {
        if (event.data === 'pong') return;
        try {
          const message = JSON.parse(
            await decodeSnapshotMessage(event.data as string | ArrayBuffer),
          ) as { type: string; data: unknown };
          if (message.type === 'ready') {
            ready = true;
            clearTimeout(timeout);
            resolve();
            return;
          }
          if (!ready && message.type === 'error') {
            clearTimeout(timeout);
            reject(new Error((message.data as { message: string }).message));
            ws.close();
            return;
          }
          const listeners = handlers.get(message.type);
          if (listeners?.length) for (const handler of listeners) handler(message.data);
          else if (buffered.length < 10) buffered.push(message);
        } catch {
          if (!ready) {
            clearTimeout(timeout);
            reject(new Error('Não foi possível receber os dados da carreira'));
            ws.close();
          }
          for (const handler of errors) handler();
        }
      });
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      if (!ready) reject(new Error('Falha na conexão com o servidor'));
      for (const handler of errors) handler();
    };
    ws.onclose = (event) => {
      clearTimeout(timeout);
      if (!ready)
        reject(
          new Error(
            `Conexão encerrada (código ${event.code})${event.reason ? `: ${event.reason}` : '. O servidor não informou o motivo.'}`,
          ),
        );
      for (const handler of leaves) handler();
    };
  });
  return room;
}
