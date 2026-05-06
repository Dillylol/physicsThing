# Rotational Physics Lab

Interactive 3D physics simulator for rotational motion, built around AP Physics C: Mechanics FRQ concepts. Explore rolling dynamics, loop-the-loop minimum heights, compound inertia systems, and energy analysis.

**[Live Demo →](https://dillylol.github.io/physicsThing/)**

## FRQ Alignment

This lab is designed around two AP Physics C: Mechanics rotational motion problems:

**Problem 1 — Rolling on an Incline:**
- Objects rolling without slipping down an inclined plane
- Compound toy (3 coaxial cylinders) with `I_total = 9/2 MR²`
- Acceleration: `a = g sinθ / (1 + b)` where `b = I/(mR²)`
- Angular momentum non-conservation due to friction torque
- Total kinetic energy: `K = ½mv²(1 + b)`

**Problem 2 — Loop-the-Loop:**
- Minimum release height to complete a loop: `h_min = R(5 + b)/2`
- Different objects (solid sphere, hollow sphere, solid cylinder, hollow cylinder) with different `b` values
- Normal force condition at top of loop: `N = m(v²/R − g) ≥ 0`
- Linear relationship between h and b (slope = R/2)

## Features

- **FRQ Object Presets** — Solid sphere (b=0.4), hollow sphere (b=0.67), solid cylinder (b=0.5), hollow cylinder (b=1.0), FRQ1 compound toy
- **FRQ Track Presets** — Inclined plane (FRQ1), loop track (FRQ2), valley, double loop
- **Loop Analysis Panel** — Live minimum height calculation, pass/fail indicator, normal force at top, energy derivation, h vs b experiment table
- **Compound Inertia Systems** — Configure center + outer disk/hoop combinations matching the FRQ1 toy
- **Custom Track Editor** — Build tracks with ramps, flat sections, loops, and adjustable thickness
- **3D Interactive Viewer** — Three.js rendering with orbit camera and force arrows
- **Energy Analysis** — Live `K = ½mv²(1+b) + mgh` with animated energy bar
- **Force Calculations** — Gravity, normal, friction, centripetal with rolling acceleration derivation
- **Angular Momentum** — `L = Iω` tracking with non-conservation explanation (friction torque)
- **Mouse Hover Analysis** — Hover over any track point to see calculated energy
- **Equations Panel** — Full breakdown of all physics with FRQ derivations shown inline

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
