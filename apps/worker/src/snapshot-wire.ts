function smallJsonTree(value: unknown): boolean {
  const pending = [value];
  let nodes = 0,
    characters = 0;
  while (pending.length) {
    if (++nodes > 256) return false;
    const item = pending.pop();
    if (typeof item === 'string') characters += item.length;
    else if (item && typeof item === 'object') {
      const children = Object.values(item);
      if (children.length + pending.length > 256) return false;
      pending.push(...children);
    }
    if (characters > 16384) return false;
  }
  return true;
}
function* jsonParts(value: unknown, depth = 0): Generator<string> {
  if (depth >= 3 && value && typeof value === 'object' && smallJsonTree(value)) {
    yield JSON.stringify(value);
    return;
  }
  if (!value || typeof value !== 'object') {
    yield JSON.stringify(value) ?? 'null';
  } else if (Array.isArray(value)) {
    if (value.length <= 64 && value.every((item) => item === null || typeof item !== 'object')) {
      yield JSON.stringify(value);
      return;
    }
    yield '[';
    for (let index = 0; index < value.length; index++) {
      if (index) yield ',';
      yield* jsonParts(value[index] ?? null, depth + 1);
    }
    yield ']';
  } else {
    yield '{';
    let first = true;
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      if (!first) yield ',';
      first = false;
      yield JSON.stringify(key) + ':';
      yield* jsonParts(child, depth + 1);
    }
    yield '}';
  }
}

/** Stream negotiated large snapshots into gzip without a full JSON/UTF-8 copy. */
export async function encodeSnapshotMessage(
  type: string,
  data: unknown,
  compressed: boolean,
): Promise<string | ArrayBuffer> {
  if (!compressed) return JSON.stringify({ type, data });
  const parts = jsonParts({ type, data });
  let buffer = '';
  let complete = false;
  while (buffer.length < 131072) {
    const part = parts.next();
    if (part.done) {
      complete = true;
      break;
    }
    buffer += part.value;
  }
  if (complete) return buffer;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      while (buffer.length < 32768 && !complete) {
        const part = parts.next();
        if (part.done) complete = true;
        else buffer += part.value;
      }
      if (!buffer.length) {
        controller.close();
        return;
      }
      // Avoid splitting a UTF-16 surrogate pair across UTF-8 chunks.
      let end = Math.min(32768, buffer.length);
      const last = buffer.charCodeAt(end - 1);
      if (end < buffer.length && last >= 0xd800 && last <= 0xdbff) end--;
      controller.enqueue(encoder.encode(buffer.slice(0, end)));
      buffer = buffer.slice(end);
    },
  }).pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}
