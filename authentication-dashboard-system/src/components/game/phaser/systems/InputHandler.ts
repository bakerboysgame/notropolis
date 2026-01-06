import Phaser from 'phaser';
import { screenToGrid } from '../utils/coordinates';

export interface InputCallbacks {
  onTileClick: (x: number, y: number) => void;
  onCenterChange: (x: number, y: number) => void;
}

export class InputHandler {
  private scene: Phaser.Scene;
  private callbacks: InputCallbacks;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;
  private dragDistance = 0;

  constructor(scene: Phaser.Scene, callbacks: InputCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.setupInput();
  }

  setCallbacks(callbacks: InputCallbacks): void {
    this.callbacks = callbacks;
  }

  private setupInput(): void {
    const pointer = this.scene.input;

    pointer.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartX = p.x;
      this.dragStartY = p.y;
      this.cameraStartX = this.scene.cameras.main.scrollX;
      this.cameraStartY = this.scene.cameras.main.scrollY;
      this.dragDistance = 0;
    });

    pointer.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dx = p.x - this.dragStartX;
      const dy = p.y - this.dragStartY;
      this.dragDistance = Math.sqrt(dx * dx + dy * dy);

      this.scene.cameras.main.scrollX = this.cameraStartX - dx;
      this.scene.cameras.main.scrollY = this.cameraStartY - dy;
    });

    pointer.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.dragDistance < 10) {
        // Click, not drag
        const worldPoint = this.scene.cameras.main.getWorldPoint(p.x, p.y);
        const { x, y } = screenToGrid(worldPoint.x, worldPoint.y);
        this.callbacks.onTileClick(x, y);
      } else {
        // Drag ended - report new center
        const center = this.scene.cameras.main.getWorldPoint(
          this.scene.cameras.main.width / 2,
          this.scene.cameras.main.height / 2
        );
        const { x, y } = screenToGrid(center.x, center.y);
        this.callbacks.onCenterChange(x, y);
      }
      this.isDragging = false;
    });

    // Zoom with wheel
    pointer.on('wheel', (_p: Phaser.Input.Pointer, _gx: unknown, _gy: unknown, deltaY: number) => {
      const camera = this.scene.cameras.main;
      const newZoom = Phaser.Math.Clamp(
        camera.zoom + (deltaY > 0 ? -0.1 : 0.1),
        0.5,
        2
      );
      camera.setZoom(newZoom);
    });
  }
}
