/**
 * Vision Provider Abstract Interface
 *
 * Pluggable abstraction layer for object detection vision backends.
 * Allows seamless substitution of multimodal LLMs, open-vocabulary detectors,
 * or mock providers without mutating application code.
 */

export class IVisionProvider {
  /**
   * Analyzes an input image and returns raw object detection results.
   *
   * @param {string|File} imageSource - Image URL, asset path, or blob
   * @returns {Promise<Object>} Promise resolving to raw detection output { width, height, detections }
   */
  async analyzeImage(imageSource) {
    throw new Error('IVisionProvider.analyzeImage method must be implemented by concrete vision provider.');
  }
}
