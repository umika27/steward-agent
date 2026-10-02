/**
 * Recovery Strategies Module
 * Phase 11 — Advanced Autonomy, Failure Recovery & Dynamic Replanning
 *
 * Deterministic failure recovery strategy handlers with bounded retry limits.
 */

import { FAILURE_CATEGORIES, MAX_RECOVERY_ATTEMPTS, AUTONOMY_STATES } from './autonomyTypes';
import { resolveTaskTarget } from '../tasks/taskTargetResolver';

/**
 * Evaluates a classified failure and determines the appropriate recovery action
 *
 * @param {Object} classification - Output from classifyFailure()
 * @param {Object} taskContext - Active TaskContext instance
 * @param {Object} sceneState - Current normalized SceneState
 * @returns {Object} Strategy resolution { action: string, speechText?: string, replacementTarget?: Object, canReplan: boolean }
 */
export function evaluateRecoveryStrategy(classification, taskContext, sceneState) {
  const category = classification?.category || FAILURE_CATEGORIES.UNKNOWN_FAILURE;
  const attempts = taskContext?.attempts || 0;

  // 1. Retry Limit Guard
  if (attempts >= MAX_RECOVERY_ATTEMPTS) {
    taskContext?.recordRecoveryAttempt('MAX_ATTEMPTS_EXCEEDED', 'FAILED');
    return {
      action: AUTONOMY_STATES.FAILED,
      speechText: "I've reached maximum recovery attempts. Please provide a new command.",
      canReplan: false,
    };
  }

  switch (category) {
    case FAILURE_CATEGORIES.NO_TARGET:
      taskContext?.recordRecoveryAttempt('NO_TARGET', 'WAITING_FOR_USER');
      return {
        action: AUTONOMY_STATES.WAITING_FOR_USER,
        speechText: "I can't find that object in the current scene.",
        canReplan: false,
      };

    case FAILURE_CATEGORIES.TARGET_UNREACHABLE: {
      taskContext?.recordRecoveryAttempt('TARGET_UNREACHABLE_RETRY', 'REPLANNING');
      // Attempt 1 controlled replan around obstacle grid
      return {
        action: AUTONOMY_STATES.REPLANNING,
        speechText: "I couldn't reach that target. Re-evaluating walkable paths.",
        canReplan: true,
      };
    }

    case FAILURE_CATEGORIES.TARGET_DISAPPEARED: {
      // Re-read SceneState and attempt semantic resolution for a replacement object
      const intent = taskContext?.currentPlan?.intent || 'INSPECT';
      const categoryHint = taskContext?.currentPlan?.targetObject?.category || null;

      const res = resolveTaskTarget(sceneState, intent, { category: categoryHint });

      if (res.success && res.targetObject) {
        taskContext?.recordRecoveryAttempt('TARGET_REPLACED', 'REPLANNING');
        return {
          action: AUTONOMY_STATES.REPLANNING,
          speechText: `Target disappeared. Found replacement ${res.targetObject.label}.`,
          replacementTarget: res.targetObject,
          canReplan: true,
        };
      }

      taskContext?.recordRecoveryAttempt('NO_REPLACEMENT_FOUND', 'WAITING_FOR_USER');
      return {
        action: AUTONOMY_STATES.WAITING_FOR_USER,
        speechText: 'The target object disappeared from the scene.',
        canReplan: false,
      };
    }

    case FAILURE_CATEGORIES.SCENE_CHANGED:
      taskContext?.recordRecoveryAttempt('SCENE_REANALYZED', 'REPLANNING');
      return {
        action: AUTONOMY_STATES.REPLANNING,
        speechText: 'The environment changed. Adjusting plan to new scene.',
        canReplan: true,
      };

    case FAILURE_CATEGORIES.REQUIRED_OBJECT_MISSING:
      taskContext?.recordRecoveryAttempt('REQUIRED_OBJECT_MISSING', 'WAITING_FOR_USER');
      return {
        action: AUTONOMY_STATES.WAITING_FOR_USER,
        speechText: 'A required object for this task is missing from the scene.',
        canReplan: false,
      };

    case FAILURE_CATEGORIES.INVALID_PLAN:
      taskContext?.recordRecoveryAttempt('INVALID_PLAN_REJECTED', 'FAILED');
      return {
        action: AUTONOMY_STATES.FAILED,
        speechText: 'Task plan failed validation. Halting execution for safety.',
        canReplan: false,
      };

    case FAILURE_CATEGORIES.USER_CANCELLED:
      taskContext?.recordRecoveryAttempt('USER_CANCELLED', 'CANCELLED');
      return {
        action: AUTONOMY_STATES.CANCELLED,
        speechText: null,
        canReplan: false,
      };

    default:
      taskContext?.recordRecoveryAttempt('GENERIC_RECOVERY_REPLAN', 'REPLANNING');
      return {
        action: AUTONOMY_STATES.REPLANNING,
        speechText: 'Task interrupted. Attempting plan recovery.',
        canReplan: true,
      };
  }
}
