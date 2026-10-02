/**
 * Scene Interaction Controller Module
 * Phase 3 — Interactive Detected Scene
 *
 * Manages object selection state, hover state, and selection events
 * for detected scene perception objects.
 *
 * DO NOT move the Butler here.
 * DO NOT execute tasks or repair workflows here.
 * Phase 4 will subscribe to SCENE_OBJECT_SELECTED events for Butler navigation.
 */

import { findTargetObjectAtPoint } from './sceneCoordinateMapper';

export const SCENE_EVENT_TYPES = {
  SCENE_OBJECT_SELECTED: 'SCENE_OBJECT_SELECTED',
  SCENE_SELECTION_CLEARED: 'SCENE_SELECTION_CLEARED',
  SCENE_OBJECT_HOVERED: 'SCENE_OBJECT_HOVERED',
};

export class SceneInteractionController {
  constructor() {
    this.selectedObject = null;
    this.hoveredObject = null;
    this.listeners = new Set();
  }

  /**
   * Subscribes a listener to interaction state changes & events
   * @param {Function} callback - (event, controllerState) => void
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

  /**
   * Private helper to notify all subscribers
   */
  _notify(event) {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(event, state);
      } catch (err) {
        console.error('SceneInteractionController Listener Error:', err);
      }
    });
  }

  /**
   * Selects a detected scene object and emits SCENE_OBJECT_SELECTED
   * @param {Object|null} object - Complete normalized scene object or null
   */
  selectObject(object) {
    if (this.selectedObject?.id === object?.id) {
      return this.selectedObject;
    }

    this.selectedObject = object || null;

    const event = object
      ? {
          type: SCENE_EVENT_TYPES.SCENE_OBJECT_SELECTED,
          object: { ...object },
        }
      : {
          type: SCENE_EVENT_TYPES.SCENE_SELECTION_CLEARED,
          object: null,
        };

    this._notify(event);
    return this.selectedObject;
  }

  /**
   * Clears currently selected object
   */
  clearSelection() {
    return this.selectObject(null);
  }

  /**
   * Returns currently selected scene object
   */
  getSelectedObject() {
    return this.selectedObject;
  }

  /**
   * Updates hovered scene object
   */
  setHoveredObject(object) {
    if (this.hoveredObject?.id === object?.id) {
      return;
    }

    this.hoveredObject = object || null;
    this._notify({
      type: SCENE_EVENT_TYPES.SCENE_OBJECT_HOVERED,
      object: this.hoveredObject ? { ...this.hoveredObject } : null,
    });
  }

  /**
   * Returns currently hovered scene object
   */
  getHoveredObject() {
    return this.hoveredObject;
  }

  /**
   * Resolves a scene click at normalized point (normX, normY)
   * Uses deterministic overlap resolution (highest confidence, smallest area).
   *
   * @param {Object} normPoint - { x, y } in [0..1]
   * @param {Array} objects - List of detected scene objects
   * @returns {Object|null} Selected object or null if empty space was clicked
   */
  handleSceneClick(normPoint, objects = []) {
    const targetObject = findTargetObjectAtPoint(normPoint, objects);

    if (targetObject) {
      this.selectObject(targetObject);
    } else {
      this.clearSelection();
    }

    return this.selectedObject;
  }

  /**
   * Current controller state snapshot
   */
  getState() {
    return {
      selectedObject: this.selectedObject ? { ...this.selectedObject } : null,
      hoveredObject: this.hoveredObject ? { ...this.hoveredObject } : null,
    };
  }
}

// Singleton default instance for application usage
export const sceneInteractionController = new SceneInteractionController();
