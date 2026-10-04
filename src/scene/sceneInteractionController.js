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

export const SCENE_INTERACTION_MODE = {
  SCENE_INTERACTION_ACTIVE: 'SCENE_INTERACTION_ACTIVE',
  FOCUSED_INVESTIGATION: 'FOCUSED_INVESTIGATION',
};

export const SCENE_EVENT_TYPES = {
  SCENE_OBJECT_SELECTED: 'SCENE_OBJECT_SELECTED',
  SCENE_SELECTION_CLEARED: 'SCENE_SELECTION_CLEARED',
  SCENE_OBJECT_HOVERED: 'SCENE_OBJECT_HOVERED',
  SCENE_FOCUSED_INVESTIGATION: 'SCENE_FOCUSED_INVESTIGATION',
  SCENE_INTERACTION_RESET: 'SCENE_INTERACTION_RESET',
};

export class SceneInteractionController {
  constructor() {
    this.selectedObject = null;
    this.hoveredObject = null;
    this.interactionMode = SCENE_INTERACTION_MODE.SCENE_INTERACTION_ACTIVE;
    this.sceneInteractionEnabled = true;
    this.focusedObject = null;
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
   * Transitions scene into FOCUSED_INVESTIGATION mode.
   * Locks general scene interaction, sets focusedObject, and disables
   * pointer events/selection on all other objects.
   *
   * @param {Object} brokenObject - Detected broken/malfunctioning object
   * @returns {Object} focusedObject
   */
  setFocusedInvestigation(brokenObject) {
    if (!brokenObject) return null;

    this.interactionMode = SCENE_INTERACTION_MODE.FOCUSED_INVESTIGATION;
    this.sceneInteractionEnabled = false;
    this.focusedObject = { ...brokenObject };
    this.selectedObject = { ...brokenObject };
    this.hoveredObject = null;

    const event = {
      type: SCENE_EVENT_TYPES.SCENE_FOCUSED_INVESTIGATION,
      focusedObject: { ...this.focusedObject },
      object: { ...this.focusedObject },
    };

    this._notify(event);
    return this.focusedObject;
  }

  /**
   * Resets scene interaction back to SCENE_INTERACTION_ACTIVE.
   * Re-enables general object detection and interaction across the scene.
   */
  resetSceneInteraction() {
    this.interactionMode = SCENE_INTERACTION_MODE.SCENE_INTERACTION_ACTIVE;
    this.sceneInteractionEnabled = true;
    this.focusedObject = null;
    this.selectedObject = null;
    this.hoveredObject = null;

    const event = {
      type: SCENE_EVENT_TYPES.SCENE_INTERACTION_RESET,
    };

    this._notify(event);
  }

  /**
   * Returns whether scene is currently in focused investigation mode
   */
  isFocused() {
    return this.interactionMode === SCENE_INTERACTION_MODE.FOCUSED_INVESTIGATION;
  }

  /**
   * Returns whether general scene interaction is enabled
   */
  isSceneInteractionEnabled() {
    return this.sceneInteractionEnabled;
  }

  /**
   * Returns the currently focused broken object, if any
   */
  getFocusedObject() {
    return this.focusedObject;
  }

  /**
   * Selects a detected scene object and emits SCENE_OBJECT_SELECTED.
   * If focused investigation is active, prevents selection of any object
   * other than the focused broken object.
   *
   * @param {Object|null} object - Complete normalized scene object or null
   */
  selectObject(object) {
    // If scene interaction is locked in focused investigation:
    if (!this.sceneInteractionEnabled) {
      if (object && this.focusedObject && object.id === this.focusedObject.id) {
        return this.focusedObject;
      }
      return null;
    }

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
    if (!this.sceneInteractionEnabled) {
      return this.focusedObject;
    }
    return this.selectObject(null);
  }

  /**
   * Returns currently selected scene object
   */
  getSelectedObject() {
    return this.selectedObject;
  }

  /**
   * Updates hovered scene object.
   * In focused investigation mode, general hover detection is disabled.
   */
  setHoveredObject(object) {
    if (!this.sceneInteractionEnabled) {
      if (this.hoveredObject !== null) {
        this.hoveredObject = null;
        this._notify({
          type: SCENE_EVENT_TYPES.SCENE_OBJECT_HOVERED,
          object: null,
        });
      }
      return;
    }

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
   * In focused investigation mode, background clicks and general object clicks are ignored.
   *
   * @param {Object} normPoint - { x, y } in [0..1]
   * @param {Array} objects - List of detected scene objects
   * @returns {Object|null} Selected object or null
   */
  handleSceneClick(normPoint, objects = []) {
    if (!this.sceneInteractionEnabled) {
      return null;
    }

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
      interactionMode: this.interactionMode,
      sceneInteractionEnabled: this.sceneInteractionEnabled,
      focusedObject: this.focusedObject ? { ...this.focusedObject } : null,
      isFocusedInvestigation: this.interactionMode === SCENE_INTERACTION_MODE.FOCUSED_INVESTIGATION,
    };
  }
}

// Singleton default instance for application usage
export const sceneInteractionController = new SceneInteractionController();
