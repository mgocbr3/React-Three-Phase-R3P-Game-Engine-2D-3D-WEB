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
            },
          },
        });
        // Phase 6B debug.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__pixlPhaserGame = gameRef.current;
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
