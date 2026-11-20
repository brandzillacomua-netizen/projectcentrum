---
description: Usability, TV dashboards, mobile PWA, and UI consistency rules for Centrum MES
---

# Usability, Devices & UI Standards

## 1. Respect User Intent & Domain Reality
- Follow the exact operational workflow and metrics requested by the user (e.g., if sheets are issued inside cutter boxes, count them accurately; if per-material breakdown is requested, display each material separately rather than hiding behind a single sum).
- Keep UI labels, statuses, and error messages in clear, natural **Ukrainian**.

## 2. Multi-Device Compatibility (TV, Tablets, iPhone PWA)
- **TV Dashboards** (`/preparation-dashboard`, `/tumbling-dashboard`, `/dashboard`):
  - Must fit a 16:9 TV viewport (`Box R Lite 4K` / Android TV) without clipping bottom cards or overflowing horizontally. Use responsive `transform: scale(...)` auto-scaling with manual scale override when appropriate.
- **Shop-Floor Tablets & Scanners**:
  - Large, touch-friendly controls (`touchAction: 'manipulation'`), fast scanner feedback, and clear visual distinction between `БУФЕР`, `РОБОТА`, `ПАУЗА`, and `ПОТРІБНА ЧИСТКА`.
- **Auto-Update Resilience (`version.json` + `ServiceWorkerUpdateManager`)**:
  - Never break `/version.json` cache-bypass headers (`vercel.json`, `public/sw.js`) or interrupt an operator mid-input (`INPUT` / `TEXTAREA` / `SELECT`) during auto-reload.

## 3. Theme Support (Light & Dark)
- Every new or updated UI component/card/header must have verified readable contrast in **both** `.light-theme` / `[data-theme="light"]` and dark mode. Never leave white text on a light background or dark text on a dark background.
