import type { ObjectType, SceneKind } from '@/stores/editorStore';

export type AddMenuItem =
  | { kind: 'object'; objectType: ObjectType; label: string }
  | { kind: 'terrain'; label: string };

export interface AddMenuSection {
  label: string;
  items: AddMenuItem[];
}

type ViewportGameLike = {
  scene?: { scenes?: Array<{ cameras?: { main?: {
    width?: number;
    height?: number;
    getWorldPoint?: (x: number, y: number) => { x?: number; y?: number };
  } } }> };
};

const primitives3d: AddMenuItem[] = [
  { kind: 'object', objectType: 'box', label: 'Cube' },
  { kind: 'object', objectType: 'sphere', label: 'Sphere' },
  { kind: 'object', objectType: 'cylinder', label: 'Cylinder' },
  { kind: 'object', objectType: 'plane', label: 'Plane' },
];

const primitives2d: AddMenuItem[] = [
  { kind: 'object', objectType: 'rectangle', label: 'Square' },
  { kind: 'object', objectType: 'circle', label: 'Circle' },
  { kind: 'object', objectType: 'text', label: 'Text' },
  { kind: 'object', objectType: 'sprite', label: 'Sprite' },
];

const lights3d: AddMenuItem[] = [
  { kind: 'object', objectType: 'light', label: 'Point Light' },
  { kind: 'object', objectType: 'sunlight', label: 'Sun Light' },
  { kind: 'object', objectType: 'spotlight', label: 'Spot Light' },
];

export const getEditorAddMenuSections = (kind: SceneKind): AddMenuSection[] => (
  kind === '2d'
    ? [{ label: '2D Objects', items: primitives2d }]
    : [
      { label: 'Terrain', items: [{ kind: 'terrain', label: 'Terrain' }] },
      { label: 'Primitives', items: primitives3d },
      { label: 'Lights', items: lights3d },
    ]
);

export const getEditorAddObjectPosition = (
  kind: SceneKind,
  game: ViewportGameLike | null | undefined = typeof window === 'undefined'
    ? null
    : (window as Window & { __pixlPhaserGame?: ViewportGameLike }).__pixlPhaserGame,
): [number, number, number] | undefined => {
  if (kind !== '2d') return undefined;
  const camera = game?.scene?.scenes?.[0]?.cameras?.main;
  const width = camera?.width ?? 800;
  const height = camera?.height ?? 600;
  const point = camera?.getWorldPoint?.(width / 2, height / 2);
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return [400, 300, 0];
  return [Math.round(point.x as number), Math.round(point.y as number), 0];
};
