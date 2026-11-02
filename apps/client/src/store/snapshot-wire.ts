/** Binary snapshots are negotiated gzip frames; JSON replies remain compatible. */
export async function decodeSnapshotMessage(data: string | ArrayBuffer): Promise<string> {
  if (typeof data === 'string') return data;
  return new Response(new Response(data).body!.pipeThrough(new DecompressionStream('gzip'))).text();
}
