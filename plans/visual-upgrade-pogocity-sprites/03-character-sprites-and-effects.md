# Stage 3: Character Sprites & Visual Effects

## Objective

Add apple character sprite support and implement lamp glow effects for visual polish.

## Dependencies

**Requires**: Stage 2 complete (vertical slice rendering)

## Complexity

**Medium** — Two independent features: character sprite upgrade + glow effects

---

## Files to Modify

### 1. `src/components/game/phaser/systems/CharacterSystem.ts`
**Changes**:
- Expand GIF_URLS to include apple sprites
- Add characterType field to Character interface
- Change default spawn to 'apple'
- Update animation key to use character type

### 2. `src/components/game/phaser/systems/EffectsRenderer.ts`
**Changes**:
- Add glow texture generation
- Add glow sprite management
- Update updateEffects() to handle glows
- Update clear() to cleanup glows

---

## Files to Create

### 1. `public/Characters/apple_walk_*.gif` (4 files)

**Purpose**: Standardized naming for apple character

**Copy operations**:
```bash
cp public/Characters/applewalkeast.gif public/Characters/apple_walk_right.gif
cp public/Characters/applewalknorth.gif public/Characters/apple_walk_up.gif
cp public/Characters/applewalksouth.gif public/Characters/apple_walk_down.gif
cp public/Characters/applewalkwest.gif public/Characters/apple_walk_left.gif
```

---

## Implementation Details

### Part A: Apple Character Integration

**CharacterSystem.ts Changes**:

```typescript
// Expand GIF_URLS (line 33-38)
private readonly GIF_URLS: Record<string, string> = {
  banana_up: '/Characters/banana_walk_up.gif',
  banana_down: '/Characters/banana_walk_down.gif',
  banana_left: '/Characters/banana_walk_left.gif',
  banana_right: '/Characters/banana_walk_right.gif',
  apple_up: '/Characters/apple_walk_up.gif',
  apple_down: '/Characters/apple_walk_down.gif',
  apple_left: '/Characters/apple_walk_left.gif',
  apple_right: '/Characters/apple_walk_right.gif',
};

// Update Character interface (line 8-17)
interface Character {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;
  targetX: number;
  targetY: number;
  direction: Direction;
  speed: number;
  characterType: 'banana' | 'apple';  // ADD THIS
}

// Update spawnCharacter default (line 80)
spawnCharacter(characterType: 'banana' | 'apple' = 'apple'): boolean {
  // ...
  const character: Character = {
    // ... existing fields ...
    characterType,  // ADD THIS
  };
}

// Update animation key (line 172)
const animKey = `${char.characterType}_${char.direction}`;
playGifAnimation(char.sprite, animKey);
```

### Part B: Lamp Glow Effects

**EffectsRenderer.ts Changes**:

```typescript
// Add to class members
private glowSprites: Map<string, Phaser.GameObjects.Image> = new Map();
private glowTextureCreated = false;

// Glow configuration
private readonly BUILDING_GLOW_CONFIG: Record<string, {
  offsetY: number;
  scale?: number;
  color?: number;
}> = {
  restaurant: { offsetY: -25, color: 0xff9966 },  // martini_bar sprite - warm bar glow
  // Add more as needed (casino, bank for landmark lighting, etc.)
};

// Create glow texture (call once)
private createGlowTexture(): void {
  if (this.glowTextureCreated) return;

  const graphics = this.scene.add.graphics();
  const size = 96;
  const center = size / 2;

  // Concentric circles with alpha falloff
  const rings = [
    { radius: 40, alpha: 0.15 },
    { radius: 32, alpha: 0.10 },
    { radius: 24, alpha: 0.06 },
    { radius: 16, alpha: 0.03 },
    { radius: 8, alpha: 0.015 },
  ];

  for (const ring of rings) {
    graphics.fillStyle(0xffcc66, ring.alpha);
    graphics.fillCircle(center, center, ring.radius);
  }

  graphics.generateTexture('lamp_glow', size, size);
  graphics.destroy();
  this.glowTextureCreated = true;
}

// Add glow effect
private addGlowEffect(
  buildingId: string,
  buildingTypeId: string,
  screenX: number,
  screenY: number,
  depth: number
): void {
  const config = this.BUILDING_GLOW_CONFIG[buildingTypeId];
  if (!config) return;

  this.createGlowTexture();

  const glow = this.scene.add.image(screenX, screenY + config.offsetY, 'lamp_glow');
  glow.setBlendMode(Phaser.BlendModes.ADD);
  glow.setScale(config.scale || 1.0);
  glow.setDepth(depth - 1); // Behind building

  // Pulsing animation
  this.scene.tweens.add({
    targets: glow,
    alpha: { from: 0.7, to: 1.0 },
    duration: 2000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  this.glowSprites.set(buildingId, glow);
}

// Update updateEffects() method
updateEffects(buildings: BuildingInstance[], tileMap: Map<...>): void {
  const activeGlowIds = new Set<string>();

  for (const building of buildings) {
    // ... existing fire/for-sale logic ...

    // Glow logic
    if (!building.is_collapsed && !building.is_on_fire) {
      if (this.BUILDING_GLOW_CONFIG[building.building_type_id]) {
        activeGlowIds.add(building.id);
        if (!this.glowSprites.has(building.id)) {
          const tilePos = tileMap.get(building.tile_id);
          if (tilePos) {
            const { x, y } = gridToScreen(tilePos.x, tilePos.y);
            const depth = (tilePos.x + tilePos.y) * DEPTH_Y_MULT + BUILDING_DEPTH_OFFSET;
            this.addGlowEffect(building.id, building.building_type_id, x, y, depth);
          }
        }
      }
    }
  }

  // Cleanup
  this.cleanupMap(this.glowSprites, activeGlowIds);
}

// Update clear() method
clear(): void {
  // ... existing cleanup ...

  for (const sprite of this.glowSprites.values()) {
    sprite.destroy();
  }
  this.glowSprites.clear();
}
```

