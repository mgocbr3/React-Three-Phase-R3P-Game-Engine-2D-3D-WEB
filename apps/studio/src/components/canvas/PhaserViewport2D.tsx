import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { useEditorStore, SceneObject } from '@/stores/editorStore';

type SceneSnapshot = {
  objects: SceneObject[];
  selectedObjectId: string | null;
  showGrid: boolean;
  onSelect: (id: string | null) => void;
};

const WORLD_SCALE = 32;
const GRID_STEP = 64;

const getObjectFootprint = (object: SceneObject) => {
  const [scaleX, , scaleZ] = object.scale;
  const width = Math.max(24, Math.abs(scaleX) * WORLD_SCALE);
  const height = Math.max(24, Math.abs(scaleZ || scaleX) * WORLD_SCALE);

  if (object.type === 'player' || object.type === 'camera') {
    return { width: 28, height: 28 };
  }

  if (object.type === 'light' || object.type === 'sunlight' || object.type === 'spotlight') {
    return { width: 22, height: 22 };
  }

  return { width, height };
};

const getObjectLabelColor = (object: SceneObject) => {
  if (object.type === 'player') return '#38bdf8';
  if (object.type === 'camera') return '#a78bfa';
  if (object.type === 'light' || object.type === 'sunlight' || object.type === 'spotlight') return '#facc15';
  if (object.type === 'plane' || object.type === 'terrain') return '#22c55e';
  return object.color || '#fb923c';
};

class PixlPhaserEditorScene extends Phaser.Scene {
  private snapshot: SceneSnapshot;
  private gridLayer?: Phaser.GameObjects.Graphics;
  private objectLayer?: Phaser.GameObjects.Graphics;
  private labelLayer: Phaser.GameObjects.Text[] = [];
  private isPanning = false;
  private lastPointer = { x: 0, y: 0 };

  constructor(snapshot: SceneSnapshot) {
    super('PixlPhaserEditorScene');
    this.snapshot = snapshot;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1020');
    this.cameras.main.centerOn(0, 0);
    this.cameras.main.setZoom(1);
    this.input.mouse?.disableContextMenu();

    this.gridLayer = this.add.graphics();
    this.objectLayer = this.add.graphics();

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('wheel', this.handleWheel, this);

    this.refresh(this.snapshot);
  }

  refresh(snapshot: SceneSnapshot) {
    this.snapshot = snapshot;
    if (!this.gridLayer || !this.objectLayer) return;

    this.gridLayer.clear();
    this.objectLayer.clear();
    this.labelLayer.forEach((label) => label.destroy());
    this.labelLayer = [];

    if (snapshot.showGrid) {
      this.drawGrid();
    }

    snapshot.objects
      .filter((object) => object.visible !== false)
      .forEach((object) => this.drawObject(object));
  }

  private drawGrid() {
    if (!this.gridLayer) return;
    const gridSize = 4096;
    const half = gridSize / 2;

    this.gridLayer.lineStyle(1, 0x26334f, 0.55);
    for (let x = -half; x <= half; x += GRID_STEP) {
      this.gridLayer.moveTo(x, -half);
      this.gridLayer.lineTo(x, half);
    }
    for (let y = -half; y <= half; y += GRID_STEP) {
      this.gridLayer.moveTo(-half, y);
      this.gridLayer.lineTo(half, y);
    }
    this.gridLayer.strokePath();

    this.gridLayer.lineStyle(2, 0x3b82f6, 0.45);
    this.gridLayer.moveTo(-half, 0);
    this.gridLayer.lineTo(half, 0);
    this.gridLayer.moveTo(0, -half);
    this.gridLayer.lineTo(0, half);
    this.gridLayer.strokePath();
  }

