/**
 * Butler Navigation Engine
 * Phase 8 — Walkability, Obstacle Representation & Pathfinding
 *
 * Scene-aware pathfinding module that routes the Butler around detected room obstacles
 * using normalized navigation scene geometry, A* search, and path smoothing.
 *
 * Public API remains compatible with Phase 4/5 callers (TaskEngine, ConversationDemo).
 */

import { normalizedToScreenPoint } from '../scene/sceneCoordinateMapper';
import { buildNavigationScene } from './navigationScene';
import { NavigationGrid } from './navigationGrid';
import { findPathAStar } from './pathfinder';
import { smoothPath } from './pathSmoother';
import { globalSceneAnalyzer } from '../scene/sceneStore';

export const NAVIGATION_STATES = {
  IDLE: 'IDLE',
  MOVING: 'MOVING',
  ARRIVED: 'ARRIVED',
  CANCELLED: 'CANCELLED',
  ERROR: 'ERROR',
  NO_PATH: 'NO_PATH',
};

export const NAVIGATION_EVENT_TYPES = {
  BUTLER_NAVIGATION_STARTED: 'BUTLER_NAVIGATION_STARTED',
  BUTLER_NAVIGATION_ARRIVED: 'BUTLER_NAVIGATION_ARRIVED',
  BUTLER_NAVIGATION_CANCELLED: 'BUTLER_NAVIGATION_CANCELLED',
  BUTLER_NAVIGATION_ERROR: 'BUTLER_NAVIGATION_ERROR',
  BUTLER_NAVIGATION_NO_PATH: 'BUTLER_NAVIGATION_NO_PATH',
};

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class ButlerNavigator {
  constructor(initialNormPos = { x: 0.5, y: 0.75 }) {
    this.state = NAVIGATION_STATES.IDLE;
    this.currentNormalizedPos = { ...initialNormPos };
    this.homeNormalizedPos = { ...initialNormPos };

    this.semanticTarget = null;
    this.navigationGoal = null;
    this.targetNormalizedPos = null; // Alias for backward compatibility
    this.targetObject = null;

    this.rawPath = [];
    this.smoothedPath = [];
    this.currentWaypointIndex = 0;
    this.navigationGrid = null;

    this.animFrameId = null;
    this.activeResolve = null;
    this.listeners = new Set();
    this.arrivalToleranceNorm = 0.01;
  }

  /**
   * Subscribes a listener callback to navigation state changes & events
   * @param {Function} callback - (event, navigatorState) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  _notify(event) {
    const currentState = this.getNavigationStateSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(event, currentState);
      } catch (err) {
        console.error('ButlerNavigator Listener Error:', err);
      }
    });
  }

  /**
   * Sets initial or new home position
   */
  setHomePosition(normPos) {
    if (normPos && typeof normPos.x === 'number' && typeof normPos.y === 'number') {
      this.homeNormalizedPos = { ...normPos };
    }
  }

  getNavigationState() {
    return this.state;
  }

  getCurrentNormalizedPosition() {
    return { ...this.currentNormalizedPos };
  }

  getTargetNormalizedPosition() {
    return this.navigationGoal ? { ...this.navigationGoal } : null;
  }

  getTargetObject() {
    return this.targetObject ? { ...this.targetObject } : null;
  }

  getNavigationStateSnapshot() {
    return {
      state: this.state,
      currentNormalizedPos: { ...this.currentNormalizedPos },
      homeNormalizedPos: { ...this.homeNormalizedPos },
      semanticTarget: this.semanticTarget ? { ...this.semanticTarget } : null,
      navigationGoal: this.navigationGoal ? { ...this.navigationGoal } : null,
      targetNormalizedPos: this.navigationGoal ? { ...this.navigationGoal } : null,
      targetObject: this.targetObject ? { ...this.targetObject } : null,
      rawPath: [...this.rawPath],
      smoothedPath: [...this.smoothedPath],
      currentWaypointIndex: this.currentWaypointIndex,
      navigationGrid: this.navigationGrid,
    };
  }

  /**
   * Resets scene pathfinding state when dynamic scene changes or image is re-analyzed
   */
  resetScene() {
    this.cancelNavigation();
    this.rawPath = [];
    this.smoothedPath = [];
    this.currentWaypointIndex = 0;
    this.navigationGrid = null;
    this.semanticTarget = null;
    this.navigationGoal = null;
    this.targetObject = null;
    this.state = NAVIGATION_STATES.IDLE;
  }

  /**
   * Cancels any active navigation
   */
  cancelNavigation() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.activeResolve) {
      const resolve = this.activeResolve;
      this.activeResolve = null;
      resolve(false);
    }

    if (this.state === NAVIGATION_STATES.MOVING) {
      this.state = NAVIGATION_STATES.CANCELLED;
      this._notify({
        type: NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_CANCELLED,
        targetObject: this.targetObject ? { ...this.targetObject } : null,
        position: { ...this.currentNormalizedPos },
      });
    }
  }

  /**
   * Primary Navigation Entrypoint: Navigates Butler toward a detected scene object using A* pathfinding.
   *
   * @param {Object} sceneObject - Normalized scene object from Phase 1+2 pipeline
   * @param {Function} updatePixelPosCallback - Callback to update Butler group screen position
   * @param {Object} geometryContext - Screen layout context
   * @param {Object} [sceneStateOverride] - Optional active SceneState override
   * @returns {Promise<boolean>} Resolves true if arrived cleanly
   */
  navigateTo(sceneObject, updatePixelPosCallback, geometryContext, sceneStateOverride = null) {
    if (!sceneObject || !sceneObject.normalizedInteractionPoint) {
      this.state = NAVIGATION_STATES.ERROR;
      this._notify({
        type: NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_ERROR,
        error: 'Invalid scene object or missing normalizedInteractionPoint',
      });
      return Promise.resolve(false);
    }

    const sceneState = sceneStateOverride || globalSceneAnalyzer.getSceneState();
    const semanticTarget = { ...sceneObject.normalizedInteractionPoint };

    return this._planAndNavigate(semanticTarget, updatePixelPosCallback, geometryContext, sceneObject, sceneState);
  }

  /**
   * Navigates Butler back to home position using pathfinding
   */
  returnHome(updatePixelPosCallback, geometryContext, sceneStateOverride = null) {
    const sceneState = sceneStateOverride || globalSceneAnalyzer.getSceneState();
    const semanticTarget = { ...this.homeNormalizedPos };

    return this._planAndNavigate(semanticTarget, updatePixelPosCallback, geometryContext, null, sceneState);
  }

  /**
   * Orchestrates scene model building, grid rasterization, A* search, path smoothing & waypoint execution.
   */
  _planAndNavigate(semanticTarget, updatePixelPosCallback, geometryContext, sceneObject, sceneState) {
    // 1. Cancel existing active navigation loop
    if (this.state === NAVIGATION_STATES.MOVING || this.animFrameId) {
      this.cancelNavigation();
    }

    this.targetObject = sceneObject || null;
    this.semanticTarget = { ...semanticTarget };

    // 2. Build Navigation Scene Model from active SceneState
    const navScene = buildNavigationScene(sceneState);

    // 3. Create Navigation Grid & rasterize obstacles with safety margin
    const grid = new NavigationGrid(40, 40);
    grid.rasterizeObstacles(navScene.obstacles);
    this.navigationGrid = grid;

    // 4. Start & Goal Validation
    const startPoint = { ...this.currentNormalizedPos };

    // Ensure goal is inside navigable space (Part 7 & Part 8 interaction point adjustment)
    const navigationGoal = grid.findNearestWalkableCell(semanticTarget);

    if (!navigationGoal) {
      // Goal is trapped in wall/obstacle with no walkable neighbors
      this.state = NAVIGATION_STATES.NO_PATH;
      this.navigationGoal = null;
      this.targetNormalizedPos = null;
      this.rawPath = [];
      this.smoothedPath = [];
      this._notify({
        type: NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_NO_PATH,
        targetObjectId: sceneObject?.id || null,
        targetLabel: sceneObject?.label || 'Target',
      });
      return Promise.resolve(false);
    }

    this.navigationGoal = { ...navigationGoal };
    this.targetNormalizedPos = { ...navigationGoal };

    // 5. Run A* Pathfinding
    const rawPath = findPathAStar(grid, startPoint, navigationGoal);

    if (!rawPath || rawPath.length === 0) {
      this.state = NAVIGATION_STATES.NO_PATH;
      this.rawPath = [];
      this.smoothedPath = [];
      this._notify({
        type: NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_NO_PATH,
        targetObjectId: sceneObject?.id || null,
        targetLabel: sceneObject?.label || 'Target',
      });
      return Promise.resolve(false);
    }

    // 6. Path Validation (Part 17)
    const isPathValid = rawPath.every((pt) => {
      if (pt.x < 0 || pt.x > 1 || pt.y < 0 || pt.y > 1) return false;
      return grid.isWalkable(pt);
    });

    if (!isPathValid) {
      this.state = NAVIGATION_STATES.ERROR;
      this.rawPath = [];
      this.smoothedPath = [];
      this._notify({
        type: NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_ERROR,
        error: 'Path validation failed: waypoint out of bounds or blocked',
      });
      return Promise.resolve(false);
    }

    // 7. Path Smoothing (Part 9)
    const smoothedPath = smoothPath(rawPath, grid);

    this.rawPath = rawPath;
    this.smoothedPath = smoothedPath;
    this.currentWaypointIndex = 0;

    this.state = NAVIGATION_STATES.MOVING;

    this._notify({
      type: NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_STARTED,
      targetObjectId: sceneObject?.id || null,
      targetLabel: sceneObject?.label || 'Target',
      position: { ...startPoint },
      targetPosition: { ...navigationGoal },
      semanticTarget: { ...semanticTarget },
      pathLength: smoothedPath.length,
    });

    // 8. Execute Waypoint Traversal
    return this._followWaypoints(smoothedPath, updatePixelPosCallback, geometryContext, sceneObject);
  }

  /**
   * Traverses a series of waypoints sequentially using requestAnimationFrame.
   */
  _followWaypoints(waypoints, updatePixelPosCallback, geometryContext, sceneObject) {
    if (waypoints.length <= 1) {
      // Already at target or single waypoint
      if (waypoints.length === 1) {
        this.currentNormalizedPos = { ...waypoints[0] };
      }
      this.state = NAVIGATION_STATES.ARRIVED;
      this._notify({
        type: NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_ARRIVED,
        targetObjectId: sceneObject?.id || null,
        targetLabel: sceneObject?.label || 'Target',
        position: { ...this.currentNormalizedPos },
      });
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      this.activeResolve = resolve;

      let waypointIdx = 0;
      this.currentWaypointIndex = waypointIdx;

      const animateSegment = () => {
        if (this.state !== NAVIGATION_STATES.MOVING) {
          if (this.activeResolve) {
            const res = this.activeResolve;
            this.activeResolve = null;
            res(false);
          }
          return;
        }

        const segStart = { ...waypoints[waypointIdx] };
        const segTarget = { ...waypoints[waypointIdx + 1] };

        const dx = segTarget.x - segStart.x;
        const dy = segTarget.y - segStart.y;
        const segDistNorm = Math.sqrt(dx * dx + dy * dy);

        // Segment duration based on length (120ms to 400ms per segment)
        const segDuration = Math.max(120, Math.min(400, segDistNorm * 900));
        const startTime = performance.now();

        const step = (now) => {
          if (this.state !== NAVIGATION_STATES.MOVING) {
            if (this.activeResolve) {
              const res = this.activeResolve;
              this.activeResolve = null;
              res(false);
            }
            return;
          }

          const elapsed = now - startTime;
          const progress = Math.min(elapsed / segDuration, 1);
          const easedProgress = easeInOutCubic(progress);

          const curX = segStart.x + dx * easedProgress;
          const curY = segStart.y + dy * easedProgress;

          this.currentNormalizedPos = { x: curX, y: curY };

          if (typeof updatePixelPosCallback === 'function') {
            const pixelPos = this.calculatePixelPosFromNorm(this.currentNormalizedPos, geometryContext);
            updatePixelPosCallback(pixelPos);
          }

          if (progress >= 1) {
            this.currentNormalizedPos = { ...segTarget };
            waypointIdx++;
            this.currentWaypointIndex = waypointIdx;

            if (waypointIdx >= waypoints.length - 1) {
              // Navigation Complete
              this.state = NAVIGATION_STATES.ARRIVED;
              this.animFrameId = null;

              if (typeof updatePixelPosCallback === 'function') {
                const finalPixelPos = this.calculatePixelPosFromNorm(this.currentNormalizedPos, geometryContext);
                updatePixelPosCallback(finalPixelPos);
              }

              this._notify({
                type: NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_ARRIVED,
                targetObjectId: sceneObject?.id || null,
                targetLabel: sceneObject?.label || 'Target',
                position: { ...this.currentNormalizedPos },
              });

              if (this.activeResolve) {
                const res = this.activeResolve;
                this.activeResolve = null;
                res(true);
              }
            } else {
              // Proceed to next waypoint segment
              animateSegment();
            }
          } else {
            this.animFrameId = requestAnimationFrame(step);
          }
        };

        this.animFrameId = requestAnimationFrame(step);
      };

      animateSegment();
    });
  }

  /**
   * Helper: Calculates screen pixel transform (x, y) from normalized position.
   */
  calculatePixelPosFromNorm(normPos, geometryContext = {}) {
    const {
      containerWidth = window.innerWidth,
      containerHeight = window.innerHeight,
      imageWidth = 1920,
      imageHeight = 1080,
      groupWidth = 320,
      groupHeight = 360,
      scale = 1,
      baseLeft = 0,
      baseTop = 0,
    } = geometryContext;

    const targetScreenPx = normalizedToScreenPoint(
      normPos,
      containerWidth,
      containerHeight,
      imageWidth,
      imageHeight
    );

    let rawX = targetScreenPx.x - baseLeft - (groupWidth * scale) / 2;
    let rawY = targetScreenPx.y - baseTop - groupHeight * scale * 0.75;

    const minX = 16 - baseLeft;
    const maxX = containerWidth - 16 - baseLeft - groupWidth * scale;
    const minY = 16 - baseTop;
    const maxY = containerHeight - 16 - baseTop - groupHeight * scale;

    const clampedX = Math.max(minX, Math.min(maxX, rawX));
    const clampedY = Math.max(minY, Math.min(maxY, rawY));

    return {
      x: Math.round(clampedX),
      y: Math.round(clampedY),
    };
  }
}

// Global default navigator instance for application usage
export const butlerNavigator = new ButlerNavigator();

