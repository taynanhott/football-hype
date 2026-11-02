/** Gzip only negotiated large snapshots; small replies and older clients keep JSON. */
export async function encodeSnapshotMessage(
  type: string,
  data: unknown,
  compressed: boolean,
): Promise<string | ArrayBuffer> {
  const payload = JSON.stringify({ type, data });
  if (!compressed || payload.length < 131072) return payload;
  const stream = new Response(payload).body!.pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}
