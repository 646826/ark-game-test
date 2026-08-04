export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
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
    if (this.#state === 0) this.#state = 0x6d2b79f5;
  }

  public next(): number {
    let value = (this.#state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  public int(min: number, maxInclusive: number): number {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot choose from an empty collection.');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  public shuffle<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const other = this.int(0, index);
      [items[index], items[other]] = [items[other] as T, items[index] as T];
    }
    return items;
  }
}
