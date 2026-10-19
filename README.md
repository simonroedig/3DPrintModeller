<p align="center">
  <img src="docs/logo.svg" width="84" alt="3DPrintModeller logo" />
</p>

<h1 align="center">3DPrintModeller</h1>

<p align="center">
  <b>Precise parts for 3D printing, right in your browser.</b><br />
  As intuitive as Tinkercad, as precise as real CAD.
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white" />
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-000000?logo=threedotjs&logoColor=white" />
  <img alt="OpenCascade WASM" src="https://img.shields.io/badge/OpenCascade-WebAssembly-4f8ff7" />
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite_8-646cff?logo=vite&logoColor=white" />
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind_CSS_4-0f172a?logo=tailwindcss&logoColor=38bdf8" />
  <a href="https://github.com/simonroedig/3DPrintModeller/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/simonroedig/3DPrintModeller/actions/workflows/ci.yml/badge.svg" /></a>
</p>

<p align="center">
  <a href="https://3d-print-modeller.vercel.app/"><img alt="Try it live: 3d-print-modeller.vercel.app" src="https://img.shields.io/badge/Try_it_live-3d--print--modeller.vercel.app-3b82f6?style=for-the-badge&logo=vercel&logoColor=white" /></a>
</p>

<p align="center"><b>English</b> · <a href="README.de.md">Deutsch</a></p>

<p align="center">
  <a href="#why">Why?</a> ·
  <a href="#features">Features</a> ·
  <a href="#example-phone-stand">Example</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#tech">Tech</a> ·
  <a href="https://simonroedig.com">simonroedig.com</a>
</p>

