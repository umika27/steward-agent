# Steward Butler UI — Demonstration & Testing Guide (Phase 12B Final)

## 1. Quick Start Guide

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start Development Server
```bash
npm run dev
```
Open your browser to `http://127.0.0.1:5173`.

---

## 2. Environment Configuration

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### Option A: Offline Development Mock Mode (Default)
```env
VITE_IMAGE_GENERATION_PROVIDER=mock
VITE_VISION_PROVIDER=mock
VITE_REASONING_PROVIDER=mock
```

### Option B: Live AI Mode (Google Gemini & Imagen)
```env
VITE_IMAGE_GENERATION_PROVIDER=ai
VITE_VISION_PROVIDER=ai
VITE_REASONING_PROVIDER=ai
VITE_GEMINI_API_KEY=your_actual_gemini_api_key_here
VITE_GEMINI_MODEL=gemini-2.5-flash
```

---

## 3. Primary User Experience Demo Script

### STEP 1: Launch Application
Open the web app. Observe the minimal interface featuring only the indoor room environment, Butler, and top floating `[ Generate ]` button.

### STEP 2: Generate Environment
Click `[ Generate ]`.
- A new synthetic room appears with clear walkable floor space, furniture, objects, documentation, and a telephone.
- Automatic scene perception detects objects and visible conditions (`NORMAL`, `DAMAGED`, `MALFUNCTIONING`, `UNCERTAIN`).

### STEP 3: Click a Normal Object
Click any normal object (e.g. Sofa, Cabinet, Desk, Lamp).
- **Result**: Butler responds briefly (`"The sofa looks fine."`).
- No task starts, no movement occurs. Speech clears after 3.5 seconds.

### STEP 4: Click a Broken Object
Click the malfunctioning/damaged object (e.g. Broken Washing Machine, Refrigerator, Printer, or TV).
- **Result**:
  1. Butler says `"I'll take a look at the washing machine."` and transitions emotion to `thinking`.
  2. Butler navigates around obstacles using A* pathfinding to inspect the broken object.
  3. Butler identifies the need for documentation and navigates across the room to the user manual.
  4. Butler reviews the manual (`"Reviewing manual..."`).
  5. Butler returns to the broken object to diagnose.
  6. Diagnosis determines `REPAIR_REQUIRED`. Butler navigates to the telephone object and contacts repair service (`"Calling technician..."`).
  7. Butler reports completion (`"Repair requested. Service dispatched."`) and returns safely home.

---

## 4. Developer Debug Visualizer
Click the system info icon (ⓘ) and select **SHOW PERCEPTION DETECTION OVERLAY**.
- Renders bounding boxes, object categories, confidence scores, condition tags, navigation obstacle grids, and A* waypoints for development debugging.
- Normal view remains 100% clean and minimal.
