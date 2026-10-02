/**
 * Scene Normalizer Module
 *
 * Normalizes raw bounding boxes from vision providers into standard pixel and
 * normalized (0.0 to 1.0) coordinate schemas for viewport independence.
 */

import { OBJECT_CATEGORIES } from './sceneTypes';

/**
 * Normalizes a raw detection result into the unified SceneObject schema.
 *
 * @param {Object} rawDetection - Raw detection output from vision provider
 * @param {number} imageWidth - Width of the analyzed image
 * @param {number} imageHeight - Height of the analyzed image
 * @param {number} index - Index fallback for ID generation
 * @returns {Object} Normalized SceneObject contract
 */
export function normalizeDetection(rawDetection, imageWidth = 1920, imageHeight = 1080, index = 0) {
  const {
    id,
    label = 'unknown_object',
    category = OBJECT_CATEGORIES.OTHER,
    confidence = 0.9,
    box, // Supported formats: { x, y, width, height } or [ymin, xmin, ymax, xmax] (normalized or pixel)
  } = rawDetection;

  let normX = 0, normY = 0, normW = 0, normH = 0;

  if (Array.isArray(box) && box.length === 4) {
    // Format: [ymin, xmin, ymax, xmax]
    const [ymin, xmin, ymax, xmax] = box;
    if (ymin <= 1 && ymax <= 1 && xmin <= 1 && xmax <= 1) {
      // Normalized 0..1
      normX = xmin;
      normY = ymin;
      normW = xmax - xmin;
      normH = ymax - ymin;
    } else {
      // Pixel coordinates
      normX = xmin / imageWidth;
      normY = ymin / imageHeight;
      normW = (xmax - xmin) / imageWidth;
      normH = (ymax - ymin) / imageHeight;
    }
  } else if (box && typeof box === 'object') {
    const { x, y, width, height } = box;
    if (x <= 1 && y <= 1 && width <= 1 && height <= 1) {
      normX = x;
      normY = y;
      normW = width;
      normH = height;
    } else {
      normX = x / imageWidth;
      normY = y / imageHeight;
      normW = width / imageWidth;
      normH = height / imageHeight;
    }
  }

  // Clamp normalized values between 0.0 and 1.0
  normX = Math.max(0, Math.min(1, normX));
  normY = Math.max(0, Math.min(1, normY));
  normW = Math.max(0, Math.min(1 - normX, normW));
  normH = Math.max(0, Math.min(1 - normY, normH));

  const normCenterX = normX + normW / 2;
  const normCenterY = normY + normH / 2;

  // Calculate pixel values
  const pixelX = Math.round(normX * imageWidth);
  const pixelY = Math.round(normY * imageHeight);
  const pixelW = Math.round(normW * imageWidth);
  const pixelH = Math.round(normH * imageHeight);
  const pixelCenterX = Math.round(normCenterX * imageWidth);
  const pixelCenterY = Math.round(normCenterY * imageHeight);

  const objectId = id || `det_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${index + 1}`;

  return {
    id: objectId,
    label: label.toLowerCase(),
    category,
    confidence: Number(confidence.toFixed(2)),
    boundingBox: {
      x: pixelX,
      y: pixelY,
      width: pixelW,
      height: pixelH,
    },
    center: {
      x: pixelCenterX,
      y: pixelCenterY,
    },
    normalizedBoundingBox: {
      x: Number(normX.toFixed(4)),
      y: Number(normY.toFixed(4)),
      width: Number(normW.toFixed(4)),
      height: Number(normH.toFixed(4)),
    },
    normalizedCenter: {
      x: Number(normCenterX.toFixed(4)),
      y: Number(normCenterY.toFixed(4)),
    },
    condition: rawDetection.condition || 'NORMAL',
    conditionConfidence: rawDetection.conditionConfidence !== undefined ? rawDetection.conditionConfidence : 0.9,
  };
}