[![3DPrintModeller with the example phone stand](docs/screenshots/hero.jpg)](https://3d-print-modeller.vercel.app/)

<p align="center"><sub>The example phone stand: built from simple primitives, cable channel and cable slot subtracted (the channel is highlighted in orange), corners rounded. Every part stays editable.</sub></p>

## Why?

For my 3D printing projects there was no software tailored to my needs.
Tinkercad is intuitive but quickly hits its limits. Shapr3D is powerful, but often too much for a quick print part.
**3DPrintModeller combines both**: intuitive building with simple primitives plus real CAD tools for the complex parts.
Everything runs in the browser, no installation, no account: **[3d-print-modeller.vercel.app](https://3d-print-modeller.vercel.app/)**

| The simple part, like Tinkercad | The precise part, like CAD tools such as Shapr3D |
| --- | --- |
| Primitives in one click: box, cylinder, wedge, cone, sphere, tube | Sketches on any plane, even directly on faces of other parts |
| Drag parts around, they snap to faces and to the print bed | Exact dimensions, input with math like `120/2` or `2cm+5` |
| Holes are just bodies that get subtracted | Real fillets and chamfers on a B-rep CAD kernel (OpenCascade) |
| Handles on every side to drag dimensions | Push and tilt faces, even on combined parts |
| Start right away, examples in the start dialog | Non-destructive boolean operations, STEP import and export |

## Features

### Build
- **Unit and grid** chosen at the start (mm, cm, inch). Everything snaps to the grid, hold `Alt` while dragging to move freely.
- **Primitives**: box, cylinder, wedge (with angle), cone, sphere, tube. Hold `Shift` to add one as a hole.
- **Move with snapping** to faces of other bodies (flush, touching, centered) and to the print bed; pink guides show what it snapped to.
- **Arrow handles** in the color of their axis (X red, Y green, Z blue), dimension labels editable right in the model.
- **Rotate** in 90° steps or freely, **lay a face flat** on the bed with one click, **center** on the print bed (on the grid or exactly),
  **align** several parts.

### Sketch on any plane

![Sketch on the front face of the lip, the plane preview at the top right](docs/screenshots/sketch.png)

- Rectangle, circle and polygon, drawn on the plane of the current view: top, bottom, front, back, left, right (in 3D on the floor).
- **Plane preview at the top right**: a small 3D picture shows where the sketch lives in space, and an eye in the axis color shows
  where you are looking from. Dragging moves the plane live and snaps flush to faces. Or click a face and the sketch lies exactly on it.
- **Extrude** by typing a height or dragging the arrow, also directly as a hole.

### Edges and faces

![Selecting and rounding an edge](docs/screenshots/fillet.jpg)

- `F` or double click a body: edges and faces light up on hover.
- **Edge**: drag the arrow outwards for a fillet, inwards for a chamfer. Works at the seams of combined parts too.
- **Face**: push it (outwards or inwards) or tilt it around one of its edges.
- Everything stays in the panel as an editing step that can be changed or removed later.

### Combine
- **Union** into one real solid, **Subtract** (the body picked first is the base), **Intersect**, and plain **Group**.
- **Non-destructive**: subtracted tools are kept invisibly, and can be expanded in the panel, edited, swapped or pulled out again.
- Combined bodies are **scalable** (handles, dimensions or percent), parametrically: round parts stay round, everything stays exact.

### Made for printing
- **Export** as 3MF (recommended), STL or STEP, with selectable quality, watertight meshes and volume and weight estimate.
- **Import** STEP (exact), STL, 3MF and OBJ. Meshes are converted into CAD solids (flat regions become real faces),
  very large meshes stay fast mesh objects.
- **Print bed** with presets (Bambu, Prusa, Ender, Voron), can be shown or hidden.

### Comfort
- **Projects** in a collapsible bar at the bottom, with preview images, saved automatically in the browser (IndexedDB).
- **Context bar** for the selection with the next useful steps, **tooltips** with shortcuts on every button.
- **Colors with meaning**: sketch light blue, bodies indigo, edges and faces orange, union green, subtract red, intersect purple.
- Undo and redo, copy and paste, long computations can be cancelled.
- **Language**: English or German, switchable in the top bar.

## Example: phone stand

In the start dialog under **“Or explore an example”** you can open the phone stand from the picture above.
It shows the typical workflow:

1. **Base plate**: a box, 84 × 70 × 6 mm.
2. **Backrest**: a wedge rising to about 65°.
3. **Lip**: a flat box at the front so the phone does not slide off.
4. **Cable slot** and **cable channel**: a box and a rotated cylinder, both as holes.
5. **Union**: everything becomes one solid, the holes are subtracted.
6. **Round edges**: the corners of the plate and the top of the lip.
7. **Export** as 3MF and print.

Every step stays editable: expand a part in the panel, change its dimensions, done.

## Controls

| Key | Action |
| --- | --- |
| `V` | Select and move |
| `R` / `C` / `P` | Rectangle / circle / polygon |
| `F` | Edit edges and faces |
| `L` | Lay a face flat on the bed |
| `1` to `6`, `7` | 3D, top, front, back, left, right, bottom |
| `Space` / `0` | Toggle top and 3D / fit everything |
| `Ctrl+G` / `Ctrl+Shift+G` | Union / split |
| `M` / `Shift+M` | Center on the bed (on the grid / exactly) |
| `Q` / `E` | Rotate 90° around Z |
| `H` | Solid or hole |
| `Ctrl+D`, `Ctrl+C`, `Ctrl+V` | Duplicate, copy, paste |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| Arrow keys, Page Up/Down | Move the selection by one grid step (`Shift` ×10) |
| `Esc` | Cancel, leave the tool |

Mouse: left button selects, drags and draws, hold the right button to orbit (from a 2D view it continues in 3D right away),
middle button pans, wheel zooms.

## Quick start

Requires Node.js 22 (at least 20.19).

```bash
git clone https://github.com/simonroedig/3DPrintModeller.git
cd 3DPrintModeller
npm install
npm run dev       # http://localhost:5173
```

```bash
npm run build     # typecheck and production build into dist/
npm run preview   # serve the build locally
```

## Tech

| Area | Technology |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS 4, lucide-react |
| 3D view | Three.js, React Three Fiber, drei |
| CAD kernel | OpenCascade compiled to WebAssembly via [replicad](https://replicad.xyz), running in a Web Worker |
| App state | [Zustand](https://github.com/pmndrs/zustand) (state management library), undo and redo via document snapshots |
| Storage | IndexedDB (projects, preview images, imported files) |
| Build | Vite 8 |
| Export | custom 3MF writer (fflate), binary STL, STEP via OpenCascade |
| Languages | small built-in i18n: English source texts, German dictionary |

A few details:

- **Parametric model**: every body is a shape with parameters plus a list of editing steps (fillet, chamfer, push or tilt a face).
  The steps remember their edges and faces geometrically, so they survive changes made before them.
- **CAD in the background**: the OpenCascade kernel runs in a Web Worker with a job queue. Meshes are cached by geometry,
  long computations can be cancelled (the worker restarts).
- **Robust fillets**: if a fillet fails in one go, the edges are tried one by one, and as a last resort a custom profile is rounded.
  That is what makes the seams between combined parts work.
- **Import**: STEP is read exactly. Triangle meshes up to about 12,000 triangles are split into flat regions, sewn into faces
  and repaired into solids. Larger meshes stay mesh objects and are displayed directly.
- **Plane preview**: rendered into a scissored region of the same WebGL context, no second canvas.

```
src/
  cad/        CAD worker (OpenCascade), mesh cache, import, STL/3MF writers
  store/      document, selection, undo/redo, model operations, projects
  lib/        units, planes, geometry, snapping, scaling
  viewport/   3D view: cameras, bodies, sketches, handles, edge tool, previews
  ui/         toolbar, panels, dialogs, shortcuts
  i18n/       translation helper and German dictionary
```

## Deployment

A purely static site with relative paths that runs on any static host.
It is hosted on **Vercel** at [3d-print-modeller.vercel.app](https://3d-print-modeller.vercel.app/): framework preset **Vite**,
build command `npm run build`, output directory `dist`. Netlify or GitHub Pages work the same way.

On every push to `main` and on pull requests, GitHub Actions checks typecheck and build (`.github/workflows/ci.yml`).

## Author

Designed and built by **Simon R.**, [simonroedig.com](https://simonroedig.com).

![Start screen of 3DPrintModeller](docs/screenshots/welcome.png)
