/**
 * Task Definitions & Semantic Plan Generator
 * Phase 9 — Advanced Task Intelligence & Semantic Task Planning
 *
 * Backward-compatibility wrapper exporting findObjectByCategory and createTaskPlan
 * delegating directly to TaskTargetResolver and TaskPlanner.
 */

import { resolveTaskTarget } from './taskTargetResolver';
import { createTaskPlanFromIntent } from './taskPlanner';

/**
 * Searches detected scene objects for a matching semantic category or label
 */
export function findObjectByCategory(categoryKey, objects = []) {
  const res = resolveTaskTarget({ objects }, 'INSPECT', { category: categoryKey });
  return res.success ? res.targetObject : null;
}

/**
 * Generates a structured Task Plan for a selected target scene object
 */
export function createTaskPlan(targetObject, sceneObjects = []) {
  if (!targetObject) return null;
  const res = createTaskPlanFromIntent('INSPECT', targetObject, { objects: sceneObjects });
  return res.success ? res.plan : null;
}
