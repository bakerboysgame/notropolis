# Stage 4: Characters & Vehicles - Testing Guide

This document provides instructions for testing the character and vehicle systems implemented in Stage 4.

## Overview

Stage 4 implementation includes:
- **GifLoader.ts**: Ported from pogicity, loads animated GIFs as Phaser sprite sheets
- **CharacterSystem.ts**: Manages walking NPCs with 4-direction animations
- **VehicleSystem.ts**: Manages cars that follow road tiles
- **MainScene.ts**: Integrated both systems into the game loop
- **UI Controls**: Buttons in bottom-left corner for spawning characters/vehicles

## Deployment Status

✅ **Deployed to production:**
- Worker API: https://api.notropolis.net
- Frontend: https://boss.notropolis.net

## How to Test

1. Navigate to https://boss.notropolis.net
2. Go to a game map (e.g., /map/{your-map-id})
3. Click any tile to enter zoomed (isometric) view
4. Look for the **"NPCs & Vehicles"** control panel in the bottom-left corner
5. Movement speeds have been reduced for more realistic pacing

## Testing via UI Controls (Recommended)

The easiest way to test is using the built-in UI controls:

### UI Control Panel

In zoomed (isometric) view, you'll see a control panel in the bottom-left corner:

**"NPCs & Vehicles" Panel:**
- 🚶 **Character** button - Spawns a walking character
- 🚗 **Vehicle** button - Spawns a car on a road
- **Clear All** button - Removes all characters and vehicles
- **Counter display** - Shows current counts: "Characters: X  Vehicles: Y"

### Test Steps with UI:

1. **Test Character Spawning:**
   - Click the "🚶 Character" button 5 times
   - Watch characters appear and start walking around
   - Observe the counter update: "Characters: 5"

2. **Test Vehicle Spawning:**
   - Click the "🚗 Vehicle" button 3 times
   - Watch cars appear on roads
   - Observe the counter update: "Vehicles: 3"

3. **Test Clear All:**
   - Click the "Clear All" button
   - All characters and vehicles should disappear
   - Counters should reset to 0

---

## Testing via Browser Console (Advanced)

For advanced testing, you can also use the browser console:

### Access the Phaser Game Instance

The MainScene is automatically exposed to `window.__phaserScene` when you load a map in zoomed view.

Open the browser console (F12) and verify access:

```javascript
// The console will automatically show these messages when the scene loads:
// MainScene exposed as window.__phaserScene
// Test commands:
//   window.__phaserScene.spawnCharacter() - Spawn a walking character
//   window.__phaserScene.spawnCar() - Spawn a car on a road
//   window.__phaserScene.getCharacterCount() - Count characters
//   window.__phaserScene.getCarCount() - Count vehicles

// Verify scene is ready:
if (window.__phaserScene) {
  console.log('✓ MainScene ready for testing');
} else {
  console.log('✗ Scene not found - ensure you are on the map in zoomed view');
}
```

### Test 1: Character GIF Loading

Check if character GIF assets are loaded:

```javascript
const scene = window.__phaserScene;
const textures = ['banana_up', 'banana_down', 'banana_left', 'banana_right'];
textures.forEach(key => {
  const exists = scene.textures.exists(key);
  console.log(`${exists ? '✓' : '✗'} ${key}: ${exists ? 'loaded' : 'not found'}`);
});
```

Expected output:
```
✓ banana_up: loaded
✓ banana_down: loaded
✓ banana_left: loaded
✓ banana_right: loaded
```

### Test 2: Spawn Characters

Spawn characters on the map:

```javascript
// Spawn 5 characters
for (let i = 0; i < 5; i++) {
  const success = window.__phaserScene.spawnCharacter();
  console.log(`Character ${i + 1}: ${success ? 'spawned' : 'failed'}`);
}

// Check total count
console.log(`Total characters: ${window.__phaserScene.getCharacterCount()}`);
```

Expected behavior:
- Characters appear on the map as banana sprites
- Characters start walking around randomly
- Animations change based on movement direction (up/down/left/right)

### Test 3: Character Movement

Wait 10-15 seconds and observe:
- Characters should move smoothly between grid positions
- Animations should update to match direction (walking up, down, left, right)
- Characters should stay within map bounds

### Test 4: Spawn Vehicles

Spawn cars on road tiles:

```javascript
// Spawn 3 vehicles
for (let i = 0; i < 3; i++) {
  const success = window.__phaserScene.spawnCar();
  console.log(`Vehicle ${i + 1}: ${success ? 'spawned' : 'failed'}`);
}

// Check total count
console.log(`Total vehicles: ${window.__phaserScene.getCarCount()}`);
```

Expected behavior:
- Vehicles appear only on road tiles
- Vehicle sprites face the correct direction

If vehicles fail to spawn:
- Check if your map has road tiles: `window.__phaserScene.vehicleSystem?.roadArray?.length`
- If no roads, vehicles cannot spawn

### Test 5: Vehicle Road-Following

Observe vehicle movement:
- Vehicles should drive along road tiles
- When reaching a dead end or intersection, vehicles should turn
- Vehicles should not drive onto non-road tiles
- Sprite orientation should update when turning

