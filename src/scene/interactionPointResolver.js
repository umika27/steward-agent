/**
 * Interaction Point Resolver Module
 * Phase 2 — Scene Interaction Points
 *
 * Dynamically derives "Where should the Butler stand to interact with an object?"
 * from detected object geometry (bounding box, center, and semantic category).
 * ZERO hardcoded room coordinates allowed.
 */

import { OBJECT_CATEGORIES } from './sceneTypes';

export const INTERACTION_STRATEGIES = {
  FRONT: 'front',
  SIDE: 'side',
  NEAR: 'near',
  CENTER: 'center',
};

/**
 * Determines the generic interaction strategy based on object category and semantic label
 */
export function getInteractionStrategy(object) {
  const label = (object.label || '').toLowerCase();
  const category = object.category || OBJECT_CATEGORIES.OTHER;

  // Front-facing appliances & storage units
  if (
    category === OBJECT_CATEGORIES.APPLIANCES ||
    label.includes('washing') ||
    label.includes('cupboard') ||
    label.includes('cabinet') ||
    label.includes('bookshelf') ||
    label.includes('refrigerator') ||
    label.includes('drawer')
  ) {
    return INTERACTION_STRATEGIES.FRONT;
  }

  // Side-approachable furniture
  if (
    category === OBJECT_CATEGORIES.FURNITURE ||
    label.includes('sofa') ||
    label.includes('couch') ||
    label.includes('table') ||
    label.includes('chair') ||
    label.includes('armchair') ||
    label.includes('desk')
  ) {
    return INTERACTION_STRATEGIES.SIDE;
  }

  // Near-field electronics, structures, and decor
  if (
    category === OBJECT_CATEGORIES.ELECTRONICS ||
    category === OBJECT_CATEGORIES.STRUCTURES ||
    category === OBJECT_CATEGORIES.DECOR_LIGHTING ||
    label.includes('telephone') ||
    label.includes('door') ||
    label.includes('plant') ||
    label.includes('light')
  ) {
    return INTERACTION_STRATEGIES.NEAR;
  }

  return INTERACTION_STRATEGIES.NEAR;
}

/**
 * Derives normalized and pixel interaction points from detected object geometry
 *
 * @param {Object} normalizedObject - Object created by SceneNormalizer
 * @param {number} imageWidth - Scene image width in pixels
 * @param {number} imageHeight - Scene image height in pixels
 * @returns {Object} Object extended with interactionPoint, normalizedInteractionPoint, strategy, and reliability
 */
export function resolveInteractionPoint(normalizedObject, imageWidth = 1920, imageHeight = 1080) {
  const { normalizedBoundingBox, normalizedCenter, confidence = 0.9 } = normalizedObject;
  const strategy = getInteractionStrategy(normalizedObject);

  let rawNormX = normalizedCenter.x;
  let rawNormY = normalizedCenter.y;

  const bboxX = normalizedBoundingBox.x;
  const bboxY = normalizedBoundingBox.y;
  const bboxW = normalizedBoundingBox.width;
  const bboxH = normalizedBoundingBox.height;

  // Offset distance proportional to bounding box size
  const offsetMarginY = Math.max(0.04, Math.min(0.08, bboxH * 0.25));
  const offsetMarginX = Math.max(0.04, Math.min(0.08, bboxW * 0.3));

  switch (strategy) {
    case INTERACTION_STRATEGIES.FRONT:
      // Stand slightly below/front of object center
      rawNormX = normalizedCenter.x;
      rawNormY = bboxY + bboxH + offsetMarginY;
      break;

    case INTERACTION_STRATEGIES.SIDE:
      // Stand to the side of object (left or right depending on room position)
      if (normalizedCenter.x < 0.5) {
        rawNormX = bboxX + bboxW + offsetMarginX;
      } else {
        rawNormX = bboxX - offsetMarginX;
      }
      rawNormY = bboxY + bboxH * 0.65;
      break;

    case INTERACTION_STRATEGIES.NEAR:
      // Stand near the front-side of object
      rawNormX = normalizedCenter.x + (normalizedCenter.x < 0.5 ? offsetMarginX : -offsetMarginX);
      rawNormY = bboxY + bboxH + offsetMarginY * 0.8;
      break;

    case INTERACTION_STRATEGIES.CENTER:
    default:
      rawNormX = normalizedCenter.x;
      rawNormY = normalizedCenter.y;
      break;
  }

  // Enforce boundary clamping strictly between 0.05 and 0.95
  const clampedNormX = Math.max(0.05, Math.min(0.95, rawNormX));
  const clampedNormY = Math.max(0.05, Math.min(0.95, rawNormY));

  // Compute pixel coordinates
  const pixelX = Math.round(clampedNormX * imageWidth);
  const pixelY = Math.round(clampedNormY * imageHeight);

  // Confidence & Reliability assessment
  const interactionPointReliable = confidence >= 0.7;
  const interactionPointConfidence = Number((confidence * 0.95).toFixed(2));

  return {
    ...normalizedObject,
    interactionStrategy: strategy,
    interactionPointReliable,
    interactionPointConfidence,
    normalizedInteractionPoint: {
      x: Number(clampedNormX.toFixed(4)),
      y: Number(clampedNormY.toFixed(4)),
    },
    interactionPoint: {
      x: pixelX,
      y: pixelY,
    },
  };
}
