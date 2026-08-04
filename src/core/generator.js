import { analyzeBoard, canonicalizeMask, directionFromDelta, oppositeDirection, rotationPeriod, rotationsToTarget, tileKey } from './board.js';
import { SeededRandom } from './random.js';
const GENERATOR_VERSION = 1;
const PLANTS = ['aster', 'orchid', 'lotus', 'fern', 'rose'];
export function dailySeed(date = new Date()) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `daily:${year}-${month}-${day}`;
}
export function generatePuzzle(options) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
        const random = new SeededRandom(`${options.seed}|${options.config.tier}|${attempt}`);
        const tree = growTree(options.config, random);
        const leaves = [...tree.values()].filter((node) => node.neighbors.size === 1);
        const source = chooseSource(tree, leaves, options.config, random);
        const plantCandidates = leaves.filter((node) => tileKey(node.x, node.y) !== tileKey(source.x, source.y));
        if (plantCandidates.length < options.config.minPlants) {
            continue;
        }
        const plantCount = Math.min(plantCandidates.length, random.int(options.config.minPlants, Math.min(options.config.maxPlants, plantCandidates.length)));
        const plantKeys = new Set(random.shuffle(plantCandidates).slice(0, plantCount).map((node) => tileKey(node.x, node.y)));
        const tiles = [...tree.values()].map((node) => createTile(node, source, plantKeys, options.config, random));
        const sourceId = idFor(source.x, source.y);
        const definition = {
            seed: options.seed,
            mode: options.mode,
            level: options.level,
            config: options.config,
            tiles,
            sourceId,
            optimalMoves: tiles.reduce((sum, tile) => sum + rotationsToTarget(tile), 0),
            generatedAtVersion: GENERATOR_VERSION,
        };
        if (definition.optimalMoves <= 0 || analyzeBoard(definition).solved) {
            scrambleAgain(definition, random);
        }
        if (definition.optimalMoves > 0 && !analyzeBoard(definition).solved) {
            return {
                ...definition,
                optimalMoves: definition.tiles.reduce((sum, tile) => sum + rotationsToTarget(tile), 0),
            };
        }
    }
    throw new Error(`Unable to generate a valid puzzle for seed ${options.seed}.`);
}
function growTree(config, random) {
    const sourceX = Math.floor(config.cols / 2);
    const sourceY = Math.floor(config.rows / 2);
    const nodes = new Map();
    const source = { x: sourceX, y: sourceY, neighbors: new Set() };
    nodes.set(tileKey(sourceX, sourceY), source);
    while (nodes.size < config.activeCells) {
        const frontier = [];
        for (const parent of nodes.values()) {
            const candidates = [
                [parent.x, parent.y - 1],
                [parent.x + 1, parent.y],
                [parent.x, parent.y + 1],
                [parent.x - 1, parent.y],
            ];
            for (const [x, y] of candidates) {
                if (x < 0 || y < 0 || x >= config.cols || y >= config.rows || nodes.has(tileKey(x, y))) {
                    continue;
                }
                const adjacentCount = countAdjacent(nodes, x, y);
                const branchWeight = parent.neighbors.size === 1 ? 1.55 : parent.neighbors.size === 2 ? 0.95 : 0.35;
                const opennessWeight = adjacentCount === 1 ? 1.35 : adjacentCount === 2 ? 0.8 : 0.4;
                const edgeDistance = Math.min(x, y, config.cols - 1 - x, config.rows - 1 - y);
                frontier.push({ parent, x, y, weight: branchWeight * opennessWeight * (1 + edgeDistance * 0.06) });
            }
        }
        if (frontier.length === 0) {
            break;
        }
        const chosen = weightedPick(frontier, random);
        const child = { x: chosen.x, y: chosen.y, neighbors: new Set() };
        const parentKey = tileKey(chosen.parent.x, chosen.parent.y);
        const childKey = tileKey(child.x, child.y);
        child.neighbors.add(parentKey);
        chosen.parent.neighbors.add(childKey);
        nodes.set(childKey, child);
    }
    return nodes;
}
function countAdjacent(nodes, x, y) {
    let count = 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        if (nodes.has(tileKey(x + dx, y + dy))) {
            count += 1;
        }
    }
    return count;
}
function weightedPick(items, random) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let cursor = random.next() * total;
    for (const item of items) {
        cursor -= item.weight;
        if (cursor <= 0) {
            return item;
        }
    }
    return items[items.length - 1];
}
function chooseSource(tree, leaves, config, random) {
    const centerX = (config.cols - 1) / 2;
    const centerY = (config.rows - 1) / 2;
    const leafKeys = new Set(leaves.map((leaf) => tileKey(leaf.x, leaf.y)));
    const candidates = [...tree.values()]
        .filter((node) => !leafKeys.has(tileKey(node.x, node.y)) && node.neighbors.size >= 2)
        .sort((a, b) => {
        const distanceA = Math.hypot(a.x - centerX, a.y - centerY);
        const distanceB = Math.hypot(b.x - centerX, b.y - centerY);
        return distanceA - distanceB;
    });
    const shortlist = candidates.slice(0, Math.min(5, candidates.length));
    return shortlist.length > 0 ? random.pick(shortlist) : [...tree.values()][0];
}
function createTile(node, source, plantKeys, config, random) {
    let solutionMask = 0;
    for (const neighborKey of node.neighbors) {
        const [neighborX, neighborY] = neighborKey.split(':').map(Number);
        solutionMask |= directionFromDelta(neighborX - node.x, neighborY - node.y);
    }
    const { baseMask, targetRotation } = canonicalizeMask(solutionMask);
    const key = tileKey(node.x, node.y);
    const isSource = node.x === source.x && node.y === source.y;
    const isPlant = plantKeys.has(key);
    const period = rotationPeriod(baseMask);
    const fixed = isSource || period === 1 || random.bool(config.fixedChance);
    let rotation = targetRotation;
    if (!fixed && !random.bool(config.preSolvedChance)) {
        rotation = (targetRotation + random.int(1, period - 1)) % period;
    }
    const common = {
        id: idFor(node.x, node.y),
        x: node.x,
        y: node.y,
        kind: isSource ? 'source' : isPlant ? 'plant' : 'path',
        baseMask,
        solutionMask,
        targetRotation,
        fixed,
        rotation,
        visualTurns: rotation,
    };
    if (isPlant) {
        return { ...common, kind: 'plant', plantKind: random.pick(PLANTS) };
    }
    return common;
}
function scrambleAgain(puzzle, random) {
    for (let pass = 0; pass < 24; pass += 1) {
        for (const tile of puzzle.tiles) {
            const period = rotationPeriod(tile.baseMask);
            if (tile.fixed || period === 1) {
                tile.rotation = tile.targetRotation;
            }
            else {
                tile.rotation = (tile.targetRotation + random.int(0, period - 1)) % period;
            }
            tile.visualTurns = tile.rotation;
        }
        if (!analyzeBoard(puzzle).solved && puzzle.tiles.some((tile) => rotationsToTarget(tile) > 0)) {
            return;
        }
    }
}
function idFor(x, y) {
    return `tile-${x}-${y}`;
}
export function applySolution(puzzle) {
    for (const tile of puzzle.tiles) {
        tile.rotation = tile.targetRotation;
        tile.visualTurns = tile.targetRotation;
    }
}
export function validateSolutionTopology(puzzle) {
    const original = puzzle.tiles.map((tile) => tile.rotation);
    for (const tile of puzzle.tiles) {
        tile.rotation = tile.targetRotation;
    }
    const valid = analyzeBoard(puzzle).solved;
    puzzle.tiles.forEach((tile, index) => {
        tile.rotation = original[index];
    });
    return valid;
}
export function solutionDistanceMap(puzzle) {
    const byCoordinate = new Map(puzzle.tiles.map((tile) => [tileKey(tile.x, tile.y), tile]));
    const byId = new Map(puzzle.tiles.map((tile) => [tile.id, tile]));
    const source = byId.get(puzzle.sourceId);
    const distances = new Map();
    if (!source) {
        return distances;
    }
    distances.set(source.id, 0);
    const queue = [source];
    while (queue.length > 0) {
        const tile = queue.shift();
        const distance = distances.get(tile.id);
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const direction = directionFromDelta(dx, dy);
            if ((tile.solutionMask & direction) === 0) {
                continue;
            }
            const neighbor = byCoordinate.get(tileKey(tile.x + dx, tile.y + dy));
            if (!neighbor || (neighbor.solutionMask & oppositeDirection(direction)) === 0 || distances.has(neighbor.id)) {
                continue;
            }
            distances.set(neighbor.id, distance + 1);
            queue.push(neighbor);
        }
    }
    return distances;
}
//# sourceMappingURL=generator.js.map