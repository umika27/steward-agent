import React, { useState, useEffect } from 'react';
import { EyeOff, ShieldAlert, Navigation } from 'lucide-react';
import { sceneInteractionController } from './sceneInteractionController';
import { butlerNavigator } from '../navigation/butlerNavigator';
import { taskEngine } from '../tasks/taskEngine';
import { autonomyController } from '../autonomy/autonomyController';
import { getCurrentProviderType } from './visionProviders/visionProviderFactory';
import { CELL_TYPES } from '../navigation/navigationGrid';
import './SceneDetectionVisualizer.css';

/**
 * SceneDetectionVisualizer Component (Development / Debug Overlay)
 *
 * Visualizes objects detected by the Scene Perception system.
 * Shows normalized bounding boxes, labels, categories, confidence scores,
 * active hover/selection state, Butler Navigation Engine telemetry,
 * Navigation Grid (walkable vs blocked cells), A* path, smoothed waypoints,
 * Task Engine execution state, and active Vision Provider status in debug mode.
 */
export const SceneDetectionVisualizer = ({ sceneState, isVisible, onToggle }) => {
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [hoveredObjectId, setHoveredObjectId] = useState(null);
  const [navState, setNavState] = useState(butlerNavigator.getNavigationStateSnapshot());
  const [taskSnapshot, setTaskSnapshot] = useState(taskEngine.getTaskStateSnapshot());
  const [autonomySnapshot, setAutonomySnapshot] = useState(autonomyController.getSnapshot());

  useEffect(() => {
    const unsubInteraction = sceneInteractionController.subscribe((event, state) => {
      setSelectedObjectId(state.selectedObject?.id || null);
      setHoveredObjectId(state.hoveredObject?.id || null);
    });

    const unsubNav = butlerNavigator.subscribe((event, stateSnapshot) => {
      setNavState(stateSnapshot);
    });

    const unsubTask = taskEngine.subscribe((event, taskStateSnapshot) => {
      setTaskSnapshot(taskStateSnapshot);
    });

    const unsubAutonomy = autonomyController.subscribe((event, autoSnapshot) => {
      setAutonomySnapshot(autoSnapshot);
    });

    const initSelectState = sceneInteractionController.getState();
    setSelectedObjectId(initSelectState.selectedObject?.id || null);
    setHoveredObjectId(initSelectState.hoveredObject?.id || null);
    setNavState(butlerNavigator.getNavigationStateSnapshot());
    setTaskSnapshot(taskEngine.getTaskStateSnapshot());
    setAutonomySnapshot(autonomyController.getSnapshot());

    return () => {
      unsubInteraction();
      unsubNav();
      unsubTask();
      unsubAutonomy();
    };
  }, []);

  if (!isVisible || !sceneState || !sceneState.objects) {
    return null;
  }

  const { objects = [] } = sceneState;
  const selectedObj = sceneInteractionController.getSelectedObject();
  const {
    state: navStatus,
    currentNormalizedPos,
    semanticTarget,
    navigationGoal,
    rawPath = [],
    smoothedPath = [],
    navigationGrid,
  } = navState;
  const providerType = getCurrentProviderType();

  // Grid Cell dimensions for overlay
  const cols = navigationGrid?.cols || 40;
  const rows = navigationGrid?.rows || 40;
  const cellW = (100 / cols).toFixed(4);
  const cellH = (100 / rows).toFixed(4);

  // SVG Coordinates
  const curX = currentNormalizedPos ? (currentNormalizedPos.x * 100).toFixed(2) : '50';
  const curY = currentNormalizedPos ? (currentNormalizedPos.y * 100).toFixed(2) : '75';

  const semX = semanticTarget ? (semanticTarget.x * 100).toFixed(2) : null;
  const semY = semanticTarget ? (semanticTarget.y * 100).toFixed(2) : null;

  const goalX = navigationGoal ? (navigationGoal.x * 100).toFixed(2) : null;
  const goalY = navigationGoal ? (navigationGoal.y * 100).toFixed(2) : null;

  const rawPointsStr = rawPath.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(' ');
  const smoothedPointsStr = smoothedPath.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`).join(' ');

  const brokenCount = objects.filter((o) => o.condition === 'DAMAGED' || o.condition === 'MALFUNCTIONING').length;

  return (
    <div className="scene-visualizer-overlay fade-in" aria-label="Development Scene Perception Visualizer">
      {/* Dev Header Badge */}
      <div className="scene-visualizer-badge">
        <ShieldAlert size={14} style={{ color: '#fbbf24' }} />
        <span>
          DEV PERCEPTION ({providerType.toUpperCase()}) // v{sceneState.sceneVersion || 1} // BROKEN: {brokenCount} // {objects.length} OBJS
          {selectedObj ? ` // TARGET: ${selectedObj.label.toUpperCase()}` : ''}
          {navStatus && navStatus !== 'IDLE' ? ` // NAV: ${navStatus}` : ''}
          {autonomySnapshot.state !== 'IDLE' ? ` // AUTONOMY: ${autonomySnapshot.state}` : ''}
          {taskSnapshot.state !== 'IDLE' ? ` // TASK: ${taskSnapshot.state}` : ''}
        </span>
        <button
          type="button"
          className="scene-visualizer-close-btn"
          onClick={onToggle}
          title="Hide Detection Overlay"
        >
          <EyeOff size={13} />
        </button>
      </div>

      {/* Navigation Grid & Path Overlay (SVG) */}
      <svg
        className="nav-vector-overlay"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 6 }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Render Blocked Navigation Grid Cells */}
        {navigationGrid &&
          navigationGrid.grid &&
          navigationGrid.grid.map((row, r) =>
            row.map((cell, c) => {
              if (cell === CELL_TYPES.BLOCKED) {
                const x = (c * (100 / cols)).toFixed(3);
                const y = (r * (100 / rows)).toFixed(3);
                return (
                  <rect
                    key={`cell-${r}-${c}`}
                    x={`${x}%`}
                    y={`${y}%`}
                    width={`${cellW}%`}
                    height={`${cellH}%`}
                    fill="rgba(239, 68, 68, 0.22)"
                    stroke="rgba(239, 68, 68, 0.35)"
                    strokeWidth="0.08"
                  />
                );
              }
              return null;
            })
          )}

        {/* Raw A* Path (Dashed cyan line) */}
        {rawPointsStr && (
          <polyline
            points={rawPointsStr}
            fill="none"
            stroke="rgba(56, 189, 248, 0.75)"
            strokeWidth="0.5"
            strokeDasharray="1 1"
          />
        )}

        {/* Smoothed Path (Solid gold line) */}
        {smoothedPointsStr && (
          <polyline
            points={smoothedPointsStr}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Smoothed Waypoints Markers */}
        {smoothedPath.map((pt, idx) => (
          <circle
            key={`wp-${idx}`}
            cx={`${(pt.x * 100).toFixed(2)}%`}
            cy={`${(pt.y * 100).toFixed(2)}%`}
            r="0.8"
            fill="#fbbf24"
            stroke="#000000"
            strokeWidth="0.3"
          />
        ))}

        {/* Current Butler Position Marker */}
        {currentNormalizedPos && (
          <circle
            cx={`${curX}%`}
            cy={`${curY}%`}
            r="1.4"
            fill="#10b981"
            stroke="#ffffff"
            strokeWidth="0.4"
          />
        )}

        {/* Adjusted Navigation Goal Marker (Gold Crosshair) */}
        {goalX && goalY && (
          <g>
            <circle cx={`${goalX}%`} cy={`${goalY}%`} r="1.2" fill="none" stroke="#fbbf24" strokeWidth="0.4" />
            <circle cx={`${goalX}%`} cy={`${goalY}%`} r="0.4" fill="#fbbf24" />
          </g>
        )}
      </svg>

      {/* Normalized Bounding Boxes & Interaction Points Rendered Over Background */}
      <div className="scene-boxes-container">
        {objects.map((obj) => {
          const {
            normalizedBoundingBox,
            normalizedCenter,
            normalizedInteractionPoint,
            interactionStrategy = 'near',
          } = obj;

          const leftPct = (normalizedBoundingBox.x * 100).toFixed(2);
          const topPct = (normalizedBoundingBox.y * 100).toFixed(2);
          const widthPct = (normalizedBoundingBox.width * 100).toFixed(2);
          const heightPct = (normalizedBoundingBox.height * 100).toFixed(2);

          const ipLeftPct = (normalizedInteractionPoint?.x * 100).toFixed(2);
          const ipTopPct = (normalizedInteractionPoint?.y * 100).toFixed(2);

          const isSelected = selectedObjectId === obj.id;
          const isHovered = hoveredObjectId === obj.id;

          return (
            <React.Fragment key={obj.id}>
              {/* Bounding Box Card */}
              <div
                className={`scene-bbox-card category-${obj.category} ${isSelected ? 'dev-selected' : ''} ${
                  isHovered ? 'dev-hovered' : ''
                }`}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                }}
              >
                {/* Center dot (●) */}
                <div
                  className="scene-center-dot"
                  style={{
                    left: `calc(50% - 4px)`,
                    top: `calc(50% - 4px)`,
                  }}
                  title={`Object Center (${normalizedCenter.x}, ${normalizedCenter.y})`}
                />

                {/* Label, Confidence & Strategy Badge */}
                <div className="scene-bbox-label">
                  <span className="bbox-name">{obj.label}</span>
                  <span className="bbox-conf">{(obj.confidence * 100).toFixed(0)}%</span>
                  <span className="bbox-strategy">[{interactionStrategy}]</span>
                </div>
              </div>

              {/* Derived Interaction Point Marker (◆ Diamond) */}
              {normalizedInteractionPoint && (
                <div
                  className={`scene-interaction-marker ${isSelected ? 'dev-selected-ip' : ''}`}
                  style={{
                    left: `${ipLeftPct}%`,
                    top: `${ipTopPct}%`,
                  }}
                  title={`Interaction Point: ${obj.label} [${interactionStrategy}] (${normalizedInteractionPoint.x}, ${normalizedInteractionPoint.y})`}
                >
                  <div className="interaction-diamond" />
                  <span className="interaction-tag">◆ {obj.label} ({interactionStrategy})</span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};



