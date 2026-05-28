import { useEffect, useRef, useState, type RefObject } from 'react';

import { formatPointerPosition, getViewportGridLines, getViewportRulerTicks } from './phaserRuler';

type CameraLike = { scrollX: number; scrollY: number; zoom: number };
type SceneLike = { cameras?: { main?: CameraLike }; input?: { activePointer?: { worldX?: number; worldY?: number } } };
type PhaserGameLike = { scene?: { scenes?: SceneLike[] } };

const RULER = 30;
const TILE = 32;
const MAJOR_EVERY = 4;

const fitCanvas = (canvas: HTMLCanvasElement) => {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx?.clearRect(0, 0, width, height);
  return { ctx, width, height };
};

const drawGrid = (canvas: HTMLCanvasElement, camera: CameraLike) => {
  const { ctx, width, height } = fitCanvas(canvas);
  if (!ctx) return;
  const sx = camera.scrollX + RULER / camera.zoom;
  const sy = camera.scrollY + RULER / camera.zoom;
  const vertical = getViewportGridLines(sx, width, camera.zoom, TILE, MAJOR_EVERY);
  const horizontal = getViewportGridLines(sy, height, camera.zoom, TILE, MAJOR_EVERY);

  for (const line of vertical) {
    ctx.beginPath();
    ctx.strokeStyle = line.world === 0 ? 'rgba(210,210,210,.55)' : line.major ? 'rgba(190,190,190,.28)' : 'rgba(255,255,255,.1)';
    ctx.lineWidth = line.world === 0 ? 1.5 : 1;
    ctx.moveTo(line.screen + 0.5, 0);
    ctx.lineTo(line.screen + 0.5, height);
    ctx.stroke();
  }
  for (const line of horizontal) {
    ctx.beginPath();
    ctx.strokeStyle = line.world === 0 ? 'rgba(210,210,210,.55)' : line.major ? 'rgba(190,190,190,.28)' : 'rgba(255,255,255,.1)';
    ctx.lineWidth = line.world === 0 ? 1.5 : 1;
    ctx.moveTo(0, line.screen + 0.5);
    ctx.lineTo(width, line.screen + 0.5);
    ctx.stroke();
  }
};

const drawAxis = (canvas: HTMLCanvasElement, scroll: number, zoom: number, vertical = false) => {
  const { ctx, width, height } = fitCanvas(canvas);
  if (!ctx) return;
  ctx.fillStyle = '#c8c8c8';
  ctx.strokeStyle = '#787878';
  ctx.font = '10px Noto Sans Mono, monospace';
  ctx.textBaseline = 'top';
  for (const tick of getViewportRulerTicks(scroll, vertical ? height : width, zoom, TILE, MAJOR_EVERY)) {
    ctx.beginPath();
    ctx.strokeStyle = tick.world === 0 ? '#cfcfcf' : tick.labeled ? '#8f8f8f' : '#686868';
    if (vertical) {
      ctx.moveTo(RULER, tick.screen + 0.5);
      ctx.lineTo(RULER - (tick.labeled ? 12 : 6), tick.screen + 0.5);
      ctx.stroke();
      if (tick.labeled) ctx.fillText(String(tick.world), 2, tick.screen + 2);
    } else {
      ctx.moveTo(tick.screen + 0.5, RULER);
      ctx.lineTo(tick.screen + 0.5, RULER - (tick.labeled ? 12 : 6));
      ctx.stroke();
      if (tick.labeled) ctx.fillText(String(tick.world), tick.screen + 3, 2);
    }
  }
};

export const Viewport2DOverlay = ({
  gameRef,
  visible,
}: {
  gameRef: RefObject<PhaserGameLike | null>;
  visible: boolean;
}) => {
  const gridRef = useRef<HTMLCanvasElement | null>(null);
  const topRef = useRef<HTMLCanvasElement | null>(null);
  const leftRef = useRef<HTMLCanvasElement | null>(null);
  const lastPositionRef = useRef('');
  const [position, setPosition] = useState('X 0  Y 0');

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const scene = visible ? gameRef.current?.scene?.scenes?.[0] : null;
      const camera = scene?.cameras?.main;
      if (camera && gridRef.current && topRef.current && leftRef.current) {
        drawGrid(gridRef.current, camera);
        drawAxis(topRef.current, camera.scrollX + RULER / camera.zoom, camera.zoom);
        drawAxis(leftRef.current, camera.scrollY + RULER / camera.zoom, camera.zoom, true);
        const pointer = scene.input?.activePointer;
        if (typeof pointer?.worldX === 'number' && typeof pointer.worldY === 'number') {
          const next = `${formatPointerPosition(pointer.worldX, pointer.worldY)}  ${Math.round(camera.zoom * 100)}%`;
          if (next !== lastPositionRef.current) {
            lastPositionRef.current = next;
            setPosition(next);
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [gameRef, visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <canvas
        ref={gridRef}
        data-testid="viewport-2d-grid"
        style={{
          position: 'absolute',
          left: RULER,
          top: RULER,
          width: `calc(100% - ${RULER}px)`,
          height: `calc(100% - ${RULER}px)`,
        }}
      />
      <div
        className="absolute left-0 top-0 border-b border-r border-[#1f1f1f] bg-[#2b2b2b]"
        style={{ width: RULER, height: RULER }}
      />
      <canvas
        ref={topRef}
        data-testid="viewport-2d-ruler-top"
        className="absolute top-0 border-b border-[#1f1f1f] bg-[#2b2b2b]"
        style={{ left: RULER, width: `calc(100% - ${RULER}px)`, height: RULER }}
      />
      <canvas
        ref={leftRef}
        data-testid="viewport-2d-ruler-left"
        className="absolute left-0 border-r border-[#1f1f1f] bg-[#2b2b2b]"
        style={{ top: RULER, width: RULER, height: `calc(100% - ${RULER}px)` }}
      />
      <div
        data-testid="viewport-2d-position"
        className="absolute bottom-2 border border-black/70 bg-[#202020]/90 px-2 py-1 font-mono text-[10px] text-[#d8d8d8]"
        style={{ left: RULER + 8 }}
      >
        {position}
      </div>
    </div>
  );
};
