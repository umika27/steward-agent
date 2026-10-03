/**
 * Task Monitor Module
 * Phase 11 — Advanced Autonomy, Failure Recovery & Dynamic Replanning
 *
 * Presentation-independent event observer listening to TaskEngine, ButlerNavigator,
 * and SceneImageStore events to report structured execution telemetry to AutonomyController.
 *
 * DOES NOT execute navigation, alter DOM, or call AI models.
 */

import { taskEngine, TASK_EVENT_TYPES } from '../tasks/taskEngine';
import { butlerNavigator, NAVIGATION_EVENT_TYPES } from '../navigation/butlerNavigator';
import { sceneImageStore, SCENE_IMAGE_EVENTS } from '../scene/sceneImageStore';

export class TaskMonitor {
  constructor(onReport) {
    this.onReport = onReport;
    this.isMonitoring = false;
    this.unsubTask = null;
    this.unsubNav = null;
    this.unsubImage = null;
  }

  start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // 1. TaskEngine Observer
    this.unsubTask = taskEngine.subscribe((event, taskSnapshot) => {
      if (!this.isMonitoring) return;

      switch (event.type) {
        case TASK_EVENT_TYPES.TASK_STEP_STARTED:
          this._emit({
            type: 'TASK_STEP_STARTED',
            stepIndex: event.stepIndex,
            stepType: event.stepType,
            description: event.description,
            snapshot: taskSnapshot,
          });
          break;

        case TASK_EVENT_TYPES.TASK_COMPLETED:
          this._emit({
            type: 'TASK_COMPLETED',
            taskId: event.taskId,
            snapshot: taskSnapshot,
          });
          break;

        case TASK_EVENT_TYPES.TASK_ERROR:
        case TASK_EVENT_TYPES.TASK_PLAN_FAILED:
          this._emit({
            type: 'TASK_STEP_FAILED',
            reason: event.reason || 'TASK_ERROR',
            error: event.error || 'Task Engine reported execution failure',
            snapshot: taskSnapshot,
          });
          break;

        case TASK_EVENT_TYPES.TASK_CANCELLED:
          this._emit({
            type: 'TASK_CANCELLED',
            taskId: event.taskId,
          });
          break;

        default:
          break;
      }
    });

    // 2. ButlerNavigator Observer
    this.unsubNav = butlerNavigator.subscribe((event, navSnapshot) => {
      if (!this.isMonitoring) return;

      switch (event.type) {
        case NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_NO_PATH:
          this._emit({
            type: 'NAVIGATION_NO_PATH',
            targetObjectId: event.targetObjectId,
            targetLabel: event.targetLabel,
            navSnapshot,
          });
          break;

        case NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_CANCELLED:
          this._emit({
            type: 'NAVIGATION_CANCELLED',
            navSnapshot,
          });
          break;

        case NAVIGATION_EVENT_TYPES.BUTLER_NAVIGATION_ERROR:
          this._emit({
            type: 'NAVIGATION_ERROR',
            error: event.error,
            navSnapshot,
          });
          break;

        default:
          break;
      }
    });

    // 3. SceneImageStore Observer (Environment change detection)
    this.unsubImage = sceneImageStore.subscribe((event) => {
      if (!this.isMonitoring) return;

      if (
        event.type === SCENE_IMAGE_EVENTS.SCENE_IMAGE_CHANGED ||
        event.type === SCENE_IMAGE_EVENTS.SCENE_IMAGE_RESET
      ) {
        this._emit({
          type: 'SCENE_ENVIRONMENT_CHANGED',
          event: event.type,
        });
      }
    });
  }

  stop() {
    this.isMonitoring = false;

    if (this.unsubTask) {
      this.unsubTask();
      this.unsubTask = null;
    }
    if (this.unsubNav) {
      this.unsubNav();
      this.unsubNav = null;
    }
    if (this.unsubImage) {
      this.unsubImage();
      this.unsubImage = null;
    }
  }

  _emit(report) {
    if (typeof this.onReport === 'function') {
      try {
        this.onReport(report);
      } catch (err) {
        console.error('TaskMonitor emit error:', err);
      }
    }
  }
}
