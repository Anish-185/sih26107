# MetrIQ — Frontend

React + TypeScript + Vite + Tailwind CSS v4. The UI for the MetrIQ
(AI-Assisted Legal Metrology Inspection) system.

## Run

```bash
# 1. start the backend (from ../backend)
../backend/.venv/bin/uvicorn app.main:app --port 8000

# 2. start the frontend
npm install
npm run dev            # http://localhost:5173
```

The dev server proxies `/api/*` → `http://127.0.0.1:8000/*` (see `vite.config.ts`,
override with `VITE_BACKEND_ORIGIN`). For a production build set `VITE_API_BASE`
to the backend origin.

```bash
npm run build          # tsc -b && vite build  → dist/
npm run typecheck      # tsc -b --noEmit
npm run preview        # serve dist/ on :4173
```

## What talks to the backend

| Screen | Endpoint | Live? |
|---|---|---|
| Inspection · OCR + declarations + product + standard | `POST /inspection/analyze` | ✅ real (Phase 14) |
| Standards | `POST /product-standard` | ✅ real |
| Certification | `POST /certification-guidance` | ✅ real (local LLM) |
| Laboratories | `POST /laboratory-search` | ✅ real (`explain=false` by default) |
| Hallmarking / HUID | `POST /ask` | ✅ real (local LLM) |
| Header status dot | `GET /health` | ✅ real |
| Inspection · legal-metrology PASS/FAIL | — | ⏳ next phase (shown as `NEXT`) |
| History / Review | — | ⚠️ mock (`src/mocks.tsx`) |

The legal-metrology rule engine and the officer report are not built yet, so
History / Review run on clearly-labelled placeholder data (`MockDataBanner`). No
fabricated compliance outcomes are presented as real.

## Structure

```
src/
  main.tsx              routes
  index.css             design tokens (@theme) + base layer
  lib/
    api.ts              typed backend client (contracts mirror backend/app/api.py)
    hooks.ts            useAsyncTask / useOnMount
    format.ts, cn.ts    helpers
  components/
    ui.tsx              design-system primitives (Button, Panel, StatusBadge, …)
    layout.tsx          AppLayout, TopNav, HealthStatus, SystemLayerFooter
    Dropzone.tsx        structured upload region
    GroundedAnswer.tsx  shared answer/evidence/sources renderer
  features/
    DashboardView, StandardsView, CertificationView, LaboratoriesView,
    HallmarkingView, HistoryView, ReviewView, NotFoundView
    inspection/InspectionView, inspection/ImageInspector
  mocks.tsx             isolated placeholder data + MockDataBanner
```
