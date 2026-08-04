export const Direction = {
    North: 1,
    East: 2,
    South: 4,
    West: 8,
};
export const DIRECTIONS = [
    { bit: Direction.North, opposite: Direction.South, dx: 0, dy: -1, name: 'north' },
    { bit: Direction.East, opposite: Direction.West, dx: 1, dy: 0, name: 'east' },
    { bit: Direction.South, opposite: Direction.North, dx: 0, dy: 1, name: 'south' },
    { bit: Direction.West, opposite: Direction.East, dx: -1, dy: 0, name: 'west' },
];
//# sourceMappingURL=types.js.map