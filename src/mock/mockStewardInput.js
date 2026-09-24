/**
 * Standalone Mock Data Layer for Steward Butler UI (Phases 1-6)
 *
 * Defines the schema and mock driver for Steward input data including
 * contextual signals ({ userIntent, taskResult, userExpressedConfusion, etc. }).
 */

export const STEWARD_STATUSES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  PROCESSING: 'processing',
  RESPONDING: 'responding',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

export const STATUS_METADATA = {
  [STEWARD_STATUSES.IDLE]: {
    label: 'IDLE',
    description: 'Steward is standby and awaiting prompt.',
    color: '#3b82f6',
    badgeClass: 'status-idle',
  },
  [STEWARD_STATUSES.THINKING]: {
    label: 'THINKING',
    description: 'Analyzing context and formulating plan...',
    color: '#a855f7',
    badgeClass: 'status-thinking',
  },
  [STEWARD_STATUSES.PROCESSING]: {
    label: 'PROCESSING',
    description: 'Executing tool or compiling dataset...',
    color: '#06b6d4',
    badgeClass: 'status-processing',
  },
  [STEWARD_STATUSES.RESPONDING]: {
    label: 'RESPONDING',
    description: 'Synthesizing response output for user...',
    color: '#10b981',
    badgeClass: 'status-responding',
  },
  [STEWARD_STATUSES.SUCCESS]: {
    label: 'SUCCESS',
    description: 'Operation completed successfully.',
    color: '#22c55e',
    badgeClass: 'status-success',
  },
  [STEWARD_STATUSES.WARNING]: {
    label: 'WARNING',
    description: 'Attention required: sub-optimal performance.',
    color: '#f59e0b',
    badgeClass: 'status-warning',
  },
  [STEWARD_STATUSES.ERROR]: {
    label: 'ERROR',
    description: 'Task execution encountered an anomaly.',
    color: '#ef4444',
    badgeClass: 'status-error',
  },
};

export const MOCK_PRESETS = [
  {
    id: 'preset-welcome',
    name: 'Standard Greeting (Idle)',
    status: STEWARD_STATUSES.IDLE,
    text: 'Good day. I am Steward Butler. How may I assist your workflow today?',
    context: { userIntent: 'question', taskResult: 'none' },
  },
  {
    id: 'preset-thinking',
    name: 'Analyzing Query (Thinking)',
    status: STEWARD_STATUSES.THINKING,
    text: 'Analyzing your request parameters and scanning available context repositories...',
    context: { requiresClarification: true },
  },
  {
    id: 'preset-processing',
    name: 'Running Workflows (Processing)',
    status: STEWARD_STATUSES.PROCESSING,
    text: 'Compiling project artifacts and evaluating structural constraints...',
    context: { userIntent: 'command' },
  },
  {
    id: 'preset-responding',
    name: 'Active Output (Responding)',
    status: STEWARD_STATUSES.RESPONDING,
    text: 'I have prepared the standalone architecture layout. All components are strictly decoupled.',
    context: { taskResult: 'none' },
  },
  {
    id: 'preset-success',
    name: 'Task Done (Success)',
    status: STEWARD_STATUSES.SUCCESS,
    text: 'Verification complete. All Phase requirements have been satisfied flawlessly.',
    context: { taskResult: 'success' },
  },
  {
    id: 'preset-warning',
    name: 'Resource Alert (Warning)',
    status: STEWARD_STATUSES.WARNING,
    text: 'Notice: Memory usage spiked slightly during layout matrix compilation, but system remains fully responsive.',
    context: { taskResult: 'warning' },
  },
  {
    id: 'preset-error',
    name: 'Exception Handled (Error)',
    status: STEWARD_STATUSES.ERROR,
    text: 'Simulation alert: Unable to reach mock endpoint. Falling back to internal local cache buffer.',
    context: { taskResult: 'error' },
  },
];

export const INITIAL_STEWARD_STATE = {
  text: MOCK_PRESETS[0].text,
  status: MOCK_PRESETS[0].status,
  context: MOCK_PRESETS[0].context,
  overrideEmotion: null,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
};

class StewardMockEventEmitter {
  constructor() {
    this.currentState = { ...INITIAL_STEWARD_STATE };
    this.listeners = new Set();
  }

  getState() {
    return { ...this.currentState };
  }

  updateState(newState) {
    this.currentState = {
      ...this.currentState,
      ...newState,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}

export const stewardMockStore = new StewardMockEventEmitter();
