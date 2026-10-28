class Node {
  readonly children = new Map<string, Node>();
  readonly ids = new Set<string>();
}
export class SearchTrie {
  private readonly root = new Node();
  private readonly names = new Map<string, Set<string>>();
  insert(text: string, id: string): void {
    const names = this.names.get(id) ?? new Set<string>();
    names.add(normalize(text));
    this.names.set(id, names);
    let node = this.root;
    node.ids.add(id);
    for (const character of normalize(text)) {
      let child = node.children.get(character);
      if (!child) {
        child = new Node();
        node.children.set(character, child);
      }
      node = child;
      node.ids.add(id);
    }
  }
  search(prefix: string): readonly string[] {
    let node: Node | undefined = this.root;
    for (const character of normalize(prefix)) node = node?.children.get(character);
    const query = normalize(prefix),
      words = query.split(/\s+/);
    const matches = [...(node?.ids ?? [])];
    const matched = new Set(matches);
    for (const [id, names] of this.names) {
      if (matched.has(id)) continue;
      if (
        [...names].some((name) =>
          words.every(
            (word) =>
              name.includes(word) ||
              name.split(/\s+/).some((token) => word.length >= 4 && oneEdit(word, token)),
          ),
        )
      )
        matches.push(id);
    }
    return Object.freeze(matches);
  }
}
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function oneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
