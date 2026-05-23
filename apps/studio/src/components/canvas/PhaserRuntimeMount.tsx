// GDD §6.6 — Phase 6B step 5.
// 2D mount. Symmetric to ThreeRuntimeMount. Fetches a project.pixlproject.json
// from `assetBaseUrl`, converts via @pixlland/phaser-runtime's pixlSceneToPhaserScene
// adapter, and renders each rootObject as a Phaser game object (rectangle / circle
// / image) inside a custom Phaser.Scene. The Phaser.Game is built lazily so the
// 3D code path doesn't pay for the phaser import.
//
// Not yet wired (Phase 6B step 5b): persistence via engine-ops.object.setTransform
// when the user drags an object in the 2D viewport. Currently the scene is
// read-only.

import React, { useEffect, useRef, useState } from 'react';

import { pixlSceneToPhaserScene, type GameObjectJSON, type SceneJSON } from '@pixlland/phaser-runtime';
import { useEditorStore } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';

export interface PhaserRuntimeMountProps {
  visible: boolean;
  /** Absolute URL or relative path to the project root served by the studio. */
  assetBaseUrl?: string;
}

interface LoadState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
}

const DEFAULT_BASE_URL = '/sample-projects/sample-2d';

const fetchPixlProject = async (baseUrl: string): Promise<{ scenes: unknown[]; activeSceneId: string }> => {
  const url = `${baseUrl.replace(/\/$/, '')}/project.pixlproject.json`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`project.pixlproject.json: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

const parseColor = (value: unknown, fallback = 0xffffff): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.startsWith('#')) {
    return parseInt(value.slice(1), 16);
  }
  return fallback;
};

// Resolve a sprite's URL declared in the project doc against the project's
// asset base. Project docs reference assets via relative paths (e.g.
// "assets/characters/mage.png"); the runtime fetches from
// `${assetBaseUrl}/${path}`. Returns the input verbatim for absolute URLs.
const resolveAssetUrl = (assetBaseUrl: string, path: string): string => {
  if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path;
  return `${assetBaseUrl.replace(/\/$/, '')}/${path}`;
};

// Walk a tree of GameObjectJSON, calling fn on every node depth-first.
const walkObjects = (
  list: GameObjectJSON[],
  fn: (obj: GameObjectJSON) => void,
): void => {
  for (const obj of list) {
    fn(obj);
    if (obj.children?.length) walkObjects(obj.children, fn);
  }
};

// Queue every sprite/image asset referenced by the scene tree onto Phaser's
// loader so create() can synchronously add them to the scene. Spritesheet
// frame configs are honoured when data.frameWidth/frameHeight are set.
const queueSpriteLoads = (
  scene: import('phaser').Scene,
  rootObjects: GameObjectJSON[],
  assetBaseUrl: string,
): void => {
  const queued = new Set<string>();
  walkObjects(rootObjects, (obj) => {
    if (obj.type !== 'sprite' && obj.type !== 'image') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (obj as any).data ?? {};
    const url = data.imageUrl ?? data.url;
    if (typeof url !== 'string' || queued.has(url)) return;
    queued.add(url);
    const fullUrl = resolveAssetUrl(assetBaseUrl, url);
    if (typeof data.frameWidth === 'number' && typeof data.frameHeight === 'number') {
      scene.load.spritesheet(url, fullUrl, {
        frameWidth: data.frameWidth,
        frameHeight: data.frameHeight,
        margin: data.frameMargin ?? 0,
        spacing: data.frameSpacing ?? 0,
      });
    } else {
      scene.load.image(url, fullUrl);
    }
  });
};

// Track the pixl id on each Phaser GameObject so scripts can look up
// entities by their stable schema id (not by display name, which is
// human-readable and can collide). Runtime gameObjects Map is keyed by
// this id; setName(obj.name||obj.id) is preserved for the existing
// Phaser-name convention.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stampPixlId = (go: any, id: string | undefined): void => {
  if (id && typeof go?.setData === 'function') {
    go.setData('pixlId', id);
  }
};

// Draws a single PixlSceneObject into the given Phaser.Scene. Supports
// primitive shapes (rectangle/circle), sprite/image, and text. Unknown
// types render a magenta marker so the gap is visible instead of silent.
const drawObject = (
  scene: import('phaser').Scene,
  obj: GameObjectJSON,
): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (obj as any).data ?? {};
  const px = obj.transform.position;
  const color = parseColor(data.color, 0xff00ff);
  switch (obj.type) {
    case 'rectangle': {
      const w = typeof data.width === 'number' ? data.width : 40;
      const h = typeof data.height === 'number' ? data.height : 40;
      const r = scene.add.rectangle(px.x, px.y, w, h, color);
      r.setName(obj.name || obj.id);
      stampPixlId(r, obj.id);
      r.setRotation(obj.transform.rotation);
      r.setScale(obj.transform.scale.x, obj.transform.scale.y);
      r.setVisible(obj.visible !== false);
      if (typeof data.alpha === 'number') r.setAlpha(data.alpha);
      break;
    }
    case 'circle': {
      const radius = typeof data.radius === 'number' ? data.radius : 20;
      const c = scene.add.circle(px.x, px.y, radius, color);
      c.setName(obj.name || obj.id);
      stampPixlId(c, obj.id);
      c.setVisible(obj.visible !== false);
      if (typeof data.alpha === 'number') c.setAlpha(data.alpha);
      break;
    }
    case 'sprite':
    case 'image': {
      const key = data.imageUrl ?? data.url;
      if (!key || !scene.textures.exists(key)) {
        // Asset missing — render a magenta marker labeled with the URL so
        // the gap is debuggable instead of silently invisible.
        const placeholder = scene.add.rectangle(px.x, px.y, 32, 32, 0xff00ff);
        placeholder.setName(`${obj.name}(sprite-missing:${key ?? 'no-url'})`);
        placeholder.setStrokeStyle(2, 0xffffff);
        break;
      }
      const frame = typeof data.frame === 'number' ? data.frame : undefined;
      const sprite = scene.add.sprite(px.x, px.y, key, frame);
      sprite.setName(obj.name || obj.id);
      stampPixlId(sprite, obj.id);
      sprite.setRotation(obj.transform.rotation);
      const scaleMult = typeof data.scale === 'number' ? data.scale : 1;
      sprite.setScale(
        obj.transform.scale.x * scaleMult,
        obj.transform.scale.y * scaleMult,
      );
      sprite.setVisible(obj.visible !== false);
      if (typeof data.flipX === 'boolean') sprite.setFlipX(data.flipX);
      if (typeof data.flipY === 'boolean') sprite.setFlipY(data.flipY);
      if (typeof data.alpha === 'number') sprite.setAlpha(data.alpha);
      if (typeof data.tint === 'string' || typeof data.tint === 'number') {
        sprite.setTint(parseColor(data.tint, 0xffffff));
      }
      if (typeof data.depth === 'number') sprite.setDepth(data.depth);
      // For tiled backgrounds (e.g. wallpaper-style arena-bg), let the
      // project doc set displayWidth/displayHeight directly instead of
      // multiplying scale (works better with auto-sized images).
      if (typeof data.displayWidth === 'number') sprite.displayWidth = data.displayWidth;
      if (typeof data.displayHeight === 'number') sprite.displayHeight = data.displayHeight;
      break;
    }
    case 'text': {
      const txt = typeof data.text === 'string' ? data.text : '';
      const fontSize = typeof data.fontSize === 'number' ? `${data.fontSize}px` : '16px';
      const fontFamily = typeof data.fontFamily === 'string' ? data.fontFamily : 'monospace';
      const fontColor = typeof data.color === 'string' ? data.color : '#ffffff';
      const t = scene.add.text(px.x, px.y, txt, {
        fontSize, fontFamily, color: fontColor,
      });
      t.setName(obj.name || obj.id);
      stampPixlId(t, obj.id);
      t.setRotation(obj.transform.rotation);
      t.setScale(obj.transform.scale.x, obj.transform.scale.y);
      t.setVisible(obj.visible !== false);
      if (typeof data.depth === 'number') t.setDepth(data.depth);
      if (typeof data.alpha === 'number') t.setAlpha(data.alpha);
      break;
    }
    default: {
      // Unknown type — render a magenta marker square so the user sees it's there.
      const marker = scene.add.rectangle(px.x, px.y, 20, 20, 0xff00ff);
      marker.setName(`${obj.name}(unsupported:${obj.type})`);
      marker.setStrokeStyle(2, 0xffffff);
      break;
    }
  }
  // Recurse into children — Phaser doesn't auto-nest like the Pixl tree, so
  // we just flatten for now. Real parenting would use Phaser.Container.
  for (const child of obj.children ?? []) drawObject(scene, child);
};

export function PhaserRuntimeMount({
  visible,
  assetBaseUrl = DEFAULT_BASE_URL,
}: PhaserRuntimeMountProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameRef = useRef<any>(null);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  // Subscribe to the editor's Play/Stop button via the existing
  // runtimeGameStore. The Phaser scene starts PAUSED so the user sees the
  // project doc as a static snapshot (typical editor behavior — edit mode
  // by default, click Play to start, click Stop to pause). Subscribing
  // through useEffect below means Play/Stop toggles flow through to
  // scene.scene.pause()/resume() without re-mounting the canvas.
  const isPlaying = useRuntimeGameStore((s) => s.isPlaying);
  // Round 1: subscribe to the existing editor-store selection so the
  // outline + InspectorPanel work uniformly for the 2D viewport.
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  // Round 2: subscribe to the currently-selected SceneObject's transform
  // and visibility so Inspector edits flow back into the Phaser scene
  // without a reload. Use scalar derived deps (px, py, rz, sx, sy) instead
  // of the whole object reference so the effect only re-runs when a value
  // we actually care about changes.
  const selectedStoreObject = useEditorStore((s) =>
    s.objects.find((o) => o.id === s.selectedObjectId),
  );
  const selStorePx = selectedStoreObject?.position?.[0];
  const selStorePy = selectedStoreObject?.position?.[1];
  const selStoreRz = selectedStoreObject?.rotation?.[2];
  const selStoreSx = selectedStoreObject?.scale?.[0];
  const selStoreSy = selectedStoreObject?.scale?.[1];
  const selStoreVisible = selectedStoreObject?.visible;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !visible) return;

    let disposed = false;
    setLoad({ status: 'loading' });

    void (async () => {
      try {
        const Phaser = (await import('phaser')) as unknown as typeof import('phaser');
        if (disposed) return;
        const project = await fetchPixlProject(assetBaseUrl);
        const activeScene = (project.scenes as unknown as Array<{ id: string; kind?: string }>).find(
          (s) => s.id === project.activeSceneId,
        ) ?? (project.scenes as unknown as Array<unknown>)[0];
        if (!activeScene) throw new Error('No active scene in project');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const phaserScene: SceneJSON = pixlSceneToPhaserScene(activeScene as any);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gravity: { x: number; y: number } = (Array.isArray(phaserScene.physics?.gravity)
          ? { x: phaserScene.physics?.gravity[0] ?? 0, y: phaserScene.physics?.gravity[1] ?? 0 }
          : (phaserScene.physics?.gravity as { x: number; y: number } | undefined) ?? { x: 0, y: 980 });
        const bg = parseColor(phaserScene.environment?.background, 0x101822);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const env = (phaserScene.environment ?? {}) as any;
        // Default to pixel art rendering — most 2D games using this mount
        // are low-res sprite-driven (Magic Battleground, Arcane Arena, etc.).
        // The project doc can opt out via environment.pixelArt = false.
        const pixelArt = env.pixelArt !== false;

        gameRef.current = new Phaser.Game({
          type: Phaser.AUTO,
          parent: container,
          width: container.clientWidth || 800,
          height: container.clientHeight || 600,
          backgroundColor: bg,
          pixelArt,
          roundPixels: pixelArt,
          physics: { default: 'arcade', arcade: { gravity } },
          scene: {
            preload(this: import('phaser').Scene) {
              // Queue every sprite/image referenced by the scene tree before
              // create() runs — Phaser's loader resolves between scenes so
              // create() can call scene.add.sprite() synchronously.
              queueSpriteLoads(this, phaserScene.rootObjects, assetBaseUrl);
            },
            create(this: import('phaser').Scene) {
              for (const obj of phaserScene.rootObjects) {
                drawObject(this, obj);
              }

              // Round 1 of the visual editor: make every rendered gameobject
              // hit-testable, route clicks to useEditorStore.selectObject so
              // the existing InspectorPanel picks up the selection. Empty
              // clicks deselect. The runtime script's own pointerdown
              // handlers still fire — selection is additive, not exclusive.
              for (const go of this.children.list) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const anyGo = go as any;
                if (typeof anyGo.setInteractive === 'function') {
                  try { anyGo.setInteractive(); } catch { /* some types can't be interactive */ }
                }
              }
              this.input.on(
                'gameobjectdown',
                (
                  _pointer: import('phaser').Input.Pointer,
                  gameObject: import('phaser').GameObjects.GameObject,
                ) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const pixlId = (gameObject as any).getData?.('pixlId') as string | undefined;
                  if (pixlId) {
                    useEditorStore.getState().selectObject(pixlId);
                  }
                },
              );
              this.input.on(
                'pointerdown',
                (
                  _pointer: import('phaser').Input.Pointer,
                  hits: import('phaser').GameObjects.GameObject[],
                ) => {
                  if (!hits || hits.length === 0) {
                    useEditorStore.getState().selectObject(null);
                  }
                },
              );

              // Selection outline — drawn as a yellow rectangle on top of
              // everything. Updated reactively by the React layer below;
              // here we just create the Graphics object and stash it on
              // the scene plus a redraw helper that the drag handler can
              // call without going through React state.
              const outline = this.add.graphics();
              outline.setDepth(9999);
              outline.setName('__pixl_selection_outline');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (this as any).__pixlSelectionOutline = outline;

              // Scale handles: 4 small blue squares at the bounding box
              // corners of the selected object. Each handle is its own
              // interactive Phaser Rectangle so Phaser's drag system can
              // distinguish a handle drag from a body drag. The drag
              // handler at scene level (below) reads HANDLE_NAMES to know
              // which corner is moving and computes uniform scale based
              // on distance from the object's center.
              const HANDLE_NAMES = ['__pixl_handle_nw', '__pixl_handle_ne', '__pixl_handle_sw', '__pixl_handle_se'] as const;
              const handles: import('phaser').GameObjects.Rectangle[] = [];
              for (const name of HANDLE_NAMES) {
                const h = this.add.rectangle(0, 0, 10, 10, 0x4aa6ff, 0.95);
                h.setStrokeStyle(2, 0xffffff, 1);
                h.setDepth(10000);
                h.setVisible(false);
                h.setName(name);
                h.setInteractive({ draggable: true });
                handles.push(h);
                this.input.setDraggable(h, true);
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (this as any).__pixlScaleHandles = handles;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const sceneAny = this as any;
              sceneAny.__pixlRedrawOutline = (pixlId: string | null): void => {
                outline.clear();
                // Hide handles by default; show them only when an object
                // is selected and has measurable bounds.
                for (const h of handles) h.setVisible(false);
                if (!pixlId) return;
                const target = sceneAny.children.list.find(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (go: any) => go.getData?.('pixlId') === pixlId,
                );
                if (!target?.getBounds) return;
                const b = target.getBounds();
                const padding = 4;
                outline.lineStyle(2, 0xffe066, 1);
                outline.strokeRect(
                  b.x - padding, b.y - padding,
                  b.width + padding * 2, b.height + padding * 2,
                );
                outline.fillStyle(0xffe066, 0.08);
                outline.fillRect(
                  b.x - padding, b.y - padding,
                  b.width + padding * 2, b.height + padding * 2,
                );

                // Position handles at each corner of the (padded) box.
                const x0 = b.x - padding;
                const y0 = b.y - padding;
                const x1 = b.x + b.width + padding;
                const y1 = b.y + b.height + padding;
                handles[0].setPosition(x0, y0).setVisible(true);  // NW
                handles[1].setPosition(x1, y0).setVisible(true);  // NE
                handles[2].setPosition(x0, y1).setVisible(true);  // SW
                handles[3].setPosition(x1, y1).setVisible(true);  // SE
                // Track which object the handles are operating on, so the
                // drag handler can find it without doing another lookup.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (sceneAny as any).__pixlSelectedTarget = target;
              };

              // Drag handler — disambiguates body-drag (translate) from
              // handle-drag (scale via corner). Active only in edit mode
              // (gated by isPlaying).
              this.input.on(
                'drag',
                (
                  _pointer: import('phaser').Input.Pointer,
                  gameObject: import('phaser').GameObjects.GameObject,
                  dragX: number,
                  dragY: number,
                ) => {
                  if (useRuntimeGameStore.getState().isPlaying) return;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const go = gameObject as any;
                  const isHandle = (HANDLE_NAMES as readonly string[]).includes(go.name as string);

                  if (isHandle) {
                    // Scale: distance from center vs the original bounds-
                    // corner distance gives the uniform scale factor. We
                    // operate on the currently-selected target stashed
                    // when the outline redrew.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const target = (this as any).__pixlSelectedTarget as
                      | (import('phaser').GameObjects.GameObject & { x?: number; y?: number; scaleX?: number; scaleY?: number; getBounds?: () => { x: number; y: number; width: number; height: number } })
                      | undefined;
                    if (!target?.getBounds) return;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const pixlId = (target as any).getData?.('pixlId') as string | undefined;
                    if (!pixlId) return;
                    const b = target.getBounds!();
                    const cx = b.x + b.width / 2;
                    const cy = b.y + b.height / 2;
                    // Half-extent at scale=1 (current size / current scale).
                    // Compute the "1.0 scale" half-extent from the target's
                    // current scale, then derive the new scale from the
                    // dragged corner's distance to center along each axis.
                    const sx = (target.scaleX ?? 1) || 1;
                    const sy = (target.scaleY ?? 1) || 1;
                    const halfW1 = (b.width / 2) / sx;
                    const halfH1 = (b.height / 2) / sy;
                    const newHalfW = Math.max(2, Math.abs(dragX - cx));
                    const newHalfH = Math.max(2, Math.abs(dragY - cy));
                    const newSx = newHalfW / halfW1;
                    const newSy = newHalfH / halfH1;
                    // Uniform scale (preserve aspect): use the dominant axis.
                    // Hold shift to scale per-axis (future round).
                    const newScale = Math.min(newSx, newSy);
                    if (typeof (target as any).setScale === 'function') {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (target as any).setScale(
                        Math.sign(sx) * newScale,
                        Math.sign(sy) * newScale,
                      );
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (this as any).__pixlRedrawOutline?.(pixlId);
                    const store = useEditorStore.getState();
                    store.updateObject(pixlId, {
                      scale: [Math.sign(sx) * newScale, Math.sign(sy) * newScale, 1],
                    } as Parameters<typeof store.updateObject>[1]);
                    return;
                  }

                  // Body translate (the original path).
                  if (typeof go.setPosition === 'function') {
                    go.setPosition(dragX, dragY);
                  } else {
                    go.x = dragX;
                    go.y = dragY;
                  }
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const pixlId = go.getData?.('pixlId') as string | undefined;
                  if (pixlId) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (this as any).__pixlRedrawOutline?.(pixlId);
                    const store = useEditorStore.getState();
                    store.updateObject(pixlId, {
                      position: [dragX, dragY, 0],
                    } as Parameters<typeof store.updateObject>[1]);
                  }
                },
              );

              const cam = phaserScene.camera;
              // Pixl 2D camera.position is interpreted as "scroll" offset
              // (top-left corner of view in world coords). Only override
              // when the project explicitly carries a non-zero offset; the
              // default sample uses world (0,0) at top-left which matches
              // Phaser's default and shouldn't be shifted.
              if (cam?.position && (cam.position.x !== 0 || cam.position.y !== 0)) {
                this.cameras.main.setScroll(cam.position.x, cam.position.y);
              }
              if (typeof cam?.zoom === 'number' && cam.zoom !== 1) {
                this.cameras.main.setZoom(cam.zoom);
              }

              // Scene-level runtime script — first step toward the PLAN
              // item 1 "scripts as components" milestone. If the active
              // scene declares `runtimeScript` (a path relative to the
              // project root), import it dynamically, call its default
              // export with { scene, gameObjects, Phaser, project }, and
              // wire the returned tick(delta) function to scene update.
              // Vite serves files under /sample-projects/ raw, so the
              // script is a plain ES module — no external bare imports.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const scriptPath = (activeScene as any).runtimeScript as string | undefined;
              if (typeof scriptPath === 'string' && scriptPath.length > 0) {
                // Key the lookup map by the pixl id (stamped via setData
                // in drawObject) — that's the stable schema id the script
                // references, distinct from go.name which carries the
                // human-readable display name. Fall back to go.name when
                // no pixl id was stamped (e.g. legacy projects).
                const gameObjects = new Map<string, import('phaser').GameObjects.GameObject>();
                for (const go of this.children.list) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const pixlId = (go as any).getData?.('pixlId') as string | undefined;
                  const key = pixlId ?? go.name;
                  if (key) gameObjects.set(key, go);
                }
                const sceneRef = this;
                const fullUrl = `${assetBaseUrl.replace(/\/$/, '')}/${scriptPath}?t=${Date.now()}`;
                // eslint-disable-next-line no-console
                console.log(`[PhaserRuntimeMount] loading runtime script: ${fullUrl}`);
                // Vite refuses dynamic import() of files served from /public
                // ("only via HTML tags"), so we fetch the raw text and import
                // it through a Blob URL — the browser still treats the result
                // as a real ES module with proper import/export semantics.
                (async () => {
                  const response = await fetch(fullUrl);
                  if (!response.ok) {
                    throw new Error(
                      `runtimeScript fetch ${response.status} ${response.statusText} for ${fullUrl}`,
                    );
                  }
                  const code = await response.text();
                  const blob = new Blob([code], { type: 'application/javascript' });
                  const blobUrl = URL.createObjectURL(blob);
                  try {
                    return await import(/* @vite-ignore */ blobUrl);
                  } finally {
                    URL.revokeObjectURL(blobUrl);
                  }
                })()
                  .then((mod: { default?: unknown; setup?: unknown }) => {
                    const setup = (mod.default ?? mod.setup) as
                      | ((ctx: unknown) => unknown)
                      | undefined;
                    if (typeof setup !== 'function') {
                      // eslint-disable-next-line no-console
                      console.warn(
                        `[PhaserRuntimeMount] runtimeScript ${scriptPath} has no default/setup export`,
                      );
                      return;
                    }
                    let tickFn: ((dt: number, time: number) => void) | null = null;
                    // Editor-friendly ctx helpers: scripts that want to
                    // react to player input must go through onGameInput so
                    // the editor can suppress gameplay during edit mode.
                    // tick() is already gated by scene pause (scene.update
                    // doesn't fire) so polled inputs like keys[X].isDown
                    // don't need a wrapper — only one-shot listeners do.
                    const offFns: Array<() => void> = [];
                    const onGameInput = (
                      event: string,
                      handler: (...args: unknown[]) => void,
                    ): (() => void) => {
                      const wrapped = (...args: unknown[]) => {
                        if (useRuntimeGameStore.getState().isPlaying) {
                          handler(...args);
                        }
                      };
                      sceneRef.input.on(event, wrapped);
                      const off = () => sceneRef.input.off(event, wrapped);
                      offFns.push(off);
                      return off;
                    };

                    try {
                      const ret = setup({
                        scene: sceneRef,
                        gameObjects,
                        Phaser,
                        project,
                        activeScene,
                        onGameInput,
                        isPlaying: () => useRuntimeGameStore.getState().isPlaying,
                      });
                      if (typeof ret === 'function') {
                        tickFn = ret as (dt: number, time: number) => void;
                      }
                    } catch (err) {
                      // eslint-disable-next-line no-console
                      console.error('[PhaserRuntimeMount] runtimeScript setup threw:', err);
                      return;
                    }
                    if (tickFn) {
                      sceneRef.events.on('update', (time: number, delta: number) => {
                        try {
                          tickFn?.(delta, time);
                        } catch (err) {
                          // eslint-disable-next-line no-console
                          console.error('[PhaserRuntimeMount] runtimeScript tick threw:', err);
                        }
                      });
                    }
                  })
                  .catch((err: unknown) => {
                    // eslint-disable-next-line no-console
                    console.error(
                      `[PhaserRuntimeMount] failed to load runtimeScript ${scriptPath}:`,
                      err,
                    );
                  });
              }
            },
          },
        });
        // Phase 6B debug.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__pixlPhaserGame = gameRef.current;

        // Keyboard capture only works when the canvas can take focus and
        // is in fact focused. Phaser DOES listen on window by default, but
        // when the studio toolbar steals focus to a button the user's
        // WASD keypresses go to the button (or, worse, trigger button
        // accesskey behaviour) and never reach the game loop. Fix on both
        // ends: make the canvas tab-focusable, auto-focus it on mount,
        // and re-focus on click.
        const canvas = gameRef.current.canvas as HTMLCanvasElement | undefined;
        if (canvas) {
          canvas.setAttribute('tabindex', '0');
          canvas.style.outline = 'none';
          // First mount: pull focus so WASD works without the user having
          // to click the canvas first.
          requestAnimationFrame(() => canvas.focus({ preventScroll: true }));
          // Click anywhere on the canvas reclaims focus from the toolbar.
          canvas.addEventListener('pointerdown', () => {
            try { canvas.focus({ preventScroll: true }); } catch { /* noop */ }
          });
        }

        // Honor the current Play/Stop state immediately on boot. The user
        // expects the editor to default to "edit mode" (paused) so they
        // can inspect the scene before scripts start moving things; click
        // Play in the toolbar to begin. The useEffect below keeps it in
        // sync with later toggles.
        try {
          const sceneRef = gameRef.current.scene.scenes[0] as import('phaser').Scene | undefined;
          if (sceneRef && !useRuntimeGameStore.getState().isPlaying) {
            sceneRef.scene.pause();
          }
        } catch { /* scene may not be fully booted yet — useEffect will catch up */ }

        setLoad({ status: 'ready' });
      } catch (error) {
        if (disposed) return;
        const message = error instanceof Error ? error.message : String(error);
        setLoad({ status: 'error', message });
      }
    })();

    return () => {
      disposed = true;
      if (gameRef.current) {
        try { gameRef.current.destroy(true); } catch { /* ignore */ }
        gameRef.current = null;
      }
    };
  }, [visible, assetBaseUrl]);

  // Redraw the selection outline + toggle draggable on the selected
  // gameobject whenever the editor store's selection changes. Runs
  // decoupled from Phaser's update loop so it works whether the scene
  // is paused (edit mode) or running (play mode).
  useEffect(() => {
    const game = gameRef.current;
    if (!game || load.status !== 'ready') return;
    try {
      const scene = game.scene?.scenes?.[0] as import('phaser').Scene | undefined;
      if (!scene) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sceneAny = scene as any;
      const redraw = sceneAny.__pixlRedrawOutline as
        | ((id: string | null) => void)
        | undefined;
      redraw?.(selectedObjectId);

      // Only the selected gameobject is draggable in edit mode. Other
      // interactive objects keep their hit-testing for click-select but
      // shouldn't move. In play mode (isPlaying true) the drag handler
      // is a no-op anyway, so we leave the flag alone.
      for (const go of scene.children.list) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyGo = go as any;
        const id = anyGo.getData?.('pixlId') as string | undefined;
        if (typeof anyGo.input?.draggable === 'boolean') {
          // Re-set via the Phaser API which keeps the flag in sync.
          if (id && id === selectedObjectId) {
            scene.input.setDraggable(go, true);
          } else {
            scene.input.setDraggable(go, false);
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PhaserRuntimeMount] selection outline / drag toggle failed:', err);
    }
  }, [selectedObjectId, load.status, isPlaying]);

  // Round 2: Inspector edits → live Phaser GO sync. When the selected
  // SceneObject's transform/visible changes in the editor store (typically
  // because the user typed a new value in the InspectorPanel), find the
  // matching Phaser GameObject by pixlId and apply the values. Idempotent
  // for the drag path: drag handler calls updateObject(pixlId, {position})
  // which triggers this effect with the same values it just set on the
  // GO — Phaser setPosition/setRotation/etc are no-ops when the values
  // already match, so no loop.
  useEffect(() => {
    if (!selectedObjectId || load.status !== 'ready') return;
    const game = gameRef.current;
    const scene = game?.scene?.scenes?.[0] as import('phaser').Scene | undefined;
    if (!scene) return;
    const target = scene.children.list.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (go) => (go as any).getData?.('pixlId') === selectedObjectId,
    );
    if (!target) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyGo = target as any;
    try {
      if (typeof selStorePx === 'number' && typeof selStorePy === 'number') {
        if (typeof anyGo.setPosition === 'function') {
          anyGo.setPosition(selStorePx, selStorePy);
        } else {
          anyGo.x = selStorePx;
          anyGo.y = selStorePy;
        }
      }
      if (typeof selStoreRz === 'number' && typeof anyGo.setRotation === 'function') {
        // 2D rotation maps to z-axis rotation from the 3D-shaped editor
        // store. Phaser uses radians on the canvas.
        anyGo.setRotation(selStoreRz);
      }
      if (typeof selStoreSx === 'number' && typeof selStoreSy === 'number') {
        if (typeof anyGo.setScale === 'function') {
          anyGo.setScale(selStoreSx, selStoreSy);
        }
      }
      if (typeof selStoreVisible === 'boolean' && typeof anyGo.setVisible === 'function') {
        anyGo.setVisible(selStoreVisible);
      }
      // Re-draw the outline at the new bounds.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (scene as any).__pixlRedrawOutline?.(selectedObjectId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PhaserRuntimeMount] store→GO sync failed:', err);
    }
  }, [
    selectedObjectId, load.status,
    selStorePx, selStorePy, selStoreRz, selStoreSx, selStoreSy, selStoreVisible,
  ]);

  // Mirror the Play/Stop toggle into the live Phaser scene. Pause freezes
  // the update loop (so the runtime script's tick stops running); resume
  // re-enables it. Input handlers attached at scene.input level still
  // fire on either side of pause, which is fine — they just don't see
  // motion until tick runs again.
  useEffect(() => {
    const game = gameRef.current;
    if (!game || load.status !== 'ready') return;
    try {
      const scene = game.scene?.scenes?.[0];
      if (!scene) return;
      const sceneMgr = scene.scene;
      const currentlyPaused = sceneMgr?.isPaused?.() ?? false;
      if (isPlaying && currentlyPaused) {
        sceneMgr.resume();
        // Re-focus the canvas so WASD reaches the game on resume — the
        // user usually clicked the Play button, which stole focus.
        try { game.canvas?.focus?.({ preventScroll: true }); } catch { /* noop */ }
      } else if (!isPlaying && !currentlyPaused) {
        sceneMgr.pause();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PhaserRuntimeMount] play/stop toggle failed:', err);
    }
  }, [isPlaying, load.status]);

  return (
    <div
      data-runtime="phaser"
      ref={containerRef}
      style={{
        display: visible ? 'block' : 'none',
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#101822',
      }}
    >
      {load.status !== 'ready' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--editor-text, #cfd6e0)',
            fontSize: 14,
            pointerEvents: 'none',
            padding: 16,
          }}
        >
          {load.status === 'loading' && 'Carregando @pixlland/phaser-runtime…'}
          {load.status === 'error' && (
            <span style={{ color: '#ff9b9b', textAlign: 'center', maxWidth: 480 }}>
              phaser-runtime: {load.message ?? 'falha'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
