# Scribble3D – Sketch to 3D Studio 🎨✨
### Transform 2D sketches into interactive 3D objects and walkable worlds — in real time.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue.svg?style=flat-square&logo=react)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r182-orange.svg?style=flat-square&logo=three.js)](https://threejs.org/)
[![FastAPI](https://img.shields.io/badge/AI_Backend-FastAPI-009688.svg?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Gemini](https://img.shields.io/badge/AI-Google_Gemini-4285F4.svg?style=flat-square&logo=google)](https://ai.google.dev/)
[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-ef4444.svg?style=flat-square&logo=turborepo)](https://turbo.build/)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-green.svg?style=flat-square)](LICENSE)

---

## 📺 Demo

https://github.com/user-attachments/assets/a564f2db-37d2-413a-9ae3-6a2391c6723a

---

## 🚀 Overview

**Scribble3D** is an AI-powered creative web platform that eliminates the steep learning curve of 3D modeling. Sketch any idea on the 2D canvas, hit **Make 3D**, and watch it appear as an interactive three-dimensional object in a walkable world — no Blender knowledge required.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🖊️ **2D Sketching** | Full-featured vector canvas powered by [tldraw](https://tldraw.dev/) |
| 🤖 **AI 3D Generation** | Google Gemini Vision converts your sketch into a Three.js 3D model |
| 🌄 **AI Sketch Enhancement** | FLUX AI polishes and renders your rough doodles into concept art |
| 🌍 **3D World** | First-person walkable environment with sky, ocean, infinite grid & gizmos |
| 🎯 **Object Manipulation** | Select, translate, rotate, and scale any 3D object in the scene |
| 📤 **GLTF Export** | Download your entire scene as a standard `.gltf` file for Blender/Unity |

---

## 🏗️ Architecture & Tech Stack

```
sketch-to-3d-studio/
├── apps/
│   ├── web/              # Next.js 16 + tldraw canvas + Three.js / React Three Fiber
│   └── ai-backend/       # Python FastAPI — Gemini AI, FLUX image enhancement, SSE streaming
└── packages/
    ├── ui/               # Shared UI components
    └── typescript-config/# Shared TSConfigs
```

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (Turbopack), React 19, TypeScript |
| 2D Canvas | [tldraw](https://tldraw.dev/) |
| 3D Graphics | Three.js, React Three Fiber, Drei |
| State | Zustand |
| AI Backend | Python FastAPI, Google Gemini Vision API |
| Image AI | Pollinations FLUX (free, no key required) |
| Monorepo | Turborepo, pnpm |

---

## 🏃 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or 20+
- [pnpm](https://pnpm.io/) 9+ (or use `npx pnpm`)
- [Python](https://python.org/) 3.10+
- A **Google Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com/))

### 1. Clone the Repository
```bash
git clone https://github.com/rxhuljoshi10/sketch-to-3d-studio.git
cd sketch-to-3d-studio
```

### 2. Install Frontend Dependencies
```bash
npx pnpm install
```

### 3. Configure the AI Backend
```bash
cd apps/ai-backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
```

Create `apps/ai-backend/.env`:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### 4. Start Both Servers

**Terminal 1 – Frontend:**
```bash
npx pnpm --filter web dev
```

**Terminal 2 – AI Backend:**
```bash
python apps/ai-backend/run_backend.py
```

| Service | URL |
|---|---|
| Studio (Canvas + 3D World) | http://localhost:3000/canvas |
| AI Backend health check | http://localhost:8000/ |

---

## 🗺️ User Walkthrough — Explore Every Feature

Follow these steps to discover everything Scribble3D can do.

---

### Step 1 — Open the Studio

Navigate to **[http://localhost:3000/canvas](http://localhost:3000/canvas)**.

You will see two tabs at the top:
- **🖊️ Canvas** — the 2D drawing board
- **🌍 3D World** — the interactive 3D environment

Start on the **Canvas** tab.

---

### Step 2 — Draw Your Sketch

Use the toolbar on the left to draw anything you like:

| Tool | What it does |
|---|---|
| **Pencil** | Free-hand drawing — great for organic shapes |
| **Rectangle / Ellipse** | Geometric primitives |
| **Arrow** | Draw directional arrows |
| **Color Picker** | Change stroke and fill colour |
| **Eraser** | Erase parts of your drawing |

**Tips:**
- Draw a simple house, tree, car, or animal — the simpler the sketch, the faster the AI.
- Use **Ctrl+Z** / **Cmd+Z** to undo and **Ctrl+Y** to redo.
- Hold **Space + drag** to pan around the canvas.
- Use the scroll wheel to zoom in/out.

---

### Step 3 — Enhance Your Sketch with AI (Optional)

Before generating 3D, you can let AI polish your rough drawing into rendered concept art.

1. **Select** the shapes you want to improve (drag to box-select, or **Ctrl+A** for all).
2. Click **✨ Improve Drawing** in the top navigation bar.
3. Wait ~5–10 seconds — the AI (FLUX) will replace your sketch with a cleaner, more detailed version.
4. The enhanced image is placed directly on the canvas.

> This step is completely optional. You can go straight to "Make 3D" with a rough sketch.

---

### Step 4 — Generate a 3D Model

1. **Select** the shapes or drawing you want to convert (drag to box-select all, or **Ctrl+A**).
2. Click **🔮 Make 3D** in the top navigation bar.
3. A loading card appears to the right of your selection.
4. The AI (Google Gemini) analyses your sketch and writes Three.js code to build a 3D model.
5. When done, a **3D preview card** appears on the canvas — you can double-click it to rotate and zoom the model.

> The AI backend must be running (`python apps/ai-backend/run_backend.py`) for this to work.  
> Check **http://localhost:8000/** — it should return `"gemini_active": true`.

---

### Step 5 — View in the 3D World

After generation completes, the model is **automatically added** to the 3D scene.

1. Click the **🌍 3D World** tab at the top.
2. Your generated object appears in the scene.
3. Use **first-person controls** to explore:

| Control | Action |
|---|---|
| `W` | Move forward |
| `S` | Move backward |
| `A` | Strafe left |
| `D` | Strafe right |
| `Mouse drag` | Look around |
| `Space` | Move up |
| `Shift` | Move down |
| Scroll | Zoom (when not in first-person) |

> Click anywhere on the 3D viewport to activate first-person mode. Press **Escape** to exit.

---

### Step 6 — Select & Transform Objects

1. **Click** any object in the 3D scene to select it (a gizmo appears).
2. Use the **transform toolbar** (top-right of the 3D view):
   - **Move** — drag the arrows to reposition
   - **Rotate** — drag the rings to spin the object
   - **Scale** — drag the handles to resize
3. Press **Delete** or **Backspace** to remove a selected object.

---

### Step 7 — Toggle the Ocean Environment

1. In the **3D World** tab, look for the **🌊 Ocean** toggle button.
2. Enable it to replace the infinite grid floor with a dynamic ocean shader.
3. Toggle it back off to return to the grid.

---

### Step 8 — Add a Model to the Scene Manually

Each 3D preview card on the 2D canvas has icon buttons on its right side:

| Icon | Action |
|---|---|
| **+** (plus) | Add the model into the 3D World scene |
| **↩** (redo) | Regenerate the 3D model from the original sketch |
| **⧉** (copy) | Copy the raw Three.js code to clipboard |

Click **+** at any time to push a generated model into the 3D world manually.

---

### Step 9 — Export Your Scene

1. Switch to the **🌍 3D World** tab.
2. Click **Export Scene** (bottom-left corner of the 3D viewport).
3. A `scene.gltf` file will be downloaded.
4. Open it in **Blender**, **Unity**, **Unreal Engine**, or any 3D tool that supports GLTF.

---

### Step 10 — Sign In / Sign Up (Optional)

Visit **[http://localhost:3000/signin](http://localhost:3000/signin)** or **[http://localhost:3000/signup](http://localhost:3000/signup)** to create an account for saving your work (when backend persistence is configured).

---

## 🔧 Troubleshooting

| Problem | Solution |
|---|---|
| "Make 3D" does nothing | Make sure the AI backend is running and `gemini_active: true` at http://localhost:8000 |
| 3D World is empty after generation | Ensure the backend is connected; refresh the page and try again |
| `GEMINI_API_KEY` errors in backend | Add your key to `apps/ai-backend/.env` |
| `pip install` fails | Upgrade pip: `python -m pip install --upgrade pip` |
| Port 8000 in use | Kill the other process or change the port in `run_backend.py` |

---

## 👤 Author

**Rahul Joshi**
- GitHub: [@rxhuljoshi10](https://github.com/rxhuljoshi10)
- Repository: [sketch-to-3d-studio](https://github.com/rxhuljoshi10/sketch-to-3d-studio)

---

## 📜 License

This project is licensed under the [AGPL-3.0 License](LICENSE).  
You are free to use, study, and modify this code. Any distributed modifications must also be open-sourced under the same license.
