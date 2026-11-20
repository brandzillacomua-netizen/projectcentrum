---
description: Architectural standards and anti-monolith modularity rules for Centrum MES
---

# Architecture & Modularity Standards (Centrum MES)

## 1. Reference Architecture (Feature-Sliced Modular Design)
Follow the modular pattern used in `src/modules/Foreman2/`:
- `src/modules/<Module>/features/<feature-name>/`:
  - `<feature>Calculations.js` (or `src/domain/` / `utils/`): **pure functions only** (no React hooks, no Supabase calls, no `window`/`localStorage`). Every non-trivial calculation must be unit-testable.
  - `use<Feature>.js`: state, orchestration, and side effects (API/RPC calls).
  - `<Feature>Modal.jsx` / `<Feature>Panel.jsx`: thin presentation component receiving props from the hook.
- Shared cross-module API/RPC/cache logic belongs in `src/services/` (e.g., `atomicCardTransitionService.ts`, `inventoryStockService.js`).

## 2. Anti-Monolith Rules
- **Hard Rule for New Code**: Never write a new component, hook, or service > **350–400 lines**. Split early into `features/`, `components/`, `hooks/`, and `utils/`.
- **Do Not Grow Existing Monoliths**: Never add new features or large blocks into existing 1000+ line files (e.g. `NomenclatureCardModal/index.jsx`, `Shop2Module.jsx`, `SpecBuilderTab.jsx`, `useShop1CardWorkflow.js`, `useBrakData.js`). Put new logic in a separate file under `features/` or `subhooks/` and wire it in with minimal lines.
- **No Unsolicited Mass Refactors**: Do NOT rewrite or split stable working monoliths unless the user explicitly asks for refactoring. When fixing a bug inside a monolith, extract only the pure logic you are touching into a testable helper function.

## 3. Code Quality & Contracts
- Prefer explicit, typed/normalized data structures over string-encoded tags. **Never** invent new `[KEY:value]` text markers inside `card_info` for new features — use proper database columns or JSONB fields.
- Keep `src/App.jsx` routes lazy-loaded (`React.lazy`) and avoid importing heavy libraries (`xlsx`, `html5-qrcode`, `emoji-picker-react`) into shared entry bundles.
- Fix TypeScript errors at the boundary (`npm run typecheck` must always pass with 0 errors).
