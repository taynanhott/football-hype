export class UsageMeter {
  readonly totals = {
    httpRequests: 0,
    webSocketMessages: 0,
    commands: 0,
    authentications: 0,
    alarms: 0,
    errors: 0,
    receivedBytes: 0,
    sqlStatements: 0,
    rowsRead: 0,
    rowsWritten: 0,
    sentMessages: 0,
    sentBytes: 0,
    fullSnapshots: 0,
    deltaSnapshots: 0,
    alarmWrites: 0,
  };
  constructor(private readonly enabled: boolean) {}
  start() {
    return { ...this.totals, at: performance.now() };
  }
  finish(kind: string, before: ReturnType<UsageMeter['start']>, storageBytes?: number) {
    if (!this.enabled) return;
    console.log(
      JSON.stringify({
        event: 'game.usage',
        kind,
        storageBytes,
        ...Object.fromEntries(
          Object.entries(this.totals).map(([key, value]) => [
            key,
            value - before[key as keyof typeof this.totals],
          ]),
        ),
        elapsedMs: Math.round((performance.now() - before.at) * 100) / 100,
      }),
    );
  }
}
