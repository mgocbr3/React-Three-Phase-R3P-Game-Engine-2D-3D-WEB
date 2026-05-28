export const getRulerMarks = (halfSize: number, step: number): number[] => {
  const marks: number[] = [];
  for (let value = -halfSize; value <= halfSize; value += step) marks.push(value);
  return marks;
};

export const formatRulerMark = (value: number): string => String(value);
