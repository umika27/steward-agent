import React, { useState, useEffect, useRef } from 'react';
import { normalizedToScreenRect, screenPointToNormalized } from '../../scene/sceneCoordinateMapper';
import { sceneInteractionController } from '../../scene/sceneInteractionController';
import './InteractiveScene.css';

/**
 * InteractiveScene Component
 * Phase 3 — Interactive Detected Scene Layer
 *
 * Renders lightweight interactive hitboxes for all detected scene perception objects.
 * Dynamically computes pixel bounding boxes using background-size: cover coordinate mapping.
 * Handles hover highlights, selection outlines, and empty-space deselects.
 */
export const InteractiveScene = ({ sceneState, imageWidth = 1920, imageHeight = 1080 }) => {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [hoveredObjectId, setHoveredObjectId] = useState(null);

  const objects = sceneState?.objects || [];

  // Track container dimensions dynamically on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateSize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // Subscribe to scene interaction controller state changes
  useEffect(() => {
    const unsubscribe = sceneInteractionController.subscribe((event, state) => {
      setSelectedObjectId(state.selectedObject?.id || null);
      setHoveredObjectId(state.hoveredObject?.id || null);
    });

    // Initial state sync
    const state = sceneInteractionController.getState();
    setSelectedObjectId(state.selectedObject?.id || null);
    setHoveredObjectId(state.hoveredObject?.id || null);

    return unsubscribe;
  }, []);

  // Handle click on empty scene background
  const handleContainerClick = (e) => {
    // Only process if user clicked directly on the container layer or empty space
    if (e.target === containerRef.current || e.target.classList.contains('interactive-scene-backdrop')) {
      if (containerSize.width > 0 && containerSize.height > 0) {
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const normPoint = screenPointToNormalized(
          clickX,
          clickY,
          containerSize.width,
          containerSize.height,
          imageWidth,
          imageHeight
        );

        sceneInteractionController.handleSceneClick(normPoint, objects);
      } else {
        sceneInteractionController.clearSelection();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="interactive-scene-layer"
      onClick={handleContainerClick}
      aria-label="Interactive Living Room Scene"
    >
      <div className="interactive-scene-backdrop" />

      {containerSize.width > 0 &&
        containerSize.height > 0 &&
        objects.map((obj) => {
          const rect = normalizedToScreenRect(
            obj.normalizedBoundingBox,
            containerSize.width,
            containerSize.height,
            imageWidth,
            imageHeight
          );

          const isSelected = selectedObjectId === obj.id;
          const isHovered = hoveredObjectId === obj.id;

          return (
            <div
              key={obj.id}
              className={`scene-interactive-hitbox ${isHovered ? 'is-hovered' : ''} ${
                isSelected ? 'is-selected' : ''
              }`}
              style={{
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
              }}
              onMouseEnter={() => sceneInteractionController.setHoveredObject(obj)}
              onMouseLeave={() => sceneInteractionController.setHoveredObject(null)}
              onClick={(e) => {
                e.stopPropagation();
                sceneInteractionController.selectObject(obj);
              }}
              title={obj.label}
              role="button"
              tabIndex={0}
            />
          );
        })}
    </div>
  );
};
