import { STEWARD_STATUSES } from '../mock/mockStewardInput';

/**
 * Deterministic Mock Conversation Data (Final Pass — 8 Story Turns)
 *
 * Demonstrates all 8 Butler emotions in a coherent short story sequence:
 * 1. ATTENTIVE  - Initial system check request
 * 2. WORRIED    - Warning discovered
 * 3. THINKING   - Analysis & clarification
 * 4. CONFIDENT  - Clear explanation provided
 * 5. RELIEVED   - Initial task completion
 * 6. CONFUSED   - User expresses confusion
 * 7. SURPRISED  - Unexpected diagnostic event
 * 8. FRUSTRATED - Final component blockage / error
 */

export const MOCK_CONVERSATION_TURNS = [
  {
    id: 1,
    turnNumber: 1,
    userText: 'Can you check the current system status?',
    assistantText: "Certainly. I'll check the system status for you.",
    status: STEWARD_STATUSES.IDLE,
    context: {
      userIntent: 'question',
      taskResult: 'none',
    },
  },
  {
    id: 2,
    turnNumber: 2,
    userText: 'Is everything operating normally?',
    assistantText: 'Most systems are operating normally, but I found one warning that needs your attention.',
    status: STEWARD_STATUSES.WARNING,
    context: {
      taskResult: 'warning',
    },
  },
  {
    id: 3,
    turnNumber: 3,
    userText: 'What did you find?',
    assistantText: 'I found an abnormal reading in one monitored component.',
    status: STEWARD_STATUSES.THINKING,
    context: {
      requiresClarification: true,
      userIntent: 'question',
    },
  },
  {
    id: 4,
    turnNumber: 4,
    userText: 'Can you explain what that means?',
    assistantText: 'Certainly. The reading is outside the expected range, so the component should be inspected.',
    status: STEWARD_STATUSES.RESPONDING,
    context: {
      taskResult: 'none',
      userIntent: 'command',
    },
  },
  {
    id: 5,
    turnNumber: 5,
    userText: 'Go ahead and run the routine maintenance script.',
    assistantText: 'Maintenance script execution completed successfully.',
    status: STEWARD_STATUSES.SUCCESS,
    context: {
      taskResult: 'success',
    },
  },
  {
    id: 6,
    turnNumber: 6,
    userText: "Wait, I don't understand these log entries at all.",
    assistantText: 'Let me explain that another way in simpler terms.',
    status: STEWARD_STATUSES.RESPONDING,
    context: {
      userExpressedConfusion: true,
      userIntent: 'clarification',
    },
  },
  {
    id: 7,
    turnNumber: 7,
    userText: 'Did the secondary hardware diagnostic finish already?',
    assistantText: 'Surprisingly, yes! The automated process completed in record time.',
    status: STEWARD_STATUSES.RESPONDING,
    context: {
      unexpectedResult: true,
      taskResult: 'unexpected',
    },
  },
  {
    id: 8,
    turnNumber: 8,
    userText: 'Wait, why did the power coupling drop right after?',
    assistantText: 'Alert: Power coupling 4 failed to synchronize. Immediate manual inspection required.',
    status: STEWARD_STATUSES.ERROR,
    context: {
      taskResult: 'error',
    },
  },
];
