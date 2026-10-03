import React, { useState } from 'react';
import {
  MOCK_PRESETS,
  STEWARD_STATUSES,
  STATUS_METADATA,
  stewardMockStore,
} from '../../mock/mockStewardInput';
import { EMOTION_DEFINITIONS } from '../../emotions/emotionDefinitions';
import { resolveContextualEmotion } from '../../emotions/contextResolver';
import { MOCK_CONVERSATION_TURNS } from '../../demo/mockConversation';
import { mockCaseStore } from '../../case/mockCaseStore';
import { SCENARIO_KEYS } from '../../case/caseTypes';
import {
  Sliders,
  ChevronDown,
  ChevronUp,
  Send,
  Smile,
  RefreshCw,
  MessageSquareCode,
  RotateCcw,
  XCircle,
  Play,
  SkipForward,
  Sparkles,
  Layers,
} from 'lucide-react';
import './MockControls.css';

/**
 * MockControls Component (Final Development Pass)
 *
 * Developer testing toolbar supporting:
 * 1. CONTEXT TESTING (Creates context objects to evaluate contextResolver.js)
 * 2. DIRECT EMOTION OVERRIDE (Low-level asset testing)
 * 3. DEMO MODE CONTROLS (8 Story Turns)
 * 4. SPEECH REVEAL TESTING
 * 5. STATUS PRESETS
 * 6. CASE SCENARIOS (ACT, RESTRAIN, RECOVER)
 */
