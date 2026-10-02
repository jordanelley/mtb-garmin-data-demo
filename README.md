# Audit Tracks

A local tool for visualizing GPX track files: the raw GPS points, the elevation
gradient throughout the track, and an **estimated** bank angle for berms/turns.

## Usage

```sh
npm install
npm run dev
```

Drop `.gpx` files into `gpx-tracks/` (a sample track is included), then hit
**Refresh** in the sidebar and select a file. The dev server reads that folder
live, so new files show up on refresh with no rebuild.

## What it shows

- **Track shape** — a 2D plot of the raw lat/lon points, colored by gradient.
- **Elevation & gradient** — an elevation profile colored the same way, with a
  hover crosshair.
- **Estimated berm bank angle** — turns are flagged where the estimated lean
  angle is 8° or more, bucketed into Mild / Moderate / Aggressive / Extreme.
- A raw point-by-point data table for every chart, so every value is reachable
  without hovering.

## How berm angle is estimated

GPX files don't contain a bank/lean angle — only lat/lon/elevation and
(usually) timestamps. For each point, this app:

1. Fits a local turn radius through nearby GPS points (a circumradius over a
   short window, not point-to-point, to reduce GPS jitter).
2. Derives speed from timestamps over that same window.
3. Applies the ideal banking formula: **θ = atan(v² / (g·r))** — the lean
   angle at which a rider corners with zero net lateral force.

This is a physics-based **estimate**, not a measurement — it's only as good as
GPS accuracy and point density, and it assumes the formula's idealized
cornering model. Files without timestamps can still show gradient, but can't
produce a bank-angle estimate (no speed to derive).

## Project layout

- `gpx-tracks/` — drop your `.gpx` files here
- `vite-plugin-gpx-api.js` — dev/preview-server middleware that lists/serves that folder
- `src/lib/` — GPX parsing, geometry (distance/curvature/banking), and the track model
- `src/components/` — the map, elevation chart, legends, and tables
