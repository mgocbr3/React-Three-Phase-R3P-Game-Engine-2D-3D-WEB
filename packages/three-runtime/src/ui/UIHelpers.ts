// Adapted from tools/vendor/three-game-engine/src/ui/UIHelpers.ts
// (MIT, WesUnwin/three-game-engine). three-mesh-ui is loaded lazily.

import * as THREE from 'three';

import type AssetStore from '../assets/AssetStore.js';

const MESH_UI_ATTRIBUTE_NAMES = [
  'offset', 'width', 'height',
  'fontSize', 'fontKerning', 'fontColor', 'fontOpacity', 'fontSupersampling', 'fontFamily', 'fontTexture',
  'padding', 'margin',
  'contentDirection', 'justifyContent', 'alignItems',
  'interline', 'hiddenOverflow',
  'bestFit',
  'backgroundColor', 'backgroundOpacity', 'backgroundTexture', 'backgroundSize',
  'borderRadius', 'borderWidth', 'borderColor',
  'content',
  'letterSpacing',
  'textAlign',
  'whitespace',
  'breakOn',
] as const;

let threeMeshUICache: Record<string, unknown> | null = null;

const loadThreeMeshUI = async (): Promise<Record<string, unknown>> => {
  if (threeMeshUICache) return threeMeshUICache;
  const importer = new Function('specifier', 'return import(specifier);') as (specifier: string) => Promise<unknown>;
  const mod = await importer('three-mesh-ui') as Record<string, unknown>;
  threeMeshUICache = mod;
  return mod;
};

export interface UserInterfaceJSON {
  type: 'Text' | 'Block' | 'InlineBlock' | 'Keyboard';
  children?: UserInterfaceJSON[];
  [key: string]: unknown;
}

export const createUIComponent = async (
  userInterfaceJSON: UserInterfaceJSON,
  parentObject3D: THREE.Object3D,
  assetStore: AssetStore,
): Promise<void> => {
  const ThreeMeshUI = await loadThreeMeshUI();
  const { type, children, ...attributes } = userInterfaceJSON;

  const meshUIAttributes: Record<string, unknown> = {};
  const object3DAttributes: Record<string, unknown> = {};
  Object.keys(attributes).forEach((attr) => {
    if (MESH_UI_ATTRIBUTE_NAMES.includes(attr as never)) meshUIAttributes[attr] = attributes[attr];
    else object3DAttributes[attr] = attributes[attr];
  });

  if (typeof meshUIAttributes.fontFamily === 'string') {
    const fontFamilyAsset = await assetStore.load(meshUIAttributes.fontFamily);
    meshUIAttributes.fontFamily = fontFamilyAsset.data;
  }

  if (typeof meshUIAttributes.fontTexture === 'string' && !meshUIAttributes.fontTexture.includes('://')) {
    const fontTextureAsset = await assetStore.load(meshUIAttributes.fontTexture);
    meshUIAttributes.fontTexture = await fontTextureAsset.getFullURL();
  }

  const Klass = ThreeMeshUI[type] as (new (attrs: Record<string, unknown>) => THREE.Object3D) | undefined;
  if (!Klass) {
    throw new Error(`createUIComponent: invalid component type: ${type}`);
  }

  const component = new Klass(meshUIAttributes);
  Object.keys(object3DAttributes).forEach((attr) => {
    (component as unknown as Record<string, unknown>)[attr] = object3DAttributes[attr];
  });

  if (!component.name) component.name = `mesh-ui-${type.toLowerCase()}`;
  parentObject3D.add(component);

  for (const child of children ?? []) {
    await createUIComponent(child, component, assetStore);
  }
};

export const updateThreeMeshUI = async (): Promise<void> => {
  const ThreeMeshUI = await loadThreeMeshUI();
  const update = ThreeMeshUI.update as (() => void) | undefined;
  update?.();
};

export const updateThreeMeshUIIfLoaded = (): void => {
  if (!threeMeshUICache) return;
  const update = threeMeshUICache.update as (() => void) | undefined;
  update?.();
};
