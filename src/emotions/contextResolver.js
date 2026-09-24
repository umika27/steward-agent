import { EMOTION_IDS, EMOTION_DEFINITIONS } from './emotionDefinitions';
import { STATUS_TO_EMOTION_MAP } from './emotionResolver';

/**
 * Deterministic Contextual Emotion Resolver (Phase 6)
 *
 * Resolves final Butler emotion based on a strict priority cascade:
 *
 * Priority Order:
 * 1. Explicit Emotion Override (Developer/Testing override)
 * 2. User Confusion (userExpressedConfusion = true → CONFUSED)
 * 3. Unexpected Result (unexpectedResult = true → SURPRISED)
 * 4. Task Error (taskResult = 'error' → FRUSTRATED)
 * 5. Task Warning (taskResult = 'warning' → WORRIED)
 * 6. Task Success (taskResult = 'success' → RELIEVED)
 * 7. Clarification / Thinking (requiresClarification = true or userIntent = 'clarification' → THINKING)
 * 8. Status Mapping (IDLE → ATTENTIVE, RESPONDING → CONFIDENT, etc.)
 * 9. Default Fallback → ATTENTIVE
 *
 * Pure, deterministic, 100% client-side logic. Zero AI/LLM.
 */

export const resolveContextualEmotion = (status, context = {}, overrideEmotion = null) => {
  // Priority 1: Explicit Developer Override
  if (overrideEmotion && EMOTION_DEFINITIONS[overrideEmotion]) {
    return {
      emotion: EMOTION_DEFINITIONS[overrideEmotion],
      reason: `Direct developer override: ${EMOTION_DEFINITIONS[overrideEmotion].label}`,
      priority: 1,
    };
  }

  // Priority 2: User Confusion
  if (context?.userExpressedConfusion) {
    return {
      emotion: EMOTION_DEFINITIONS[EMOTION_IDS.CONFUSED],
      reason: 'Contextual signal: User expressed confusion',
      priority: 2,
    };
  }

  // Priority 3: Unexpected Result
  if (context?.unexpectedResult || context?.taskResult === 'unexpected') {
    return {
      emotion: EMOTION_DEFINITIONS[EMOTION_IDS.SURPRISED],
      reason: 'Contextual signal: Unexpected task event occurred',
      priority: 3,
    };
  }

  // Priority 4: Task Error
  if (context?.taskResult === 'error') {
    return {
      emotion: EMOTION_DEFINITIONS[EMOTION_IDS.FRUSTRATED],
      reason: 'Contextual signal: Task execution encountered an error',
      priority: 4,
    };
  }

  // Priority 5: Task Warning
  if (context?.taskResult === 'warning') {
    return {
      emotion: EMOTION_DEFINITIONS[EMOTION_IDS.WORRIED],
      reason: 'Contextual signal: Task returned a warning condition',
      priority: 5,
    };
  }

  // Priority 6: Task Success
  if (context?.taskResult === 'success') {
    return {
      emotion: EMOTION_DEFINITIONS[EMOTION_IDS.RELIEVED],
      reason: 'Contextual signal: Task completed successfully',
      priority: 6,
    };
  }

  // Priority 7: Clarification / Thinking
  if (context?.requiresClarification || context?.userIntent === 'clarification') {
    return {
      emotion: EMOTION_DEFINITIONS[EMOTION_IDS.THINKING],
      reason: 'Contextual signal: Task requires clarification',
      priority: 7,
    };
  }

  // Priority 8: Steward Status Mapping
  if (status && STATUS_TO_EMOTION_MAP[status]) {
    const statusEmotionId = STATUS_TO_EMOTION_MAP[status];
    return {
      emotion: EMOTION_DEFINITIONS[statusEmotionId],
      reason: `Steward status mapping: ${status.toUpperCase()} → ${EMOTION_DEFINITIONS[statusEmotionId].label}`,
      priority: 8,
    };
  }

  // Priority 9: Default Fallback
  return {
    emotion: EMOTION_DEFINITIONS[EMOTION_IDS.ATTENTIVE],
    reason: 'Default fallback: Standby attentive state',
    priority: 9,
  };
};
