/**
 * Task Plan Compiler Module
 * Phase 10 — AI Reasoning & Natural-Language Task Planning
 *
 * Translates validated AI structured plans into Phase 9 TaskEngine-compatible task plans.
 * Presentation-independent adapter layer.
 */

import { resolveTaskTarget } from '../tasks/taskTargetResolver';
import { createTaskPlanFromIntent } from '../tasks/taskPlanner';

/**
 * Compiles a validated AI reasoning plan into an executable Phase 9 Task Plan
 *
 * @param {Object} validatedPlan - Output from reasoningValidator.validateReasoningOutput()
 * @param {Object} sceneState - Active normalized SceneState
 * @returns {Object} { success: boolean, compiledTaskPlan?: Object, reason?: string }
 */
export function compileTaskPlan(validatedPlan, sceneState) {
  if (!validatedPlan || validatedPlan.status !== 'PLAN_READY') {
    return {
      success: false,
      reason: 'PLAN_NOT_READY',
      error: 'Cannot compile plan that is not in PLAN_READY status',
    };
  }

  const objects = sceneState?.objects || [];
  const goalIntent = validatedPlan.goal?.intent || 'INSPECT';

  // 1. Resolve Primary Target Object
  let primaryTargetObj = null;
  if (validatedPlan.target && validatedPlan.target.objectId) {
    const targetRes = resolveTaskTarget(sceneState, goalIntent, { targetId: validatedPlan.target.objectId });
    if (targetRes.success) {
      primaryTargetObj = targetRes.targetObject;
    }
  }

  // Fallback: check first step target
  if (!primaryTargetObj && validatedPlan.steps && validatedPlan.steps.length > 0) {
    const firstStepTargetId = validatedPlan.steps[0].targetObjectId;
    if (firstStepTargetId) {
      const targetRes = resolveTaskTarget(sceneState, goalIntent, { targetId: firstStepTargetId });
      if (targetRes.success) {
        primaryTargetObj = targetRes.targetObject;
      }
    }
  }

  // If goal requires a target but none was resolved
  if (!primaryTargetObj && goalIntent !== 'RETURN' && goalIntent !== 'WAIT') {
    // Attempt fallback target resolution for intent category
    const fallbackRes = resolveTaskTarget(sceneState, goalIntent);
    if (fallbackRes.success) {
      primaryTargetObj = fallbackRes.targetObject;
    } else {
      return {
        success: false,
        reason: 'TARGET_RESOLUTION_FAILED',
        error: 'Failed to resolve valid target object from AI reasoning plan',
      };
    }
  }

  // 2. Delegate to Phase 9 TaskPlanner to generate executable step plan
  const planResult = createTaskPlanFromIntent(goalIntent, primaryTargetObj, sceneState);

  if (!planResult.success || !planResult.plan) {
    return {
      success: false,
      reason: planResult.reason || 'PLAN_COMPILATION_FAILED',
      error: planResult.error || 'Phase 9 TaskPlanner failed to compile task steps',
    };
  }

  // 3. Attach AI reasoning metadata to compiled plan
  const compiledPlan = {
    ...planResult.plan,
    aiGoalDescription: validatedPlan.goal?.description || null,
    aiReasoningStatus: validatedPlan.status,
    completionCriteria: validatedPlan.completionCriteria || [],
  };

  return {
    success: true,
    compiledTaskPlan: compiledPlan,
  };
}
