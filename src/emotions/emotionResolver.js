import { EMOTION_IDS, EMOTION_DEFINITIONS } from './emotionDefinitions';
import { STEWARD_STATUSES } from '../mock/mockStewardInput';
import { resolveContextualEmotion } from './contextResolver';

/**
 * Provisional Status → Emotion Mapping
 */
export const STATUS_TO_EMOTION_MAP = {
  [STEWARD_STATUSES.IDLE]: EMOTION_IDS.ATTENTIVE,
  [STEWARD_STATUSES.THINKING]: EMOTION_IDS.THINKING,
  [STEWARD_STATUSES.PROCESSING]: EMOTION_IDS.ATTENTIVE,
  [STEWARD_STATUSES.RESPONDING]: EMOTION_IDS.CONFIDENT,
  [STEWARD_STATUSES.SUCCESS]: EMOTION_IDS.RELIEVED,
  [STEWARD_STATUSES.WARNING]: EMOTION_IDS.WORRIED,
  [STEWARD_STATUSES.ERROR]: EMOTION_IDS.FRUSTRATED,
};

/**
 * Main Emotion Resolver API
 * Resolves final emotion definition & reason based on status, context, and explicit override.
 */
export const resolveEmotion = (status, context = {}, overrideEmotion = null) => {
  return resolveContextualEmotion(status, context, overrideEmotion);
};

export const resolveEmotionFromStatus = (status) => {
  return resolveContextualEmotion(status, {}, null).emotion;
};

export const getEmotion = (emotionId) => {
  if (emotionId && EMOTION_DEFINITIONS[emotionId]) {
    return EMOTION_DEFINITIONS[emotionId];
  }
  return EMOTION_DEFINITIONS[EMOTION_IDS.ATTENTIVE];
};

export const isValidEmotion = (emotionId) => {
  return Boolean(emotionId && EMOTION_DEFINITIONS[emotionId]);
};
