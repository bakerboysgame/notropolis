import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Phaser from 'phaser';
import { MainSceneTopDown } from './MainSceneTopDown';
import { createGameConfig } from './gameConfig';
import { PhaserGameProps, PhaserGameHandle } from './types';

/**
 * Top-down variant of PhaserGame component
 * Uses MainSceneTopDown scene instead of the standard isometric MainScene
 */
export const PhaserGameTopDown = forwardRef<PhaserGameHandle, PhaserGameProps>(
  function PhaserGameTopDown(
    { tiles, buildings, activeCompanyId, centerTile, selectedTile, onTileClick, onCenterChange },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<MainSceneTopDown | null>(null);

    // Expose spawn methods and zoom controls via ref
    useImperativeHandle(ref, () => ({
      spawnCharacter: () => sceneRef.current?.spawnCharacter() ?? false,
      spawnCar: () => sceneRef.current?.spawnCar() ?? false,
      getCharacterCount: () => sceneRef.current?.getCharacterCount() ?? 0,
      getCarCount: () => sceneRef.current?.getCarCount() ?? 0,
      clearCharacters: () => sceneRef.current?.clearCharacters(),
      clearCars: () => sceneRef.current?.clearCars(),
      setZoom: (zoom: number) => sceneRef.current?.setZoom(zoom),
      getZoom: () => sceneRef.current?.getZoom() ?? 1.0,
    }));

    // Expose scene to window for testing
    useEffect(() => {
      if (sceneRef.current) {
        (window as any).__phaserSceneTopDown = sceneRef.current;
        console.log('MainSceneTopDown exposed as window.__phaserSceneTopDown');
        console.log('Test commands:');
        console.log('  window.__phaserSceneTopDown.spawnCharacter() - Spawn a walking character');
        console.log('  window.__phaserSceneTopDown.spawnCar() - Spawn a car on a road');
        console.log('  window.__phaserSceneTopDown.getCharacterCount() - Count characters');
        console.log('  window.__phaserSceneTopDown.getCarCount() - Count vehicles');
      }
      return () => {
        delete (window as any).__phaserSceneTopDown;
      };
    }, [sceneRef.current]);

    // Initialize Phaser game
    useEffect(() => {
      if (!containerRef.current || gameRef.current) return;

      const scene = new MainSceneTopDown();
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
export type { PhaserGameHandle as PhaserGameTopDownHandle };