  private drawObject(object: SceneObject) {
    if (!this.objectLayer) return;

    const x = object.position[0] * WORLD_SCALE;
    const y = object.position[2] * WORLD_SCALE;
    const { width, height } = getObjectFootprint(object);
    const color = Phaser.Display.Color.HexStringToColor(getObjectLabelColor(object)).color;
    const isSelected = this.snapshot.selectedObjectId === object.id;

    this.objectLayer.save();
    this.objectLayer.translateCanvas(x, y);
    this.objectLayer.rotateCanvas(object.rotation[1] || 0);

    if (object.type === 'player' || object.type === 'camera') {
      this.objectLayer.fillStyle(color, isSelected ? 0.9 : 0.65);
      this.objectLayer.lineStyle(isSelected ? 3 : 1.5, isSelected ? 0xffffff : color, 0.95);
      this.objectLayer.fillCircle(0, 0, Math.max(width, height) / 2);
      this.objectLayer.strokeCircle(0, 0, Math.max(width, height) / 2);
    } else if (object.type === 'light' || object.type === 'sunlight' || object.type === 'spotlight') {
      this.objectLayer.fillStyle(color, isSelected ? 0.95 : 0.75);
      this.objectLayer.lineStyle(isSelected ? 3 : 1.5, isSelected ? 0xffffff : color, 0.95);
      this.objectLayer.beginPath();
      this.objectLayer.moveTo(0, -height / 2);
      this.objectLayer.lineTo(width / 2, 0);
      this.objectLayer.lineTo(0, height / 2);
      this.objectLayer.lineTo(-width / 2, 0);
      this.objectLayer.closePath();
      this.objectLayer.fillPath();
      this.objectLayer.strokePath();
    } else {
      this.objectLayer.fillStyle(color, isSelected ? 0.75 : 0.45);
      this.objectLayer.lineStyle(isSelected ? 3 : 1.5, isSelected ? 0xffffff : color, 0.95);
      this.objectLayer.fillRect(-width / 2, -height / 2, width, height);
      this.objectLayer.strokeRect(-width / 2, -height / 2, width, height);
    }

    this.objectLayer.restore();

    const label = this.add.text(x + width / 2 + 8, y - height / 2 - 2, object.name, {
      color: isSelected ? '#ffffff' : '#cbd5e1',
      fontFamily: 'Roboto, Noto Sans, Arial, sans-serif',
      fontSize: '12px',
      backgroundColor: isSelected ? 'rgba(14, 165, 233, 0.35)' : 'rgba(15, 23, 42, 0.6)',
      padding: { x: 5, y: 3 },
    });
    label.setDepth(10);
    this.labelLayer.push(label);
  }

  private pickObject(worldX: number, worldY: number) {
    for (let index = this.snapshot.objects.length - 1; index >= 0; index -= 1) {
      const object = this.snapshot.objects[index];
      if (object.visible === false || object.locked) continue;

      const x = object.position[0] * WORLD_SCALE;
      const y = object.position[2] * WORLD_SCALE;
      const { width, height } = getObjectFootprint(object);

      if (
        worldX >= x - width / 2 &&
        worldX <= x + width / 2 &&
        worldY >= y - height / 2 &&
        worldY <= y + height / 2
      ) {
        return object.id;
      }
    }

    return null;
  }

  private handlePointerDown(pointer: any) {
    this.isPanning = pointer.rightButtonDown() || pointer.middleButtonDown();
    this.lastPointer = { x: pointer.x, y: pointer.y };

    if (this.isPanning) return;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.snapshot.onSelect(this.pickObject(worldPoint.x, worldPoint.y));
  }

  private handlePointerUp() {
    this.isPanning = false;
  }

  private handlePointerMove(pointer: any) {
    if (!this.isPanning) return;

    const camera = this.cameras.main;
    camera.scrollX -= (pointer.x - this.lastPointer.x) / camera.zoom;
    camera.scrollY -= (pointer.y - this.lastPointer.y) / camera.zoom;
    this.lastPointer = { x: pointer.x, y: pointer.y };
  }

  private handleWheel(_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) {
    const camera = this.cameras.main;
    camera.setZoom(Phaser.Math.Clamp(camera.zoom - deltaY * 0.001, 0.25, 3));
  }
}

export const PhaserViewport2D = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<PixlPhaserEditorScene | null>(null);
  const { objects, selectedObjectId, selectObject } = useEditorStore();
  const showGrid = useEditorStore((state) => state.showGrid);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;

    const snapshot: SceneSnapshot = {
      objects,
      selectedObjectId,
      showGrid,
      onSelect: selectObject,
    };
    const scene = new PixlPhaserEditorScene(snapshot);
    sceneRef.current = scene;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: hostRef.current.clientWidth,
      height: hostRef.current.clientHeight,
      backgroundColor: '#0b1020',
      scene,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    return () => {
      sceneRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.refresh({
      objects,
      selectedObjectId,
      showGrid,
      onSelect: selectObject,
    });
  }, [objects, selectedObjectId, selectObject, showGrid]);

  return (
    <div className="relative w-full h-full bg-[#0b1020] overflow-hidden">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="absolute left-4 top-4 pointer-events-none rounded-lg border border-sky-400/30 bg-slate-950/75 px-3 py-2 text-xs text-slate-200 shadow-xl">
        <div className="font-semibold text-sky-300">Phaser 2D Viewport</div>
        <div className="text-slate-400">Left click selects. Right click pans. Wheel zooms.</div>
      </div>
    </div>
  );
};
