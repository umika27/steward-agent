/**
 * Scene Coordinate Mapper Module
 * Phase 3 — Background Image Geometry Mapper
 *
 * Translates between normalized scene coordinates [0.0 - 1.0] and rendered screen pixels
 * for background images using CSS `background-size: cover` or responsive scaling.
 *
 * Ensures object hitboxes and interaction points remain perfectly aligned on window resize.
 */

/**
 * Calculates rendered image dimensions and letterbox/crop offsets for `background-size: cover`
 *
 * @param {number} containerWidth - Viewport / container width in pixels
 * @param {number} containerHeight - Viewport / container height in pixels
 * @param {number} imageWidth - Natural source image width (default: 1920)
 * @param {number} imageHeight - Natural source image height (default: 1080)
 * @returns {Object} { renderedWidth, renderedHeight, offsetX, offsetY, scale }
 */
export function getRenderedImageRect(containerWidth, containerHeight, imageWidth = 1920, imageHeight = 1080) {
  if (!containerWidth || !containerHeight) {
    return { renderedWidth: 0, renderedHeight: 0, offsetX: 0, offsetY: 0, scale: 1 };
  }

  const containerAspect = containerWidth / containerHeight;
  const imageAspect = imageWidth / imageHeight;

  let scale = 1;
  if (containerAspect > imageAspect) {
    // Container is wider than image aspect ratio -> fit to width, crop top/bottom
    scale = containerWidth / imageWidth;
  } else {
    // Container is taller than image aspect ratio -> fit to height, crop left/right
    scale = containerHeight / imageHeight;
  }

  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;

  // Center alignment offsets (negative when cropped, positive when padded)
  const offsetX = (containerWidth - renderedWidth) / 2;
  const offsetY = (containerHeight - renderedHeight) / 2;

  return {
    renderedWidth,
    renderedHeight,
    offsetX,
    offsetY,
    scale,
  };
}

/**
 * Maps a normalized bounding box [0..1] to pixel screen coordinates inside the container
 *
 * @param {Object} normalizedBox - { x, y, width, height } in [0..1]
 * @param {number} containerWidth
 * @param {number} containerHeight
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @returns {Object} { left, top, width, height } in screen pixels
 */
export function normalizedToScreenRect(normalizedBox, containerWidth, containerHeight, imageWidth = 1920, imageHeight = 1080) {
  if (!normalizedBox) return { left: 0, top: 0, width: 0, height: 0 };

  const { renderedWidth, renderedHeight, offsetX, offsetY } = getRenderedImageRect(
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight
  );

  return {
    left: Math.round(offsetX + normalizedBox.x * renderedWidth),
    top: Math.round(offsetY + normalizedBox.y * renderedHeight),
    width: Math.round(normalizedBox.width * renderedWidth),
    height: Math.round(normalizedBox.height * renderedHeight),
  };
}

/**
 * Maps a normalized point { x, y } in [0..1] to screen pixel coordinates
 */
export function normalizedToScreenPoint(normalizedPoint, containerWidth, containerHeight, imageWidth = 1920, imageHeight = 1080) {
  if (!normalizedPoint) return { x: 0, y: 0 };

  const { renderedWidth, renderedHeight, offsetX, offsetY } = getRenderedImageRect(
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight
  );

  return {
    x: Math.round(offsetX + normalizedPoint.x * renderedWidth),
    y: Math.round(offsetY + normalizedPoint.y * renderedHeight),
  };
}

/**
 * Converts screen click coordinates (clientX, clientY) within container to normalized scene point [0..1]
 */
export function screenPointToNormalized(screenX, screenY, containerWidth, containerHeight, imageWidth = 1920, imageHeight = 1080) {
  const { renderedWidth, renderedHeight, offsetX, offsetY } = getRenderedImageRect(
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight
  );

  if (renderedWidth === 0 || renderedHeight === 0) {
    return { x: 0, y: 0 };
  }

  const rawNormX = (screenX - offsetX) / renderedWidth;
  const rawNormY = (screenY - offsetY) / renderedHeight;

  return {
    x: Math.max(0, Math.min(1, rawNormX)),
    y: Math.max(0, Math.min(1, rawNormY)),
  };
}

/**
 * Checks if a normalized point {x, y} falls within a normalized bounding box
 */
export function isPointInNormalizedBox(normPoint, normalizedBox) {
  if (!normPoint || !normalizedBox) return false;
  return (
    normPoint.x >= normalizedBox.x &&
    normPoint.x <= normalizedBox.x + normalizedBox.width &&
    normPoint.y >= normalizedBox.y &&
    normPoint.y <= normalizedBox.y + normalizedBox.height
  );
}

/**
 * Deterministically finds the target object containing a normalized point.
 * Overlap Resolution Rule:
 * 1. Highest confidence score
 * 2. If equal confidence, smallest bounding box area (width * height)
 *
 * @param {Object} normPoint - { x, y } in [0..1]
 * @param {Array} objects - Array of normalized scene objects
 * @returns {Object|null} Winning scene object or null if empty space clicked
 */
export function findTargetObjectAtPoint(normPoint, objects = []) {
  if (!normPoint || !Array.isArray(objects) || objects.length === 0) {
    return null;
  }

  const matchingObjects = objects.filter((obj) =>
    isPointInNormalizedBox(normPoint, obj.normalizedBoundingBox)
  );

  if (matchingObjects.length === 0) {
    return null;
  }

  if (matchingObjects.length === 1) {
    return matchingObjects[0];
  }

  // Deterministic Sorting for Overlapping Boxes
  matchingObjects.sort((a, b) => {
    const confDiff = (b.confidence || 0) - (a.confidence || 0);
    if (Math.abs(confDiff) > 0.001) {
      return confDiff; // Higher confidence wins
    }

    // Secondary tie-breaker: Smallest bounding box area
    const areaA = (a.normalizedBoundingBox.width || 0) * (a.normalizedBoundingBox.height || 0);
    const areaB = (b.normalizedBoundingBox.width || 0) * (b.normalizedBoundingBox.height || 0);
    return areaA - areaB;
  });

  return matchingObjects[0];
}
