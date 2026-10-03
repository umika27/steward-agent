/**
 * Pathfinder Module
 * Phase 8 — Walkability, Obstacle Representation & Pathfinding
 *
 * Implements A* pathfinding with 8-direction movement, corner-cutting prevention,
 * and Euclidean/Octile heuristic estimation over NavigationGrid.
 */

class Node {
  constructor(col, row, g = 0, h = 0, parent = null) {
    this.col = col;
    this.row = row;
    this.g = g; // Path cost from start
    this.h = h; // Heuristic cost to goal
    this.f = g + h; // Total estimated cost
    this.parent = parent;
  }
}

function octileDistance(c1, r1, c2, r2) {
  const dc = Math.abs(c1 - c2);
  const dr = Math.abs(r1 - r2);
  return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr);
}

/**
 * Executes A* pathfinding on a NavigationGrid between start and goal points
 * Supports either (grid, startNorm, goalNorm) or (startNorm, goalNorm, grid)
 *
 * @param {NavigationGrid|Object} arg1
 * @param {Object} arg2
 * @param {Object|NavigationGrid} arg3
 * @returns {Array|null} Array of normalized waypoints [{x,y}, ...] or null if NO_PATH
 */
export function findPathAStar(arg1, arg2, arg3) {
  let grid, startNorm, goalNorm;

  if (arg1 && typeof arg1.isCellWalkable === 'function') {
    grid = arg1;
    startNorm = arg2;
    goalNorm = arg3;
  } else {
    startNorm = arg1;
    goalNorm = arg2;
    grid = arg3;
  }

  if (!startNorm || !goalNorm || !grid) return null;

  let startCell = grid.pointToCell(startNorm.x, startNorm.y);
  let goalCell = grid.pointToCell(goalNorm.x, goalNorm.y);

  // Validate start cell walkability; find nearest if blocked
  if (!grid.isCellWalkable(startCell.col, startCell.row)) {
    const validStart = grid.findNearestWalkableCell(startCell.col, startCell.row);
    if (!validStart) return null;
    startCell = grid.pointToCell(validStart.x !== undefined ? validStart.x : startNorm.x, validStart.y !== undefined ? validStart.y : startNorm.y);
  }

  // Validate goal cell walkability; find nearest if blocked
  if (!grid.isCellWalkable(goalCell.col, goalCell.row)) {
    const validGoal = grid.findNearestWalkableCell(goalCell.col, goalCell.row);
    if (!validGoal) return null;
    goalCell = grid.pointToCell(validGoal.x !== undefined ? validGoal.x : goalNorm.x, validGoal.y !== undefined ? validGoal.y : goalNorm.y);
  }

  // Same start and goal cell
  if (startCell.col === goalCell.col && startCell.row === goalCell.row) {
    return [grid.cellToPoint(goalCell.col, goalCell.row)];
  }

  const openList = [];
  const closedSet = new Set();
  const nodeMap = new Map();

  const startKey = `${startCell.col}_${startCell.row}`;
  const startNode = new Node(
    startCell.col,
    startCell.row,
    0,
    octileDistance(startCell.col, startCell.row, goalCell.col, goalCell.row)
  );

  openList.push(startNode);
  nodeMap.set(startKey, startNode);

  // 8 Directional offsets: [dCol, dRow, cost]
  const neighbors = [
    [0, -1, 1], // North
    [1, 0, 1], // East
    [0, 1, 1], // South
    [-1, 0, 1], // West
    [1, -1, Math.SQRT2], // North-East
    [1, 1, Math.SQRT2], // South-East
    [-1, 1, Math.SQRT2], // South-West
    [-1, -1, Math.SQRT2], // North-West
  ];

  let iterations = 0;
  const maxIterations = 2500; // Safety threshold

  while (openList.length > 0 && iterations < maxIterations) {
    iterations++;

    // Extract node with lowest F score
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift();
    const currentKey = `${current.col}_${current.row}`;

    if (current.col === goalCell.col && current.row === goalCell.row) {
      // Reconstruct path from target to start
      const pathCells = [];
      let curr = current;
      while (curr) {
        pathCells.unshift(grid.cellToPoint(curr.col, curr.row));
        curr = curr.parent;
      }
      return pathCells;
    }

    closedSet.add(currentKey);

    for (const [dc, dr, cost] of neighbors) {
      const neighborCol = current.col + dc;
      const neighborRow = current.row + dr;
      const neighborKey = `${neighborCol}_${neighborRow}`;

      if (!grid.isCellWalkable(neighborCol, neighborRow) || closedSet.has(neighborKey)) {
        continue;
      }

      // Corner-cutting prevention: do not allow diagonal move if adjacent cardinal cells are blocked
      if (dc !== 0 && dr !== 0) {
        const card1Walkable = grid.isCellWalkable(current.col + dc, current.row);
        const card2Walkable = grid.isCellWalkable(current.col, current.row + dr);
        if (!card1Walkable || !card2Walkable) {
          continue;
        }
      }

      const tentativeG = current.g + cost;
      let neighborNode = nodeMap.get(neighborKey);

      if (!neighborNode) {
        const h = octileDistance(neighborCol, neighborRow, goalCell.col, goalCell.row);
        neighborNode = new Node(neighborCol, neighborRow, tentativeG, h, current);
        nodeMap.set(neighborKey, neighborNode);
        openList.push(neighborNode);
      } else if (tentativeG < neighborNode.g) {
        neighborNode.g = tentativeG;
        neighborNode.f = tentativeG + neighborNode.h;
        neighborNode.parent = current;
      }
    }
  }

  // No path found after max search iterations
  return null;
}

