var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Random_state;
export function hashSeed(seed) {
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
    constructor(seed) {
        _Random_state.set(this, void 0);
        __classPrivateFieldSet(this, _Random_state, typeof seed === 'number' ? seed >>> 0 : hashSeed(seed), "f");
        if (__classPrivateFieldGet(this, _Random_state, "f") === 0)
            __classPrivateFieldSet(this, _Random_state, 0x6d2b79f5, "f");
    }
    next() {
        let value = (__classPrivateFieldSet(this, _Random_state, __classPrivateFieldGet(this, _Random_state, "f") + 0x6d2b79f5, "f"));
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }
    int(min, maxInclusive) {
        return min + Math.floor(this.next() * (maxInclusive - min + 1));
    }
    pick(items) {
        if (items.length === 0)
            throw new Error('Cannot choose from an empty collection.');
        return items[Math.floor(this.next() * items.length)];
    }
    shuffle(items) {
        for (let index = items.length - 1; index > 0; index -= 1) {
            const other = this.int(0, index);
            [items[index], items[other]] = [items[other], items[index]];
        }
        return items;
    }
}
_Random_state = new WeakMap();
//# sourceMappingURL=random.js.map