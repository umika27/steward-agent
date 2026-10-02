/**
 * Image Generation Prompt Module
 * Phase 12A — Generated Environment & Condition-Aware Perception
 *
 * Controlled prompt for generating indoor room environments containing
 * exactly one malfunctioning object, normal objects, documentation, telephone, and floor space.
 */

export const CONTROLLED_GENERATE_PROMPT = `A wide-angle, high-resolution synthetic indoor room environment (laundry room, kitchen, utility workspace, or office).
The room features everyday furniture, appliances, an open walkable floor, a telephone on a table or wall, and reference documentation/manuals on a desk or cupboard.
CRITICAL CONSTRAINT: Exactly ONE primary physical object is clearly and visibly malfunctioning or damaged (e.g. a broken appliance door, damaged control panel, or visible leak). The object's broken condition must be visually obvious enough for an AI vision model to identify. Every other major object in the room must appear completely normal, intact, and operational.
The scene contains NO people, NO animals, NO watermarks, NO UI overlays, NO multiple broken objects, and NO ambiguous hidden damage.
Bright, natural, clean interior lighting with clear visual separation between distinct physical objects.`;

export function getFixedGenerationPrompt() {
  return CONTROLLED_GENERATE_PROMPT;
}
