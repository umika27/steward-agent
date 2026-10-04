/**
 * Task Planner Module
 * Phase 9 — Advanced Task Intelligence & Semantic Task Planning
 *
 * Generates structured, validated semantic task plans derived from task intents,
 * target scene objects, and active SceneState.
 *
 * Presentation-independent, zero hardcoded room coordinates.
 */

import { getIntent } from './taskIntents';
import { resolveTaskTarget } from './taskTargetResolver';
import { resolveInteraction } from './taskInteractionResolver';

/**
 * Generates an ordered task plan for a semantic intent and target object
 *
 * @param {string|Object} intentOrKey - Semantic task intent (e.g. 'INSPECT', 'RETRIEVE')
 * @param {Object} targetObject - Target scene object from SceneState
 * @param {Object} sceneState - Active normalized SceneState
 * @param {Object} [options] - Additional task planning options
 * @returns {Object} Structured plan result { success: boolean, plan?: Object, reason?: string }
 */
export function createTaskPlanFromIntent(intentOrKey, targetObject, sceneState, options = {}) {
  const intent = typeof intentOrKey === 'object' ? intentOrKey : getIntent(intentOrKey);
  const objects = sceneState?.objects || [];

  if (!targetObject && intent.id !== 'RETURN' && intent.id !== 'WAIT') {
    return {
      success: false,
      reason: 'REQUIRED_OBJECT_MISSING',
      error: 'Target object is null or not found in scene',
    };
  }

  const interaction = resolveInteraction(intent, targetObject);

  switch (intent.id) {
    case 'INSPECT': {
      const steps = [
        {
          type: 'NAVIGATE',
          target: targetObject,
          description: `Navigate to ${targetObject.label}`,
        },
        {
          type: 'SPEAK',
          text: interaction.speechText,
          emotionContext: interaction.emotionContext,
        },
        {
          type: 'WAIT',
          duration: interaction.duration || 1000,
        },
        {
          type: 'SPEAK',
          text: interaction.completionSpeechText,
          emotionContext: interaction.completionEmotionContext,
        },
        {
          type: 'WAIT',
          duration: 800,
        },
        {
          type: 'RETURN_HOME',
          description: 'Return Butler to home position',
        },
        {
          type: 'COMPLETE',
          description: 'Task Completed',
        },
      ];

      return {
        success: true,
        plan: {
          id: `plan_inspect_${targetObject.id}_${Date.now()}`,
          intent: intent.id,
          targetObjectId: targetObject.id,
          targetObject,
          steps,
        },
      };
    }

    case 'RETRIEVE': {
      // Find storage object in scene if target isn't storage
      let storageObj = targetObject;
      if ((targetObject.category || '').toLowerCase() !== 'storage') {
        const storageRes = resolveTaskTarget(sceneState, 'RETRIEVE', { category: 'storage' });
        if (storageRes.success && storageRes.targetObject) {
          storageObj = storageRes.targetObject;
        }
      }

      if (!storageObj) {
        return {
          success: false,
          reason: 'REQUIRED_OBJECT_MISSING',
          error: 'No storage object available in scene for retrieve task',
        };
      }

      const storageInteraction = resolveInteraction('RETRIEVE', storageObj);

      const steps = [
        {
          type: 'NAVIGATE',
          target: storageObj,
          description: `Navigate to ${storageObj.label}`,
        },
        {
          type: 'SPEAK',
          text: storageInteraction.speechText,
          emotionContext: 'thinking',
        },
        {
          type: 'WAIT',
          duration: 1200,
        },
        {
          type: 'SPEAK',
          text: storageInteraction.completionSpeechText,
          emotionContext: 'relieved',
        },
        {
          type: 'WAIT',
          duration: 800,
        },
        {
          type: 'RETURN_HOME',
          description: 'Return Butler to home base',
        },
        {
          type: 'COMPLETE',
          description: 'Task Completed',
        },
      ];

      return {
        success: true,
        plan: {
          id: `plan_retrieve_${storageObj.id}_${Date.now()}`,
          intent: intent.id,
          targetObjectId: storageObj.id,
          targetObject: storageObj,
          steps,
        },
      };
    }

    case 'DELIVER': {
      // Primary target is destination; find secondary source object if available
      const sourceRes = resolveTaskTarget(sceneState, 'RETRIEVE', { category: 'storage' });
      const sourceObj = sourceRes.success ? sourceRes.targetObject : null;

      const steps = [];

      if (sourceObj && sourceObj.id !== targetObject.id) {
        steps.push(
          {
            type: 'NAVIGATE',
            target: sourceObj,
            description: `Navigate to source ${sourceObj.label}`,
          },
          {
            type: 'SPEAK',
            text: `Retrieving package from ${sourceObj.label.toLowerCase()}.`,
            emotionContext: 'attentive',
          },
          {
            type: 'WAIT',
            duration: 1000,
          }
        );
      }

      steps.push(
        {
          type: 'NAVIGATE',
          target: targetObject,
          description: `Navigate to destination ${targetObject.label}`,
        },
        {
          type: 'SPEAK',
          text: interaction.speechText,
          emotionContext: 'attentive',
        },
        {
          type: 'WAIT',
          duration: 1000,
        },
        {
          type: 'SPEAK',
          text: interaction.completionSpeechText,
          emotionContext: 'confident',
        },
        {
          type: 'WAIT',
          duration: 800,
        },
        {
          type: 'RETURN_HOME',
          description: 'Return Butler to home base',
        },
        {
          type: 'COMPLETE',
          description: 'Task Completed',
        }
      );

      return {
        success: true,
        plan: {
          id: `plan_deliver_${targetObject.id}_${Date.now()}`,
          intent: intent.id,
          targetObjectId: targetObject.id,
          targetObject,
          steps,
        },
      };
    }

    case 'INVESTIGATE':
    case 'ASSIST':
    case 'INTERACT': {
      const steps = [
        {
          type: 'NAVIGATE',
          target: targetObject,
          description: `Navigate to ${targetObject.label}`,
        },
        {
          type: 'SPEAK',
          text: interaction.speechText,
          emotionContext: interaction.emotionContext,
        },
        {
          type: 'WAIT',
          duration: interaction.duration || 1000,
        },
        {
          type: 'SPEAK',
          text: interaction.completionSpeechText,
          emotionContext: interaction.completionEmotionContext,
        },
        {
          type: 'WAIT',
          duration: 800,
        },
        {
          type: 'RETURN_HOME',
          description: 'Return Butler to home base',
        },
        {
          type: 'COMPLETE',
          description: 'Task Completed',
        },
      ];

      return {
        success: true,
        plan: {
          id: `plan_${intent.id.toLowerCase()}_${targetObject.id}_${Date.now()}`,
          intent: intent.id,
          targetObjectId: targetObject.id,
          targetObject,
          steps,
        },
      };
    }

    case 'DIAGNOSE_BROKEN': {
      const rawLabel = (targetObject.label || 'object').toLowerCase();

      const steps = [
        {
          type: 'SPEAK',
          text: `I'll take a look at the ${rawLabel}.`,
          emotionContext: 'thinking',
        },
        {
          type: 'NAVIGATE',
          target: targetObject,
          description: `Navigate to ${targetObject.label}`,
        },
        {
          type: 'SPEAK',
          text: `Inspecting the ${rawLabel}...`,
          emotionContext: 'attentive',
        },
        {
          type: 'WAIT',
          duration: 1200,
        },
      ];

      // Step 2: Find document / manual object in active scene
      let docObj = null;
      const docRes = resolveTaskTarget(sceneState, 'INSPECT', { category: 'documents', targetLabel: 'manual' });
      if (docRes.success && docRes.targetObject && docRes.targetObject.id !== targetObject.id) {
        docObj = docRes.targetObject;
      } else {
        const matchedDoc = (sceneState?.objects || []).find(
          (o) => o.id !== targetObject.id &&
                 (o.category === 'documents' ||
                  /manual|document|guide|paper|instructions/i.test(o.label))
        );
        if (matchedDoc) docObj = matchedDoc;
      }

      if (docObj) {
        steps.push(
          {
            type: 'SPEAK',
            text: `Checking documentation...`,
            emotionContext: 'attentive',
          },
          {
            type: 'NAVIGATE',
            target: docObj,
            description: `Navigate to ${docObj.label}`,
          },
          {
            type: 'WAIT',
            duration: 1200,
          },
          {
            type: 'SPEAK',
            text: `Reviewing manual for the ${rawLabel}.`,
            emotionContext: 'thinking',
          },
          {
            type: 'WAIT',
            duration: 1000,
          },
          {
            type: 'NAVIGATE',
            target: targetObject,
            description: `Return to broken ${rawLabel}`,
          },
          {
            type: 'WAIT',
            duration: 800,
          }
        );
      } else {
        steps.push(
          {
            type: 'SPEAK',
            text: `I couldn't find the documentation for the ${rawLabel}.`,
            emotionContext: 'worried',
          },
          {
            type: 'WAIT',
            duration: 1000,
          }
        );
      }

      // Step 3: Determine outcome (default REPAIR_REQUIRED)
      const outcome = options.diagnosticOutcome || 'REPAIR_REQUIRED';

      if (outcome === 'REPAIR_REQUIRED') {
        let phoneObj = null;
        const phoneRes = resolveTaskTarget(sceneState, 'INSPECT', { category: 'electronics', targetLabel: 'telephone' });
        if (phoneRes.success && phoneRes.targetObject && phoneRes.targetObject.id !== targetObject.id) {
          phoneObj = phoneRes.targetObject;
        } else {
          const matchedPhone = (sceneState?.objects || []).find(
            (o) => o.id !== targetObject.id && /phone|telephone|mobile|handset/i.test(o.label)
          );
          if (matchedPhone) phoneObj = matchedPhone;
        }

        if (phoneObj) {
          steps.push(
            {
              type: 'SPEAK',
              text: `Repair is required. Contacting repair service...`,
              emotionContext: 'thinking',
            },
            {
              type: 'NAVIGATE',
              target: phoneObj,
              description: `Navigate to ${phoneObj.label}`,
            },
            {
              type: 'WAIT',
              duration: 1500,
            },
            {
              type: 'SPEAK',
              text: `Calling technician for ${rawLabel} repair.`,
              emotionContext: 'confident',
            },
            {
              type: 'WAIT',
              duration: 1200,
            },
            {
              type: 'SPEAK',
              text: `Repair requested. Service dispatched.`,
              emotionContext: 'relieved',
            }
          );
        } else {
          steps.push(
            {
              type: 'SPEAK',
              text: `Repair is required, but no telephone detected.`,
              emotionContext: 'confused',
            }
          );
        }
      } else if (outcome === 'REPLACEMENT_REQUIRED') {
        steps.push(
          {
            type: 'SPEAK',
            text: `The ${rawLabel} needs replacement. Scheduling replacement...`,
            emotionContext: 'worried',
          }
        );
      } else {
        steps.push(
          {
            type: 'SPEAK',
            text: `Inspection complete. Issue noted.`,
            emotionContext: 'confident',
          }
        );
      }

      steps.push(
        {
          type: 'WAIT',
          duration: 1000,
        },
        {
          type: 'RETURN_HOME',
          description: 'Return Butler to home base',
        },
        {
          type: 'COMPLETE',
          description: 'Task Completed',
        }
      );

      return {
        success: true,
        plan: {
          id: `plan_diagnose_${targetObject.id}_${Date.now()}`,
          intent: 'DIAGNOSE_BROKEN',
          targetObjectId: targetObject.id,
          targetObject,
          diagnosticOutcome: outcome,
          steps,
        },
      };
    }

    case 'RETURN': {
      return {
        success: true,
        plan: {
          id: `plan_return_${Date.now()}`,
          intent: 'RETURN',
          targetObjectId: null,
          targetObject: null,
          steps: [
            {
              type: 'RETURN_HOME',
              description: 'Return Butler to home base',
            },
            {
              type: 'COMPLETE',
              description: 'Task Completed',
            },
          ],
        },
      };
    }

    case 'WAIT': {
      return {
        success: true,
        plan: {
          id: `plan_wait_${Date.now()}`,
          intent: 'WAIT',
          targetObjectId: null,
          targetObject: null,
          steps: [
            {
              type: 'WAIT',
              duration: options.duration || 2000,
            },
            {
              type: 'COMPLETE',
              description: 'Task Completed',
            },
          ],
        },
      };
    }

    default:
      return {
        success: false,
        reason: 'INVALID_TASK_INTENT',
        error: `Unsupported task intent ${intent.id}`,
      };
  }
}
