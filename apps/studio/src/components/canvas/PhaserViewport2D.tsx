import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { useEditorStore, SceneObject } from '@/stores/editorStore';
import { useAssetDragStore } from '@/stores/assetDragStore';
import { toast } from 'sonner';
import { formatRulerMark, getRulerMarks } from './phaserRuler';

type SceneSnapshot = {
  objects: SceneObject[];
  selectedObjectId: string | null;
  showGrid: boolean;
  onSelect: (id: string | null) => void;
  onMoveObject: (id: string, position: [number, number, number]) => void;
};

const WORLD_SCALE = 32;
const GRID_STEP = 64;
// Default game viewport size when the project doesn't carry one yet. Matches
// the most common 2D web-game aspect (4:3 800x600 / 16:9 960x540). We pick a
// 16:9 frame so it reads as a TV-style camera box. Future: read from
// project.runtime.viewport once that field lands in the schema.
const DEFAULT_CAMERA_VIEWPORT = { width: 960, height: 540 };

const getDataNumber = (object: SceneObject, key: string, fallback = 0) => {
  const value = object.data?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const getDataString = (object: SceneObject, key: string) => {
  const value = object.data?.[key];
  return typeof value === 'string' ? value : undefined;
};

const isImageLike2DObject = (object: SceneObject) => (
  object.type === 'image' || object.type === 'sprite'
);

const getObjectWorldPosition = (object: SceneObject) => ({
  x: object.position[0] ?? 0,
  y: object.position[1] ?? object.position[2] ?? 0,
});

const getObjectRotation = (object: SceneObject) => object.rotation[2] ?? object.rotation[1] ?? 0;

const getObjectFootprint = (object: SceneObject) => {
  const [scaleX, scaleY, scaleZ] = object.scale;
  const scaleMultiplier = getDataNumber(object, 'scale', 1);

  if (object.type === 'rectangle') {
    return {
      width: Math.max(2, getDataNumber(object, 'width', 40) * Math.abs(scaleX || 1)),
      height: Math.max(2, getDataNumber(object, 'height', 40) * Math.abs(scaleY || 1)),
    };
  }

  if (object.type === 'circle') {
    const radius = Math.max(2, getDataNumber(object, 'radius', 20));
    return {
      width: radius * 2 * Math.abs(scaleX || 1),
      height: radius * 2 * Math.abs(scaleY || 1),
    };
  }

  if (object.type === 'text') {
    const text = getDataString(object, 'text') ?? object.name;
    const fontSize = getDataNumber(object, 'fontSize', 16);
    return {
      width: Math.max(24, text.length * fontSize * 0.62 * Math.abs(scaleX || 1)),
      height: Math.max(16, fontSize * 1.3 * Math.abs(scaleY || 1)),
    };
  }

  if (isImageLike2DObject(object)) {
    const width = getDataNumber(
      object,
      'displayWidth',
      getDataNumber(object, 'frameWidth', 64),
    );
    const height = getDataNumber(
      object,
      'displayHeight',
      getDataNumber(object, 'frameHeight', 64),
    );
    return {
      width: Math.max(8, width * Math.abs(scaleX || 1) * scaleMultiplier),
      height: Math.max(8, height * Math.abs(scaleY || 1) * scaleMultiplier),
    };
  }

  const width = Math.max(24, Math.abs(scaleX) * WORLD_SCALE);
  const height = Math.max(24, Math.abs(scaleY || scaleZ || scaleX) * WORLD_SCALE);

  if (object.type === 'player' || object.type === 'camera') {
    return { width: 28, height: 28 };
  }

  if (object.type === 'light' || object.type === 'sunlight' || object.type === 'spotlight') {
    return { width: 22, height: 22 };
  }

  return { width, height };
};

// Draws a dashed rectangle into a Phaser.Graphics layer. Used by the
// camera-viewport overlay. Two passes (top/bottom + left/right) so the
// dash pattern is continuous at each edge.
const drawDashedRect = (
  layer: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  dash = 10,
  gap = 6,
): void => {
  const step = dash + gap;
  // Top
  for (let i = 0; i < w; i += step) {
    layer.moveTo(x + i, y);
    layer.lineTo(x + Math.min(i + dash, w), y);
  }
  // Bottom
  for (let i = 0; i < w; i += step) {
    layer.moveTo(x + i, y + h);
    layer.lineTo(x + Math.min(i + dash, w), y + h);
  }
  // Left
  for (let i = 0; i < h; i += step) {
    layer.moveTo(x, y + i);
    layer.lineTo(x, y + Math.min(i + dash, h));
  }
  // Right
  for (let i = 0; i < h; i += step) {
    layer.moveTo(x + w, y + i);
    layer.lineTo(x + w, y + Math.min(i + dash, h));
  }
  layer.strokePath();
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
  private renderLayer: Phaser.GameObjects.GameObject[] = [];
  private loadingTextures = new Set<string>();
  private isPanning = false;
  private draggingObjectId: string | null = null;
  private dragOffset = { x: 0, y: 0 };
  private lastPointer = { x: 0, y: 0 };

  constructor(snapshot: SceneSnapshot) {
    super('PixlPhaserEditorScene');
    this.snapshot = snapshot;
  }

  create() {
    // Godot/Unity-style neutral dark scene background.
    this.cameras.main.setBackgroundColor('#3c3c3c');
    this.cameras.main.setScroll(0, 0);
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
    this.renderLayer.forEach((object) => object.destroy());
    this.renderLayer = [];
    this.labelLayer.forEach((label) => label.destroy());
    this.labelLayer = [];

    if (snapshot.showGrid) {
      this.drawGrid();
    }

    snapshot.objects
      .filter((object) => object.visible !== false)
      .forEach((object) => this.drawObject(object));
  }

  screenToWorld(clientX: number, clientY: number, rect: DOMRect) {
    return this.cameras.main.getWorldPoint(clientX - rect.left, clientY - rect.top);
  }

  private ensureTexture(url: string) {
    if (this.textures.exists(url) || this.loadingTextures.has(url)) return;

    this.loadingTextures.add(url);
    this.load.image(url, url);
    this.load.once('complete', () => {
      this.loadingTextures.delete(url);
      this.refresh(this.snapshot);
    });
    if (!this.load.isLoading()) {
      this.load.start();
    }
  }

  private drawGrid() {
    if (!this.gridLayer) return;
    const gridSize = 4096;
    const half = gridSize / 2;

    // Neutral grid: medium gray ticks + slightly lighter axis lines.
    // Matches Godot 4 / Unity scene-view conventions.
    this.gridLayer.lineStyle(1, 0x4a4a4a, 0.85);
    for (let x = -half; x <= half; x += GRID_STEP) {
      this.gridLayer.moveTo(x, -half);
      this.gridLayer.lineTo(x, half);
    }
    for (let y = -half; y <= half; y += GRID_STEP) {
      this.gridLayer.moveTo(-half, y);
      this.gridLayer.lineTo(half, y);
    }
    this.gridLayer.strokePath();

    // Major lines every 8 cells (= 512 world units) — stronger contrast for
    // orientation. Godot/Unity convention: brighter the closer to origin.
    this.gridLayer.lineStyle(1.5, 0x7a7a7a, 0.95);
    for (let x = -half; x <= half; x += GRID_STEP * 8) {
      this.gridLayer.moveTo(x, -half);
      this.gridLayer.lineTo(x, half);
    }
    for (let y = -half; y <= half; y += GRID_STEP * 8) {
      this.gridLayer.moveTo(-half, y);
      this.gridLayer.lineTo(half, y);
    }
    this.gridLayer.strokePath();

    // World axes — neutral light gray, slightly heavier than the major grid
    // but no warm tones (kept sober per editor palette).
    this.gridLayer.lineStyle(1.5, 0x9a9a9a, 0.9);
    this.gridLayer.moveTo(-half, 0);
    this.gridLayer.lineTo(half, 0);
    this.gridLayer.moveTo(0, -half);
    this.gridLayer.lineTo(0, half);
    this.gridLayer.strokePath();

    // Origin marker — subtle 6×6 outlined square + small "0,0" label, both
    // in muted gray so they read as scene-view annotations, not gameplay
    // accents. Matches Unity's quiet origin gizmo.
    this.gridLayer.lineStyle(1, 0xbcbcbc, 0.9);
    this.gridLayer.strokeRect(-3, -3, 6, 6);
    const originLabel = this.add.text(6, -16, '0,0', {
      color: '#bcbcbc',
      fontFamily: 'Roboto, Noto Sans, Arial, sans-serif',
      fontSize: '10px',
      backgroundColor: 'rgba(40,40,40,0.55)',
      padding: { x: 3, y: 1 },
    });
    originLabel.setDepth(5);
    this.labelLayer.push(originLabel);

    this.drawRulers(half);

    // Camera-render frame — dashed rectangle showing what the in-game
    // camera will capture. Starts at world (0,0) and extends toward +X/+Y
    // (Phaser convention: top-left is world origin), matching the
    // coordinate space the 2D runtime uses. Discrete light-gray stroke.
    const vw = DEFAULT_CAMERA_VIEWPORT.width;
    const vh = DEFAULT_CAMERA_VIEWPORT.height;
    this.gridLayer.lineStyle(1.5, 0xa8a8a8, 0.7);
    drawDashedRect(this.gridLayer, 0, 0, vw, vh, 10, 6);
    const camLabel = this.add.text(4, -14, `Camera ${vw}×${vh}`, {
      color: '#a8a8a8',
      fontFamily: 'Roboto, Noto Sans, Arial, sans-serif',
      fontSize: '11px',
      backgroundColor: 'rgba(20,20,20,0.65)',
      padding: { x: 4, y: 2 },
    });
    camLabel.setDepth(5);
    this.labelLayer.push(camLabel);
  }

  private drawRulers(half: number) {
    if (!this.gridLayer) return;
    const style = {
      color: '#bcbcbc',
      fontFamily: 'Roboto, Noto Sans, Arial, sans-serif',
      fontSize: '10px',
      backgroundColor: 'rgba(32,32,32,0.62)',
      padding: { x: 3, y: 1 },
    };

    this.gridLayer.lineStyle(1, 0xbcbcbc, 0.6);
    getRulerMarks(half, GRID_STEP * 8).forEach((mark) => {
      if (mark === 0) return;
      this.gridLayer!.moveTo(mark, -8);
      this.gridLayer!.lineTo(mark, 8);
      this.gridLayer!.moveTo(-8, mark);
      this.gridLayer!.lineTo(8, mark);

      const xLabel = this.add.text(mark + 4, 10, formatRulerMark(mark), style).setDepth(5);
      const yLabel = this.add.text(10, mark + 4, formatRulerMark(mark), style).setDepth(5);
      this.labelLayer.push(xLabel, yLabel);
    });
    this.gridLayer.strokePath();
  }

  private drawObject(object: SceneObject) {
    if (!this.objectLayer) return;

    const { x, y } = getObjectWorldPosition(object);
    const { width, height } = getObjectFootprint(object);
    const color = Phaser.Display.Color.HexStringToColor(getObjectLabelColor(object)).color;
    const isSelected = this.snapshot.selectedObjectId === object.id;
    const rotation = getObjectRotation(object);

    if (isImageLike2DObject(object)) {
      const url = getDataString(object, 'imageUrl') ?? getDataString(object, 'url');
      if (url && this.textures.exists(url)) {
        const image = this.add.image(x, y, url);
        image.setName(object.name);
        image.setDepth(getDataNumber(object, 'depth', 0));
        image.setRotation(rotation);
        image.setScale(
          (object.scale[0] || 1) * getDataNumber(object, 'scale', 1),
          (object.scale[1] || 1) * getDataNumber(object, 'scale', 1),
        );
        image.setVisible(object.visible !== false);
        if (typeof object.data?.alpha === 'number') image.setAlpha(object.data.alpha);
        if (typeof object.data?.displayWidth === 'number') image.displayWidth = object.data.displayWidth;
        if (typeof object.data?.displayHeight === 'number') image.displayHeight = object.data.displayHeight;
        if (typeof object.data?.flipX === 'boolean') image.setFlipX(object.data.flipX);
        if (typeof object.data?.flipY === 'boolean') image.setFlipY(object.data.flipY);
        this.renderLayer.push(image);
      } else if (url) {
        this.ensureTexture(url);
      }
    }

    if (object.type === 'text') {
      const text = this.add.text(x, y, getDataString(object, 'text') ?? object.name, {
        color: getDataString(object, 'color') ?? object.color ?? '#ffffff',
        fontFamily: getDataString(object, 'fontFamily') ?? 'Roboto, Noto Sans, Arial, sans-serif',
        fontSize: `${getDataNumber(object, 'fontSize', 16)}px`,
      });
      text.setDepth(getDataNumber(object, 'depth', 0));
      text.setRotation(rotation);
      text.setScale(object.scale[0] || 1, object.scale[1] || 1);
      this.renderLayer.push(text);
    }

    this.objectLayer.save();
    this.objectLayer.translateCanvas(x, y);
    this.objectLayer.rotateCanvas(rotation);

    if (isImageLike2DObject(object) || object.type === 'text') {
      if (isSelected || !getDataString(object, 'imageUrl')) {
        this.objectLayer.fillStyle(color, isSelected ? 0.14 : 0.08);
        this.objectLayer.lineStyle(isSelected ? 3 : 1.5, isSelected ? 0xffffff : color, isSelected ? 0.95 : 0.45);
        this.objectLayer.fillRect(-width / 2, -height / 2, width, height);
        this.objectLayer.strokeRect(-width / 2, -height / 2, width, height);
      }
    } else if (object.type === 'circle') {
      this.objectLayer.fillStyle(color, isSelected ? 0.75 : 0.45);
      this.objectLayer.lineStyle(isSelected ? 3 : 1.5, isSelected ? 0xffffff : color, 0.95);
      this.objectLayer.fillCircle(0, 0, Math.max(width, height) / 2);
      this.objectLayer.strokeCircle(0, 0, Math.max(width, height) / 2);
    } else if (object.type === 'player' || object.type === 'camera') {
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

      const { x, y } = getObjectWorldPosition(object);
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
    this.draggingObjectId = null;

    if (this.isPanning) return;

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const pickedId = this.pickObject(worldPoint.x, worldPoint.y);
    this.snapshot.onSelect(pickedId);

    if (pickedId && pointer.leftButtonDown()) {
      const picked = this.snapshot.objects.find((object) => object.id === pickedId);
      if (picked && !picked.locked) {
        const position = getObjectWorldPosition(picked);
        this.draggingObjectId = pickedId;
        this.dragOffset = {
          x: worldPoint.x - position.x,
          y: worldPoint.y - position.y,
        };
        this.input.setDefaultCursor('grabbing');
      }
    }
  }

  private handlePointerUp() {
    this.isPanning = false;
    this.draggingObjectId = null;
    this.input.setDefaultCursor('default');
  }

  private handlePointerMove(pointer: any) {
    if (this.draggingObjectId) {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const next: [number, number, number] = [
        worldPoint.x - this.dragOffset.x,
        worldPoint.y - this.dragOffset.y,
        0,
      ];
      const object = this.snapshot.objects.find((item) => item.id === this.draggingObjectId);
      if (object) object.position = next;
      this.snapshot.onMoveObject(this.draggingObjectId, next);
      this.refresh(this.snapshot);
      return;
    }

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
  const { objects, selectedObjectId, selectObject, updateObject, addSpriteFromAsset } = useEditorStore();
  const { endDrag } = useAssetDragStore();
  const showGrid = useEditorStore((state) => state.showGrid);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    endDrag();

    const raw = event.dataTransfer.getData('application/json');
    if (!raw) return;

    try {
      const asset = JSON.parse(raw) as {
        type?: string;
        name?: string;
        url?: string;
        assetType?: string;
        thumbnailUrl?: string;
      };
      if (asset.type !== 'pixlland-asset' || !asset.url || !asset.name) return;

      const assetType = asset.assetType ?? 'image';
      if (!['texture', 'image', 'sprite', 'spritesheet'].includes(assetType)) {
        toast.error('Use imagens ou sprites no viewport 2D.');
        return;
      }

      const rect = hostRef.current?.getBoundingClientRect();
      const world = rect && sceneRef.current
        ? sceneRef.current.screenToWorld(event.clientX, event.clientY, rect)
        : { x: 0, y: 0 };
      addSpriteFromAsset({
        name: asset.name,
        url: asset.url,
        type: assetType,
        thumbnailUrl: asset.thumbnailUrl,
      }, [Math.round(world.x), Math.round(world.y), 0]);
      toast.success(`${asset.name} adicionado ao viewport 2D.`);
    } catch (error) {
      console.error('[PhaserViewport2D] Failed to parse dropped asset:', error);
      toast.error('Nao foi possivel adicionar o asset 2D.');
    }
  }, [addSpriteFromAsset, endDrag]);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;

    const snapshot: SceneSnapshot = {
      objects,
      selectedObjectId,
      showGrid,
      onSelect: selectObject,
      onMoveObject: (id, position) => updateObject(id, { position }),
    };
    const scene = new PixlPhaserEditorScene(snapshot);
    sceneRef.current = scene;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: hostRef.current.clientWidth,
      height: hostRef.current.clientHeight,
      backgroundColor: '#3c3c3c',
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
      onMoveObject: (id, position) => updateObject(id, { position }),
    });
  }, [objects, selectedObjectId, selectObject, showGrid, updateObject]);

  return (
    <div
      className="relative w-full h-full bg-[#3c3c3c] overflow-hidden"
      data-testid="phaser-viewport-2d"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div ref={hostRef} className="absolute inset-0" />
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-2 border-dashed border-primary bg-primary/20">
          <div className="border border-border bg-card/95 px-5 py-3 text-center shadow-xl">
            <p className="text-sm font-semibold text-foreground">Solte para criar sprite 2D</p>
            <p className="text-xs text-muted-foreground">O asset entra na cena exatamente neste ponto.</p>
          </div>
        </div>
      )}
      <Viewport2DRulers sceneRef={sceneRef} />
    </div>
  );
};

