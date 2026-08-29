# SIMPUL — Critical Fix QA

## Implemented

1. **Live vessel position** is now calculated from the unified shipment clock and curved maritime route geometry. The map consumes shipment progress continuously, so in-transit vessels move as time advances.
2. **BESS shared state** follows the active shipment. Its location coordinates are derived from the same vessel position; after an operational shipment, the BESS resolves to the destination port/microgrid.
3. **Simulation chain** now executes Digital Twin scenario mutation → risk calculation → BESS candidate ranking → discrete sailing/ETA feasibility → adaptive response/KPI generation, and records the run plus audit event.
4. **Arrival guard** prevents a technician from confirming arrival before the shipment ETA unless the FSM is changed deliberately in code; the UI exposes `Menunggu ETA` until eligible.
5. **Shipment FSM** no longer permits arbitrary `IN_TRANSIT → ARRIVED` transport updates. Arrival is owned by the technician/admin arrival action after the time guard.

## Static critical regression

`node scripts/critical-regression.mjs` passes all critical implementation checks.

## Environment note

The supplied environment contains an incomplete/empty `node_modules` tree. `npm ci` / `npm install` could not complete in this environment because package retrieval timed out, so a genuine `next build`, ESLint run, and browser-driven regression could not be executed here. The ZIP intentionally excludes `node_modules`; on a normal networked machine run:

```bash
npm install
npm run lint
npm run build
npm run dev
```

The project source and lockfile are preserved so dependency installation is reproducible.


## Finalization additions

- Composite Priority is now explicitly used by BESS recommendation scoring, combining EBT hosting-capacity suitability and emergency risk.
- Simulation KPI output now includes curtailment, unit readiness, and supply readiness time, aligned to the five KPI concepts in the video narrative.
- Scenario timeline presentation follows the narrative milestones H-21 → H-14 → H-10 → H-0.
- Allocation UI formula text was updated to reflect the active composite-priority logic.

## Environment limitation

A dependency install was attempted in the supplied environment but timed out, so `next build`, ESLint, and TypeScript compiler execution could not be completed locally. The existing source-level regression and validation scripts both pass.
