# Notropolis Game - Master Plan

## Feature Overview

Notropolis is a competitive multiplayer property tycoon game where players run anonymous companies, buy land, build properties, earn profit, sabotage rivals, and progress through real-world locations (Towns → Cities → Capitals). The end-game goal is to accumulate the most wealth in your offshore account by "heroing" out of locations.

**Core Loop:** Buy land → Build properties → Earn profit (affected by adjacency) → Use dirty tricks on rivals → Meet hero requirements → Cash out to offshore → Progress to higher-tier locations → Repeat at higher stakes.

**Key Differentiators:**
- Anonymous companies (3 per user, no way to link them)
- Real-world location maps (countries, towns, cities, capitals)
- Adjacency-based profit modifiers (terrain + buildings affect income)
- PvP dirty tricks with police/security risk
- Tick-based economy (10 min intervals, 6-tick offline cap)

## Success Criteria

| Criteria | Metric |
|----------|--------|
| Core loop functional | Player can: create company → buy land → build → earn profit → attack rivals → hero out |
| Map system working | Admin can create 100x100 maps, players can view and interact |
| PvP operational | Dirty tricks, police catches, security defense, fire spread all working |
| Progression complete | Levels unlock content, hero requirements gate location progression |
| Multi-company support | Users can manage 3 companies across different locations |
| Economy balanced | Tick system, taxes, adjacency bonuses produce playable economy |
| Real-time competitive | Multiple players can compete in same location simultaneously |

## Dependencies & Prerequisites

| Dependency | Status | Notes |
|------------|--------|-------|
| Authentication system | ✅ Complete | Existing auth in `authentication-dashboard-system` |
| Cloudflare Workers | ✅ Available | Already deployed for auth |
| D1 Database | ✅ Available | Game tables added to existing `notropolis-database` |
| R2 Storage | ✅ Available | For building sprites, event images, avatars |
| Frontend (React) | ✅ Complete | Dashboard exists, will extend |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tick system performance at scale | Medium | High | Batch processing, queue system, optimize queries - See [D1 Optimization Reference](REFERENCE-d1-optimization.md) |
| Economy balance issues | High | Medium | Start with simple modifiers, tune with real data |
| Cheating/exploitation | Medium | High | Server-side validation, rate limiting, action logging |
| Complex adjacency calculations | Medium | Medium | Pre-calculate on build, cache results, recalc on neighbor change |
| Police strike sync across timezones | Low | Low | Store strike day per map, calculate server-side |

## Technical References

| Document | Purpose |
|----------|---------|
| [D1 Optimization Reference](REFERENCE-d1-optimization.md) | Critical D1 performance patterns - **100 param limit**, batch() usage, benchmarks |

## Stage Index

| Stage | Name | Description |
|-------|------|-------------|
| 01 | ✅ [Game Database Foundation](01-game-database.md) | Game tables added to existing D1 database |
| 02 | ✅ [Admin Map Builder](02-admin-map-builder.md) | Tool to create/edit maps up to 100x100 |
| 03 | ✅ [Company Management](03-company-management.md) | Create and manage up to 3 anonymous companies |
| 04 | ✅ [Map Viewer](04-map-viewer.md) | View maps with ownership and terrain |
| 05 | [Land & Building Core](05-land-building-core.md) | Buy land, build properties, adjacency calculations |
| 06 | [Tick System](06-tick-system.md) | Worker cron for profit calculation every 10 min |
| 07 | [Property Market](07-property-market.md) | Sell to state, list for sale, buy from others |
| 08 | [Dirty Tricks](08-dirty-tricks.md) | Attack system with police catch mechanics |
| 09 | [Security & Fire](09-security-fire.md) | Defense systems and fire spread |
| 10 | [Prison System](10-prison-system.md) | Arrest, fines, action blocking |
| 11 | [Level Progression](11-level-progression.md) | Level thresholds and content unlocks |
| 12 | [Hero System](12-hero-system.md) | Cash out to offshore, location progression |
| 13 | [Bank Transfers](13-bank-transfers.md) | Transfer cash between your companies |
| 14 | [Social Features](14-social-features.md) | Message boards, temple, casino |
| 15 | [Avatar System](15-avatar-system.md) | Character customization |
| 16 | [Visual Polish](16-visual-polish.md) | Zoomed view, sprites, event scenes |
| 17 | [Achievements](17-achievements.md) | Trophies, badges, leaderboards |

