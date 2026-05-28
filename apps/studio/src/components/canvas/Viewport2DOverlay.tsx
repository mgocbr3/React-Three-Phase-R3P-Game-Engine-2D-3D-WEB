import { useEffect, useRef, useState, type RefObject } from 'react';

import { formatPointerPosition, getViewportRulerTicks } from './phaserRuler';

type CameraLike = { scrollX: number; scrollY: number; zoom: number };
type SceneLike = { cameras?: { main?: CameraLike }; input?: { activePointer?: { worldX?: number; worldY?: number } } };
type PhaserGameLike = { scene?: { scenes?: SceneLike[] } };

const RULER = 20;
const STEP = 64;
const LABEL_EVERY = 4;

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

const drawAxis = (canvas: HTMLCanvasElement, scroll: number, zoom: number, vertical = false) => {
  const { ctx, width, height } = fitCanvas(canvas);
  if (!ctx) return;
  ctx.fillStyle = '#bdbdbd';
  ctx.strokeStyle = '#787878';
  ctx.font = '10px Noto Sans Mono, monospace';
  ctx.textBaseline = 'top';
  for (const tick of getViewportRulerTicks(scroll, vertical ? height : width, zoom, STEP, LABEL_EVERY)) {
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(RULER, tick.screen);
      ctx.lineTo(RULER - (tick.labeled ? 9 : 5), tick.screen);
      ctx.stroke();
      if (tick.labeled) ctx.fillText(String(tick.world), 2, tick.screen + 2);
    } else {
      ctx.moveTo(tick.screen, RULER);
      ctx.lineTo(tick.screen, RULER - (tick.labeled ? 9 : 5));
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
  const topRef = useRef<HTMLCanvasElement | null>(null);
  const leftRef = useRef<HTMLCanvasElement | null>(null);
  const lastPositionRef = useRef('');
  const [position, setPosition] = useState('X 0  Y 0');

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const scene = visible ? gameRef.current?.scene?.scenes?.[0] : null;
      const camera = scene?.cameras?.main;
      if (camera && topRef.current && leftRef.current) {
        drawAxis(topRef.current, camera.scrollX, camera.zoom);
        drawAxis(leftRef.current, camera.scrollY, camera.zoom, true);
        const pointer = scene.input?.activePointer;
        if (typeof pointer?.worldX === 'number' && typeof pointer.worldY === 'number') {
          const next = formatPointerPosition(pointer.worldX, pointer.worldY);
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
      <div className="absolute left-0 top-0 h-5 w-5 border-b border-r border-[#1f1f1f] bg-[#2b2b2b]" />
      <canvas
        ref={topRef}
        data-testid="viewport-2d-ruler-top"
        className="absolute left-5 right-0 top-0 h-5 border-b border-[#1f1f1f] bg-[#2b2b2b]"
      />
      <canvas
        ref={leftRef}
        data-testid="viewport-2d-ruler-left"
        className="absolute bottom-0 left-0 top-5 w-5 border-r border-[#1f1f1f] bg-[#2b2b2b]"
      />
      <div
        data-testid="viewport-2d-position"
        className="absolute bottom-2 left-7 border border-black/70 bg-[#202020]/90 px-2 py-1 font-mono text-[10px] text-[#d8d8d8]"
      >
        {position}
      </div>
    </div>
  );
};
