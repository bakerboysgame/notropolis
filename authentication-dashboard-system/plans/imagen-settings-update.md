# Imagen Settings Update Plan

## Goal
- All image generations should default to **4K** resolution
- Sprites (1:1 aspect ratio)
- Reference sheets (3:2 aspect ratio for 6-panel layout)

## Files to Update

### `/worker/src/routes/admin/assets.js`

---

### 1. `validateGenerationSettings()` function (line 2434)

**Current:** Returns `null` for aspectRatio and imageSize if not specified
**Change:** Add `category` parameter, set smart defaults:
- `imageSize`: Always `'4K'` by default
- `aspectRatio`:
  - `'1:1'` for sprites (`building_sprite`, `npc`, `effect`, `terrain`, `overlay`, `avatar`)
  - `'3:2'` for reference sheets (`*_ref` categories)
  - `'1:1'` for everything else

---

### 2. Main generate endpoint (line 3023)

**Current:** `validateGenerationSettings(generation_settings)`
**Change:** Pass category: `validateGenerationSettings(generation_settings, category)`

---

### 3. Regenerate endpoint (line 3885)

**Current:** `validateGenerationSettings({...})`
**Change:** Pass category from `original.category`

---

### 4. Queue processor - auto sprite generation (line 2798)

**Current:** `generateWithGemini(env, item.base_prompt, referenceImage ? [referenceImage] : null)`
**Change:** Pass settings with category-appropriate defaults

---

### 5. Auto-sprite generation endpoint (line 4243)

**Current:** `generateWithGemini(env, sprite_prompt)`
**Change:** Pass settings with `aspectRatio: '1:1'`, `imageSize: '4K'`

---

## Category to Settings Mapping

| Category | aspectRatio | imageSize |
|----------|-------------|-----------|
| `building_ref` | 3:2 | 4K |
| `character_ref` | 3:2 | 4K |
| `vehicle_ref` | 3:2 | 4K |
| `effect_ref` | 3:2 | 4K |
| `terrain_ref` | 3:2 | 4K |
| `building_sprite` | 1:1 | 4K |
| `npc` | 1:1 | 4K |
| `effect` | 1:1 | 4K |
| `terrain` | 1:1 | 4K |
| `overlay` | 1:1 | 4K |
| `avatar` | 1:1 | 4K |
| `scene` | 16:9 | 4K |
| `ui` | 1:1 | 4K |

---

## Implementation Order

1. [ ] Update `validateGenerationSettings()` to accept category and set defaults
2. [ ] Update main generate endpoint (line 3023)
3. [ ] Update regenerate endpoint (line 3885)
4. [ ] Update queue processor (line 2798)
5. [ ] Update auto-sprite endpoint (line 4243)
6. [ ] Deploy and test
