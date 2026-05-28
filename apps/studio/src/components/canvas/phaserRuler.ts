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

export const formatPointerPosition = (x: number, y: number): string => (
  `X ${Math.round(x)}  Y ${Math.round(y)}`
);