export const MockControls = ({ currentState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customText, setCustomText] = useState(currentState?.text || '');
  const [demoTurnIndex, setDemoTurnIndex] = useState(0);

  // Resolved contextual emotion object
  const resolutionResult = resolveContextualEmotion(
    currentState?.status,
    currentState?.context || {},
    currentState?.overrideEmotion
  );
  const currentEmotion = resolutionResult.emotion;

  // Context Testing Handlers (Triggers Context Resolver Cascade)
  const handleContextAttentive = () => {
    stewardMockStore.updateState({
      overrideEmotion: null,
      context: { userIntent: 'question', taskResult: 'none' },
      text: "Certainly. I'm listening attentively for your prompt.",
    });
  };

  const handleContextThinking = () => {
    stewardMockStore.updateState({
      overrideEmotion: null,
      context: { requiresClarification: true },
      text: 'Analyzing request parameters... Evaluating structural dependencies.',
    });
  };

  const handleContextConfident = () => {
    stewardMockStore.updateState({
      overrideEmotion: null,
      context: { taskResult: 'none', userIntent: 'command' },
      text: 'I have compiled the standalone architecture layout.',
    });
  };

  const handleContextRelieved = () => {
    stewardMockStore.updateState({
      overrideEmotion: null,
      context: { taskResult: 'success' },
      text: 'Task completed successfully. All artifacts verified.',
    });
  };

  const handleContextWorried = () => {
    stewardMockStore.updateState({
      overrideEmotion: null,
      context: { taskResult: 'warning' },
      text: 'Notice: Abnormal reading detected in monitored component.',
    });
  };

  const handleContextFrustrated = () => {
    stewardMockStore.updateState({
      overrideEmotion: null,
      context: { taskResult: 'error' },
      text: 'Alert: Power coupling failed to synchronize. Manual intervention needed.',
    });
  };

  const handleContextConfusion = () => {
    stewardMockStore.updateState({
      overrideEmotion: null,
      context: { userExpressedConfusion: true, userIntent: 'clarification' },
      text: 'Let me explain that another way in simpler terms.',
    });
  };

  const handleContextUnexpected = () => {
    stewardMockStore.updateState({
      overrideEmotion: null,
      context: { unexpectedResult: true, taskResult: 'unexpected' },
      text: 'Surprisingly, yes! The process finished in record time.',
    });
  };

  // Demo Controls
  const handleStartDemo = () => {
    setDemoTurnIndex(0);
    const turn = MOCK_CONVERSATION_TURNS[0];
    setCustomText(turn.assistantText);
    stewardMockStore.updateState({
      text: turn.assistantText,
      status: turn.status,
      context: turn.context,
      overrideEmotion: turn.emotion || null,
    });
  };

  const handleNextDemoTurn = () => {
    const nextIdx = (demoTurnIndex + 1) % MOCK_CONVERSATION_TURNS.length;
    setDemoTurnIndex(nextIdx);
    const turn = MOCK_CONVERSATION_TURNS[nextIdx];
    setCustomText(turn.assistantText);
    stewardMockStore.updateState({
      text: turn.assistantText,
      status: turn.status,
      context: turn.context,
      overrideEmotion: turn.emotion || null,
    });
  };

  const handleRestartDemo = () => {
    handleStartDemo();
  };

  // Speech Presets
  const handleSendShortSpeech = () => {
    const text = 'Done.';
    setCustomText(text);
    stewardMockStore.updateState({ text, status: STEWARD_STATUSES.SUCCESS, context: { taskResult: 'success' } });
  };

  const handleSendMediumSpeech = () => {
    const text = "I've completed the requested analysis.";
    setCustomText(text);
    stewardMockStore.updateState({ text, status: STEWARD_STATUSES.RESPONDING, context: { taskResult: 'none' } });
  };

  const handleSendLongSpeech = () => {
    const text =
      'I have compiled the complete architectural matrix across all decoupled modules.\n\nAll Phase 1 through Phase 8 acceptance criteria are verified and operational.';
    setCustomText(text);
    stewardMockStore.updateState({ text, status: STEWARD_STATUSES.RESPONDING, context: { taskResult: 'none' } });
  };

  const handleClearSpeech = () => {
    setCustomText('');
    stewardMockStore.updateState({ text: '', status: STEWARD_STATUSES.IDLE, context: {} });
  };

  const handleRepeatIdenticalSpeech = () => {
    stewardMockStore.updateState({ text: currentState.text });
  };

  const handleSelectPreset = (preset) => {
    setCustomText(preset.text);
    stewardMockStore.updateState({
      status: preset.status,
      text: preset.text,
      context: preset.context || {},
      overrideEmotion: null,
    });
  };

  const handleStatusChange = (statusKey) => {
    stewardMockStore.updateState({
      status: statusKey,
      overrideEmotion: null,
    });
  };

  const handleEmotionOverride = (emotionId) => {
    stewardMockStore.updateState({
      overrideEmotion: emotionId,
    });
  };

  const handleClearEmotionOverride = () => {
    stewardMockStore.updateState({
      overrideEmotion: null,
    });
  };

  const handleSendCustomText = (e) => {
    e.preventDefault();
    stewardMockStore.updateState({
      text: customText,
    });
  };

  return (
    <aside className="mock-controls-floating" aria-label="Mock Steward Control Panel">
      <button
        className="mock-controls-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle Developer Mock Controller"
      >
        <Sliders size={15} />
        <span>Mock Steward Controller</span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {isOpen && (
        <div className="mock-controls-panel">
          <div className="mock-panel-title">
            <span>// Steward Input Simulator</span>
            <span>FINAL BUILD</span>
          </div>

          {/* Section 1: CONTEXT TESTING (Context Resolver Rule Evaluator) */}
          <div className="mock-custom-input-group">
            <div className="mock-input-label">
              <span>Context Testing (8 Emotions):</span>
              <span style={{ color: 'var(--accent-cyan)', fontSize: '0.62rem' }}>
                P{resolutionResult.priority}: {resolutionResult.reason.split(':')[0]}
              </span>
            </div>
            <div className="mock-speech-btn-group">
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleContextAttentive}
                title="Test question → ATTENTIVE"
              >
                <Sparkles size={11} />
                <span>ATTENTIVE</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleContextThinking}
                title="Test requiresClarification → THINKING"
              >
                <Sparkles size={11} />
                <span>THINKING</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleContextConfident}
                title="Test taskResult=none → CONFIDENT"
              >
                <Sparkles size={11} />
                <span>CONFIDENT</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleContextRelieved}
                title="Test taskResult=success → RELIEVED"
              >
                <Sparkles size={11} />
                <span>RELIEVED</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleContextWorried}
                title="Test taskResult=warning → WORRIED"
              >
                <Sparkles size={11} />
                <span>WORRIED</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleContextFrustrated}
                title="Test taskResult=error → FRUSTRATED"
              >
                <Sparkles size={11} />
                <span>FRUSTRATED</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleContextConfusion}
                title="Test userExpressedConfusion → CONFUSED"
              >
                <Sparkles size={11} />
                <span>CONFUSED</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleContextUnexpected}
                title="Test unexpectedResult → SURPRISED"
              >
                <Sparkles size={11} />
                <span>SURPRISED</span>
              </button>
            </div>
          </div>

          {/* Section 2: DEMO MODE CONTROLS (8 Story Turns) */}
          <div className="mock-section-divider">
            <div className="mock-input-label">
              <span>Demo Story (8 Turns):</span>
              <span style={{ color: 'var(--accent-cyan)' }}>
                Turn {demoTurnIndex + 1}/{MOCK_CONVERSATION_TURNS.length}
              </span>
            </div>
            <div className="mock-speech-btn-group">
              <button
                type="button"
                className="mock-speech-btn"
                style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b' }}
                onClick={handleStartDemo}
                title="Start Demo from Turn 1"
              >
                <Play size={12} />
                <span>Start Demo</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleNextDemoTurn}
                title="Advance to Next Turn"
              >
                <SkipForward size={12} />
                <span>Next Turn</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleRestartDemo}
                title="Restart Demo"
              >
                <RotateCcw size={12} />
                <span>Restart Demo</span>
              </button>
            </div>
          </div>

          {/* Section 2.5: CANONICAL CASE SCENARIOS */}
          <div className="mock-section-divider">
            <div className="mock-input-label">
              <span>Case Scenarios:</span>
              <span style={{ color: 'var(--accent-cyan)' }}>
                {mockCaseStore.getActiveScenarioKey()}
              </span>
            </div>
            <div className="mock-speech-btn-group">
              <button
                type="button"
                className="mock-speech-btn"
                onClick={() => mockCaseStore.loadScenario(SCENARIO_KEYS.ACT)}
                title="Load Scenario A: ACT (Autonomous Resolution)"
              >
                <Layers size={11} />
                <span>ACT</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={() => mockCaseStore.loadScenario(SCENARIO_KEYS.RESTRAIN)}
                title="Load Scenario B: RESTRAIN (Human Approval Required)"
              >
                <Layers size={11} />
                <span>RESTRAIN</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={() => mockCaseStore.loadScenario(SCENARIO_KEYS.RECOVER)}
                title="Load Scenario C: RECOVER (Household Verification Failed)"
              >
                <Layers size={11} />
                <span>RECOVER</span>
              </button>
            </div>
          </div>

          {/* Section 3: DIRECT EMOTION OVERRIDE (Asset & Animation Low-Level Testing) */}
          <div className="mock-section-divider">
            <div className="mock-input-label">
              <span>DIRECT EMOTION OVERRIDE:</span>
              {currentState?.overrideEmotion && (
                <button
                  type="button"
                  onClick={handleClearEmotionOverride}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-cyan)',
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  title="Reset to status/context-driven emotion mapping"
                >
                  <RefreshCw size={10} />
                  <span>Reset Auto</span>
                </button>
              )}
            </div>

            <div className="mock-emotion-grid">
              {Object.values(EMOTION_DEFINITIONS).map((emo) => {
                const isOverrideActive = currentState?.overrideEmotion === emo.id;
                const isCurrentActive = currentEmotion?.id === emo.id;
                return (
                  <button
                    key={emo.id}
                    className={`mock-emotion-btn ${
                      isOverrideActive ? 'active' : isCurrentActive ? 'active' : ''
                    }`}
                    style={{
                      '--emo-color': emo.ambientColor,
                      '--emo-glow': emo.ambientGlow,
                    }}
                    onClick={() => handleEmotionOverride(emo.id)}
                  >
                    <Smile size={12} style={{ color: emo.ambientColor }} />
                    <span>{emo.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Speech Reveal Testing */}
          <div className="mock-section-divider">
            <div className="mock-input-label">
              <span>Speech Reveal Testing:</span>
            </div>
            <div className="mock-speech-btn-group">
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleSendShortSpeech}
                title="Test short response"
              >
                <MessageSquareCode size={12} />
                <span>Short</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleSendMediumSpeech}
                title="Test medium response"
              >
                <MessageSquareCode size={12} />
                <span>Medium</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleSendLongSpeech}
                title="Test long multiline response"
              >
                <MessageSquareCode size={12} />
                <span>Long</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn"
                onClick={handleRepeatIdenticalSpeech}
                title="Test identical text re-emission"
              >
                <RotateCcw size={12} />
                <span>Identical</span>
              </button>
              <button
                type="button"
                className="mock-speech-btn clear-btn"
                onClick={handleClearSpeech}
                title="Clear text"
              >
                <XCircle size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Section 5: Status Presets */}
          <div className="mock-section-divider">
            <div className="mock-input-label" style={{ marginBottom: 6 }}>
              Status Presets:
            </div>
            <div className="mock-presets-grid">
              {MOCK_PRESETS.map((preset) => {
                const meta = STATUS_METADATA[preset.status];
                const isActive =
                  !currentState?.overrideEmotion &&
                  currentState?.status === preset.status &&
                  currentState?.text === preset.text;
                return (
                  <button
                    key={preset.id}
                    className={`mock-preset-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    <span className="mock-status-pill" style={{ backgroundColor: meta.color }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mock-custom-input-group">
            <div className="mock-input-label">Select Status:</div>
            <div className="mock-status-selector">
              {Object.values(STEWARD_STATUSES).map((st) => {
                const meta = STATUS_METADATA[st];
                const isSelected = !currentState?.overrideEmotion && currentState?.status === st;
                return (
                  <button
                    key={st}
                    className={`mock-status-opt ${isSelected ? 'selected' : ''}`}
                    style={{ '--opt-color': meta.color }}
                    onClick={() => handleStatusChange(st)}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 6: Custom Input */}
          <form onSubmit={handleSendCustomText} className="mock-custom-input-group">
            <div className="mock-input-label">Custom Mock Speech Text:</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <textarea
                className="mock-textarea"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type custom Steward output text..."
              />
              <button
                type="submit"
                className="mock-controls-toggle-btn"
                style={{ padding: '0 14px', borderRadius: 'var(--radius-sm)' }}
                title="Emit custom text"
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        </div>
      )}
    </aside>
  );
};
