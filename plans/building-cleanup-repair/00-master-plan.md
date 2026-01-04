# Building Cleanup & Repair System

## Feature Overview

Allow building owners to recover from dirty trick attacks by:
1. **Cleaning up tricks** - Remove visual effects (graffiti, smoke, stink) and stop ongoing effects
2. **Putting out fires** - Any player can extinguish fires on any building (community action)
3. **Repairing damage** - Owner restores building to 100% health for a cost based on building value

Currently, buildings can only accumulate damage with no way to recover. This creates a death spiral where attacked buildings become worthless with no recourse.

## Success Criteria

- [ ] Building owner can clean up trick effects for a cost
- [ ] Any player can put out fires on any building (free action)
- [ ] Building owner can repair damage (restores to 0% damage) for % of building value
- [ ] All actions logged to `game_transactions` table
- [ ] Adjacent buildings marked dirty for profit recalculation
- [ ] Prison check prevents cleanup/repair while incarcerated
- [ ] Events feed shows cleanup/repair/extinguish actions

## Dependencies & Prerequisites

- Existing `building_instances` table with `damage_percent`, `is_on_fire`, `is_collapsed` columns
- Existing `attacks` table tracking trick history
- Existing `game_transactions` table for event logging
- Existing `markAffectedBuildingsDirty()` utility for adjacency recalc

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Players spam extinguish on burning buildings | Low | Free action, no abuse vector |
| Repair cost too cheap/expensive | Medium | Use % of building value (configurable) |
| Race condition on concurrent cleanup | Low | Single DB batch transaction |
| Missing attack effects to clean | Medium | Add `is_cleaned` flag to attacks table |

## Stage Index

1. **Stage 1: Database & Attack Cleanup** - Add `is_cleaned` column to attacks, implement cleanup endpoint
2. **Stage 2: Fire Extinguish & Repair** - Add put-out-fire (any user) and repair (owner) endpoints

## Out of Scope

- Automated fire brigade (future feature)
- Partial repairs (must repair to 100%)
- Insurance system
- Cleanup costs varying by trick type
- Frontend UI changes (API only)
