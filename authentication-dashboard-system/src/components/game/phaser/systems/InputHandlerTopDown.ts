import Phaser from 'phaser';
import { screenToGrid } from '../utils/coordinatesTopDown';

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

      // Account for zoom level when dragging
      const zoom = this.scene.cameras.main.zoom;
      this.scene.cameras.main.scrollX = this.cameraStartX - dx / zoom;
      this.scene.cameras.main.scrollY = this.cameraStartY - dy / zoom;
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

    // Zoom with wheel (smoother zooming)
    pointer.on('wheel', (p: Phaser.Input.Pointer, _gx: unknown, _gy: unknown, deltaY: number) => {
      const camera = this.scene.cameras.main;
      const zoomFactor = deltaY > 0 ? 0.9 : 1.1; // Multiplicative zoom for smoother feel
      const newZoom = Phaser.Math.Clamp(
        camera.zoom * zoomFactor,
        0.1,
        3
      );

      // Zoom towards pointer position for better UX
      const worldPoint = camera.getWorldPoint(p.x, p.y);
      camera.setZoom(newZoom);
      const newWorldPoint = camera.getWorldPoint(p.x, p.y);

      camera.scrollX += worldPoint.x - newWorldPoint.x;
      camera.scrollY += worldPoint.y - newWorldPoint.y;
    });

    // Add keyboard controls for panning (Arrow keys + WASD)
    const cursors = this.scene.input.keyboard?.createCursorKeys();
    const wasd = this.scene.input.keyboard?.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    }) as { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key } | undefined;

    if (cursors || wasd) {
      this.scene.events.on('update', () => {
        const panSpeed = 10 / this.scene.cameras.main.zoom;

        if (cursors?.left.isDown || wasd?.a.isDown) {
          this.scene.cameras.main.scrollX -= panSpeed;
        }
        if (cursors?.right.isDown || wasd?.d.isDown) {
          this.scene.cameras.main.scrollX += panSpeed;
        }
        if (cursors?.up.isDown || wasd?.w.isDown) {
          this.scene.cameras.main.scrollY -= panSpeed;
        }
        if (cursors?.down.isDown || wasd?.s.isDown) {
          this.scene.cameras.main.scrollY += panSpeed;
        }
      });
    }
  }
}
