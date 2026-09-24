/**
 * Standalone Speech State Definitions (Phase 5)
 *
 * Defines the visual communication lifecycle states for Butler responses.
 * Completely independent from the emotion engine.
 */

export const SPEECH_STATES = {
  IDLE: 'IDLE',            // No active speech payload
  RECEIVING: 'RECEIVING',  // New response received, preparing reveal
  REVEALING: 'REVEALING',  // Text is being progressively revealed
  DISPLAYING: 'DISPLAYING', // Full text is rendered, active readout
  COMPLETE: 'COMPLETE',    // Text reveal complete, standing output
};

export const SPEECH_STATE_METADATA = {
  [SPEECH_STATES.IDLE]: {
    label: 'IDLE',
    color: '#6b7280',
  },
  [SPEECH_STATES.RECEIVING]: {
    label: 'RECEIVING...',
    color: '#a855f7',
  },
  [SPEECH_STATES.REVEALING]: {
    label: 'TRANSMITTING',
    color: '#06b6d4',
  },
  [SPEECH_STATES.DISPLAYING]: {
    label: 'DISPLAYING',
    color: '#3b82f6',
  },
  [SPEECH_STATES.COMPLETE]: {
    label: 'TRANSMISSION COMPLETE',
    color: '#10b981',
  },
};
