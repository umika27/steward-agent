/**
 * Task Engine Module
 * Phase 9 — Advanced Task Intelligence & Semantic Task Planning
 *
 * Primary task orchestrator integrating TaskTargetResolver, TaskPlanner, TaskExecutor,
 * and TaskIntents over active SceneState.
 *
 * Public API remains 100% backward-compatible with Phase 4/5 callers (ConversationDemo, etc.).
 * Presentation-independent, zero A* grid awareness, zero hardcoded room coordinates.
 */

import { getIntent } from './taskIntents';
import { resolveTaskTarget } from './taskTargetResolver';
import { createTaskPlanFromIntent } from './taskPlanner';
import { TaskExecutor } from './taskExecutor';
import { globalSceneAnalyzer } from '../scene/sceneStore';

export const TASK_STATES = {
  IDLE: 'IDLE',
  PLANNING: 'PLANNING',
  NAVIGATING: 'NAVIGATING',
  INTERACTING: 'INTERACTING',
  WAITING: 'WAITING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  ERROR: 'ERROR',
};

export const TASK_EVENT_TYPES = {
  TASK_STARTED: 'TASK_STARTED',
  TASK_TARGET_RESOLVED: 'TASK_TARGET_RESOLVED',
  TASK_PLAN_CREATED: 'TASK_PLAN_CREATED',
  TASK_STEP_STARTED: 'TASK_STEP_STARTED',
  TASK_NAVIGATION_REQUESTED: 'TASK_NAVIGATION_REQUESTED',
  TASK_SPEECH_REQUESTED: 'TASK_SPEECH_REQUESTED',
  TASK_WAIT_STARTED: 'TASK_WAIT_STARTED',
  TASK_INTERACTION_STARTED: 'TASK_INTERACTION_STARTED',
  TASK_INTERACTION_COMPLETED: 'TASK_INTERACTION_COMPLETED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_CANCELLED: 'TASK_CANCELLED',
  TASK_ERROR: 'TASK_ERROR',
  TASK_PLAN_FAILED: 'TASK_PLAN_FAILED',
};

export class TaskEngine {
  constructor() {
    this.state = TASK_STATES.IDLE;
    this.currentTask = null;
    this.currentStepIndex = -1;
    this.listeners = new Set();

    this.executor = new TaskExecutor(
      (stepIndex, step, plan) => this._handleStepAdvance(stepIndex, step, plan),
      (plan) => this._handleTaskComplete(plan),
      (reason, message, plan) => this._handleTaskFail(reason, message, plan),
      (notifyEvent) => this._notify(notifyEvent)
    );
  }

