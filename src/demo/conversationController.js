import { useState, useCallback } from 'react';
import { MOCK_CONVERSATION_TURNS } from './mockConversation';
import { stewardMockStore } from '../mock/mockStewardInput';

/**
 * ConversationController Hook (Phase 6 — Contextual Resolution)
 *
 * Manages 7 deterministic turn progressions, user messages, Butler outputs,
 * and emits status + context payloads to the mock data stream.
 */
export function useConversationController() {
  const [turnIndex, setTurnIndex] = useState(0);

  const totalTurns = MOCK_CONVERSATION_TURNS.length;
  const currentTurn = MOCK_CONVERSATION_TURNS[turnIndex];
  const isLastTurn = turnIndex === totalTurns - 1;

  // Emit state & context to Steward mock store
  const syncTurnToMockStore = useCallback((turn) => {
    stewardMockStore.updateState({
      text: turn.assistantText,
      status: turn.status,
      context: turn.context || {},
      overrideEmotion: turn.emotion || null, // Allow optional override if specified
    });
  }, []);

  // Advance to next turn (or restart if at last turn)
  const nextTurn = useCallback(
    (skipRevealCallback) => {
      if (typeof skipRevealCallback === 'function') {
        skipRevealCallback();
      }

      setTurnIndex((prev) => {
        const nextIndex = prev >= totalTurns - 1 ? 0 : prev + 1;
        const targetTurn = MOCK_CONVERSATION_TURNS[nextIndex];
        syncTurnToMockStore(targetTurn);
        return nextIndex;
      });
    },
    [totalTurns, syncTurnToMockStore]
  );

  // Restart conversation to Turn 1
  const restartConversation = useCallback(
    (skipRevealCallback) => {
      if (typeof skipRevealCallback === 'function') {
        skipRevealCallback();
      }
      setTurnIndex(0);
      syncTurnToMockStore(MOCK_CONVERSATION_TURNS[0]);
    },
    [syncTurnToMockStore]
  );

  // Jump to specific turn index
  const goToTurn = useCallback(
    (index) => {
      if (index >= 0 && index < totalTurns) {
        setTurnIndex(index);
        syncTurnToMockStore(MOCK_CONVERSATION_TURNS[index]);
      }
    },
    [totalTurns, syncTurnToMockStore]
  );

  return {
    turnIndex,
    turnNumber: turnIndex + 1,
    totalTurns,
    currentTurn,
    isLastTurn,
    nextTurn,
    restartConversation,
    goToTurn,
  };
}
