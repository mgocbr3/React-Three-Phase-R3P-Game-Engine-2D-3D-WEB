// GDD §6.6 — Phase 6B step 5.
// 2D mount. Symmetric to ThreeRuntimeMount. Fetches a project.pixlproject.json
// from `assetBaseUrl`, converts via @pixlland/phaser-runtime's pixlSceneToPhaserScene
// adapter, and renders each rootObject as a Phaser game object (rectangle / circle
// / image) inside a custom Phaser.Scene. The Phaser.Game is built lazily so the
// 3D code path doesn't pay for the phaser import.
//
// Interactive editor path: click selects, drag translates, toolbar modes expose
// rotate/scale handles, and changes persist back through useEditorStore.

import React, { useEffect, useRef, useState } from 'react';

import { pixlSceneToPhaserScene, type GameObjectJSON, type SceneJSON } from '@pixlland/phaser-runtime';
import { useEditorStore } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { loadProjectDocSnapshot } from '@/services/projectDocStorage';
import { mergeSnapshotOntoFresh } from '@/services/snapshotMerge';

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
  // Round 3.5: also subscribe to transformMode so the toolbar
  // (select / translate / rotate / scale) drives which gizmo handles
  // appear. Default 'translate' = body drag only; 'scale' = corner
  // handles; 'rotate' = rotation handle (future).
  const transformMode = useEditorStore((s) => s.transformMode);
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
        const fresh = await fetchPixlProject(assetBaseUrl);
        // Merge autosaved edits ONTO the fresh sample (vs replacing wholesale).
        // The snapshot only preserves transform/visible/locked/name — render
        // data like `data.imageUrl` lives in the sample. Direct replacement
        // would make every sprite render as the magenta "missing texture"
        // placeholder because the snapshot lacks the texture key.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const freshAny = fresh as any;
        const freshId = typeof freshAny?.id === 'string' ? freshAny.id : null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const freshSavedAt = typeof freshAny?.savedAt === 'number' ? freshAny.savedAt : 0;
        const snapshot = freshId ? loadProjectDocSnapshot(freshId) : null;
        const useSnapshot = !!(snapshot
          && typeof snapshot.savedAt === 'number'
          && snapshot.savedAt > freshSavedAt);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const project = (useSnapshot && snapshot ? mergeSnapshotOntoFresh(fresh as any, snapshot) : fresh) as any;
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
              // FIRST THING in create(): pin the keyboard plugin to the
              // current play state. Phaser initializes keyboard.enabled=true
              // by default during scene boot, AFTER the post-construct IIFE
              // in PhaserRuntimeMount runs — so without this we ended up
              // with kb.enabled=true even though isPlaying=false, which let
              // the Magic Battleground script's `keys.W.isDown` poll move
              // the player in edit mode (user complaint: "selecting HP bar +
              // arrows moves Player Mage when not in play mode").
              //
              // The useEffect in the component still owns the LIVE toggle
              // (Play/Stop button), but this guarantees a sane initial
              // state at the exact moment the runtime script first calls
              // scene.input.keyboard.addKey('W').
              const initIsPlaying = useRuntimeGameStore.getState().isPlaying;
              if (this.input?.keyboard) {
                this.input.keyboard.enabled = initIsPlaying;
                try {
                  if (!initIsPlaying) this.input.keyboard.clearCaptures();
                } catch { /* depends on Phaser version */ }
              }

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
                  // Don't deselect when the user clicks our own internal
                  // editor handles (scale corners, rotate dot, rotate ring).
                  // Previously a missed click on the small rotate dot
                  // landed on the canvas → deselect → handle disappears →
                  // user can't grab it anymore. We now (a) make the
                  // handles much bigger, AND (b) treat ANY internal-handle
                  // hit as a non-deselect event.
                  const hitInternal = (hits ?? []).some((g) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const n = (g as any)?.name as string | undefined;
                    return typeof n === 'string' && n.startsWith('__pixl_');
                  });
                  if (hitInternal) return;
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
              // Scale corner handles. Sized to be CLEARLY GRABBABLE on mouse
              // and touch (was 14×14 — way too small, "clique impreciso"
              // feedback from QA). The HIT area gets +14 px padding on each
              // side so the user has a forgiving grab zone even on a shaky
              // pointer — common Phaser-editor UX trick: visible 24, grab 38.
              const HANDLE_NAMES = ['__pixl_handle_nw', '__pixl_handle_ne', '__pixl_handle_sw', '__pixl_handle_se'] as const;
              const HANDLE_SIZE = 24;
              const HANDLE_HIT_PAD = 7;
              const HANDLE_FILL = 0x4aa6ff;
              const HANDLE_FILL_HOVER = 0x77ccff;
              const handles: import('phaser').GameObjects.Rectangle[] = [];
              for (const name of HANDLE_NAMES) {
                const h = this.add.rectangle(0, 0, HANDLE_SIZE, HANDLE_SIZE, HANDLE_FILL, 0.95);
                h.setStrokeStyle(2.5, 0xffffff, 1);
                h.setDepth(100000);
                h.setVisible(false);
                h.setName(name);
                // Hit area is bigger than the visual so the user can grab
                // slightly around the edge of the colored square.
                const hitSize = HANDLE_SIZE + HANDLE_HIT_PAD * 2;
                const hitArea = new Phaser.Geom.Rectangle(
                  -hitSize / 2, -hitSize / 2,
                  hitSize, hitSize,
                );
                h.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
                this.input.setDraggable(h, true);
                // Hover feedback: cursor + color brighten so the user sees
                // they're over a grabbable target.
                h.on('pointerover', () => {
                  this.input.setDefaultCursor('grab');
                  h.setFillStyle(HANDLE_FILL_HOVER, 1);
                });
                h.on('pointerout', () => {
                  this.input.setDefaultCursor('default');
                  h.setFillStyle(HANDLE_FILL, 0.95);
                });
                h.on('dragstart', () => this.input.setDefaultCursor('grabbing'));
                h.on('dragend', () => this.input.setDefaultCursor('default'));
                handles.push(h);
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (this as any).__pixlScaleHandles = handles;

              // Rotate handle ported from PhaserEditor2D-v3 RotateToolItem
              // (MIT) — a green circle above the object's top-center.
              // The reference renders a ring at radius 100 around the
              // object center and drags any point on the ring; we use a
              // single grab dot above-top-center because that's the
              // Unity/Godot idiom and easier to discover for users.
              // Drag math is the same: angleBetweenTwoPointsWithFixedPoint.
              const ROTATE_HANDLE_NAME = '__pixl_rotate_handle';
              const ROTATE_RING_NAME = '__pixl_rotate_ring';
              const ROTATE_HANDLE_RADIUS = 14;
              const ROTATE_HIT_PAD = 8;
              const ROTATE_FILL = 0x4cd964;
              const ROTATE_FILL_HOVER = 0x7fee92;

              // Phaser Editor 2D-style rotation RING — drawn around the
              // object so the user can grab ANYWHERE on the circumference,
              // not just a single dot. The ring is purely visual; the
              // drag interaction is owned by `rotateHandle` (the green
              // dot above the top edge) AND by `rotateRing` (an invisible
              // hit zone that follows the ring). Both dispatch the same
              // dragstart/drag with name === ROTATE_HANDLE_NAME so the
              // existing rotation math kicks in for either.
              const rotateRingViz = this.add.graphics();
              rotateRingViz.setDepth(99999);
              rotateRingViz.setVisible(false);
              rotateRingViz.setName('__pixl_rotate_ring_viz');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (this as any).__pixlRotateRingViz = rotateRingViz;

              const rotateHandle = this.add.circle(0, 0, ROTATE_HANDLE_RADIUS, ROTATE_FILL, 0.95);
              rotateHandle.setStrokeStyle(2.5, 0xffffff, 1);
              rotateHandle.setDepth(100000);
              rotateHandle.setVisible(false);
              rotateHandle.setName(ROTATE_HANDLE_NAME);
              rotateHandle.setInteractive(
                new Phaser.Geom.Circle(0, 0, ROTATE_HANDLE_RADIUS + ROTATE_HIT_PAD),
                Phaser.Geom.Circle.Contains,
              );
              this.input.setDraggable(rotateHandle, true);
              rotateHandle.on('pointerover', () => {
                this.input.setDefaultCursor('grab');
                rotateHandle.setFillStyle(ROTATE_FILL_HOVER, 1);
              });
              rotateHandle.on('pointerout', () => {
                this.input.setDefaultCursor('default');
                rotateHandle.setFillStyle(ROTATE_FILL, 0.95);
              });
              rotateHandle.on('dragstart', () => this.input.setDefaultCursor('grabbing'));
              rotateHandle.on('dragend', () => this.input.setDefaultCursor('default'));
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (this as any).__pixlRotateHandle = rotateHandle;

              // Translate indicator: small crosshair at the object's
              // center when mode === 'translate'. Non-interactive — the
              // body itself is the drag target (Round 1.5 path).
              const translateIndicator = this.add.graphics();
              translateIndicator.setDepth(100000);
              translateIndicator.setVisible(false);
              translateIndicator.setName('__pixl_translate_indicator');
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (this as any).__pixlTranslateIndicator = translateIndicator;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const sceneAny = this as any;
              // Cache of the active transformMode + which handles are
              // appropriate for each. The React-side useEffect mutates
              // this when the toolbar toggles, and the redraw helper
              // reads it to decide handle visibility.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (sceneAny as any).__pixlTransformMode = 'translate';
              // Toggle the hit-tester for handles together with their
              // visibility. Without this, invisible handles still SHOW UP
              // in `scene.input.hitTest` results — they linger at the
              // last selected object's corners, and then any click in
              // that region gets eaten by the invisible handle and the
              // anti-deselect guard treats it as an internal-handle
              // click, silently doing nothing. End result: user clicks
              // on a sprite, selection appears to not change.
              const setHandleInteractive = (h: import('phaser').GameObjects.GameObject, on: boolean): void => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const inputObj = (h as any).input;
                if (inputObj) inputObj.enabled = on;
              };
              sceneAny.__pixlRedrawOutline = (pixlId: string | null): void => {
                outline.clear();
                // Hide handles by default + disable their input. Invisible
                // handles must NOT consume pointer hits — see comment above.
                for (const h of handles) { h.setVisible(false); setHandleInteractive(h, false); }
                setHandleInteractive(rotateHandle, false);
                rotateHandle.setVisible(false);
                rotateRingViz.clear();
                rotateRingViz.setVisible(false);
                if (!pixlId) return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const mode = ((sceneAny as any).__pixlTransformMode ?? 'translate') as string;
                const wantHandles = mode === 'scale';
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

                // Position scale handles at each corner of the (padded) box.
                const x0 = b.x - padding;
                const y0 = b.y - padding;
                const x1 = b.x + b.width + padding;
                const y1 = b.y + b.height + padding;
                handles[0].setPosition(x0, y0).setVisible(wantHandles);  // NW
                handles[1].setPosition(x1, y0).setVisible(wantHandles);  // NE
                handles[2].setPosition(x0, y1).setVisible(wantHandles);  // SW
                handles[3].setPosition(x1, y1).setVisible(wantHandles);  // SE
                for (const h of handles) setHandleInteractive(h, wantHandles);

                // Rotate handle: green dot 28px above top-center + a visual
                // ring around the object (PhaserEditor2D-v3 style — the user
                // sees the rotation axis explicitly instead of just a lone
                // dot floating in space).
                const wantRotate = mode === 'rotate';
                const cxRot = (x0 + x1) / 2;
                const cyRot = y0 - 28;
                rotateHandle.setPosition(cxRot, cyRot).setVisible(wantRotate);
                setHandleInteractive(rotateHandle, wantRotate);
                rotateRingViz.clear();
                if (wantRotate) {
                  const cxRing = (x0 + x1) / 2;
                  const cyRing = (y0 + y1) / 2;
                  // Ring radius hugs the corners of the bbox so it looks
                  // tied to the object. Min 32 so tiny sprites still get
                  // a usable ring.
                  const ringRadius = Math.max(
                    32,
                    Math.hypot((x1 - x0) / 2, (y1 - y0) / 2) + 6,
                  );
                  rotateRingViz.lineStyle(2, ROTATE_FILL, 0.45);
                  rotateRingViz.strokeCircle(cxRing, cyRing, ringRadius);
                  // Tick lines at 0 / 90 / 180 / 270 — gives a sense of
                  // rotation reference while dragging.
                  rotateRingViz.lineStyle(1, ROTATE_FILL, 0.3);
                  const tickInner = ringRadius - 4;
                  const tickOuter = ringRadius + 4;
                  for (let i = 0; i < 4; i += 1) {
                    const a = (i * Math.PI) / 2;
                    rotateRingViz.beginPath();
                    rotateRingViz.moveTo(cxRing + Math.cos(a) * tickInner, cyRing + Math.sin(a) * tickInner);
                    rotateRingViz.lineTo(cxRing + Math.cos(a) * tickOuter, cyRing + Math.sin(a) * tickOuter);
                    rotateRingViz.strokePath();
                  }
                  rotateRingViz.setVisible(true);
                }

                // Translate indicator: small + at object's geometric center,
                // visible in 'translate' or 'select' so users see the pivot.
                const wantTranslate = mode === 'translate' || mode === 'select';
                translateIndicator.clear();
                if (wantTranslate) {
                  const cxT = (x0 + x1) / 2;
                  const cyT = (y0 + y1) / 2;
                  translateIndicator.lineStyle(2, 0xffe066, 0.9);
                  translateIndicator.beginPath();
                  translateIndicator.moveTo(cxT - 8, cyT);
                  translateIndicator.lineTo(cxT + 8, cyT);
                  translateIndicator.moveTo(cxT, cyT - 8);
                  translateIndicator.lineTo(cxT, cyT + 8);
                  translateIndicator.strokePath();
                  translateIndicator.setVisible(true);
                } else {
                  translateIndicator.setVisible(false);
                }

                // Track which object the handles are operating on, so the
                // drag handler can find it without doing another lookup.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (sceneAny as any).__pixlSelectedTarget = target;
              };

              // Drag handler — disambiguates body-drag (translate) from
              // handle-drag (scale via corner). Active only in edit mode
              // (gated by isPlaying).
              // -------------------------------------------------------
              // Gizmo drag math ported from PhaserEditor2D-v3:
              // source/editor/plugins/phasereditor2d.scene/src/ui/
              //   sceneobjects/object/tools/ScaleToolItem.ts  (MIT)
              // -------------------------------------------------------
              // The reference editor stores `initScaleX/Y, initLocalPos,
              // initWorldTx, initWidth/Height` on the sprite via setData
              // at dragstart, then derives the new scale per axis from
              // (localPos - initLocalPos) / width * initScale at drag
              // time. We mirror that exact math here — the local-space
              // delta approach handles rotation, origin and parent
              // transforms correctly, which a naïve distance-from-center
              // implementation does not.
              this.input.on(
                'dragstart',
                (
                  pointer: import('phaser').Input.Pointer,
                  go: import('phaser').GameObjects.GameObject,
                ) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const name = (go as any).name as string | undefined;

                  // Rotate handle dragstart — port of
                  // PhaserEditor2D-v3 RotateToolItem.onStartDrag (MIT).
                  // Captures the initial cursor pos + the target's
                  // current angle. onDrag computes the delta via
                  // angleBetweenTwoPointsWithFixedPoint.
                  if (name === ROTATE_HANDLE_NAME) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const target = (this as any).__pixlSelectedTarget;
                    if (!target) return;
                    target.setData('__pixl_rotate_init', {
                      initCursorX: pointer.worldX,
                      initCursorY: pointer.worldY,
                      // Phaser exposes both `angle` (degrees) and
                      // `rotation` (radians); the reference uses angle.
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      initAngle: (target as any).angle ?? 0,
                    });
                    return;
                  }

                  if (!name || !(HANDLE_NAMES as readonly string[]).includes(name)) {
                    return;
                  }
                  // Stash init state on the SELECTED target so onDrag can
                  // compute the additive delta. Mirrors the reference
                  // ScaleToolItem.onStartDrag pattern.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const target = (this as any).__pixlSelectedTarget;
                  if (!target?.getWorldTransformMatrix) return;
                  const worldTx = new Phaser.GameObjects.Components.TransformMatrix();
                  target.getWorldTransformMatrix(worldTx);
                  const initLocalPos = new Phaser.Math.Vector2();
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const handle = go as any;
                  worldTx.applyInverse(handle.x, handle.y, initLocalPos);
                  // displayWidth = width * scaleX, so "unit width at
                  // scale=1" = displayWidth / scaleX.
                  const sx0 = target.scaleX ?? 1;
                  const sy0 = target.scaleY ?? 1;
                  const w0 = (target.displayWidth ?? target.width ?? 1) / (sx0 || 1);
                  const h0 = (target.displayHeight ?? target.height ?? 1) / (sy0 || 1);
                  target.setData('__pixl_scale_init', {
                    initScaleX: sx0,
                    initScaleY: sy0,
                    initLocalPosX: initLocalPos.x,
                    initLocalPosY: initLocalPos.y,
                    initWorldTx: worldTx,
                    initWidth: Math.max(1, Math.abs(w0)),
                    initHeight: Math.max(1, Math.abs(h0)),
                    handleName: name,
                  });
                },
              );
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
                  const isRotateHandle = go.name === ROTATE_HANDLE_NAME;

                  // Rotate handle drag — ported from PhaserEditor2D-v3
                  // RotateToolItem.onDrag (MIT). The reference computes
                  // the radians swept around the object center between
                  // the init cursor and the current cursor, then adds
                  // that to the initial angle.
                  if (isRotateHandle) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const target = (this as any).__pixlSelectedTarget;
                    if (!target?.getData) return;
                    const init = target.getData('__pixl_rotate_init') as
                      | { initCursorX: number; initCursorY: number; initAngle: number }
                      | undefined;
                    if (!init) return;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const pixlId = (target as any).getData?.('pixlId') as string | undefined;
                    if (!pixlId) return;
                    // Object center = where the rotation pivots. Use the
                    // gameobject's x/y (Phaser sprites pivot at their
                    // origin which defaults to center for Image/Sprite).
                    const cx = target.x;
                    const cy = target.y;
                    // dragX/dragY are the HANDLE's new position. The
                    // reference uses raw cursor (args.x, args.y) which
                    // matches because the handle is dragged on the cursor.
                    const angle1 = Math.atan2(dragY - cy, dragX - cx);
                    const angle2 = Math.atan2(init.initCursorY - cy, init.initCursorX - cx);
                    const deltaRadians = angle1 - angle2;
                    const deltaAngle = Phaser.Math.RadToDeg(deltaRadians);
                    const newAngle = init.initAngle + deltaAngle;
                    target.angle = newAngle;
                    // Redraw outline + propagate to store. Use rotation
                    // tuple [x, y, z] where z is radians (matches the
                    // editorStore's 3D-shaped rotation type).
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (this as any).__pixlRedrawOutline?.(pixlId);
                    const store = useEditorStore.getState();
                    store.updateObject(pixlId, {
                      rotation: [0, 0, Phaser.Math.DegToRad(newAngle)],
                    } as Parameters<typeof store.updateObject>[1]);
                    return;
                  }

                  if (isHandle) {
                    // -----------------------------------------------
                    // Scale drag — ported from PhaserEditor2D-v3
                    // ScaleToolItem.onDrag (MIT). See the dragstart
                    // handler above for the init-state stash.
                    // -----------------------------------------------
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const target = (this as any).__pixlSelectedTarget as
                      | (import('phaser').GameObjects.GameObject & {
                          scaleX?: number; scaleY?: number;
                          flipX?: boolean; flipY?: boolean;
                          getData?: (key: string) => unknown;
                          setScale?: (x: number, y: number) => void;
                        })
                      | undefined;
                    if (!target?.getData) return;
                    const init = target.getData('__pixl_scale_init') as
                      | {
                          initScaleX: number; initScaleY: number;
                          initLocalPosX: number; initLocalPosY: number;
                          initWorldTx: import('phaser').GameObjects.Components.TransformMatrix;
                          initWidth: number; initHeight: number;
                          handleName: string;
                        }
                      | undefined;
                    if (!init) return;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const pixlId = (target as any).getData?.('pixlId') as string | undefined;
                    if (!pixlId) return;

                    // Pointer (handle's new position) → local-space via
                    // the WORLD transform captured at dragstart. This is
                    // the move that fixes rotation/origin/zoom — a naive
                    // distance-from-center calc misses those.
                    const localPos = new Phaser.Math.Vector2();
                    init.initWorldTx.applyInverse(dragX, dragY, localPos);

                    const flipX = target.flipX ? -1 : 1;
                    const flipY = target.flipY ? -1 : 1;
                    const dx = (localPos.x - init.initLocalPosX) * flipX;
                    const dy = (localPos.y - init.initLocalPosY) * flipY;

                    // Each handle controls scale signed by its corner:
                    // dragging NW outward (toward -x,-y) and SE outward
                    // (toward +x,+y) both grow the box.
                    const signX = (init.handleName === '__pixl_handle_ne' || init.handleName === '__pixl_handle_se') ? 1 : -1;
                    const signY = (init.handleName === '__pixl_handle_sw' || init.handleName === '__pixl_handle_se') ? 1 : -1;

                    const scaleDX = (dx * signX) / init.initWidth * init.initScaleX;
                    const scaleDY = (dy * signY) / init.initHeight * init.initScaleY;

                    let newScaleX = init.initScaleX + scaleDX;
                    let newScaleY = init.initScaleY + scaleDY;

                    // Shift = uniform scale (matches PhaserEditor2D-v3
                    // shiftKey branch for the SE diagonal handle).
                    const shiftKey =
                      this.input.keyboard?.checkDown(
                        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
                        0,
                      ) ?? false;
                    if (shiftKey) {
                      const u = Math.max(Math.abs(newScaleX), Math.abs(newScaleY));
                      newScaleX = Math.sign(newScaleX || 1) * u;
                      newScaleY = Math.sign(newScaleY || 1) * u;
                    }

                    if (typeof target.setScale === 'function') {
                      target.setScale(newScaleX, newScaleY);
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (this as any).__pixlRedrawOutline?.(pixlId);
                    const store = useEditorStore.getState();
                    store.updateObject(pixlId, {
                      scale: [newScaleX, newScaleY, 1],
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
        //
        // We ALSO mirror the play state onto the keyboard plugin here
        // because the useEffect runs in a separate microtask and may not
        // catch the initial state before the runtime script's tick fires
        // its first poll. Verified live: with only the useEffect, the
        // Magic Battleground script moved the player 120px on a held W
        // key during edit mode because the keyboard plugin was still
        // enabled at boot.
        try {
          const sceneRef = gameRef.current.scene.scenes[0] as import('phaser').Scene | undefined;
          const playing = useRuntimeGameStore.getState().isPlaying;
          if (sceneRef && !playing) {
            sceneRef.scene.pause();
          }
          if (sceneRef?.input?.keyboard) {
            sceneRef.input.keyboard.enabled = playing;
            try {
              if (!playing) sceneRef.input.keyboard.clearCaptures();
            } catch { /* depends on Phaser version */ }
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
      //
      // IMPORTANT: skip our internal transform handles (`__pixl_*`). They
      // are set draggable=true at scene `create()` time so the user can
      // grab the scale corners and rotate dot. Without this guard, the
      // for-loop below disabled them on every selection change because
      // they have no `pixlId` — which is why Rotate + Scale visually
      // appeared but did nothing on mouse drag. Found by:
      //   __pixlRotateHandle.input.draggable === false
      // even though rotation worked when emitted via scene.input.emit().
      for (const go of scene.children.list) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyGo = go as any;
        const goName = (anyGo.name ?? '') as string;
        if (goName.startsWith('__pixl_')) continue; // internal handle, leave its drag state alone
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

  // Round 3.5: keep the live scene in sync with the toolbar's
  // transformMode toggle. The scene caches the value via a custom
  // field so the redraw helper can read it without an extra React
  // subscription each tick. Trigger an outline redraw on change so
  // handles appear/disappear immediately.
  useEffect(() => {
    if (load.status !== 'ready') return;
    const game = gameRef.current;
    const scene = game?.scene?.scenes?.[0] as import('phaser').Scene | undefined;
    if (!scene) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (scene as any).__pixlTransformMode = transformMode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (scene as any).__pixlRedrawOutline?.(useEditorStore.getState().selectedObjectId);
  }, [transformMode, load.status]);

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
  //
  // ADDITIONAL: we also TOGGLE THE KEYBOARD PLUGIN in edit mode. The user
  // reported that selecting the HP bar and pressing arrow keys was moving
  // the Player Mage even while NOT in Play mode. Root cause was twofold:
  //   1. `scene.scene.pause()` only stops the update loop — Phaser's
  //      `keyboard.isDown` flags KEEP updating even on a paused scene,
  //      because the keyboard plugin lives at the input-manager level.
  //      Some boot/HMR paths also leave the scene `paused=false` despite
  //      `isPlaying=false` (observed live: active=true, paused=false).
  //   2. The Magic Battleground script polls `keys.W.isDown` and
  //      `cursors.left.isDown` in tick() — but the editor canvas had
  //      focus from clicking selection, so even a single tick from a
  //      stray frame moves the player one PLAYER_SPEED * dt step.
  // Disabling the keyboard plugin while !isPlaying makes every key's
  // isDown stay false → poll-based input in scripts becomes a no-op.
  // Also releases keyboard capture so the editor's React-level handlers
  // (e.g. useEditorArrowNudge) can own arrow keys without fighting
  // Phaser's preventDefault.
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
      } else if (!isPlaying && !currentlyPaused) {
        sceneMgr.pause();
      }
      // Re-focus the canvas on EVERY play→true transition, regardless of
      // pause state. The previous version only did this inside the
      // `currentlyPaused` branch — but in practice the scene often shows
      // `paused: false` even in edit mode (Phaser scene-pause is finicky
      // around boot/HMR), so the focus call never fired and WASD went
      // to the Play button instead of the game canvas. User report:
      // "WASD não move".
      if (isPlaying) {
        try { game.canvas?.focus?.({ preventScroll: true }); } catch { /* noop */ }
      }
      // Keyboard plugin sync — INDEPENDENT of the pause state above so it
      // protects against the bug class even when pause didn't take.
      const kb = scene.input?.keyboard;
      if (kb) {
        kb.enabled = !!isPlaying;
        // Release the captured keys so the browser (and React) get them.
        if (isPlaying) {
          // Re-capture the game keys in play mode so the script can use
          // cursors/wasd without the page scrolling on arrow press.
          try {
            kb.addCapture([
              'UP', 'DOWN', 'LEFT', 'RIGHT',
              'W', 'A', 'S', 'D', 'SPACE',
            ]);
          } catch { /* depending on Phaser ver, may not exist */ }
        } else {
          try { kb.clearCaptures(); } catch { /* noop */ }
        }
      }
      // Same idea for the pointer system: in edit mode the script
      // shouldn't fire its onGameInput pointerdown (cast spell, etc.).
      // The script wraps its own listener with isPlaying — but if the
      // user re-binds raw `scene.input.on('pointerdown', ...)`, this
      // would still leak. Leaving pointer enabled (so click-to-select
      // works) but the script's wrap covers gameplay.
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
