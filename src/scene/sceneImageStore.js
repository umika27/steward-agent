/**
 * Scene Image Store Module
 * Phase 6 — Dynamic Image Upload & Scene Reanalysis
 *
 * Manages active room background image sources, handles local browser file uploads,
 * measures dynamic image dimensions (naturalWidth / naturalHeight), and manages
 * Object URL resource lifecycles (URL.revokeObjectURL).
 *
 * NO cloud uploads, NO external APIs. 100% local browser execution.
 */

export const SCENE_IMAGE_EVENTS = {
  SCENE_IMAGE_LOADING: 'SCENE_IMAGE_LOADING',
  SCENE_IMAGE_READY: 'SCENE_IMAGE_READY',
  SCENE_IMAGE_CHANGED: 'SCENE_IMAGE_CHANGED',
  SCENE_IMAGE_RESET: 'SCENE_IMAGE_RESET',
  SCENE_IMAGE_ERROR: 'SCENE_IMAGE_ERROR',
};

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export class SceneImageStore {
  constructor(defaultImageSource = null) {
    this.defaultSource = defaultImageSource;
    this.activeSource = defaultImageSource;
    this.sourceType = 'default';
    this.fileName = null;
    this.width = 1920;
    this.height = 1080;
    this.status = 'idle';
    this.error = null;
    this.createdObjectUrl = null;
    this.listeners = new Set();
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
        console.error('SceneImageStore Listener Error:', err);
      }
    });
  }

  getSnapshot() {
    return {
      source: this.activeSource,
      sourceType: this.sourceType,
      fileName: this.fileName,
      width: this.width,
      height: this.height,
      status: this.status,
      error: this.error,
    };
  }

  /**
   * Initializes default scene background image
   */
  loadDefaultScene(defaultBgUrl, width = 1920, height = 1080) {
    this._cleanupObjectUrl();
    this.defaultSource = defaultBgUrl;
    this.activeSource = defaultBgUrl;
    this.sourceType = 'default';
    this.fileName = null;
    this.width = width;
    this.height = height;
    this.status = 'ready';
    this.error = null;

    this._notify({
      type: SCENE_IMAGE_EVENTS.SCENE_IMAGE_READY,
      sourceType: 'default',
      width,
      height,
    });
  }

  /**
   * Loads an AI-generated scene image
   */
  loadGeneratedScene(imageSource, width = 1920, height = 1080) {
    this._cleanupObjectUrl();
    this.activeSource = imageSource;
    this.sourceType = 'generated';
    this.fileName = 'generated_room.png';
    this.width = width;
    this.height = height;
    this.status = 'ready';
    this.error = null;

    this._notify({
      type: SCENE_IMAGE_EVENTS.SCENE_IMAGE_CHANGED,
      sourceType: 'generated',
      width,
      height,
    });
  }

  /**
   * Handles local user file upload (PNG, JPG, WEBP)
   * Loads image in browser, measures natural width & height, creates object URL.
   *
   * @param {File} file - Browser File object from <input type="file">
   * @returns {Promise<Object>} Image state snapshot
   */
  uploadUserImage(file) {
    if (!file) {
      return Promise.reject(new Error('No file selected'));
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      const err = `Invalid file format: ${file.type || 'unknown'}. Please upload PNG, JPG, or WEBP.`;
      this.status = 'error';
      this.error = err;
      this._notify({
        type: SCENE_IMAGE_EVENTS.SCENE_IMAGE_ERROR,
        error: err,
      });
      return Promise.reject(new Error(err));
    }

    this.status = 'loading';
    this.error = null;
    this._notify({ type: SCENE_IMAGE_EVENTS.SCENE_IMAGE_LOADING });

    return new Promise((resolve, reject) => {
      const tempUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        // Cleanup old blob object URL to prevent memory leaks
        this._cleanupObjectUrl();

        this.createdObjectUrl = tempUrl;
        this.activeSource = tempUrl;
        this.sourceType = 'upload';
        this.fileName = file.name;
        this.width = img.naturalWidth || 1920;
        this.height = img.naturalHeight || 1080;
        this.status = 'ready';
        this.error = null;

        const snapshot = this.getSnapshot();

        this._notify({
          type: SCENE_IMAGE_EVENTS.SCENE_IMAGE_CHANGED,
          sourceType: 'upload',
          fileName: file.name,
          width: this.width,
          height: this.height,
        });

        resolve(snapshot);
      };

      img.onerror = () => {
        URL.revokeObjectURL(tempUrl);
        const err = 'Failed to load image file. File may be corrupted.';
        this.status = 'error';
        this.error = err;

        this._notify({
          type: SCENE_IMAGE_EVENTS.SCENE_IMAGE_ERROR,
          error: err,
        });

        reject(new Error(err));
      };

      img.src = tempUrl;
    });
  }

  /**
   * Resets active scene image back to default living-room background
   */
  resetToDefault(defaultBgUrl = this.defaultSource) {
    this._cleanupObjectUrl();

    this.activeSource = defaultBgUrl || this.defaultSource;
    this.sourceType = 'default';
    this.fileName = null;
    this.width = 1920;
    this.height = 1080;
    this.status = 'ready';
    this.error = null;

    const snapshot = this.getSnapshot();

    this._notify({
      type: SCENE_IMAGE_EVENTS.SCENE_IMAGE_RESET,
      sourceType: 'default',
      width: 1920,
      height: 1080,
    });

    return snapshot;
  }

  /**
   * Private resource cleanup: Revokes Blob Object URL
   */
  _cleanupObjectUrl() {
    if (this.createdObjectUrl) {
      try {
        URL.revokeObjectURL(this.createdObjectUrl);
      } catch (e) {
        console.warn('Failed to revoke Object URL:', e);
      }
      this.createdObjectUrl = null;
    }
  }

  destroy() {
    this._cleanupObjectUrl();
    this.listeners.clear();
  }
}

// Global default instance for scene image state
export const sceneImageStore = new SceneImageStore();
