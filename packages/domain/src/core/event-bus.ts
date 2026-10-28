export class EventBus<T> {
  private readonly observers = new Set<(event: T) => void>();
  subscribe(observer: (event: T) => void): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }
  emit(event: T): void {
    for (const observer of this.observers) observer(event);
  }
}
