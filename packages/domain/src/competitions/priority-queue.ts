export class PriorityQueue<T> {
  private readonly heap: T[] = [];
  constructor(private readonly compare: (left: T, right: T) => number) {}
  get size(): number {
    return this.heap.length;
  }
  peek(): T | undefined {
    return this.heap[0];
  }
  push(value: T): void {
    this.heap.push(value);
    let index = this.heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const current = this.heap[index];
      const ancestor = this.heap[parent];
      if (current === undefined || ancestor === undefined || this.compare(current, ancestor) >= 0)
        break;
      [this.heap[index], this.heap[parent]] = [ancestor, current];
      index = parent;
    }
  }
  pop(): T | undefined {
    const first = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length && last !== undefined) {
      this.heap[0] = last;
      let parent = 0;
      while (true) {
        let next = parent;
        for (const child of [parent * 2 + 1, parent * 2 + 2]) {
          const candidate = this.heap[child];
          const best = this.heap[next];
          if (candidate !== undefined && best !== undefined && this.compare(candidate, best) < 0)
            next = child;
        }
        if (next === parent) break;
        const current = this.heap[parent];
        const best = this.heap[next];
        if (current === undefined || best === undefined) break;
        [this.heap[parent], this.heap[next]] = [best, current];
        parent = next;
      }
    }
    return first;
  }
}
