/**
 * Navigation Scene Model Module
 * Phase 8 — Walkability, Obstacle Representation & Pathfinding
 *
 * Converts normalized SceneState objects into a geometric obstacle model
 * with configurable safety margins.
 *
 * All coordinates remain normalized [0.0 - 1.0].
 * ZERO hardcoded room coordinates allowed.
 */

import { OBJECT_CATEGORIES } from '../scene/sceneTypes';

// Global Butler safety margin (in normalized units) to prevent visual overlap
export const BUTLER_NAVIGATION_MARGIN = 0.03;

/**
 * Determines whether a detected scene object represents a navigation obstacle.
 * Uses semantic categories & metadata. Conservative approach: if uncertain, treat as obstacle.
 *
 * @param {Object} object - Normalized scene object from SceneState
 * @returns {boolean} True if object is a blocking obstacle
 */
export function isNavigationObstacle(object) {
  if (!object) return false;

  const category = (object.category || '').toLowerCase();
  const label = (object.label || '').toLowerCase();

  // Non-blocking decor/lighting or structural ceiling/wall decorations
  if (
    category === OBJECT_CATEGORIES.DECOR_LIGHTING &&
    (label.includes('light') || label.includes('pendant') || label.includes('ceiling') || label.includes('wall'))
  ) {
    return false;
  }

  // Blocking categories
  if (
    category === OBJECT_CATEGORIES.FURNITURE ||
    category === OBJECT_CATEGORIES.APPLIANCES ||
    category === OBJECT_CATEGORIES.ELECTRONICS ||
    category === OBJECT_CATEGORIES.STRUCTURES ||
    label.includes('sofa') ||
    label.includes('table') ||
    label.includes('cupboard') ||
    label.includes('cabinet') ||
    label.includes('chair') ||
    label.includes('bed') ||
    label.includes('desk') ||
    label.includes('machine') ||
    label.includes('refrigerator') ||
    label.includes('plant')
  ) {
    return true;
  }

  // Conservative fallback: treat as obstacle for safety
  return true;
}

/**
 * Expands an object's normalized bounding box by the Butler safety margin
 *
 * @param {Object} normalizedBox - { x, y, width, height }
 * @param {number} margin - Safety expansion margin (default: BUTLER_NAVIGATION_MARGIN)
 * @returns {Object} Expanded bounds { x, y, width, height }
 */
export function getExpandedObstacleBounds(normalizedBox, margin = BUTLER_NAVIGATION_MARGIN) {
  if (!normalizedBox) return { x: 0, y: 0, width: 0, height: 0 };

  const rawX = normalizedBox.x;
  const rawY = normalizedBox.y;
  const rawW = normalizedBox.width;
  const rawH = normalizedBox.height;

  const x = Math.max(0, rawX - margin);
  const y = Math.max(0, rawY - margin);
  const width = Math.min(1 - x, rawW + margin * 2);
  const height = Math.min(1 - y, rawH + margin * 2);

  return { x, y, width, height };
}

/**
 * Builds a navigation scene model from current SceneState
 *
 * @param {Object} sceneState - Current normalized scene perception state
 * @param {number} margin - Safety margin
 * @returns {Object} Navigation scene model
 */
export function buildNavigationScene(sceneState, margin = BUTLER_NAVIGATION_MARGIN) {
  const objects = sceneState?.objects || [];
  const obstacles = [];

  for (const obj of objects) {
    if (isNavigationObstacle(obj)) {
      const bounds = getExpandedObstacleBounds(obj.normalizedBoundingBox, margin);
      obstacles.push({
        objectId: obj.id,
        label: obj.label,
        category: obj.category,
        bounds,
        rawBoundingBox: obj.normalizedBoundingBox,
      });
    }
  }

  return {
    width: 1.0,
    height: 1.0,
    margin,
    obstacles,
  };
}
