/**
 * Reasoning Validator Module
 * Phase 10 — AI Reasoning & Natural-Language Task Planning
 *
 * Enforces strict security & structural validation on AI reasoning outputs.
 * Verifies JSON integrity, object reference authenticity against SceneState.objects,
 * allowed action vocabulary, coordinate absence, and step bounds.
 */

import { ALLOWED_ACTIONS, MAX_REASONING_STEPS } from './reasoningTypes';

/**
 * Recursively checks an object for forbidden coordinate properties or code execution fields
 */
function containsForbiddenKeys(obj) {
  if (!obj || typeof obj !== 'object') return false;

  const forbiddenKeys = ['x', 'y', 'left', 'top', 'width', 'height', 'transform', 'translate', 'code', 'script', 'eval'];

  for (const key of Object.keys(obj)) {
    if (forbiddenKeys.includes(key.toLowerCase())) {
      return true;
    }
    if (typeof obj[key] === 'object' && containsForbiddenKeys(obj[key])) {
      return true;
    }
  }

  return false;
}

/**
 * Validates raw AI reasoning response against strict structural, security, and object existence rules.
 *
 * @param {Object|string} rawResponse - Model JSON string or object
 * @param {Object} sceneState - Active normalized SceneState
 * @returns {Object} { isValid: boolean, plan?: Object, reason?: string, error?: string }
 */
export function validateReasoningOutput(rawResponse, sceneState) {
  let parsed = null;

  if (typeof rawResponse === 'string') {
    try {
      // Strip markdown code fences if model included ```json ... ```
      const cleaned = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      return {
        isValid: false,
        reason: 'INVALID_JSON',
        error: `Model output is not valid JSON: ${err.message}`,
      };
    }
  } else if (typeof rawResponse === 'object' && rawResponse !== null) {
    parsed = rawResponse;
  } else {
    return {
      isValid: false,
      reason: 'INVALID_OUTPUT',
      error: 'Model output is null or invalid type',
    };
  }

  // 1. Forbidden Coordinate & Code Security Audit
  if (containsForbiddenKeys(parsed)) {
    return {
      isValid: false,
      reason: 'SECURITY_VIOLATION',
      error: 'Plan contains forbidden raw coordinates, positioning properties, or executable fields',
    };
  }

  // 2. Validate Status
  const status = (parsed.status || '').toUpperCase();
  if (status === 'NEEDS_CLARIFICATION') {
    if (!parsed.question || typeof parsed.question !== 'string') {
      return {
        isValid: false,
        reason: 'MALFORMED_CLARIFICATION',
        error: 'Clarification status requested but question string is missing',
      };
    }
    return {
      isValid: true,
      plan: {
        status: 'NEEDS_CLARIFICATION',
        question: parsed.question,
      },
    };
  }

  if (status === 'NO_TARGET') {
    return {
      isValid: true,
      plan: {
        status: 'NO_TARGET',
        reason: parsed.reason || 'Requested target object does not exist in scene',
      },
    };
  }

  if (status !== 'PLAN_READY') {
    return {
      isValid: false,
      reason: 'INVALID_STATUS',
      error: `Unknown reasoning status: ${parsed.status}`,
    };
  }

  // 3. Goal & Intent Validation
  if (!parsed.goal || !parsed.goal.intent) {
    return {
      isValid: false,
      reason: 'MISSING_GOAL',
      error: 'Plan is missing a valid goal or goal intent',
    };
  }

  const intent = String(parsed.goal.intent).toUpperCase();
  if (!ALLOWED_ACTIONS.includes(intent)) {
    return {
      isValid: false,
      reason: 'UNSUPPORTED_ACTION',
      error: `Goal intent ${intent} is not in allowed action vocabulary`,
    };
  }

  // 4. Target Validation against SceneState.objects
  const sceneObjects = sceneState?.objects || [];
  const sceneObjectIds = new Set(sceneObjects.map((obj) => String(obj.id)));

  if (parsed.target && parsed.target.objectId) {
    const targetIdStr = String(parsed.target.objectId);
    if (!sceneObjectIds.has(targetIdStr)) {
      return {
        isValid: false,
        reason: 'INVALID_TARGET',
        error: `Target objectId "${targetIdStr}" does not exist in active SceneState.objects`,
      };
    }
  }

  // 5. Steps Array Validation
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    return {
      isValid: false,
      reason: 'EMPTY_STEPS',
      error: 'Plan contains no step definitions',
    };
  }

  if (parsed.steps.length > MAX_REASONING_STEPS) {
    return {
      isValid: false,
      reason: 'EXCESSIVE_STEPS',
      error: `Plan exceeds maximum allowable steps limit of ${MAX_REASONING_STEPS}`,
    };
  }

  const stepIds = new Set();
  for (let i = 0; i < parsed.steps.length; i++) {
    const step = parsed.steps[i];
    if (!step || !step.action) {
      return {
        isValid: false,
        reason: 'MALFORMED_STEP',
        error: `Step at index ${i} is missing action property`,
      };
    }

    const action = String(step.action).toUpperCase();
    if (!ALLOWED_ACTIONS.includes(action)) {
      return {
        isValid: false,
        reason: 'UNSUPPORTED_ACTION',
        error: `Step action "${action}" is not in allowed action vocabulary`,
      };
    }

    if (step.targetObjectId) {
      const stepTargetIdStr = String(step.targetObjectId);
      if (!sceneObjectIds.has(stepTargetIdStr)) {
        return {
          isValid: false,
          reason: 'INVALID_TARGET',
          error: `Step ${i + 1} references targetObjectId "${stepTargetIdStr}" which does not exist in scene`,
        };
      }
    }

    const stepId = step.id || `step-${i + 1}`;
    if (stepIds.has(stepId)) {
      return {
        isValid: false,
        reason: 'DUPLICATE_STEP_ID',
        error: `Duplicate step ID "${stepId}" detected in plan`,
      };
    }
    stepIds.add(stepId);
  }

  return {
    isValid: true,
    plan: {
      status: 'PLAN_READY',
      goal: {
        intent,
        description: parsed.goal.description || `Execute ${intent} task`,
      },
      target: parsed.target || null,
      steps: parsed.steps.map((s, idx) => ({
        id: s.id || `step-${idx + 1}`,
        action: String(s.action).toUpperCase(),
        targetObjectId: s.targetObjectId || null,
        targetCategory: s.targetCategory || null,
        condition: s.condition || null,
      })),
      conditions: parsed.conditions || [],
      completionCriteria: parsed.completionCriteria || [],
    },
  };
}
