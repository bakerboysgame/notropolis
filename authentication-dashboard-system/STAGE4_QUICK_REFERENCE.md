# Stage 4: Quick Reference Card

## 🚀 Deployment

```bash
npm run build
# Deploy dist/ folder to production
```

## 🧪 Testing Commands (Browser Console)

### Verify Scene Loaded
```javascript
window.__phaserScene  // Should show MainScene object
```

### Spawn Entities
```javascript
// Spawn 1 character
window.__phaserScene.spawnCharacter()

// Spawn 1 vehicle
window.__phaserScene.spawnCar()

// Spawn multiple
for (let i = 0; i < 5; i++) window.__phaserScene.spawnCharacter()
for (let i = 0; i < 3; i++) window.__phaserScene.spawnCar()
```

### Check Counts
```javascript
window.__phaserScene.getCharacterCount()
window.__phaserScene.getCarCount()
```

### Clear All
```javascript
window.__phaserScene.clearCharacters()
window.__phaserScene.clearCars()
```

### Verify Assets Loaded
```javascript
// Check GIFs
['banana_up', 'banana_down', 'banana_left', 'banana_right'].forEach(k =>
  console.log(k, window.__phaserScene.textures.exists(k))
)

// Check character system ready
window.__phaserScene.characterSystem?.isReady()

// Check vehicle system ready
window.__phaserScene.vehicleSystem?.isReady()

// Check road count
window.__phaserScene.vehicleSystem?.roadArray?.length
```

## ✅ Expected Behavior

- **Characters:** Walk around with 4-direction GIF animations (banana sprites)
- **Vehicles:** Drive on roads, turn at intersections (taxi/jeep sprites)
- **Performance:** Smooth 60 FPS with 20+ entities
- **Depth:** Proper layering (characters/vehicles render correctly with buildings)

## 🔧 Troubleshooting

### Characters not spawning
```javascript
// Check if GIFs loaded
window.__phaserScene.characterSystem?.isReady()  // Should be true

// Check console for warnings
// Look for: "CharacterSystem: GIFs not yet loaded"
```

### Vehicles not spawning
```javascript
// Check if map has roads
window.__phaserScene.vehicleSystem?.roadArray?.length  // Should be > 0

// If 0, navigate to a map with roads
```

### Animations not playing
```javascript
// Verify GIF textures exist
window.__phaserScene.textures.exists('banana_up')  // Should be true

// Check for network errors in browser DevTools Network tab
// Look for 404s on /Characters/*.gif files
```

## 📁 Critical Files

- [GifLoader.ts](src/components/game/phaser/GifLoader.ts) - GIF animation loader
- [CharacterSystem.ts](src/components/game/phaser/systems/CharacterSystem.ts) - Character logic
- [VehicleSystem.ts](src/components/game/phaser/systems/VehicleSystem.ts) - Vehicle logic
- [MainScene.ts](src/components/game/phaser/MainScene.ts) - Integration
- [PhaserGame.tsx](src/components/game/phaser/PhaserGame.tsx) - Scene exposure

## 📦 Assets

```
public/Characters/banana_walk_up.gif       ✓ Copied
public/Characters/banana_walk_down.gif     ✓ Copied
public/Characters/banana_walk_left.gif     ✓ Copied
public/Characters/banana_walk_right.gif    ✓ Copied
public/cars/*.png                          ✓ Existed
```

## 🎯 Full Documentation

- [STAGE4_TESTING.md](STAGE4_TESTING.md) - Comprehensive testing guide (300+ lines)
- [STAGE4_SUMMARY.md](STAGE4_SUMMARY.md) - Implementation details & architecture

---

**Stage 4 Status: ✅ COMPLETE - Ready for Production**
