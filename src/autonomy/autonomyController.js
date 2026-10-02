/**
 * Autonomy Controller Module
 * Phase 11 — Advanced Autonomy, Failure Recovery & Dynamic Replanning
 *
 * Primary high-level autonomy orchestrator managing TaskContext, TaskMonitor,
 * FailureClassifier, RecoveryStrategies, and ReplanningController.
 *
 * DO NOT BYPASS DETERMINISTIC EXECUTION BOUNDARIES.
 */

import { AUTONOMY_STATES, AUTONOMY_EVENTS } from './autonomyTypes';
import { TaskContext } from './taskContext';
import { TaskMonitor } from './taskMonitor';
import { classifyFailure } from './failureClassifier';
import { evaluateRecoveryStrategy } from './recoveryStrategies';
import { ReplanningController } from './replanningController';
import { reasoningController } from '../intelligence/reasoningController';
import { globalSceneAnalyzer } from '../scene/sceneStore';
import { taskEngine } from '../tasks/taskEngine';

export class AutonomyController {
  constructor() {
    this.state = AUTONOMY_STATES.IDLE;
    this.activeTaskContext = null;
    this.listeners = new Set();

    this.replanner = new ReplanningController();
    this.monitor = new TaskMonitor((report) => this._handleMonitorReport(report));
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
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(event, snapshot);
      } catch (err) {
        console.error('AutonomyController Listener Error:', err);
      }
    });
  }

  getState() {
    return this.state;
  }

  getSnapshot() {
    return {
      state: this.state,
      taskContext: this.activeTaskContext ? this.activeTaskContext.getSnapshot() : null,
    };
  }

  cancel() {
    this.monitor.stop();
    reasoningController.cancel();
    taskEngine.cancelTask();

    if (this.state !== AUTONOMY_STATES.IDLE) {
      this.state = AUTONOMY_STATES.CANCELLED;
      this._notify({
        type: AUTONOMY_EVENTS.AUTONOMY_CANCELLED,
      });
    }

    this.state = AUTONOMY_STATES.IDLE;
    this.activeTaskContext = null;
  }

  /**
   * Primary entry point: Starts an autonomous natural-language task execution pipeline
   *
   * @param {string} userRequest - Natural language task instruction
   * @param {Object} [sceneStateOverride] - Optional active SceneState override
   * @returns {Promise<boolean>} Resolves true if task completes successfully
   */
  async startAutonomousTask(userRequest, sceneStateOverride = null) {
    if (!userRequest) return false;

    // 1. Reset previous active autonomy run
    this.cancel();

    const sceneState = sceneStateOverride || globalSceneAnalyzer.getSceneState();
    const sceneVersion = sceneState?.sceneVersion || 1;

    // 2. Initialize TaskContext
    const taskId = `autonomy_task_${Date.now()}`;
    this.activeTaskContext = new TaskContext(taskId, userRequest, null, sceneVersion);

    this.state = AUTONOMY_STATES.EXECUTING;

    this._notify({
      type: AUTONOMY_EVENTS.AUTONOMY_STARTED,
      taskId,
      userRequest,
    });

    // 3. Start Task Monitor
    this.monitor.start();

    // 4. Request AI Reasoning Plan via ReasoningController
    const success = await reasoningController.reason(userRequest, sceneState);

    if (!success) {
      const snapshot = reasoningController.getReasoningStateSnapshot();
      if (snapshot.state === 'NEEDS_CLARIFICATION') {
        this.state = AUTONOMY_STATES.WAITING_FOR_USER;
        this._notify({
          type: AUTONOMY_EVENTS.AUTONOMY_WAITING_USER,
          question: snapshot.clarificationQuestion,
        });
      } else {
        this.state = AUTONOMY_STATES.FAILED;
        this._notify({
          type: AUTONOMY_EVENTS.AUTONOMY_FAILED,
          error: snapshot.lastError || 'Initial AI reasoning plan generation failed',
        });
      }
      return false;
    }

    // Capture initial plan in context
    const reasoningSnapshot = reasoningController.getReasoningStateSnapshot();
    if (reasoningSnapshot.currentPlan) {
      this.activeTaskContext.originalPlan = { ...reasoningSnapshot.currentPlan };
      this.activeTaskContext.currentPlan = { ...reasoningSnapshot.currentPlan };
    }

    this.state = AUTONOMY_STATES.MONITORING;
    this._notify({
      type: AUTONOMY_EVENTS.AUTONOMY_MONITORING,
    });

    return true;
  }

  /**
   * Internal Event Handler for TaskMonitor reports
   */
  async _handleMonitorReport(report) {
    if (!this.activeTaskContext || this.state === AUTONOMY_STATES.IDLE) return;

    const sceneState = globalSceneAnalyzer.getSceneState();

    switch (report.type) {
      case 'TASK_STEP_STARTED':
        if (report.stepIndex !== undefined && report.step) {
          this.activeTaskContext.recordStepCompletion(report.stepIndex, report.step);
        }
        break;

      case 'TASK_COMPLETED':
        this.state = AUTONOMY_STATES.COMPLETED;
        this.monitor.stop();
        this._notify({
          type: AUTONOMY_EVENTS.AUTONOMY_COMPLETED,
          taskId: this.activeTaskContext.taskId,
        });
        break;

      case 'TASK_STEP_FAILED':
      case 'NAVIGATION_NO_PATH':
      case 'NAVIGATION_ERROR':
      case 'SCENE_ENVIRONMENT_CHANGED': {
        this.state = AUTONOMY_STATES.RECOVERING;

        // 1. Classify Failure
        const classification = classifyFailure(report, sceneState, this.activeTaskContext);

        this._notify({
          type: AUTONOMY_EVENTS.AUTONOMY_FAILURE_DETECTED,
          classification,
        });

        // 2. Evaluate Recovery Strategy
        const strategy = evaluateRecoveryStrategy(classification, this.activeTaskContext, sceneState);

        this._notify({
          type: AUTONOMY_EVENTS.AUTONOMY_RECOVERY_STARTED,
          strategy,
        });

        // 3. Execute Recovery Action
        if (strategy.action === AUTONOMY_STATES.REPLANNING && strategy.canReplan) {
          this.state = AUTONOMY_STATES.REPLANNING;
          this._notify({
            type: AUTONOMY_EVENTS.AUTONOMY_REPLANNING_STARTED,
          });

          const replanRes = await this.replanner.replanTask(this.activeTaskContext, sceneState, strategy);

          if (replanRes.success && replanRes.newPlan) {
            this.state = AUTONOMY_STATES.MONITORING;
            this._notify({
              type: AUTONOMY_EVENTS.AUTONOMY_REPLAN_SUCCESS,
              newPlan: replanRes.newPlan,
            });
          } else {
            this.state = AUTONOMY_STATES.FAILED;
            this.monitor.stop();
            this._notify({
              type: AUTONOMY_EVENTS.AUTONOMY_FAILED,
              error: replanRes.error || 'Replanning failed to generate valid replacement plan',
            });
          }
        } else if (strategy.action === AUTONOMY_STATES.WAITING_FOR_USER) {
          this.state = AUTONOMY_STATES.WAITING_FOR_USER;
          this.monitor.stop();
          this._notify({
            type: AUTONOMY_EVENTS.AUTONOMY_WAITING_USER,
            speechText: strategy.speechText,
          });
        } else if (strategy.action === AUTONOMY_STATES.CANCELLED) {
          this.cancel();
        } else {
          this.state = AUTONOMY_STATES.FAILED;
          this.monitor.stop();
          this._notify({
            type: AUTONOMY_EVENTS.AUTONOMY_FAILED,
            error: strategy.speechText || 'Task recovery failed',
          });
        }
        break;
      }

      default:
        break;
    }
  }
}

// Global default Autonomy Controller instance
export const autonomyController = new AutonomyController();
