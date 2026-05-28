export const getRulerMarks = (halfSize: number, step: number): number[] => {
  const marks: number[] = [];
  for (let value = -halfSize; value <= halfSize; value += step) marks.push(value);
  return marks;
};

export const formatRulerMark = (value: number): string => String(value);

export interface ViewportRulerTick {
  screen: number;
  world: number;
  labeled: boolean;
}

export interface ViewportGridLine {
  screen: number;
  world: number;
  major: boolean;
}

export interface ViewportWorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FittableViewportCamera {
  setScroll: (x: number, y: number) => void;
  setZoom: (zoom: number) => void;
}

export interface Editor2DObjectLike {
  type: string;
  position: number[];
  scale?: number[];
  visible?: boolean;
  name?: string;
  data?: Record<string, unknown>;
}

const num = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const mergeBounds = (a: ViewportWorldBounds, b: ViewportWorldBounds): ViewportWorldBounds => ({
  minX: Math.min(a.minX, b.minX),
  minY: Math.min(a.minY, b.minY),
  maxX: Math.max(a.maxX, b.maxX),
  maxY: Math.max(a.maxY, b.maxY),
});

export const getViewportRulerTicks = (
  scroll: number,
  viewportSize: number,
  zoom: number,
  step: number,
  labelEvery: number,
): ViewportRulerTick[] => {
  const ticks: ViewportRulerTick[] = [];
  const stepPx = step * zoom;
  if (stepPx <= 4) return ticks;
  const firstWorld = Math.floor(scroll / step) * step;
  for (let world = firstWorld; (world - scroll) * zoom < viewportSize + stepPx; world += step) {
    ticks.push({
      screen: Math.round((world - scroll) * zoom),
      world,
      labeled: world % (step * labelEvery) === 0,
    });
  }
  return ticks;
};

export const getViewportGridLines = (
  scroll: number,
  viewportSize: number,
  zoom: number,
  step: number,
  majorEvery: number,
): ViewportGridLine[] => {
  const lines: ViewportGridLine[] = [];
  const stepPx = step * zoom;
  if (stepPx <= 3) return lines;
  const firstWorld = Math.floor(scroll / step) * step;
  for (let world = firstWorld; (world - scroll) * zoom < viewportSize + stepPx; world += step) {
    lines.push({
      screen: Math.round((world - scroll) * zoom),
      world,
      major: world % (step * majorEvery) === 0,
    });
  }
  return lines;
};

export const getEditorZoom = (current: number, deltaY: number): number => {
  if (deltaY === 0) return current;
  const next = current * (deltaY < 0 ? 1.1 : 0.9);
  return Math.min(4, Math.max(0.25, Number(next.toFixed(2))));
};

export const getZoomedScroll = (
  scroll: number,
  pointerScreen: number,
  currentZoom: number,
  nextZoom: number,
): number => scroll + pointerScreen / currentZoom - pointerScreen / nextZoom;

export const getWheelZoomCamera = (
  camera: { scrollX: number; scrollY: number; zoom: number },
  pointer: { x: number; y: number },
  deltaY: number,
) => {
  const zoom = getEditorZoom(camera.zoom, deltaY);
  return {
    scrollX: Number(getZoomedScroll(camera.scrollX, pointer.x, camera.zoom, zoom).toFixed(2)),
    scrollY: Number(getZoomedScroll(camera.scrollY, pointer.y, camera.zoom, zoom).toFixed(2)),
    zoom,
  };
};

export const getFittedViewportCamera = (
  bounds: ViewportWorldBounds,
  viewport: { width: number; height: number },
  padding = 96,
): { scrollX: number; scrollY: number; zoom: number } => {
  const contentW = Math.max(1, bounds.maxX - bounds.minX);
  const contentH = Math.max(1, bounds.maxY - bounds.minY);
  const viewW = Math.max(1, viewport.width);
  const viewH = Math.max(1, viewport.height);
  const zoom = Number(Math.min(4, Math.max(0.25, Math.min(
    Math.max(1, viewW - padding * 2) / contentW,
    Math.max(1, viewH - padding * 2) / contentH,
  ))).toFixed(2));
  const cx = bounds.minX + contentW / 2;
  const cy = bounds.minY + contentH / 2;
  return {
    scrollX: Number((cx - viewW / (zoom * 2)).toFixed(2)),
    scrollY: Number((cy - viewH / (zoom * 2)).toFixed(2)),
    zoom,
  };
};

export const setFittedViewportCamera = (
  camera: FittableViewportCamera,
  bounds: ViewportWorldBounds,
  viewport: { width: number; height: number },
  padding = 96,
) => {
  const fit = getFittedViewportCamera(bounds, viewport, padding);
  camera.setZoom(fit.zoom);
  camera.setScroll(fit.scrollX, fit.scrollY);
  return fit;
};

export const getEditorObjectBounds = (object: Editor2DObjectLike): ViewportWorldBounds | null => {
  if (object.visible === false) return null;
  const [x = 0, y = 0] = object.position;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const data = object.data ?? {};
  const sx = Math.abs(object.scale?.[0] || 1);
  const sy = Math.abs(object.scale?.[1] || object.scale?.[2] || object.scale?.[0] || 1);
  const mult = Math.abs(num(data.scale, 1));
  let w = 32 * sx;
  let h = 32 * sy;
  if (object.type === 'rectangle') [w, h] = [num(data.width, 40) * sx, num(data.height, 40) * sy];
  else if (object.type === 'circle') w = h = num(data.radius, 20) * 2 * Math.max(sx, sy);
  else if (object.type === 'text') {
    const font = num(data.fontSize, 16);
    w = Math.max(24, String(data.text ?? object.name ?? '').length * font * 0.62 * sx);
    h = Math.max(16, font * 1.3 * sy);
  } else if (object.type === 'image' || object.type === 'sprite') {
    w = num(data.displayWidth, num(data.frameWidth, 64)) * sx * mult;
    h = num(data.displayHeight, num(data.frameHeight, 64)) * sy * mult;
  }
  return { minX: x - w / 2, minY: y - h / 2, maxX: x + w / 2, maxY: y + h / 2 };
};

export const getEditorSceneBounds = (objects: Editor2DObjectLike[]): ViewportWorldBounds | null => (
  objects.reduce<ViewportWorldBounds | null>((bounds, object) => {
    const next = getEditorObjectBounds(object);
    return next ? (bounds ? mergeBounds(bounds, next) : next) : bounds;
  }, null)
);

export const getEditorSceneFit = (
  objects: Editor2DObjectLike[],
  viewport: { width: number; height: number },
  cameraFrame: { width: number; height: number },
  padding = 96,
) => {
  const frame = { minX: 0, minY: 0, maxX: cameraFrame.width, maxY: cameraFrame.height };
  const bounds = getEditorSceneBounds(objects);
  return getFittedViewportCamera(bounds ? mergeBounds(frame, bounds) : frame, viewport, padding);
};

export const formatPointerPosition = (x: number, y: number): string => (
  `X ${Math.round(x)}  Y ${Math.round(y)}`
);
