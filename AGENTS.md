# Copilot Agent Onboarding

## What this repo is
- React + Vite TypeScript single-page app that visualizes Terra Invicta tech tree data (graphs, search, sidebar, drives overlay).
- Data lives under `public/gamefiles/` (stable + experimental); build generates `public/gamefiles/index.json` manifest.
- Icons can be regenerated from game asset bundles via `resources/` + Python scripts (see README). Deployed to GitHub Pages.

## Toolchain and runtimes
- Node: CI uses Node 20 (see `.github/workflows/deploy.yml`). Use `nvm use 20` to match. Local runs above were on Node 23.2 (OK for build/tsc).
- Package manager: npm (lockfile checked in). React 18, Vite 6, TypeScript 5.8, MUI 7, Plotly, vis-network.

## Bootstrap / install
- Always run `npm install` from repo root (validated: completes in ~2s, reports 6 npm audit vulnerabilities; no install errors).
- If switching Node versions, reinstall to refresh native deps.

## Validate before changes
- Always run `npm run tsc` (type-check only, no emit). Validated: passes after install.
- Prefer `npm run build` to ensure manifest + production bundle. Validated on Node 23.2: succeeds (~8s) and regenerates `public/gamefiles/index.json`; Vite warns about large chunk (>500 kB) only.
- Tests: none defined.
- Lint: `npm run lint` currently FAILS because it scans `./.venv/.../matplotlib` JS and a `process` global in `scripts/generate_gamefiles_manifest.js`. Workarounds: remove/relocate `.venv`, or lint only project code (`npx eslint src scripts --ext ts,tsx --max-warnings=0`). Do not consider lint clean unless these are addressed.

## Run / develop
- `npm run dev` starts Vite dev server (default 5173). Ensure `public/gamefiles/` exists; otherwise build/dev that touch manifest will fail.
- `npm run preview` serves the built `dist/` bundle.

## Build pipeline (CI)
- GitHub Actions: `.github/workflows/deploy.yml` builds on push to `master` with Node 20 using `npm ci`, `npm run build`, then deploys `dist` to GitHub Pages. Keep `public/gamefiles` present/committed so manifest generation succeeds.

## Project layout (pointers)
- Root: `package.json`, `package-lock.json`, `tsconfig.json` (strict, bundler resolution, noEmit), `eslint.config.ts` (flat config), `vite.config.ts` (React plugin, GitHub Pages base), `index.html`, `README.md`, `combat_thrust_chart.svg`, `cruise_thrust_chart.svg`, `dist/` (build output), `export_test_output/` (assets), `resources/` (habmodules/shipbuildericons + manifests), `scripts/` (Node & Python utilities), `public/` (gamefiles + icons + static), `src/` (app code).
- Key config: `eslint.config.ts` ignores `dist` only; add ignores if linting locally pulls in virtualenvs. `tsconfig.json` includes `src` and `vite.config.ts`; uses `noEmit`, `strict`.
- App entry: `src/main.tsx` (mounts React, router), `src/App.tsx` (layout, data load, language/version state, drives overlay), `src/TechGraph.tsx` (network visualization), `src/Searchbox.tsx`, `src/TechSidebar.tsx`, `src/DrivesChart.tsx`, `src/SettingsMenu.tsx`, `src/utils/TechDb.ts` and other utilities, `src/types/` for templates/localization types, `src/language.ts`, `src/version.ts`, `src/theme.tsx` (theme provider).
- Data/templates: `public/gamefiles/` contains `experimental/` and `stable/` template/localization JSON; manifest written to `public/gamefiles/index.json` by build script.
- Scripts: `scripts/generate_gamefiles_manifest.js` (Node, requires `public/gamefiles`), `scripts/export_unity_textures.py` (extract icons to `public/icons/`), `scripts/fix_region_json.py`, `scripts/generate_dv_map.py`, `scripts/TIRegionTemplate_fixed.json` sample.

## Behavioral notes / pitfalls
- Ensure `public/gamefiles` exists before running build/dev; `generate_gamefiles_manifest.js` exits non-zero if missing.
- Linting will traverse `.venv` unless excluded; delete/move virtualenv or pass explicit targets as above.
- Manifest generation mutates `public/gamefiles/index.json`; commit if relevant or regenerate before packaging.
- `npm run build` depends on `npm run generate:gamefiles-manifest`; do not skip.
- Use `npm ci` in CI/clean environments for reproducibility.
- If regenerating icons, follow README: place bundles in `resources/` and run `python scripts/export_unity_textures.py ./resources ./public/icons` after cleaning `public/icons` subfolders.

## How to work efficiently
- Follow the command order: `nvm use 20` → `npm install` → `npm run tsc` → (optional) targeted lint as described → `npm run build` (regenerates manifest) → `npm run dev`/`preview` as needed.
- Trust these notes; search the tree only if something here is missing or contradictory. Document any deviation (e.g., lint ignore tweaks) in your changes.
