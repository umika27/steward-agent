/**
 * Failure Classifier Module
 * Phase 11 — Advanced Autonomy, Failure Recovery & Dynamic Replanning
 *
 * Deterministically classifies raw execution errors and monitoring reports into
 * structured failure categories.
 *
 * NO LLM required for deterministic failure classification.
 */

import { FAILURE_CATEGORIES } from './autonomyTypes';

/**
 * Classifies an incoming task monitoring report or error payload
 *
 * @param {Object} report - Event payload from TaskMonitor or TaskEngine
 * @param {Object} sceneState - Active normalized SceneState
 * @param {Object} taskContext - Active TaskContext
 * @returns {Object} Structured classification { category: string, reason: string, targetObjectId?: string }
 */
export function classifyFailure(report, sceneState, taskContext) {
  if (!report) {
    return {
      category: FAILURE_CATEGORIES.UNKNOWN_FAILURE,
      reason: 'No report or error payload provided',
    };
  }

  const type = report.type || '';
  const reasonStr = (report.reason || report.error || '').toUpperCase();
  const currentSceneVersion = sceneState?.sceneVersion || 1;
  const contextSceneVersion = taskContext?.sceneVersion || 1;

  // 1. Scene Environment Change
  if (type === 'SCENE_ENVIRONMENT_CHANGED' || currentSceneVersion !== contextSceneVersion) {
    return {
      category: FAILURE_CATEGORIES.SCENE_CHANGED,
      reason: 'Scene background image was replaced or re-analyzed',
    };
  }

  // 2. User Cancellation
  if (type === 'TASK_CANCELLED' || reasonStr.includes('CANCEL')) {
    return {
      category: FAILURE_CATEGORIES.USER_CANCELLED,
      reason: 'User or caller cancelled the task execution',
    };
  }

  // 3. Navigation Path Unreachable / No Path
  if (type === 'NAVIGATION_NO_PATH' || reasonStr.includes('NO_PATH') || reasonStr.includes('UNREACHABLE')) {
    return {
      category: FAILURE_CATEGORIES.TARGET_UNREACHABLE,
      reason: 'A* pathfinder found no walkable path to target object',
      targetObjectId: report.targetObjectId || report.navSnapshot?.targetObject?.id || null,
    };
  }

  // 4. Target Disappeared from SceneState
  if (taskContext && taskContext.currentPlan && taskContext.currentPlan.targetObjectId) {
    const targetId = taskContext.currentPlan.targetObjectId;
    const sceneObjects = sceneState?.objects || [];
    const targetStillInScene = sceneObjects.some((o) => String(o.id) === String(targetId));

    if (!targetStillInScene) {
      return {
        category: FAILURE_CATEGORIES.TARGET_DISAPPEARED,
        reason: `Target object ID "${targetId}" is no longer present in SceneState.objects`,
        targetObjectId: targetId,
      };
    }
  }

  // 5. No Target / Required Object Missing
  if (reasonStr.includes('NO_TARGET') || reasonStr.includes('TARGET_NOT_FOUND')) {
    return {
      category: FAILURE_CATEGORIES.NO_TARGET,
      reason: 'Requested target object does not exist in current scene',
    };
  }

  if (reasonStr.includes('REQUIRED_OBJECT_MISSING')) {
    return {
      category: FAILURE_CATEGORIES.REQUIRED_OBJECT_MISSING,
      reason: 'Required secondary object (e.g. storage) missing from scene',
    };
  }

  // 6. Invalid AI Plan / Verification Violation
  if (reasonStr.includes('INVALID_PLAN') || reasonStr.includes('SECURITY_VIOLATION') || reasonStr.includes('INVALID_TARGET')) {
    return {
      category: FAILURE_CATEGORIES.INVALID_PLAN,
      reason: report.error || 'AI plan failed validation audit',
    };
  }

  // 7. General Navigation Failure
  if (type === 'NAVIGATION_ERROR' || reasonStr.includes('NAVIGATION')) {
    return {
      category: FAILURE_CATEGORIES.NAVIGATION_FAILED,
      reason: report.error || 'Navigation engine encountered an error',
    };
  }

  // 8. Interaction Failure
  if (reasonStr.includes('INTERACTION')) {
    return {
      category: FAILURE_CATEGORIES.INTERACTION_FAILED,
      reason: report.error || 'Semantic interaction step failed',
    };
  }

  return {
    category: FAILURE_CATEGORIES.UNKNOWN_FAILURE,
    reason: report.error || report.reason || 'Unclassified task failure',
  };
}
