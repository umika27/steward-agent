import { useState, useEffect, useRef } from 'react';
import { SceneAnalyzer } from './sceneAnalyzer';
import { sceneImageStore } from './sceneImageStore';

// Singleton instance of SceneAnalyzer
export const globalSceneAnalyzer = new SceneAnalyzer();

/**
 * React Hook for consuming Scene Perception & Scene Image State
 *
 * @param {string} initialDefaultBgUrl - Fallback background image asset path
 * @returns {Object} { sceneState, imageSnapshot, isDebugVisualizerOpen, toggleDebugVisualizer, uploadSceneImage, resetSceneImage }
 */
export function useSceneStore(initialDefaultBgUrl) {
  const [sceneState, setSceneState] = useState(globalSceneAnalyzer.getSceneState());
  const [imageSnapshot, setImageSnapshot] = useState(() => {
    if (initialDefaultBgUrl && sceneImageStore.getSnapshot().source === null) {
      sceneImageStore.loadDefaultScene(initialDefaultBgUrl);
    }
    return sceneImageStore.getSnapshot();
  });
  const [isDebugVisualizerOpen, setIsDebugVisualizerOpen] = useState(false);
  const isAnalyzingRef = useRef(false);

  // Initialize default scene on mount if not already loaded
  useEffect(() => {
    if (initialDefaultBgUrl && sceneImageStore.getSnapshot().source !== initialDefaultBgUrl && sceneImageStore.getSnapshot().sourceType === 'default') {
      sceneImageStore.loadDefaultScene(initialDefaultBgUrl);
    }
  }, [initialDefaultBgUrl]);

  // Subscribe to sceneImageStore changes
  useEffect(() => {
    const unsubImage = sceneImageStore.subscribe((event, snapshot) => {
      setImageSnapshot(snapshot);
      if (snapshot.source) {
        runAnalysis(snapshot.source, snapshot.width, snapshot.height, true);
      }
    });

    // Initial analysis run
    const currentSnap = sceneImageStore.getSnapshot();
    if (currentSnap.source) {
      runAnalysis(currentSnap.source, currentSnap.width, currentSnap.height, false);
    }

    return unsubImage;
  }, []);

  const runAnalysis = (src, width, height, force = false) => {
    if (!src || isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;

    globalSceneAnalyzer.analyzeScene(src, force, { width, height }).then((newState) => {
      setSceneState(newState);
      isAnalyzingRef.current = false;
    });
  };

  const toggleDebugVisualizer = () => {
    setIsDebugVisualizerOpen((prev) => !prev);
  };

  const uploadSceneImage = (file) => {
    return sceneImageStore.uploadUserImage(file);
  };

  const resetSceneImage = () => {
    return sceneImageStore.resetToDefault(initialDefaultBgUrl);
  };

  return {
    sceneState,
    imageSnapshot,
    isDebugVisualizerOpen,
    toggleDebugVisualizer,
    uploadSceneImage,
    resetSceneImage,
  };
}

