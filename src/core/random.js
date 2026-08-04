/** Small deterministic PRNG based on xmur3 + mulberry32. */
export function hashSeed(input) {
    let hash = 1779033703 ^ input.length;
    for (let index = 0; index < input.length; index += 1) {
        hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
        hash = (hash << 13) | (hash >>> 19);
    }
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^ (hash >>> 16)) >>> 0;
}
export class SeededRandom {
    #state;
    constructor(seed) {
        this.#state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
    }
    next() {
        let value = (this.#state += 0x6d2b79f5);
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }
    int(minInclusive, maxInclusive) {
        return Math.floor(this.next() * (maxInclusive - minInclusive + 1)) + minInclusive;
    }
    bool(chance = 0.5) {
        return this.next() < chance;
    }
    pick(items) {
        if (items.length === 0) {
            throw new Error('Cannot pick from an empty collection.');
        }
        return items[Math.floor(this.next() * items.length)];
    }
    shuffle(items) {
        const result = [...items];
        for (let index = result.length - 1; index > 0; index -= 1) {
            const other = this.int(0, index);
            [result[index], result[other]] = [result[other], result[index]];
        }
        return result;
    }
}
//# sourceMappingURL=random.js.map