/**
 * A Set of ids with FIFO eviction — used to de-dupe realtime rows that
 * postgres_changes can redeliver on reconnect. Evicting only the oldest id
 * (rather than clearing everything) means a just-seen id is never forgotten.
 */
export class BoundedSet {
  private set = new Set<string>();
  private order: string[] = [];

  constructor(private cap = 500) {}

  has(id: string): boolean {
    return this.set.has(id);
  }

  add(id: string): void {
    if (this.set.has(id)) return;
    this.set.add(id);
    this.order.push(id);
    if (this.order.length > this.cap) {
      const oldest = this.order.shift();
      if (oldest !== undefined) this.set.delete(oldest);
    }
  }
}
