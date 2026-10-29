export interface GameRoom {
  send(type: string, data?: unknown): void;
  onMessage(type: string, handler: (input: unknown) => void): void;
  onError(handler: () => void): void;
  onLeave(handler: () => void): void;
  leave(): Promise<unknown>;
}
export async function connectWorker(url: string, options: unknown): Promise<GameRoom> {
  const ws = new WebSocket(url.replace(/\/$/, '') + '/socket');
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
      for (let i = buffered.length - 1; i >= 0; i--)
        if (buffered[i]!.type === type) {
          const [message] = buffered.splice(i, 1);
          handler(message!.data);
        }
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
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { type: string; data: unknown };
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
        for (const handler of errors) handler();
      }
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      if (!ready) reject(new Error('Falha na conexão com o servidor'));
      for (const handler of errors) handler();
    };
    ws.onclose = () => {
      clearTimeout(timeout);
      if (!ready) reject(new Error('Conexão encerrada'));
      for (const handler of leaves) handler();
    };
  });
  return room;
}
