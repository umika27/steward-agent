/**
 * Replanning Controller Module
 * Phase 11 — Advanced Autonomy, Failure Recovery & Dynamic Replanning
 *
 * Manages partial-progress preservation, plan validity checks, and dynamic replanning.
 * Ensures completed steps are NOT repeated unnecessarily during recovery.
 *
 * DO NOT BYPASS REASONING VALIDATOR OR TASK ENGINE.
 * Flow: Failure -> ReplanningController -> Reasoning/Planner -> Validator -> Compiler -> TaskEngine
 */

import { reasoningController } from '../intelligence/reasoningController';
import { createTaskPlanFromIntent } from '../tasks/taskPlanner';
import { compileTaskPlan } from '../intelligence/taskPlanCompiler';
import { taskEngine } from '../tasks/taskEngine';

export class ReplanningController {
  /**
   * Evaluates partial progress and executes dynamic replanning for active task context
   *
   * @param {Object} taskContext - Active TaskContext
   * @param {Object} sceneState - Current normalized SceneState
   * @param {Object} [recoveryStrategy] - Evaluated recovery strategy object
   * @returns {Promise<Object>} { success: boolean, newPlan?: Object, reason?: string }
   */
  async replanTask(taskContext, sceneState, recoveryStrategy = {}) {
    if (!taskContext || !taskContext.userRequest) {
      return {
        success: false,
        reason: 'NO_ACTIVE_TASK_CONTEXT',
      };
    }

    const completedSteps = taskContext.completedSteps || [];
    const originalPlan = taskContext.originalPlan;
    const currentSceneVersion = sceneState?.sceneVersion || 1;

    // Update scene version in context
    taskContext.updateSceneVersion(currentSceneVersion);

    // 1. Check if original plan remaining steps are still valid
    const remainingSteps = this._extractRemainingSteps(originalPlan, completedSteps);

    if (remainingSteps.length === 0) {
      return {
        success: true,
        reason: 'TASK_ALREADY_COMPLETED',
      };
    }

    // Determine target object (use replacement target if provided by recovery strategy)
    let targetObject = recoveryStrategy.replacementTarget || taskContext.currentPlan?.targetObject;

    if (!targetObject && sceneState?.objects?.length > 0) {
      targetObject = sceneState.objects[0];
    }

    // 2. Partial-Progress Preservation:
    // If completed steps exist, generate a truncated plan for remaining goal ONLY
    let newPlan = null;
    const goalIntent = originalPlan?.intent || 'INSPECT';

    if (completedSteps.length > 0 && targetObject) {
      // Replan remaining intent steps without repeating completed steps
      const planRes = createTaskPlanFromIntent(goalIntent, targetObject, sceneState);
      if (planRes.success && planRes.plan) {
        // Filter out step types that correspond to completed steps
        const completedTypes = new Set(completedSteps.map((cs) => cs.step?.type));
        const filteredSteps = planRes.plan.steps.filter((s) => {
          if (s.type === 'NAVIGATE' && completedTypes.has('NAVIGATE') && completedSteps.length >= 2) {
            return false;
          }
          return true;
        });

        newPlan = {
          ...planRes.plan,
          id: `replanned_${planRes.plan.id}`,
          steps: filteredSteps.length > 0 ? filteredSteps : planRes.plan.steps,
        };
      }
    }

    // 3. Fallback to ReasoningController for full AI replanning if deterministic slice insufficient
    if (!newPlan) {
      const reasoningSuccess = await reasoningController.reason(taskContext.userRequest, sceneState);
      if (reasoningSuccess) {
        const reasoningSnapshot = reasoningController.getReasoningStateSnapshot();
        newPlan = reasoningSnapshot.currentPlan;
      }
    }

    if (!newPlan) {
      return {
        success: false,
        reason: 'REPLANNING_FAILED',
        error: 'Failed to generate a valid replacement plan',
      };
    }

    // 4. Update TaskContext with new plan
    taskContext.updatePlan(newPlan);

    // 5. Dispatch replanned plan to TaskEngine (if not already dispatched by reasoningController)
    if (taskEngine.getTaskState() !== 'NAVIGATING' && taskEngine.getTaskState() !== 'PLANNING') {
      taskEngine.startTask(newPlan.targetObject, sceneState, { intent: newPlan.intent });
    }

    return {
      success: true,
      newPlan,
    };
  }

  _extractRemainingSteps(originalPlan, completedSteps = []) {
    if (!originalPlan || !Array.isArray(originalPlan.steps)) return [];
    const completedIndices = new Set(completedSteps.map((cs) => cs.stepIndex));
    return originalPlan.steps.filter((_, idx) => !completedIndices.has(idx));
  }
}
