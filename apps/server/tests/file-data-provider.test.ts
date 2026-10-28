import { describe, expect, it, vi } from 'vitest';
import { FileDataProvider } from '../src/repositories/file-data-provider.js';
const files = vi.hoisted(() => ({ readFile: vi.fn(), stat: vi.fn() }));
vi.mock('node:fs/promises', () => files);
const dataset = (source: string) =>
  JSON.stringify({
    clubs: { ids: [], byId: {} },
    players: { ids: [], byId: {} },
    stadiums: { ids: [], byId: {} },
    centers: { ids: [], byId: {} },
    source,
    license: 'test',
  });
describe('cache da base de jogadores', () => {
  it('compartilha leituras concorrentes e recarrega quando o arquivo muda', async () => {
    files.stat.mockResolvedValue({ mtimeMs: 1, size: 100 });
    files.readFile.mockResolvedValue(dataset('primeira'));
    const provider = new FileDataProvider('dataset.json');
    const [first, second] = await Promise.all([provider.load(), provider.load()]);
    expect(first.ok).toBe(true);
    expect(second).toBe(first);
    expect(files.readFile).toHaveBeenCalledTimes(1);
    expect(await provider.load()).toBe(first);
    files.stat.mockResolvedValue({ mtimeMs: 2, size: 100 });
    files.readFile.mockResolvedValue(dataset('atualizada'));
    const updated = await provider.load();
    expect(updated.ok && updated.value.source).toBe('atualizada');
    expect(files.readFile).toHaveBeenCalledTimes(2);
  });
  it('permite recuperar uma leitura que falhou', async () => {
    files.stat.mockResolvedValue({ mtimeMs: 3, size: 100 });
    files.readFile.mockRejectedValueOnce(new Error('indisponível'));
    const provider = new FileDataProvider('dataset.json');
    expect((await provider.load()).ok).toBe(false);
    files.readFile.mockResolvedValue(dataset('recuperada'));
    expect((await provider.load()).ok).toBe(true);
  });
});
