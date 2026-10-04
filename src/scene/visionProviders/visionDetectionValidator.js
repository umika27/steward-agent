/**
 * Vision Detection Validator Module
 * Phase 7 — AI Scene Understanding Provider
 *
 * Strict validation and sanitization layer for raw AI vision model outputs.
 * Verifies numeric bounding boxes, normalized ranges [0.0 - 1.0], category tags,
 * and rejects malformed detections before they enter the Scene State pipeline.
 */

import { OBJECT_CATEGORIES } from '../sceneTypes';

const VALID_CATEGORIES = new Set([
  OBJECT_CATEGORIES.FURNITURE,
  OBJECT_CATEGORIES.APPLIANCES,
  OBJECT_CATEGORIES.ELECTRONICS,
  OBJECT_CATEGORIES.STRUCTURES,
  OBJECT_CATEGORIES.DECOR_LIGHTING,
  OBJECT_CATEGORIES.DOCUMENTS,
]);

/**
 * Validates and sanitizes raw detection items from an AI Vision Provider.
 *
 * @param {Array} rawDetections - Unsanitized AI model object output
 * @returns {Array} Clean, strictly validated raw detection objects
 */
export function validateVisionDetections(rawDetections = []) {
  if (!Array.isArray(rawDetections)) {
    console.warn('VisionDetectionValidator: Expected array of detections, received:', rawDetections);
    return [];
  }

  return rawDetections
    .map((item, index) => sanitizeDetectionItem(item, index))
    .filter(Boolean);
}

/**
 * Sanitizes a single detection item
 */
function sanitizeDetectionItem(item, index) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  // 1. Label Validation
  const label = typeof item.label === 'string' && item.label.trim()
    ? item.label.trim()
    : `Detected Object ${index + 1}`;

  // 2. Category Mapping & Normalization
  let category = typeof item.category === 'string' ? item.category.toLowerCase().trim() : '';
  if (!VALID_CATEGORIES.has(category)) {
    category = mapCategoryFallback(label, category);
  }

  // 3. Confidence Normalization (0.0 to 1.0)
  let confidence = typeof item.confidence === 'number' && !isNaN(item.confidence)
    ? Math.max(0.0, Math.min(1.0, item.confidence))
    : 0.85;

  // 4. Bounding Box Parsing & Bounds Verification
  let box = null;

  if (Array.isArray(item.box) && item.box.length === 4) {
    // Format: [ymin, xmin, ymax, xmax]
    const [ymin, xmin, ymax, xmax] = item.box.map(Number);
    if (!isNaN(ymin) && !isNaN(xmin) && !isNaN(ymax) && !isNaN(xmax)) {
      box = [
        Math.max(0, Math.min(1, ymin)),
        Math.max(0, Math.min(1, xmin)),
        Math.max(0, Math.min(1, ymax)),
        Math.max(0, Math.min(1, xmax)),
      ];
    }
  } else if (item.boundingBox && typeof item.boundingBox === 'object') {
    // Format: { x, y, width, height }
    const x = Number(item.boundingBox.x);
    const y = Number(item.boundingBox.y);
    const w = Number(item.boundingBox.width);
    const h = Number(item.boundingBox.height);

    if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
      const ymin = Math.max(0, Math.min(1, y));
      const xmin = Math.max(0, Math.min(1, x));
      const ymax = Math.max(0, Math.min(1, y + h));
      const xmax = Math.max(0, Math.min(1, x + w));
      box = [ymin, xmin, ymax, xmax];
    }
  }

  if (!box || box[2] <= box[0] || box[3] <= box[1]) {
    console.warn(`VisionDetectionValidator: Invalid bounding box for "${label}". Dropping item.`);
    return null;
  }

  // 5. Condition & Condition Confidence Validation
  const ALLOWED_CONDITIONS = new Set(['NORMAL', 'DAMAGED', 'MALFUNCTIONING', 'UNCERTAIN']);
  let condition = typeof item.condition === 'string' ? item.condition.toUpperCase().trim() : 'NORMAL';
  if (!ALLOWED_CONDITIONS.has(condition)) {
    condition = 'NORMAL';
  }

  let conditionConfidence = typeof item.conditionConfidence === 'number' && !isNaN(item.conditionConfidence)
    ? Math.max(0.0, Math.min(1.0, item.conditionConfidence))
    : 0.90;

  return {
    id: item.id || `det_${category}_${index}_${Date.now().toString(36)}`,
    label,
    category,
    confidence: Number(confidence.toFixed(2)),
    condition,
    conditionConfidence: Number(conditionConfidence.toFixed(2)),
    box,
  };
}

/**
 * Fallback heuristic to map unknown labels to valid application categories
 */
function mapCategoryFallback(label, rawCategory) {
  const lbl = label.toLowerCase();
  const cat = (rawCategory || '').toLowerCase();

  if (cat.includes('doc') || cat.includes('manual') || lbl.includes('document') || lbl.includes('manual') || lbl.includes('paper') || lbl.includes('guide') || lbl.includes('book')) {
    return OBJECT_CATEGORIES.DOCUMENTS;
  }
  if (cat.includes('appliance') || lbl.includes('machine') || lbl.includes('fridge') || lbl.includes('oven') || lbl.includes('microwave')) {
    return OBJECT_CATEGORIES.APPLIANCES;
  }
  if (cat.includes('electr') || lbl.includes('phone') || lbl.includes('tv') || lbl.includes('screen') || lbl.includes('computer') || lbl.includes('laptop')) {
    return OBJECT_CATEGORIES.ELECTRONICS;
  }
  if (cat.includes('light') || cat.includes('decor') || lbl.includes('lamp') || lbl.includes('plant') || lbl.includes('vase') || lbl.includes('mirror')) {
    return OBJECT_CATEGORIES.DECOR_LIGHTING;
  }
  if (cat.includes('struct') || lbl.includes('door') || lbl.includes('window') || lbl.includes('wall') || lbl.includes('pillar')) {
    return OBJECT_CATEGORIES.STRUCTURES;
  }

  return OBJECT_CATEGORIES.FURNITURE;
}
