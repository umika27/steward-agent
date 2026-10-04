/**
 * Condition Decision Controller Module
 * Phase 12A — Generated Environment & Condition-Aware Perception
 *
 * Presentation-decoupled decision engine evaluating object condition on click events.
 * Maps object condition (NORMAL, DAMAGED, MALFUNCTIONING, UNCERTAIN) to short speech responses
 * or deterministic autonomous diagnosis workflows.
 */

import { taskEngine } from '../tasks/taskEngine';
import { resolveTaskTarget } from '../tasks/taskTargetResolver';
import { sceneInteractionController } from './sceneInteractionController';

/**
 * Checks whether a scene object has a malfunctioning/broken condition
 */
export function isObjectBroken(object) {
  if (!object) return false;
  const condition = (object.condition || '').toUpperCase();
  return (
    condition === 'BROKEN' ||
    condition === 'MALFUNCTIONING' ||
    condition === 'DAMAGED'
  );
}

export class ConditionDecisionController {
  /**
   * Processes user object selection based on detected condition
   *
   * @param {Object} selectedObject - Normalized SceneObject from SceneState
   * @param {Object} sceneState - Active normalized SceneState
   * @returns {Object} Structured decision outcome { action: string, speechText?: string }
   */
  processObjectSelection(selectedObject, sceneState) {
    if (!selectedObject) {
      return { action: 'NONE' };
    }

    const condition = (selectedObject.condition || 'NORMAL').toUpperCase();
    const rawLabel = selectedObject.label || 'object';
    const displayLabel = rawLabel.toLowerCase();

    // 1. NORMAL Object Behavior
    if (condition === 'NORMAL') {
      const normalResponses = [
        `The ${displayLabel} looks fine.`,
        `The ${displayLabel} appears to be in good condition.`,
        `Everything looks normal with the ${displayLabel}.`,
      ];
      const selectedResponse = normalResponses[Math.abs(selectedObject.id.length || 0) % normalResponses.length];

      return {
        action: 'NORMAL_RESPONSE',
        speechText: selectedResponse,
        targetObject: selectedObject,
      };
    }

    // 2. UNCERTAIN Condition Behavior
    if (condition === 'UNCERTAIN') {
      // Start a simple inspection task without claiming object is broken
      taskEngine.startTask(selectedObject, sceneState, { intent: 'INSPECT' });

      return {
        action: 'UNCERTAIN_WORKFLOW_STARTED',
        speechText: `I'm not sure about the ${displayLabel}. I'll inspect it.`,
        targetObject: selectedObject,
      };
    }

    // 3. BROKEN / DAMAGED / MALFUNCTIONING Behavior
    if (condition === 'DAMAGED' || condition === 'MALFUNCTIONING' || condition === 'BROKEN') {
      // Transition scene to FOCUSED_INVESTIGATION immediately
      sceneInteractionController.setFocusedInvestigation(selectedObject);
      this._startBrokenObjectWorkflow(selectedObject, sceneState);

      return {
        action: 'BROKEN_WORKFLOW_STARTED',
        speechText: `I'll take a look at the ${displayLabel}.`,
        targetObject: selectedObject,
        isBroken: true,
      };
    }

    return {
      action: 'NORMAL_RESPONSE',
      speechText: `The ${displayLabel} looks fine.`,
      targetObject: selectedObject,
    };
  }

  /**
   * Executes deterministic autonomous diagnostic workflow for broken objects
   */
  _startBrokenObjectWorkflow(brokenObject, sceneState) {
    // Start autonomous diagnosis workflow for broken object
    taskEngine.startTask(brokenObject, sceneState, { intent: 'DIAGNOSE_BROKEN' });
  }
}

// Global default singleton instance
export const conditionDecisionController = new ConditionDecisionController();
