/**
 * Task Executor Module
 * Phase 9 — Advanced Task Intelligence & Semantic Task Planning
 *
 * Thin execution layer executing planned semantic task steps sequentially.
 * Presentation-independent, zero A* pathfinding logic, zero coordinate math, zero direct React DOM manipulation.
 */

import { butlerNavigator, NAVIGATION_EVENT_TYPES } from '../navigation/butlerNavigator';

export class TaskExecutor {
  constructor(onStepAdvance, onTaskComplete, onTaskFail, onNotify) {
    this.onStepAdvance = onStepAdvance;
    this.onTaskComplete = onTaskComplete;
    this.onTaskFail = onTaskFail;
    this.onNotify = onNotify;

    this.activePlan = null;
    this.currentStepIndex = -1;
    this.stepTimer = null;
    this.unsubNavigator = null;

    this._setupNavigationListener();
  }

  _setupNavigationListener() {
    this.unsubNavigator = butlerNavigator.subscribe((event) => {
      if (!this.activePlan || this.currentStepIndex < 0) return;

      const currentStep = this.activePlan.steps[this.currentStepIndex];
      if (!currentStep) return;

      if (currentStep.type === 'NAVIGATE' || currentStep.type === 'RETURN_HOME') {
        if (event.type === NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_ARRIVED) {
          this._advance();
        } else if (event.type === NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_NO_PATH) {
          this._fail('NAVIGATION_FAILED', `No valid path found to target ${currentStep.target?.label || 'destination'}`);
        } else if (
          event.type === NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_CANCELLED ||
          event.type === NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_ERROR
        ) {
          this._fail('NAVIGATION_CANCELLED', 'Butler navigation was cancelled or encountered an error');
        }
      }
    });
  }

  executePlan(plan) {
    this.stop();
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      this._fail('INVALID_TASK_PLAN', 'Task plan is empty or invalid');
      return;
    }

    this.activePlan = plan;
    this.currentStepIndex = 0;
    this._runStep(0);
  }

  stop() {
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
    this.activePlan = null;
    this.currentStepIndex = -1;
  }

  _advance() {
    if (!this.activePlan) return;
    const nextIdx = this.currentStepIndex + 1;
    if (nextIdx < this.activePlan.steps.length) {
      this.currentStepIndex = nextIdx;
      this._runStep(nextIdx);
    } else {
      if (typeof this.onTaskComplete === 'function') {
        this.onTaskComplete(this.activePlan);
      }
      this.stop();
    }
  }

  _fail(reason, message) {
    const failedPlan = this.activePlan;
    this.stop();
    if (typeof this.onTaskFail === 'function') {
      this.onTaskFail(reason, message, failedPlan);
    }
  }

  _runStep(stepIndex) {
    if (!this.activePlan || stepIndex >= this.activePlan.steps.length) {
      this._advance();
      return;
    }

    const step = this.activePlan.steps[stepIndex];

    if (typeof this.onStepAdvance === 'function') {
      this.onStepAdvance(stepIndex, step, this.activePlan);
    }

    switch (step.type) {
      case 'NAVIGATE':
        if (typeof this.onNotify === 'function') {
          this.onNotify({
            type: 'TASK_NAVIGATION_REQUESTED',
            targetObject: step.target,
            returnHome: false,
          });
        }
        break;

      case 'RETURN_HOME':
        if (typeof this.onNotify === 'function') {
          this.onNotify({
            type: 'TASK_NAVIGATION_REQUESTED',
            targetObject: null,
            returnHome: true,
          });
        }
        break;

      case 'SPEAK':
        if (typeof this.onNotify === 'function') {
          this.onNotify({
            type: 'TASK_SPEECH_REQUESTED',
            text: step.text,
            emotionContext: step.emotionContext || null,
          });
        }
        this.stepTimer = setTimeout(() => {
          this._advance();
        }, 150);
        break;

      case 'WAIT':
        if (typeof this.onNotify === 'function') {
          this.onNotify({
            type: 'TASK_WAIT_STARTED',
            duration: step.duration || 1000,
          });
        }
        this.stepTimer = setTimeout(() => {
          this._advance();
        }, step.duration || 1000);
        break;

      case 'COMPLETE':
        this._advance();
        break;

      default:
        this._advance();
        break;
    }
  }

  destroy() {
    this.stop();
    if (this.unsubNavigator) {
      this.unsubNavigator();
      this.unsubNavigator = null;
    }
  }
}