### Test 6: Clear Entities

Remove all characters and vehicles:

```javascript
window.__phaserScene.clearCharacters();
console.log(`Characters remaining: ${window.__phaserScene.getCharacterCount()}`);

window.__phaserScene.clearCars();
console.log(`Vehicles remaining: ${window.__phaserScene.getCarCount()}`);
```

Expected output:
```
Characters remaining: 0
Vehicles remaining: 0
```

All sprites should disappear from the map.

### Test 7: Performance Test

Spawn many entities and check performance:

```javascript
// Spawn 20 characters
for (let i = 0; i < 20; i++) {
  window.__phaserScene.spawnCharacter();
}

// Spawn 10 vehicles
for (let i = 0; i < 10; i++) {
  window.__phaserScene.spawnCar();
}

console.log(`Characters: ${window.__phaserScene.getCharacterCount()}`);
console.log(`Vehicles: ${window.__phaserScene.getCarCount()}`);
console.log('Observe FPS and smoothness');
```

Expected:
- Game should run smoothly with 30+ entities
- No visible lag or stuttering
- Animations should remain smooth

## Adding Temporary UI Controls (Optional)

If you want to add temporary spawn buttons to the UI, modify GameMap.tsx:

```typescript
// Add ref to PhaserGame component
import { useRef } from 'react';
import { PhaserGameHandle } from '../components/game/phaser/PhaserGame';

// Inside GameMap component:
const gameRef = useRef<PhaserGameHandle>(null);

// Pass ref to PhaserGame:
<PhaserGame
  ref={gameRef}
  // ... other props
/>

// Add debug controls (temporary):
<div className="absolute bottom-4 left-4 z-10 flex gap-2">
  <button
    onClick={() => gameRef.current?.spawnCharacter()}
    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
  >
    Spawn Character
  </button>
  <button
    onClick={() => gameRef.current?.spawnCar()}
    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
  >
    Spawn Car
  </button>
  <button
    onClick={() => {
      gameRef.current?.clearCharacters();
      gameRef.current?.clearCars();
    }}
    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
  >
    Clear All
  </button>
</div>
```

## Verification Checklist

- [x] GifLoader.ts successfully ported from pogicity
- [x] Character GIFs copied to `/public/Characters/`
- [x] gifuct-js dependency installed
- [x] CharacterSystem.ts created with 4-direction walking
- [x] VehicleSystem.ts created with road-following logic
- [x] MainScene.ts integrated both systems
- [x] Build passes with no TypeScript errors
- [ ] Characters spawn and walk with animated GIFs
- [ ] Vehicles spawn only on roads
- [ ] Vehicles follow road tiles
- [ ] All 6 exposed methods work correctly
- [ ] Performance acceptable with 20+ entities

## Known Issues & Future Enhancements

### Current Limitations:
- Characters use placeholder banana sprites from pogicity
- Vehicles use basic taxi/jeep sprites
- Vehicle pathfinding is simple (random turn on dead end)
- No collision detection between entities

### Future Enhancements:
- Replace placeholder sprites with custom characters
- Add character variety (different types, speeds)
- Implement lane-based vehicle movement
- Add vehicle traffic lights at intersections
- Add character interactions (stop and chat, etc.)
- Implement object pooling for 100+ entities
- Add sound effects for vehicles

## Troubleshooting

### Characters not spawning
- Check console for "GIFs not yet loaded" warning
- Verify GIF files exist in `/public/Characters/`
- Check browser network tab for 404 errors on GIF files
- Verify system is ready: `window.__phaserScene.characterSystem?.isReady()`

### Vehicles not spawning
- Verify map has road tiles: `window.__phaserScene.vehicleSystem?.roadArray?.length`
- Check console for "No road tiles available" warning
- Check if vehicle textures are loaded: `window.__phaserScene.vehicleSystem?.isReady()`

### Animations not playing
- Check if textures are loaded: `window.__phaserScene.textures.exists('banana_up')`
- Verify GifLoader created animations: `window.__phaserScene.anims.exists('banana_up_anim')`
- Check character system: `window.__phaserScene.characterSystem?.isReady()`

### Performance issues
- Reduce entity count
- Check browser console for errors
- Verify FPS in Phaser debug mode
- Test with fewer entities first (5 characters, 2 vehicles)

## Files Modified/Created

**Created:**
- `src/components/game/phaser/GifLoader.ts` - GIF animation loader (ported)
- `src/components/game/phaser/systems/CharacterSystem.ts` - NPC character system
- `src/components/game/phaser/systems/VehicleSystem.ts` - Vehicle road-following system

**Modified:**
- `src/components/game/phaser/MainScene.ts` - Integrated systems (already done)
- `src/components/game/phaser/PhaserGame.tsx` - Exposed methods via ref (already done)

**Assets:**
- `/public/Characters/banana_walk_up.gif`
- `/public/Characters/banana_walk_down.gif`
- `/public/Characters/banana_walk_left.gif`
- `/public/Characters/banana_walk_right.gif`
- `/public/cars/taxi*.png` (already existed)
- `/public/cars/jeep*.png` (already existed)
