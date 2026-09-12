# Sketch-to-3D Studio 🎨✨
### Transform 2D sketches into interactive 3D objects and virtual worlds — in real time.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-blue.svg?style=flat-square&logo=react)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r182-orange.svg?style=flat-square&logo=three.js)](https://threejs.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-ef4444.svg?style=flat-square&logo=turborepo)](https://turbo.build/)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-green.svg?style=flat-square)](LICENSE)

---

## 📺 Demo

https://github.com/user-attachments/assets/a564f2db-37d2-413a-9ae3-6a2391c6723a

---

## 🚀 Overview

**Sketch-to-3D Studio** is an AI-powered creative web platform designed to eliminate the steep learning curve of 3D modeling. Whether you are an artist, game designer, architect, or casual doodler, this studio allows you to sketch ideas on a 2D canvas and turn them into interactive, walkable 3D environments.

---

## ✨ Key Features

### 1. 2D Sketching Studio ([tldraw](https://tldraw.dev/))
- **Instant Drawing Canvas**: Fast, responsive vector sketching engine.
- **Rich Tooling**: Pencils, shapes, color palettes, fill settings, stroke sizing, and undo/redo history.
- **Sketch Enhancer**: AI-assisted doodle cleanup and concept enhancement.

### 2. Interactive 3D World (Three.js & React Three Fiber)
- **First-Person Walkthrough**: Explore the 3D scene using standard **WASD** keyboard controls and mouse look.
- **Atmospheric Environment**: Infinite grid terrain, dynamic skybox, lighting, ocean shaders, and coordinate gizmos.
- **Object Manipulation**: Select, inspect, and transform models directly inside the 3D viewport.
- **Instant Mode Switching**: Switch between the 2D sketchpad and 3D viewport with a single click.

### 3. AI Generation Engine (Coming / Under Active Integration)
- **Procedural 3D Code Generation**: Converts hand-drawn sketches into lightweight, editable Three.js procedural meshes using multimodal vision LLMs (Google Gemini).
- **Iterative Sketch-to-Edit**: Select any placed 3D object, sketch modifications on the 2D canvas, and update the existing 3D geometry.
- **GLTF / Mesh Export**: Download scenes and individual models as standard `.gltf` / `.glb` files for use in Blender, Unity, or Unreal Engine.

---

## 🛠️ Architecture & Tech Stack

```
sketch-to-3d-studio/
├── apps/
│   ├── web/              # Next.js 16 (Turbopack) frontend + tldraw canvas + Three.js
│   ├── https-backend/    # Express API server
│   └── ws-backend/       # WebSocket server for real-time multiplayer / tasks
└── packages/
    ├── db/               # Prisma 7 database client
    ├── ui/               # Shared UI component library
    └── typescript-config/# Shared TSConfigs
```

- **Frontend**: Next.js 16 (Turbopack), React 19, TypeScript
- **Canvas**: [tldraw](https://tldraw.dev/)
- **3D Graphics**: Three.js, React Three Fiber (`@react-three/fiber`), Drei (`@react-three/drei`)
- **State Management**: Zustand
- **Monorepo Tooling**: Turborepo, pnpm
- **AI Vision Pipeline**: Google Gemini API (Multimodal Vision $\to$ Three.js code)

---

## 🏃 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ or 20+
- [pnpm](https://pnpm.io/) 9+ (or use `npx pnpm`)

### 1. Clone the Repository
```bash
git clone https://github.com/rxhuljoshi10/sketch-to-3d-studio.git
cd sketch-to-3d-studio
```

### 2. Install Dependencies
```bash
npx pnpm install
```

### 3. Start the Development Server
```bash
npx pnpm --filter web dev
```

Visit **`http://localhost:3000`** in your browser:
- **Landing Page**: `http://localhost:3000`
- **Studio Canvas & 3D World**: `http://localhost:3000/canvas`

---

## 🎨 How to Use

1. **Draw**: Open the canvas and use the pencil and shape tools to draw your object.
2. **Make 3D**: Click the **"Make 3D"** button in the top navigation bar.
3. **Explore**: Toggle to the **"3D World"** tab to see your creation in space. Use **WASD** to walk and **Mouse** to look around.
4. **Export**: Export individual meshes or the entire world as `.gltf`.

---

## 👤 Author

**Rahul Joshi**
- GitHub: [@rxhuljoshi10](https://github.com/rxhuljoshi10)
- Repository: [sketch-to-3d-studio](https://github.com/rxhuljoshi10/sketch-to-3d-studio)

---

## 📜 License

This project is licensed under the [AGPL-3.0 License](LICENSE).
