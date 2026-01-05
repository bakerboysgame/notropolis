# Tick Admin Page - Master Plan

## Feature Overview

**What:** A master-admin-only page at `/admin/tick` with two tabs:
1. **Tick History** — View historical tick data with drill-down to per-company statistics, charts for trends
2. **Tick Settings** — Configure all tick-related parameters (fire, tax, adjacency, hero, land costs) with change logging

**Why:**
- The 10-minute tick drives core game mechanics (profit distribution, fire spread, hero eligibility)
- Currently all settings are hardcoded constants scattered across multiple files
- No visibility into tick performance or ability to tune game balance without code changes
- Building variants affect competition/profit calculations and need visibility

## Success Criteria

| Criteria | Measurement |
|----------|-------------|
| History tab loads tick_history | Displays 907+ existing ticks with pagination |
| Drill-down works | Click tick row → shows company_statistics for that tick |
| Charts render | Execution time & profit trends using recharts |
| Settings form saves | All 25+ settings persist to tick_settings table |
| Settings are used | Tick processor reads from DB instead of hardcoded values |
| Change logging works | tick_settings_log captures who changed what and when |
| Admin-only access | Non-master_admin users see 403 |
| Page is responsive | Works on desktop (1024px+) |

## Dependencies & Prerequisites

| Dependency | Status | Notes |
|------------|--------|-------|
| tick_history table | ✅ Exists | 907 records, schema in migration 0016 |
| company_statistics table | ✅ Exists | 10 records, schema in migration 0047 |
| recharts library | ✅ Installed | ^2.8.0 in package.json |
| Master admin auth pattern | ✅ Exists | Used by ModerationAdminPage, AssetAdminPage |
| Tab UI pattern | ✅ Exists | Used by ModerationAdminPage |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Settings change breaks game balance | Medium | High | Add min/max validation, show current vs default |
| Tick processor fails if settings missing | Medium | Critical | Default to hardcoded values if DB fetch fails |
| Large tick_history causes slow loads | Low | Medium | Pagination, lazy loading, date range filters |
| Settings cached incorrectly | Low | Medium | Cache only per-tick, clear on new tick |

## Stage Index

| Stage | Name | Complexity | Dependencies | Deliverable |
|-------|------|------------|--------------|-------------|
| 01 | tick_settings Migration | Low | None | Database table for configurable settings |
| 02 | tick_settings_log Migration | Low | None | Database table for change audit log |
| 03 | Tick History API | Medium | Stage 1 | Backend endpoints for history + stats |
| 04 | Tick Settings API | Medium | Stage 1, 2 | Backend endpoints for settings CRUD |
| 05 | Tick Processor Update | Medium | Stage 1, 4 | Processor reads settings from DB |
| 06 | Frontend API + Types | Low | Stage 3, 4 | TypeScript types and API service |
| 07 | TickAdminPage Shell | Low | Stage 6 | Page component with tab navigation |
| 08 | Tick History Tab | Medium | Stage 7 | Table, drill-down, charts |
| 09 | Tick Settings Tab | Medium | Stage 7 | Settings form, validation, log viewer |
| 10 | Integration | Low | Stage 8, 9 | Routing, sidebar, final testing |

## Stage Dependency Graph

```
Stage 1 (tick_settings) ────┬──→ Stage 3 (History API) ──┬──→ Stage 6 (Types/API) ──→ Stage 7 (Shell)
                            │                             │                                   │
Stage 2 (settings_log) ─────┴──→ Stage 4 (Settings API) ──┘                                   │
                                        │                                                      │
                                        ↓                                                      ↓
                               Stage 5 (Processor) ←─────────────────── Stage 8 (History Tab) ←┤
                                                                                               │
                                                                        Stage 9 (Settings Tab)←┤
                                                                                               │
                                                                        Stage 10 (Integration)←┘
```

## Parallelization Opportunities

| Phase | Stages | Workers |
|-------|--------|---------|
| Phase A | 01 + 02 | 2 parallel |
| Phase B | 03 + 04 | 2 parallel (after Phase A) |
| Phase C | 05 + 06 | 2 parallel (after Phase B) |
| Phase D | 07 | 1 worker (after Phase C) |
| Phase E | 08 + 09 | 2 parallel (after Phase D) |
| Phase F | 10 | 1 worker (after Phase E) |

**Total: 10 stages across 6 phases, max 2 parallel workers**

## Out of Scope

This plan does NOT cover:
- ❌ Manual tick triggering (run tick on demand)
- ❌ Per-map settings overrides (only global settings)
- ❌ Tick scheduling changes (remains 10-minute cron)
- ❌ Historical settings snapshots (what settings were active for past ticks)
- ❌ Building variant management UI (add/remove variants from building types)
- ❌ Real-time tick progress/WebSocket updates
- ❌ Mobile-responsive layout (desktop admin only)
- ❌ Export tick history to CSV/JSON

## File Summary

### New Files (12)
```
migrations/
├── 0054_create_tick_settings.sql
└── 0055_create_tick_settings_log.sql

worker/src/routes/admin/
├── tick.js
└── tickSettings.js

src/
├── pages/admin/TickAdminPage.tsx
├── components/admin/
│   ├── TickHistoryTable.tsx
│   ├── TickHistoryCharts.tsx
│   ├── TickSettingsForm.tsx
│   ├── TickSettingsLog.tsx
│   └── CompanyStatsModal.tsx
├── services/tickAdminApi.ts
└── types/tick.ts
```

### Modified Files (6)
```
worker/index.js                          # Route registration
worker/src/tick/processor.js             # Read settings from DB
worker/src/tick/fireSpread.js            # Use settings object
worker/src/tick/profitCalculator.js      # Use settings object
worker/src/adjacencyCalculator.js        # Use settings object
src/App.tsx                              # Add route
src/components/Sidebar.tsx               # Add nav item
```

## Database Schema Summary

### tick_settings (new)
- 25+ configurable parameters
- Single row (id = 'global')
- Categories: fire, tax, profit, adjacency, hero, land

### tick_settings_log (new)
- Audit log for settings changes
- Tracks: who, when, what changed (old → new values)
- Foreign key to users table

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/tick/history` | Paginated tick history |
| GET | `/api/admin/tick/history/:id` | Single tick with company stats |
| GET | `/api/admin/tick/stats` | Aggregate statistics |
| GET | `/api/admin/tick/settings` | Current settings |
| PUT | `/api/admin/tick/settings` | Update settings |
| POST | `/api/admin/tick/settings/reset` | Reset to defaults |
| GET | `/api/admin/tick/settings/log` | Settings change log |

## Implementation Notes

- Use existing `ModerationAdminPage.tsx` as template for page structure
- Use existing tab pattern with purple accent color
- recharts already installed - use LineChart for trends, BarChart for comparisons
- Settings form should group by category with collapsible sections
- All settings need min/max validation to prevent game-breaking values
- Tick processor should fallback to defaults if DB read fails