// HTML-overlay ruler bars on the top + left edges. Reads camera state per
// frame from the Phaser scene and redraws ticks/labels in world coords.
// Godot/Unity-style: dark strip with light tick marks and numeric labels at
// the multiples of `MAJOR_STEP` world units. Pointer-events: none so the
// canvas keeps mouse input.

const RULER_THICKNESS = 18;
const MAJOR_STEP_WORLD = 64; // every cell
const MAJOR_LABEL_EVERY = 4; // label every 4 cells (= 256 world units)

interface Viewport2DRulersProps {
  sceneRef: { current: PixlPhaserEditorScene | null };
}

const Viewport2DRulers = ({ sceneRef }: Viewport2DRulersProps) => {
  const topRef = useRef<HTMLCanvasElement | null>(null);
  const leftRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const draw = (): void => {
      const scene = sceneRef.current;
      const top = topRef.current;
      const left = leftRef.current;
      if (scene && top && left) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cam = (scene as any).cameras?.main;
        if (cam) drawRulers(top, left, cam);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sceneRef]);

  return (
    <>
      <canvas
        ref={topRef}
        style={{
          position: 'absolute',
          top: 0,
          left: RULER_THICKNESS,
          right: 0,
          height: RULER_THICKNESS,
          width: `calc(100% - ${RULER_THICKNESS}px)`,
          pointerEvents: 'none',
          background: '#2b2b2b',
          borderBottom: '1px solid #1f1f1f',
        }}
      />
      <canvas
        ref={leftRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: RULER_THICKNESS,
          height: '100%',
          pointerEvents: 'none',
          background: '#2b2b2b',
          borderRight: '1px solid #1f1f1f',
        }}
      />
    </>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const drawRulers = (topCanvas: HTMLCanvasElement, leftCanvas: HTMLCanvasElement, cam: any): void => {
  const dpr = window.devicePixelRatio || 1;
  const setupCanvas = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null => {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    return ctx;
  };

  const scroll = { x: cam.scrollX as number, y: cam.scrollY as number };
  const zoom = cam.zoom as number;

  // Top ruler — horizontal, world X tick marks.
  const topCtx = setupCanvas(topCanvas);
  if (topCtx) {
    const w = topCanvas.clientWidth;
    topCtx.fillStyle = '#bdbdbd';
    topCtx.strokeStyle = '#7a7a7a';
    topCtx.font = '10px Roboto, Arial, sans-serif';
    topCtx.textBaseline = 'top';
    const stepPx = MAJOR_STEP_WORLD * zoom;
    if (stepPx > 4) {
      const firstWorldX = scroll.x;
      const firstScreen = -(firstWorldX % MAJOR_STEP_WORLD) * zoom;
      const startWorld = Math.floor(firstWorldX / MAJOR_STEP_WORLD) * MAJOR_STEP_WORLD;
      let i = 0;
      for (let sx = firstScreen; sx < w + stepPx; sx += stepPx) {
        const worldX = startWorld + i * MAJOR_STEP_WORLD;
        const isMajor = i % MAJOR_LABEL_EVERY === 0;
        topCtx.beginPath();
        topCtx.moveTo(sx, RULER_THICKNESS);
        topCtx.lineTo(sx, RULER_THICKNESS - (isMajor ? 8 : 4));
        topCtx.stroke();
        if (isMajor) topCtx.fillText(String(worldX), sx + 2, 2);
        i += 1;
      }
    }
  }

  // Left ruler — vertical, world Y tick marks.
  const leftCtx = setupCanvas(leftCanvas);
  if (leftCtx) {
    const h = leftCanvas.clientHeight;
    leftCtx.fillStyle = '#bdbdbd';
    leftCtx.strokeStyle = '#7a7a7a';
    leftCtx.font = '10px Roboto, Arial, sans-serif';
    leftCtx.textBaseline = 'top';
    const stepPx = MAJOR_STEP_WORLD * zoom;
    if (stepPx > 4) {
      const firstWorldY = scroll.y;
      const firstScreen = -(firstWorldY % MAJOR_STEP_WORLD) * zoom;
      const startWorld = Math.floor(firstWorldY / MAJOR_STEP_WORLD) * MAJOR_STEP_WORLD;
      let i = 0;
      for (let sy = firstScreen; sy < h + stepPx; sy += stepPx) {
        const worldY = startWorld + i * MAJOR_STEP_WORLD;
        const isMajor = i % MAJOR_LABEL_EVERY === 0;
        leftCtx.beginPath();
        leftCtx.moveTo(RULER_THICKNESS, sy);
        leftCtx.lineTo(RULER_THICKNESS - (isMajor ? 8 : 4), sy);
        leftCtx.stroke();
        if (isMajor) {
          leftCtx.save();
          leftCtx.translate(2, sy + 2);
          leftCtx.fillText(String(worldY), 0, 0);
          leftCtx.restore();
        }
        i += 1;
      }
    }
  }
};
