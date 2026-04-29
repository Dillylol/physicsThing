# Rotational Physics Lab

Interactive 3D physics simulator for rotational motion, compound inertia systems, and energy analysis.

**[Live Demo →](https://dillylol.github.io/physicsThing/)**

## Features

- **Compound Inertia Systems** — Configure inner + outer disk/hoop combinations (small radius between larger radii)
- **Custom Track Editor** — Build tracks with ramps, flat sections, loops, and adjustable thickness
- **3D Interactive Viewer** — Three.js 3D rendering with orbit camera and force arrows
- **Energy Analysis** — Live `E = ½mv² + ½Iω² + mgh` with animated energy bar
- **Force Calculations** — Gravity, normal, friction, centripetal, net force summation
- **Torque** — `τ = Iα = FR` with angular acceleration
- **Angular Momentum** — `L = Iω` tracking throughout the simulation
- **Mouse Hover Analysis** — Hover over any track point to see calculated energy
- **Smooth Track Transitions** — Cubic Hermite interpolation at segment junctions
- **Equations Panel** — Full breakdown of all physics at the object's current position

## Tech Stack

- React 19 + Vite
- Three.js (3D rendering)
- Tailwind CSS v4
- GitHub Pages (hosting)

## Development

```bash
npm install
npm run dev
```

## Build & Deploy

Pushes to `main` automatically deploy to GitHub Pages via GitHub Actions.

```bash
npm run build
```
