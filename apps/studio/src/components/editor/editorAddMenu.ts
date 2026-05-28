import type { ObjectType, SceneKind } from '@/stores/editorStore';

export type AddMenuItem =
  | { kind: 'object'; objectType: ObjectType; label: string }
  | { kind: 'terrain'; label: string };

export interface AddMenuSection {
  label: string;
  items: AddMenuItem[];
}

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
