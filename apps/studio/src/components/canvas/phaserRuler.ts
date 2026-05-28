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

export const formatPointerPosition = (x: number, y: number): string => (
  `X ${Math.round(x)}  Y ${Math.round(y)}`
);
