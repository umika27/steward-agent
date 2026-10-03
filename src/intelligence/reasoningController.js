/**
 * Reasoning Controller Module
 * Phase 10 — AI Reasoning & Natural-Language Task Planning
 *
 * Core orchestrator for natural-language reasoning requests.
 * Manages provider communication, output validation, compilation, conversation context,
 * and dispatching validated plans to Phase 9 TaskEngine.
 *
 * DO NOT BYPASS PHASE 9.
 * Flow: User Request -> ReasoningController -> Provider -> Validator -> Compiler -> TaskEngine -> TaskExecutor -> ButlerNavigator -> Phase 8 A*
 */

import { REASONING_STATUS, REASONING_EVENTS } from './reasoningTypes';
import { getReasoningProvider } from './reasoningProviderFactory';
import { validateReasoningOutput } from './reasoningValidator';
import { compileTaskPlan } from './taskPlanCompiler';
import { globalSceneAnalyzer } from '../scene/sceneStore';
import { taskEngine } from '../tasks/taskEngine';

export class ReasoningController {
  constructor() {
    this.state = REASONING_STATUS.IDLE;
    this.currentPlan = null;
    this.lastError = null;
    this.clarificationQuestion = null;
    this.conversationContext = {
      previousTarget: null,
      history: [],
    };
    this.listeners = new Set();
    this.activePromiseCancel = false;
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  _notify(event) {
    const snapshot = this.getReasoningStateSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(event, snapshot);
      } catch (err) {
        console.error('ReasoningController Listener Error:', err);
      }
    });
  }

  getState() {
    return this.state;
  }

  getReasoningStateSnapshot() {
    return {
      state: this.state,
      currentPlan: this.currentPlan ? { ...this.currentPlan } : null,
      lastError: this.lastError,
      clarificationQuestion: this.clarificationQuestion,
      conversationContext: { ...this.conversationContext },
    };
  }

  cancel() {
    this.activePromiseCancel = true;
    if (this.state === REASONING_STATUS.ANALYZING) {
      this.state = REASONING_STATUS.IDLE;
      this._notify({
        type: REASONING_EVENTS.REASONING_CANCELLED,
      });
    }
    this.state = REASONING_STATUS.IDLE;
  }

  /**
   * Main entrypoint: Processes a natural language request from user
   *
   * @param {string} userRequest - Natural language query or prompt
   * @param {Object} [sceneStateOverride] - Optional active SceneState override
   * @returns {Promise<boolean>} Resolves true if plan was validated and dispatched to TaskEngine
   */
  async reason(userRequest, sceneStateOverride = null) {
    if (!userRequest || typeof userRequest !== 'string') {
      this.state = REASONING_STATUS.ERROR;
      this.lastError = 'Invalid or empty user request';
      this._notify({ type: REASONING_EVENTS.REASONING_FAILED, error: this.lastError });
      return false;
    }

    this.activePromiseCancel = false;
    this.state = REASONING_STATUS.ANALYZING;
    this.lastError = null;
    this.clarificationQuestion = null;

    this._notify({
      type: REASONING_EVENTS.REASONING_STARTED,
      userRequest,
    });

    const sceneState = sceneStateOverride || globalSceneAnalyzer.getSceneState();
    const provider = getReasoningProvider();

    try {
      // 1. Query Reasoning Provider
      const rawOutput = await provider.analyzeRequest({
        userRequest,
        sceneState,
        conversationContext: this.conversationContext,
      });

      if (this.activePromiseCancel) {
        return false;
      }

      // 2. Validate Reasoning Output via ReasoningValidator
      const validation = validateReasoningOutput(rawOutput, sceneState);

      if (!validation.isValid) {
        this.state = REASONING_STATUS.INVALID_PLAN;
        this.lastError = validation.error || 'Model returned invalid plan structure';
        this._notify({
          type: REASONING_EVENTS.REASONING_FAILED,
          reason: validation.reason,
          error: this.lastError,
        });
        return false;
      }

      const validatedPlan = validation.plan;

      // 3. Handle Status Outcomes
      if (validatedPlan.status === 'NEEDS_CLARIFICATION') {
        this.state = REASONING_STATUS.NEEDS_CLARIFICATION;
        this.clarificationQuestion = validatedPlan.question;
        this._notify({
          type: REASONING_EVENTS.REASONING_CLARIFICATION_NEEDED,
          question: validatedPlan.question,
        });
        return false;
      }

      if (validatedPlan.status === 'NO_TARGET') {
        this.state = REASONING_STATUS.NO_TARGET;
        this.lastError = validatedPlan.reason || 'Target object not found in scene';
        this._notify({
          type: REASONING_EVENTS.REASONING_FAILED,
          reason: 'NO_TARGET',
          error: this.lastError,
        });
        return false;
      }

      // 4. Compile AI Plan to Phase 9 Executable Task Plan
      const compilation = compileTaskPlan(validatedPlan, sceneState);

      if (!compilation.success || !compilation.compiledTaskPlan) {
        this.state = REASONING_STATUS.INVALID_PLAN;
        this.lastError = compilation.error || 'Failed to compile AI plan for execution';
        this._notify({
          type: REASONING_EVENTS.REASONING_FAILED,
          reason: compilation.reason,
          error: this.lastError,
        });
        return false;
      }

      const compiledTaskPlan = compilation.compiledTaskPlan;
      this.currentPlan = compiledTaskPlan;
      this.state = REASONING_STATUS.PLAN_READY;

      // Update short-term conversation context
      if (compiledTaskPlan.targetObject) {
        this.conversationContext.previousTarget = { ...compiledTaskPlan.targetObject };
      }
      this.conversationContext.history.push({
        request: userRequest,
        intent: compiledTaskPlan.intent,
        timestamp: Date.now(),
      });

      this._notify({
        type: REASONING_EVENTS.REASONING_COMPLETED,
        plan: compiledTaskPlan,
      });

      // 5. Dispatch Validated Plan to Phase 9 TaskEngine
      taskEngine.startTask(
        compiledTaskPlan.targetObject,
        sceneState,
        { intent: compiledTaskPlan.intent }
      );

      return true;
    } catch (err) {
      if (this.activePromiseCancel) return false;
      this.state = REASONING_STATUS.ERROR;
      this.lastError = err.message || 'Reasoning provider request failed';
      this._notify({
        type: REASONING_EVENTS.REASONING_FAILED,
        reason: 'PROVIDER_ERROR',
        error: this.lastError,
      });
      return false;
    }
  }
}

// Global default Reasoning Controller instance
export const reasoningController = new ReasoningController();
