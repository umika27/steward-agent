/**
 * Task Interaction Resolver Module
 * Phase 9 — Advanced Task Intelligence & Semantic Task Planning
 *
 * Resolves semantic interaction behavior and dynamic speech text for target objects.
 * Presentation-independent, dynamic object label interpolation, zero hardcoded room text.
 */

import { getIntent } from './taskIntents';

/**
 * Resolves dynamic interaction instructions and speech for a target scene object
 *
 * @param {string|Object} intentOrKey - Task intent key or intent object
 * @param {Object} targetObject - Target scene object from SceneState
 * @returns {Object} Structured interaction configuration
 */
export function resolveInteraction(intentOrKey, targetObject) {
  const intent = typeof intentOrKey === 'object' ? intentOrKey : getIntent(intentOrKey);
  const rawLabel = targetObject?.label || 'object';
  const displayLabel = rawLabel.toLowerCase();

  switch (intent.id) {
    case 'INSPECT':
      return {
        type: 'inspect',
        targetObjectId: targetObject?.id || null,
        targetLabel: rawLabel,
        duration: 1000,
        speechText: `I'll inspect the ${displayLabel}.`,
        completionSpeechText: `Inspection of the ${displayLabel} is complete. All metrics look normal.`,
        emotionContext: 'attentive',
        completionEmotionContext: 'confident',
      };

    case 'RETRIEVE':
      return {
        type: 'retrieve',
        targetObjectId: targetObject?.id || null,
        targetLabel: rawLabel,
        duration: 1200,
        speechText: `Retrieving information from the ${displayLabel}.`,
        completionSpeechText: `Retrieved records from the ${displayLabel}.`,
        emotionContext: 'thinking',
        completionEmotionContext: 'relieved',
      };

    case 'DELIVER':
      return {
        type: 'deliver',
        targetObjectId: targetObject?.id || null,
        targetLabel: rawLabel,
        duration: 1000,
        speechText: `Delivering items to the ${displayLabel}.`,
        completionSpeechText: `Delivery to the ${displayLabel} is complete.`,
        emotionContext: 'attentive',
        completionEmotionContext: 'confident',
      };

    case 'INTERACT':
      return {
        type: 'interact',
        targetObjectId: targetObject?.id || null,
        targetLabel: rawLabel,
        duration: 1000,
        speechText: `Interacting with the ${displayLabel}.`,
        completionSpeechText: `Interaction with the ${displayLabel} finished.`,
        emotionContext: 'attentive',
        completionEmotionContext: 'relieved',
      };

    case 'INVESTIGATE':
      return {
        type: 'investigate',
        targetObjectId: targetObject?.id || null,
        targetLabel: rawLabel,
        duration: 1200,
        speechText: `Investigating the ${displayLabel}.`,
        completionSpeechText: `Investigation of the ${displayLabel} complete.`,
        emotionContext: 'thinking',
        completionEmotionContext: 'surprised',
      };

    case 'ASSIST':
      return {
        type: 'assist',
        targetObjectId: targetObject?.id || null,
        targetLabel: rawLabel,
        duration: 1000,
        speechText: `Assisting user with the ${displayLabel}.`,
        completionSpeechText: `Assistance for the ${displayLabel} complete.`,
        emotionContext: 'attentive',
        completionEmotionContext: 'confident',
      };

    default:
      return {
        type: 'inspect',
        targetObjectId: targetObject?.id || null,
        targetLabel: rawLabel,
        duration: 1000,
        speechText: `Checking the ${displayLabel}.`,
        completionSpeechText: `Finished checking the ${displayLabel}.`,
        emotionContext: 'attentive',
        completionEmotionContext: 'confident',
      };
  }
}
