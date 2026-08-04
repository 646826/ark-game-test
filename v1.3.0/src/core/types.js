export const NORTH = 1;
export const EAST = 2;
export const SOUTH = 4;
export const WEST = 8;
export const DIRECTIONS = [
    { bit: NORTH, opposite: SOUTH, dx: 0, dy: -1 },
    { bit: EAST, opposite: WEST, dx: 1, dy: 0 },
    { bit: SOUTH, opposite: NORTH, dx: 0, dy: 1 },
    { bit: WEST, opposite: EAST, dx: -1, dy: 0 },
];
//# sourceMappingURL=types.js.map