---

## Database Changes

**None** — Visual features only

---

## Test Cases

### Test 1: Apple Character Spawn
```
Action: Click "Character" button in UI
Expected:
- Apple character spawns (not banana)
- All 4 directions animate correctly
- Depth sorting with buildings correct
```

### Test 2: Mixed Characters
```
Action:
1. Spawn 5 apple characters
2. Use console: window.__phaserScene.spawnCharacter('banana')
3. Spawn 5 more apple characters

Expected:
- Both character types visible
- Both animate independently
- No texture loading errors
```

### Test 3: Lamp Glow on Restaurant
```
Setup: Place restaurant building
Expected:
- Warm orange glow appears below building
- Glow pulses smoothly (0.7 → 1.0 alpha)
- Glow renders behind building (depth layer 0.04)
- ADD blend mode creates light effect
```

### Test 4: Glow Disabled on Fire
```
Action:
1. Place restaurant (glow appears)
2. Set building on fire

Expected:
- Glow disappears when building catches fire
- Glow reappears if fire extinguished
```

### Test 5: Glow Performance
```
Setup: Place 20 restaurants
Expected:
- 20 glow effects active
- Smooth pulsing animation on all
- 60 FPS maintained
- No stuttering or lag
```

---

## Acceptance Checklist

- [ ] Apple character GIF files created with standardized names
- [ ] CharacterSystem loads both banana and apple sprites
- [ ] Default spawn changed to apple
- [ ] Both character types work correctly
- [ ] Animation keys use character type prefix
- [ ] Glow texture generated procedurally
- [ ] Glow effects render behind buildings
- [ ] Pulsing animation smooth and subtle
- [ ] Glows disable for collapsed/burning buildings
- [ ] No performance impact with 20+ glows
- [ ] No visual artifacts
- [ ] Build succeeds with no errors

---

## Deployment

```bash
# Build
cd /Users/riki/notropolis/authentication-dashboard-system
npm run build

# Deploy
CLOUDFLARE_API_TOKEN="RQeVAceZ3VT-McbFF9DnYem0ZDc8YXbnHPH8wbg_" \
CLOUDFLARE_ACCOUNT_ID="329dc0e016dd5cd512d6566d64d8aa0c" \
npx wrangler pages deploy dist --project-name=notropolis-dashboard
```

**Verification**:
1. Visit https://boss.notropolis.net
2. Zoomed view → Click "Character" button
3. Verify apple character spawns (check sprite appearance)
4. Place restaurant building
5. Verify warm glow effect appears and pulses
6. Spawn 10+ characters, place 10+ restaurants
7. Check FPS remains 60
8. Test damage/fire - glows should disappear

---

## Handoff Notes

**Project Complete**:
- All 3 stages implemented
- Visual upgrade complete
- No further stages planned for this feature
- Future enhancements (rotation, props) can use this foundation

**Known Limitations**:
- Buildings remain 1x1 placement (multi-tile deferred)
- South-facing only (rotation deferred)
- Only restaurant has glow (easy to add more in BUILDING_GLOW_CONFIG)

**Extension Points**:
- Add more buildings to BUILDING_GLOW_CONFIG
- Add more character types (copy apple pattern)
- Adjust glow colors/sizes in config object
