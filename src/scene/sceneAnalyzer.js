/**
 * SceneAnalyzer Module
 *
 * Core perception orchestrator for interpreting room background images.
 * Consumes vision provider detections, runs normalization, and maintains
 * scene perception state.
 */

import { SCENE_STATUS } from './sceneTypes';
import { normalizeDetection } from './sceneNormalizer';
import { resolveInteractionPoint } from './interactionPointResolver';
import { getVisionProvider } from './visionProviders/visionProviderFactory';

export class SceneAnalyzer {
  constructor(visionProvider = null) {
    this._customProvider = visionProvider;
    this.currentImageSource = null;
    this.sceneVersion = 0;
    this.cachedSceneState = {
      status: SCENE_STATUS.IDLE,
      imageMetadata: null,
      sceneVersion: 0,
      objects: [],
      error: null,
    };
  }

  get visionProvider() {
    return this._customProvider || getVisionProvider();
  }

  set visionProvider(provider) {
    this._customProvider = provider;
  }

  /**
   * Analyzes an image source and updates normalized scene state.
   * Runs analysis ONLY if imageSource differs from current image or if forced.
   *
   * @param {string} imageSource - Background image URL or asset reference
   * @param {boolean} forceReanalyze - Override cache
   * @param {Object} naturalDimensions - { width, height } for uploaded images
   * @returns {Promise<Object>} Scene state contract
   */
  async analyzeScene(imageSource, forceReanalyze = false, naturalDimensions = null) {
    if (!imageSource) {
      return this.cachedSceneState;
    }

    // Performance optimization: Prevent redundant analysis loops unless forced
    if (this.currentImageSource === imageSource && !forceReanalyze && this.cachedSceneState.status === SCENE_STATUS.READY) {
      return this.cachedSceneState;
    }

    this.currentImageSource = imageSource;
    this.sceneVersion++;
    const activeVersion = this.sceneVersion;

    this.cachedSceneState = {
      ...this.cachedSceneState,
      status: SCENE_STATUS.ANALYZING,
      sceneVersion: activeVersion,
      error: null,
    };

    try {
      // Execute vision provider inference
      const rawResult = await this.visionProvider.analyzeImage(imageSource);
      
      const width = naturalDimensions?.width || rawResult?.width || 1920;
      const height = naturalDimensions?.height || rawResult?.height || 1080;
      const detections = rawResult?.detections || [];

      // 1. Normalize all detected bounding boxes
      // 2. Derive interaction points dynamically from perception geometry
      const resolvedObjects = detections
        .map((rawDet, idx) => normalizeDetection(rawDet, width, height, idx))
        .map((normObj) => resolveInteractionPoint(normObj, width, height));

      this.cachedSceneState = {
        status: SCENE_STATUS.READY,
        sceneVersion: activeVersion,
        imageMetadata: {
          src: imageSource,
          width,
          height,
          analyzedAt: new Date().toISOString(),
          objectCount: resolvedObjects.length,
        },
        objects: resolvedObjects,
        error: null,
      };

      return this.cachedSceneState;
    } catch (err) {
      console.error('Scene Perception Error:', err);
      // Fallback state on error — app remains 100% functional
      this.cachedSceneState = {
        status: SCENE_STATUS.ERROR,
        imageMetadata: { src: imageSource, width: naturalDimensions?.width || 1920, height: naturalDimensions?.height || 1080 },
        objects: [],
        error: err.message || 'Vision analysis failed',
      };
      return this.cachedSceneState;
    }
  }

  getSceneState() {
    return this.cachedSceneState;
  }
}
