/**
 * Path Smoother Module
 * Phase 8 — Walkability, Obstacle Representation & Pathfinding
 *
 * Simplifies raw A* grid-step paths using Line-of-Sight (Bresenham grid raycasting)
 * to remove redundant intermediate waypoints and produce clean, natural paths.
 */

/**
 * Checks line-of-sight between two normalized points on a NavigationGrid
 *
 * @param {Object} p1 - { x, y } in [0..1]
 * @param {Object} p2 - { x, y } in [0..1]
 * @param {NavigationGrid} grid
 * @returns {boolean} True if straight line is completely walkable
 */
export function hasLineOfSight(p1, p2, grid) {
  if (!p1 || !p2 || !grid) return false;

  const cell1 = grid.pointToCell(p1.x, p1.y);
  const cell2 = grid.pointToCell(p2.x, p2.y);

  let x0 = cell1.col;
  let y0 = cell1.row;
  const x1 = cell2.col;
  const y1 = cell2.row;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (!grid.isCellWalkable(x0, y0)) {
      return false;
    }

    if (x0 === x1 && y0 === y1) {
      break;
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return true;
}

/**
 * Smooths an array of waypoints by removing redundant collinear/unobstructed waypoints
 *
 * @param {Array} rawWaypoints - Array of normalized points [{x,y}, ...]
 * @param {NavigationGrid} grid
 * @returns {Array} Simplified array of normalized waypoints
 */
export function smoothPath(rawWaypoints, grid) {
  if (!Array.isArray(rawWaypoints) || rawWaypoints.length <= 2) {
    return rawWaypoints || [];
  }

  const smoothed = [rawWaypoints[0]];
  let currentIdx = 0;

  while (currentIdx < rawWaypoints.length - 1) {
    let farthestIdx = currentIdx + 1;

    // Look ahead as far as possible with line of sight
    for (let testIdx = rawWaypoints.length - 1; testIdx > currentIdx + 1; testIdx--) {
      if (hasLineOfSight(rawWaypoints[currentIdx], rawWaypoints[testIdx], grid)) {
        farthestIdx = testIdx;
        break;
      }
    }

    smoothed.push(rawWaypoints[farthestIdx]);
    currentIdx = farthestIdx;
  }

  return smoothed;
}
