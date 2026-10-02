/**
 * Scene Perception Types & Contract Schemas
 * Phase 1 — Scene Perception System
 */

export const SCENE_STATUS = {
  IDLE: 'idle',
  ANALYZING: 'analyzing',
  READY: 'ready',
  ERROR: 'error',
};

export const OBJECT_CATEGORIES = {
  FURNITURE: 'furniture',
  APPLIANCES: 'appliances',
  ELECTRONICS: 'electronics',
  STRUCTURES: 'structures',
  DECOR_LIGHTING: 'decor_lighting',
  DOCUMENTS: 'documents',
  OTHER: 'other',
};

/**
 * Validates that an object conforms to the normalized SceneObject contract
 */
export function isValidSceneObject(obj) {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.label === 'string' &&
    typeof obj.confidence === 'number' &&
    obj.normalizedCenter &&
    typeof obj.normalizedCenter.x === 'number' &&
    typeof obj.normalizedCenter.y === 'number'
  );
}
