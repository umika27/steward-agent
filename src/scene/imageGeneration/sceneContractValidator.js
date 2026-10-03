/**
 * Scene Contract Validator Module
 * Phase 12A.1 — Real AI Generation Validation
 *
 * Validates that a generated scene's perceived SceneState conforms strictly to the demo contract:
 * 1. Non-empty object list (minimum 3 objects).
 * 2. Exactly ONE broken/malfunctioning object.
 * 3. At least TWO normal objects.
 * 4. At least one document/manual or reference material.
 * 5. At least one telephone.
 */

export const MIN_BROKEN_OBJECTS = 1;
export const MAX_BROKEN_OBJECTS = 1;

export function validateSceneContract(sceneState) {
  const objects = sceneState?.objects || [];

  if (!Array.isArray(objects) || objects.length < 3) {
    return {
      valid: false,
      reason: `Insufficient objects detected (${objects.length} objects found)`,
      brokenCount: 0,
    };
  }

  // 1. Broken objects count check (enforce brokenCount >= MIN_BROKEN_OBJECTS and <= MAX_BROKEN_OBJECTS)
  const brokenObjects = objects.filter(
    (o) => o.condition === 'DAMAGED' || o.condition === 'MALFUNCTIONING'
  );
  const brokenCount = brokenObjects.length;

  if (brokenCount < MIN_BROKEN_OBJECTS) {
    return {
      valid: false,
      reason: `REJECTED: Scene contains ${brokenCount} broken objects (Minimum required: ${MIN_BROKEN_OBJECTS})`,
      brokenCount,
    };
  }

  if (brokenCount > MAX_BROKEN_OBJECTS) {
    return {
      valid: false,
      reason: `REJECTED: Scene contains ${brokenCount} broken objects (Maximum allowed: ${MAX_BROKEN_OBJECTS})`,
      brokenCount,
    };
  }

  // 2. Normal objects count check
  const normalObjects = objects.filter((o) => o.condition === 'NORMAL');

  if (normalObjects.length < 2) {
    return {
      valid: false,
      reason: `Expected at least 2 normal objects, found ${normalObjects.length}`,
    };
  }

  // 3. Document presence check
  const hasDocument = objects.some(
    (o) =>
      o.category === 'documents' ||
      /manual|document|guide|paper|instructions|book|binder/i.test(o.label)
  );

  if (!hasDocument) {
    return {
      valid: false,
      reason: 'No documentation/manual object detected in scene',
    };
  }

  // 4. Telephone presence check
  const hasTelephone = objects.some(
    (o) => /phone|telephone|mobile|handset/i.test(o.label) || o.category === 'electronics'
  );

  if (!hasTelephone) {
    return {
      valid: false,
      reason: 'No telephone object detected in scene',
    };
  }

  return {
    valid: true,
    brokenObject: brokenObjects[0],
    normalObjects,
  };
}
