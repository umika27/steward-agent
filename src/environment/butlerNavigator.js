/**
 * Butler Navigator System
 *
 * Smooth cubic-easing movement controller for animating the Butler floating group
 * across environment coordinates in the living room.
 */

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class ButlerNavigator {
  constructor(updatePositionCallback) {
    this.updatePosition = updatePositionCallback;
    this.animFrameId = null;
  }

  /**
   * Smoothly animates Butler position from startPos to targetPos
   * @param {Object} startPos - { x, y }
   * @param {Object} targetPos - { x, y }
   * @param {number} duration - Animation duration in ms (default 1400ms)
   * @returns {Promise} Resolves when movement completes
   */
  moveTo(startPos, targetPos, duration = 1400) {
    return new Promise((resolve) => {
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
      }

      const startTime = performance.now();

      const animateStep = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutCubic(progress);

        // Calculate smooth interpolated coordinates
        const currentX = startPos.x + (targetPos.x - startPos.x) * easedProgress;
        const currentY = startPos.y + (targetPos.y - startPos.y) * easedProgress;

        // Subtle natural walking/bobbing motion while moving
        const bobOffset = Math.sin(progress * Math.PI * 4) * 4;

        if (this.updatePosition) {
          this.updatePosition({
            x: currentX,
            y: currentY + (progress < 1 ? bobOffset : 0),
          });
        }

        if (progress < 1) {
          this.animFrameId = requestAnimationFrame(animateStep);
        } else {
          // Final exact position lock
          if (this.updatePosition) {
            this.updatePosition({ x: targetPos.x, y: targetPos.y });
          }
          this.animFrameId = null;
          resolve();
        }
      };

      this.animFrameId = requestAnimationFrame(animateStep);
    });
  }

  cancel() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
