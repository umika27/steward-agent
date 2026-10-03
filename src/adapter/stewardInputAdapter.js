/**
 * Steward Input Adapter (Final Integration Boundary - Phase 8)
 *
 * Provides a clean interface between external data providers (Mock Store or future Steward Backend)
 * and the Butler Standalone UI.
 *
 * Contract Payload:
 * {
 *   text: string,          // Speech text payload
 *   status: string,        // Steward system status (idle, thinking, processing, responding, success, warning, error)
 *   context?: object,      // Contextual signals (userIntent, taskResult, userExpressedConfusion, etc.)
 *   emotion?: string       // Optional direct emotion override (attentive, confident, confused, frustrated, etc.)
 * }
 *
 * ZERO dependencies on Steward core implementation.
 */

export const STEWARD_INPUT_CONTRACT = {
  requiredFields: ['text', 'status'],
  optionalFields: ['context', 'emotion', 'timestamp'],
  supportedStatuses: ['idle', 'thinking', 'processing', 'responding', 'success', 'warning', 'error'],
  supportedEmotions: ['attentive', 'confident', 'confused', 'frustrated', 'relieved', 'surprised', 'thinking', 'worried'],
};

/**
 * Standardize and sanitize incoming Steward payloads before passing to UI components.
 * @param {Object} rawPayload - Incoming raw input payload
 * @returns {Object} Normalized Steward input payload
 */
export const normalizeStewardInput = (rawPayload = {}) => {
  const text = typeof rawPayload.text === 'string' ? rawPayload.text : '';
  const status = typeof rawPayload.status === 'string' ? rawPayload.status.toLowerCase() : 'idle';
  const context = rawPayload.context && typeof rawPayload.context === 'object' ? rawPayload.context : {};
  const overrideEmotion =
    rawPayload.overrideEmotion || rawPayload.emotion || null;
  const timestamp =
    rawPayload.timestamp ||
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    text,
    status,
    context,
    overrideEmotion,
    timestamp,
  };
};

/**
 * Adapter Interface wrapper for subscribe / emit operations
 */
export class StewardInputAdapter {
  static adapt(dataStore) {
    return {
      getState: () => normalizeStewardInput(dataStore.getState()),
      subscribe: (listener) => {
        return dataStore.subscribe((rawState) => {
          listener(normalizeStewardInput(rawState));
        });
      },
      emit: (payload) => {
        dataStore.updateState(normalizeStewardInput(payload));
      },
    };
  }
}