  /**
   * Subscribes a listener to task state changes and events
   * @param {Function} callback - (event, taskStateSnapshot) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  _notify(event) {
    const snapshot = this.getTaskStateSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(event, snapshot);
      } catch (err) {
        console.error('TaskEngine Listener Error:', err);
      }
    });
  }

  getTaskState() {
    return this.state;
  }

  getCurrentTask() {
    return this.currentTask ? { ...this.currentTask } : null;
  }

  getTaskStateSnapshot() {
    const currentStep =
      this.currentTask && this.currentStepIndex >= 0 && this.currentStepIndex < this.currentTask.steps.length
        ? this.currentTask.steps[this.currentStepIndex]
        : null;

    return {
      state: this.state,
      taskId: this.currentTask?.id || null,
      taskType: this.currentTask?.intent || this.currentTask?.type || null,
      intent: this.currentTask?.intent || 'INSPECT',
      targetObjectId: this.currentTask?.targetObjectId || null,
      targetObject: this.currentTask?.targetObject ? { ...this.currentTask.targetObject } : null,
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.currentTask?.steps?.length || 0,
      currentStep: currentStep ? { ...currentStep } : null,
      plan: this.currentTask ? { ...this.currentTask } : null,
    };
  }

  /**
   * Primary entry point: Initiates a semantic task for a target object or intent.
   *
   * @param {Object|string} targetOrIntent - Scene object OR intent string ('INSPECT', 'RETRIEVE')
   * @param {Array|Object} [sceneObjectsOrState] - SceneState OR objects array
   * @param {Object} [options] - Additional search/planning options
   */
  startTask(targetOrIntent, sceneObjectsOrState = null, options = {}) {
    // 1. Cancel any active running task
    if (this.state !== TASK_STATES.IDLE && this.state !== TASK_STATES.COMPLETED) {
      this.cancelTask();
    }

    this.state = TASK_STATES.PLANNING;

    // Normalize sceneState input
    let sceneState = null;
    if (sceneObjectsOrState && Array.isArray(sceneObjectsOrState)) {
      sceneState = { objects: sceneObjectsOrState };
    } else if (sceneObjectsOrState && typeof sceneObjectsOrState === 'object') {
      sceneState = sceneObjectsOrState;
    } else {
      sceneState = globalSceneAnalyzer.getSceneState();
    }

    // Determine target vs intent input
    let intentKey = 'INSPECT';
    let targetObject = null;

    if (typeof targetOrIntent === 'string') {
      intentKey = targetOrIntent;
    } else if (targetOrIntent && typeof targetOrIntent === 'object') {
      targetObject = targetOrIntent;
      intentKey = options.intent || 'INSPECT';
    }

    const intent = getIntent(intentKey);

    // 2. Resolve Target Object dynamically via TaskTargetResolver
    const targetRes = resolveTaskTarget(sceneState, intent, {
      object: targetObject,
      ...options,
    });

    if (!targetRes.success && intent.id !== 'RETURN' && intent.id !== 'WAIT') {
      this.state = TASK_STATES.ERROR;
      this._notify({
        type: TASK_EVENT_TYPES.TASK_PLAN_FAILED,
        reason: 'NO_TARGET_FOUND',
        error: targetRes.error || 'No suitable target object found in scene',
      });
      return null;
    }

    const resolvedTarget = targetRes.targetObject;

    this._notify({
      type: TASK_EVENT_TYPES.TASK_TARGET_RESOLVED,
      targetObjectId: resolvedTarget?.id || null,
      targetLabel: resolvedTarget?.label || 'Target',
      targetCategory: resolvedTarget?.category || 'general',
      intent: intent.id,
    });

    // 3. Generate Semantic Task Plan via TaskPlanner
    const planRes = createTaskPlanFromIntent(intent, resolvedTarget, sceneState, options);

    if (!planRes.success || !planRes.plan) {
      this.state = TASK_STATES.ERROR;
      this._notify({
        type: TASK_EVENT_TYPES.TASK_PLAN_FAILED,
        reason: planRes.reason || 'REQUIRED_OBJECT_MISSING',
        error: planRes.error || 'Failed to generate task plan',
      });
      return null;
    }

    const taskPlan = planRes.plan;
    this.currentTask = taskPlan;
    this.currentStepIndex = 0;

    this._notify({
      type: TASK_EVENT_TYPES.TASK_STARTED,
      taskId: taskPlan.id,
      intent: intent.id,
      targetObjectId: taskPlan.targetObjectId,
      targetLabel: resolvedTarget?.label || 'Target',
    });

    this._notify({
      type: TASK_EVENT_TYPES.TASK_PLAN_CREATED,
      planId: taskPlan.id,
      stepsCount: taskPlan.steps.length,
    });

    // 4. Execute Task Plan via TaskExecutor
    this.executor.executePlan(taskPlan);
    return this.currentTask;
  }

  /**
   * Cancels current active task, clears timers & resets to IDLE
   */
  cancelTask() {
    this.executor.stop();

    if (this.state !== TASK_STATES.IDLE) {
      this.state = TASK_STATES.CANCELLED;
      this._notify({
        type: TASK_EVENT_TYPES.TASK_CANCELLED,
        taskId: this.currentTask?.id || null,
      });
    }

    this.state = TASK_STATES.IDLE;
    this.currentTask = null;
    this.currentStepIndex = -1;
  }

  _handleStepAdvance(stepIndex, step, plan) {
    this.currentStepIndex = stepIndex;

    if (step.type === 'NAVIGATE' || step.type === 'RETURN_HOME') {
      this.state = TASK_STATES.NAVIGATING;
    } else if (step.type === 'SPEAK' || step.type === 'INTERACT') {
      this.state = TASK_STATES.INTERACTING;
    } else if (step.type === 'WAIT') {
      this.state = TASK_STATES.WAITING;
    }

    this._notify({
      type: TASK_EVENT_TYPES.TASK_STEP_STARTED,
      stepIndex,
      stepType: step.type,
      description: step.description,
    });
  }

  _handleTaskComplete(plan) {
    this.state = TASK_STATES.COMPLETED;
    this._notify({
      type: TASK_EVENT_TYPES.TASK_COMPLETED,
      taskId: plan?.id || null,
    });
  }

  _handleTaskFail(reason, message, plan) {
    this.state = TASK_STATES.ERROR;
    this._notify({
      type: TASK_EVENT_TYPES.TASK_ERROR,
      reason,
      error: message,
      taskId: plan?.id || null,
    });
  }
}

// Global default Task Engine instance
export const taskEngine = new TaskEngine();
