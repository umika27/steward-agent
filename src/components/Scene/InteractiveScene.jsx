import React, { useState, useEffect, useRef } from 'react';
import { normalizedToScreenRect, screenPointToNormalized } from '../../scene/sceneCoordinateMapper';
import { sceneInteractionController } from '../../scene/sceneInteractionController';
import { Wrench } from 'lucide-react';
import './InteractiveScene.css';

/**
 * InteractiveScene Component
 * Phase 3 — Interactive Detected Scene Layer
 *
 * Renders lightweight interactive hitboxes for all detected scene perception objects.
 * Dynamically computes pixel bounding boxes using background-size: cover coordinate mapping.
 * Handles hover highlights, selection outlines, and empty-space deselects.
 */
export const InteractiveScene = ({
  sceneState,
  imageWidth = 1920,
  imageHeight = 1080,
  showProblemIndicator = false,
}) => {
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [hoveredObjectId, setHoveredObjectId] = useState(null);
  const [isFocusedInvestigation, setIsFocusedInvestigation] = useState(false);
  const [focusedObjectId, setFocusedObjectId] = useState(null);

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
      setIsFocusedInvestigation(state.isFocusedInvestigation || false);
      setFocusedObjectId(state.focusedObject?.id || null);
    });

    // Initial state sync
    const state = sceneInteractionController.getState();
    setSelectedObjectId(state.selectedObject?.id || null);
    setHoveredObjectId(state.hoveredObject?.id || null);
    setIsFocusedInvestigation(state.isFocusedInvestigation || false);
    setFocusedObjectId(state.focusedObject?.id || null);

    return unsubscribe;
  }, []);

  // Handle click on empty scene background
  const handleContainerClick = (e) => {
    // When in focused investigation, scene background clicks are completely ignored
    if (isFocusedInvestigation) {
      return;
    }

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
      className={`interactive-scene-layer ${isFocusedInvestigation ? 'is-focused-investigation' : ''}`}
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

          const isFocusedTarget = isFocusedInvestigation && obj.id === focusedObjectId;
          const isInactiveInFocus = isFocusedInvestigation && !isFocusedTarget;
          const isSelected = selectedObjectId === obj.id || isFocusedTarget;
          const isHovered = hoveredObjectId === obj.id && !isFocusedInvestigation;
          const isProblemObject =
            obj.condition === 'MALFUNCTIONING' ||
            obj.condition === 'DAMAGED' ||
            obj.condition === 'BROKEN' ||
            obj.id === focusedObjectId ||
            obj.id?.includes('washing_machine') ||
            (obj.label || '').toLowerCase().includes('washing machine');

          return (
            <div
              key={obj.id}
              className={`scene-interactive-hitbox ${isHovered ? 'is-hovered' : ''} ${
                isSelected ? 'is-selected' : ''
              } ${isFocusedTarget ? 'is-focused-target' : ''} ${
                isInactiveInFocus ? 'is-inactive-in-focus' : ''
              }`}
              style={{
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
              }}
              onMouseEnter={() => {
                if (!isFocusedInvestigation) {
                  sceneInteractionController.setHoveredObject(obj);
                }
              }}
              onMouseLeave={() => {
                if (!isFocusedInvestigation) {
                  sceneInteractionController.setHoveredObject(null);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isFocusedInvestigation) {
                  if (isFocusedTarget) {
                    sceneInteractionController.selectObject(obj);
                  }
                  return;
                }
                sceneInteractionController.selectObject(obj);
              }}
              title={isInactiveInFocus ? undefined : obj.label}
              role={isInactiveInFocus ? 'presentation' : 'button'}
              aria-disabled={isInactiveInFocus ? 'true' : 'false'}
              tabIndex={isInactiveInFocus ? -1 : 0}
            >
              {isProblemObject && showProblemIndicator && (
                <div className="problem-repair-indicator" title="Malfunctioning — Needs Attention">
                  <Wrench size={14} className="repair-wrench-icon" />
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};
