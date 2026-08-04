export function hashSeed(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

export class Random {
  #state: number;

  public constructor(seed: string | number) {
    this.#state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
    if (this.#state === 0) this.#state = 0x9e3779b9;
  }

  public next(): number {
    let x = this.#state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.#state = x >>> 0;
    return this.#state / 0x1_0000_0000;
  }

  public integer(min: number, maxInclusive: number): number {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot choose from an empty list.');
    return items[this.integer(0, items.length - 1)] as T;
  }

  public shuffle<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const other = this.integer(0, index);
      [items[index], items[other]] = [items[other] as T, items[index] as T];
    }
    return items;
  }
}
