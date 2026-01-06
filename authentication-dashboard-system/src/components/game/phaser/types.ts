import { GameMap, Tile, BuildingInstance } from '../../../types/game';

export interface PhaserGameProps {
  map: GameMap;
  tiles: Tile[];
  buildings: BuildingInstance[];
  activeCompanyId: string;
  centerTile: { x: number; y: number };
  selectedTile: { x: number; y: number } | null;
  onTileClick: (coords: { x: number; y: number }) => void;
  onCenterChange: (coords: { x: number; y: number }) => void;
}

export interface SceneData {
  tiles: Tile[];
  buildings: BuildingInstance[];
  activeCompanyId: string;
}

export interface PhaserGameHandle {
  spawnCharacter: () => boolean;
  spawnCar: () => boolean;
  getCharacterCount: () => number;
  getCarCount: () => number;
  clearCharacters: () => void;
  clearCars: () => void;
}
