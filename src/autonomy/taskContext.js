/**
 * Task Context Module
 * Phase 11 — Advanced Autonomy, Failure Recovery & Dynamic Replanning
 *
 * Manages active task execution metadata, completed steps, failure records,
 * scene versions, and recovery attempt history for a single active task.
 *
 * SHORT-LIVED ONLY. Zero long-term persistence.
 */

export class TaskContext {
  constructor(taskId, userRequest, originalPlan = null, sceneVersion = 1) {
    this.taskId = taskId || `task_${Date.now()}`;
    this.userRequest = userRequest || '';
    this.originalPlan = originalPlan ? { ...originalPlan } : null;
    this.currentPlan = originalPlan ? { ...originalPlan } : null;
    this.currentStepIndex = 0;
    this.completedSteps = [];
    this.failedSteps = [];
    this.targetObjects = originalPlan?.targetObject ? [{ ...originalPlan.targetObject }] : [];
    this.sceneVersion = sceneVersion;
    this.attempts = 0;
    this.recoveryHistory = [];
    this.startedAt = new Date().toISOString();
  }

  recordStepCompletion(stepIndex, step) {
    this.completedSteps.push({
      stepIndex,
      step: { ...step },
      completedAt: new Date().toISOString(),
    });
    this.currentStepIndex = stepIndex + 1;
  }

  recordStepFailure(stepIndex, step, reason) {
    this.failedSteps.push({
      stepIndex,
      step: { ...step },
      reason,
      failedAt: new Date().toISOString(),
    });
  }

  recordRecoveryAttempt(strategyName, result) {
    this.attempts++;
    this.recoveryHistory.push({
      attemptNumber: this.attempts,
      strategy: strategyName,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  updatePlan(newPlan) {
    if (newPlan) {
      this.currentPlan = { ...newPlan };
    }
  }

  updateSceneVersion(version) {
    this.sceneVersion = version;
  }

  getSnapshot() {
    return {
      taskId: this.taskId,
      userRequest: this.userRequest,
      originalPlan: this.originalPlan ? { ...this.originalPlan } : null,
      currentPlan: this.currentPlan ? { ...this.currentPlan } : null,
      currentStepIndex: this.currentStepIndex,
      completedStepsCount: this.completedSteps.length,
      completedSteps: [...this.completedSteps],
      failedStepsCount: this.failedSteps.length,
      failedSteps: [...this.failedSteps],
      sceneVersion: this.sceneVersion,
      attempts: this.attempts,
      recoveryHistory: [...this.recoveryHistory],
      startedAt: this.startedAt,
    };
  }
}
