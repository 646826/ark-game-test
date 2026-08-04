export function hashSeed(value) {
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
    #state;
    constructor(seed) {
        this.#state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
        if (this.#state === 0)
            this.#state = 0x9e3779b9;
    }
    next() {
        let x = this.#state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.#state = x >>> 0;
        return this.#state / 0x1_0000_0000;
    }
    integer(min, maxInclusive) {
        return min + Math.floor(this.next() * (maxInclusive - min + 1));
    }
    pick(items) {
        if (items.length === 0)
            throw new Error('Cannot choose from an empty list.');
        return items[this.integer(0, items.length - 1)];
    }
    shuffle(items) {
        for (let index = items.length - 1; index > 0; index -= 1) {
            const other = this.integer(0, index);
            [items[index], items[other]] = [items[other], items[index]];
        }
        return items;
    }
}
//# sourceMappingURL=random.js.map