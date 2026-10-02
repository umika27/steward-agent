# Steward Butler UI — Project Architecture Document (Phase 12B Final Freeze)

## 1. Project Purpose
The Steward Butler UI is a standalone, presentation-decoupled, scene-aware visual assistant prototype. It demonstrates vision-based room perception, AI environment generation, condition-aware object perception, A* navigation around obstacles, semantic task planning, natural language AI reasoning, and event-driven autonomous failure recovery within synthetic AI-generated room environments.

---

## 2. Final Standalone Architecture & Flow

```
                 ┌──────────────────┐
                 │   GENERATE       │
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │ IMAGE GENERATOR  │
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │ SCENE CONTRACT   │
                 │   VALIDATOR      │
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │  AI VISION       │
                 │ OBJECT+CONDITION │
                 └────────┬─────────┘
                          ↓
                 ┌──────────────────┐
                 │    SCENESTATE    │
                 └────────┬─────────┘
                          ↓
                    USER CLICK
                          ↓
                 ┌──────────────────┐
                 │ CONDITION        │
                 │ DECISION         │
                 └───────┬──────────┘
                         │
               ┌─────────┴─────────┐
               ↓                   ↓
            NORMAL              BROKEN
               ↓                   ↓
         SHORT RESPONSE       TASK ENGINE
                                   ↓
                              NAVIGATION
                                   ↓
                               INSPECTION
                                   ↓
                             DOCUMENTATION
                                   ↓
                               DIAGNOSIS
                              ↙         ↘
                          REPAIR       REPLACE
                             ↓
                         TELEPHONE
                             ↓
                          COMPLETE
```

---

## 3. Core Component Modules

### 1. Image Generation (`src/scene/imageGeneration/`)
- **`imageGenerationProviderFactory`**: Instantiates active generator (`AIImageGenerationProvider` vs `MockImageGenerationProvider`).
- **`imageGenerationPrompt`**: Enforces fixed indoor environment generation prompt (1 broken object, normal objects, documentation, telephone, walkable floor space, no people/watermarks).
- **`sceneContractValidator`**: Audits generated environment perception outputs against contract requirements (up to 3 attempts before fallback).

### 2. Scene Perception & Condition Detection (`src/scene/`)
- **`visionProviderFactory`**: Switches between `AIVisionProvider` (Gemini Flash) and `MockDevVisionProvider`.
- **`visionDetectionValidator`**: Sanitizes raw vision output, validates numeric bounding boxes, clamps confidence $[0.0 - 1.0]$, enforces allowed condition states (`NORMAL`, `DAMAGED`, `MALFUNCTIONING`, `UNCERTAIN`).
- **`sceneNormalizer`**: Preserves normalized geometry $[0.0 - 1.0]$ and condition attributes into immutable `SceneObject` contracts.
- **`interactionPointResolver`**: Calculates geometric interaction approach points ($\diamondsuit$) based on object geometry.
- **`sceneAnalyzer`**: Manages perception pipeline execution and increments `sceneVersion` for stale request cancellation.

### 3. Object Click & Condition Decision Engine (`src/scene/`)
- **`conditionDecisionController`**: Evaluates object clicks:
  - `NORMAL`: Butler gives short response (`"The ${label} looks fine."`), 0 movement, 0 task execution.
  - `UNCERTAIN`: Butler expresses uncertainty (`"I'm not sure. I'll inspect it."`) and launches basic inspection.
  - `DAMAGED` / `MALFUNCTIONING`: Butler initiates autonomous diagnosis workflow (`DIAGNOSE_BROKEN`).

### 4. Semantic Task Intelligence & Navigation (`src/tasks/`, `src/navigation/`)
- **`taskIntents`**: Defines semantic intents (`INSPECT`, `RETRIEVE`, `DELIVER`, `INTERACT`, `INVESTIGATE`, `ASSIST`, `DIAGNOSE_BROKEN`, `RETURN`, `WAIT`).
- **`taskPlanner`**: Compiles multi-step plans dynamically from `SceneState` (broken object $\rightarrow$ inspect $\rightarrow$ find manual $\rightarrow$ review manual $\rightarrow$ return $\rightarrow$ diagnose $\rightarrow$ telephone if repair required).
- **`taskEngine` & `taskExecutor`**: Executes step sequences sequentially.
- **`ButlerNavigator` & `A* Pathfinder`**: Navigates Butler along 8-directional obstacle-avoiding paths smoothed via line-of-sight raycasting.

### 5. Presentation, Emotion & Minimal UI (`src/components/`, `src/emotions/`)
- **`ConversationDemo`**: Renders minimal UI (environment background, Butler, speech bubble, top sleek `[ Generate ]` button, minimal info icon).
- **`EmotionResolver`**: Maps task states to 8 core emotions (`attentive`, `confident`, `confused`, `frustrated`, `relieved`, `surprised`, `thinking`, `worried`).
- **`SceneDetectionVisualizer`**: DEV-only overlay for debugging bounding boxes, grid obstacle cells, and path waypoints (strictly hidden in normal mode).

---

## 4. Minimal UI Philosophy
The normal UI contains ZERO technical dashboards, status badges, task step counters, confidence percentages, bounding box text, or model names. The intelligence is demonstrated entirely through the Butler's natural behavior and speech.

---

## 5. Security & Credentials
API keys are loaded via environment variables (`VITE_GEMINI_API_KEY`). For production deployments, client requests MUST be proxied through a secure server-side API gateway.