## Out of Scope

This plan does NOT cover:
- Mobile native app (Expo) - separate plan after web game complete
- Real-money transactions / premium currency
- Clan/guild system beyond company ownership
- Real-time chat (only message boards)
- Tutorial/onboarding system (Phase 2)
- Sound/music
- Localization/i18n
- Additional company slot purchasing (mechanics TBD)

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Dashboard│ │Map View │ │Company  │ │Admin    │           │
│  │  Home   │ │(2 modes)│ │ Mgmt    │ │Map Build│           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Workers                         │
│  ┌─────────────────────────────┐  ┌─────────────┐           │
│  │  Notropolis API             │  │ Tick Worker │           │
│  │  (auth + game endpoints)    │  │ (cron)      │           │
│  └─────────────────────────────┘  └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              ┌───────────┐       ┌──────────┐
              │    D1     │       │    R2    │
              │ notropolis│       │  Images  │
              │ -database │       │          │
              └───────────┘       └──────────┘
```

## Game Data Model (High Level)

```
Users (existing)
  └── Companies (1-3 per user, anonymous)
        ├── Location assignment (1 per company)
        ├── Cash balance
        ├── Level & XP
        ├── Prison status
        └── Owned Tiles
              └── Buildings
                    ├── Type & level
                    ├── Damage %
                    ├── Security systems
                    └── For-sale status

Maps
  ├── Country/location metadata
  ├── Type (town/city/capital)
  ├── Hero requirements
  ├── Police strike day
  └── Tiles (up to 100x100)
        ├── Terrain type
        ├── Special building (if any)
        └── Owner (company or null)

Transactions (audit log)
  └── All actions with timestamps
```

## Building Types (Initial Set)

| Building | Cost | Base Profit | Level Required | License Required |
|----------|------|-------------|----------------|------------------|
| Market Stall | 1k | ~100 | 1 | No |
| Hot Dog Stand | 1.5k | ~150 | 1 | No |
| Campsite | 3k | ~300 | 1 | No |
| Shop | 4k | ~400 | 1 | No |
| Burger Bar | 8k | ~800 | 2 | No |
| Motel | 12k | ~1,200 | 2 | No |
| High Street Store | 20k | ~2,000 | 3 | No |
| Restaurant | 40k | ~4,000 | 3 | Yes |
| Manor | 60k | ~6,000 | 4 | Yes |
| Casino | 80k | ~8,000 | 5 | Yes |

*Profits vary ±50-100% based on adjacency modifiers*

## Dirty Tricks (Initial Set)

| Trick | Cost | Damage | Police Catch Rate | Level Required |
|-------|------|--------|-------------------|----------------|
| Graffiti | 500 | 5% | 10% | 1 |
| Smoke Bomb | 1k | 10% | 15% | 1 |
| Stink Bomb | 2k | 15% | 20% | 2 |
| Cluster Bomb | 5k | 25% | 30% | 3 |
| Fire Bomb | 10k | 40% + spread | 40% | 4 |
| Destruction Bomb | 25k | 60% | 50% | 5 |

*At 100% damage, building collapses and must be demolished*

## Adjacency Modifiers (Initial Set)

| Terrain/Building | Effect | Range |
|------------------|--------|-------|
| Road | +10% to commercial | 1 tile |
| Water/Lake | +20% to campsite/motel | 2 tiles |
| Water/Lake | -10% to commercial | 1 tile |
| Trees | +5% to all | 1 tile |
| Dirt Track | -5% to all | 1 tile |
| Other commercial | +5% synergy | 1 tile |
| Damaged building | -10% | 1 tile |

## Level Progression

| Level | Cash Required | Actions Required |
|-------|---------------|------------------|
| 1 | 0 | 0 |
| 2 | 50k | 50 |
| 3 | 1M | 300 |
| 4 | 5M | 1,000 |
| 5 | 25M | 5,000 |

## Hero Requirements

| Location | Net Worth | OR Cash | OR Land (6 ticks) |
|----------|-----------|---------|-------------------|
| Town | 5.5M | 4M | 6% |
| City | TBD (~50M) | TBD | TBD |
| Capital | TBD | TBD | TBD |

## Bank Transfer Limits

| Receiving Location | Per Transfer | Daily Limit |
|--------------------|--------------|-------------|
| Town | 50k | 3 transfers |
| City | 500k | 3 transfers |
| Capital | 1M | 3 transfers |
