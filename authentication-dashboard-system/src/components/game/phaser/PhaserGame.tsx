import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Phaser from 'phaser';
import { MainScene } from './MainScene';
import { createGameConfig } from './gameConfig';
import { PhaserGameProps, PhaserGameHandle } from './types';

export const PhaserGame = forwardRef<PhaserGameHandle, PhaserGameProps>(
  function PhaserGame(
    { tiles, buildings, activeCompanyId, centerTile, selectedTile, onTileClick, onCenterChange },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<MainScene | null>(null);

    // Expose spawn methods via ref
    useImperativeHandle(ref, () => ({
      spawnCharacter: () => sceneRef.current?.spawnCharacter() ?? false,
      spawnCar: () => sceneRef.current?.spawnCar() ?? false,
      getCharacterCount: () => sceneRef.current?.getCharacterCount() ?? 0,
      getCarCount: () => sceneRef.current?.getCarCount() ?? 0,
      clearCharacters: () => sceneRef.current?.clearCharacters(),
      clearCars: () => sceneRef.current?.clearCars(),
    }));

    // Expose scene to window for testing (Stage 4)
    // This allows testing character/vehicle spawning via browser console
    useEffect(() => {
      if (sceneRef.current) {
        (window as any).__phaserScene = sceneRef.current;
        console.log('MainScene exposed as window.__phaserScene');
        console.log('Test commands:');
        console.log('  window.__phaserScene.spawnCharacter() - Spawn a walking character');
        console.log('  window.__phaserScene.spawnCar() - Spawn a car on a road');
        console.log('  window.__phaserScene.getCharacterCount() - Count characters');
        console.log('  window.__phaserScene.getCarCount() - Count vehicles');
      }
      return () => {
        delete (window as any).__phaserScene;
      };
    }, [sceneRef.current]);

    // Initialize Phaser game
    useEffect(() => {
      if (!containerRef.current || gameRef.current) return;

      const scene = new MainScene();
      sceneRef.current = scene;

      // Set callbacks before scene starts
      scene.setCallbacks({
        onTileClick: (x, y) => onTileClick({ x, y }),
        onCenterChange: (x, y) => onCenterChange({ x, y }),
      });

      const config = createGameConfig(containerRef.current, scene);
      gameRef.current = new Phaser.Game(config);

      return () => {
        gameRef.current?.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      };
    }, []);

    // Sync data to scene
    useEffect(() => {
      sceneRef.current?.setSceneData({ tiles, buildings, activeCompanyId });
    }, [tiles, buildings, activeCompanyId]);

    // Sync selection
    useEffect(() => {
      sceneRef.current?.setSelection(selectedTile?.x ?? null, selectedTile?.y ?? null);
    }, [selectedTile]);

    // Sync center tile
    useEffect(() => {
      sceneRef.current?.setCenterTile(centerTile.x, centerTile.y);
    }, [centerTile]);

    // Update callbacks when they change
    useEffect(() => {
      sceneRef.current?.setCallbacks({
        onTileClick: (x, y) => onTileClick({ x, y }),
        onCenterChange: (x, y) => onCenterChange({ x, y }),
      });
    }, [onTileClick, onCenterChange]);

    return <div ref={containerRef} className="w-full h-full" />;
  }
);

// Re-export types for convenience
export type { PhaserGameProps, PhaserGameHandle } from './types';
