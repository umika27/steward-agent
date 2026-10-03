/**
 * Navigation Grid Module
 * Phase 8 — Walkability, Obstacle Representation & Pathfinding
 *
 * Lightweight normalized grid (default 40x40) discretizing room space into
 * WALKABLE and BLOCKED cells based on obstacle geometry and safety margins.
 */

export const CELL_TYPES = {
  WALKABLE: 0,
  BLOCKED: 1,
};

export class NavigationGrid {
  constructor(cols = 40, rows = 40) {
    this.cols = cols;
    this.rows = rows;
    this.cellWidth = 1.0 / cols;
    this.cellHeight = 1.0 / rows;
    this.grid = this._createEmptyGrid();
  }

  _createEmptyGrid() {
    const grid = new Array(this.rows);
    for (let r = 0; r < this.rows; r++) {
      grid[r] = new Array(this.cols).fill(CELL_TYPES.WALKABLE);
    }
    return grid;
  }

  /**
   * Rebuilds grid by marking obstacle bounding boxes as BLOCKED
   * @param {Array} obstacles - Array of obstacle objects with bounds { x, y, width, height }
   */
  rasterizeObstacles(obstacles = []) {
    this.grid = this._createEmptyGrid();
    for (const obstacle of obstacles) {
      const bounds = obstacle.bounds || obstacle;
      const startCol = Math.max(0, Math.floor(bounds.x * this.cols));
      const endCol = Math.min(this.cols - 1, Math.floor((bounds.x + bounds.width) * this.cols));
      const startRow = Math.max(0, Math.floor(bounds.y * this.rows));
      const endRow = Math.min(this.rows - 1, Math.floor((bounds.y + bounds.height) * this.rows));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          this.grid[r][c] = CELL_TYPES.BLOCKED;
        }
      }
    }
  }

  buildFromScene(navigationScene) {
    this.rasterizeObstacles(navigationScene?.obstacles || []);
  }

  isCellWalkable(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return false;
    }
    return this.grid[row][col] === CELL_TYPES.WALKABLE;
  }

  isPointWalkable(normX, normY) {
    const cell = this.pointToCell(normX, normY);
    return this.isCellWalkable(cell.col, cell.row);
  }

  isWalkable(pointOrX, normY) {
    if (typeof pointOrX === 'object' && pointOrX !== null) {
      return this.isPointWalkable(pointOrX.x, pointOrX.y);
    }
    return this.isPointWalkable(pointOrX, normY);
  }

  pointToCell(normX, normY) {
    const col = Math.max(0, Math.min(this.cols - 1, Math.floor(normX * this.cols)));
    const row = Math.max(0, Math.min(this.rows - 1, Math.floor(normY * this.rows)));
    return { col, row };
  }

  cellToPoint(col, row) {
    const x = (col + 0.5) * this.cellWidth;
    const y = (row + 0.5) * this.cellHeight;
    return {
      x: Number(Math.max(0.02, Math.min(0.98, x)).toFixed(4)),
      y: Number(Math.max(0.02, Math.min(0.98, y)).toFixed(4)),
    };
  }

  /**
   * Finds nearest walkable cell to target. Accepts either a normalized point {x, y} or (col, row).
   * Returns normalized point {x, y} if a point input was given, or cell {col, row} if cell input was given.
   */
  findNearestWalkableCell(targetArg1, targetArg2 = null, maxRadius = 15) {
    let targetCol, targetRow, isPointInput = false;

    if (typeof targetArg1 === 'object' && targetArg1 !== null) {
      const cell = this.pointToCell(targetArg1.x, targetArg1.y);
      targetCol = cell.col;
      targetRow = cell.row;
      isPointInput = true;
    } else {
      targetCol = targetArg1;
      targetRow = targetArg2;
    }

    if (this.isCellWalkable(targetCol, targetRow)) {
      return isPointInput ? this.cellToPoint(targetCol, targetRow) : { col: targetCol, row: targetRow };
    }

    for (let r = 1; r <= maxRadius; r++) {
      for (let dc = -r; dc <= r; dc++) {
        for (let dr = -r; dr <= r; dr++) {
          if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
          const c = targetCol + dc;
          const row = targetRow + dr;
          if (this.isCellWalkable(c, row)) {
            return isPointInput ? this.cellToPoint(c, row) : { col: c, row };
          }
        }
      }
    }

    return null;
  }
}

