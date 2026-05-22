// Adapted from tools/vendor/three-game-engine/src/assets/AssetStore.ts
// (MIT, WesUnwin/three-game-engine). The constructor now takes an
// @pixlland/engine-core AssetSource instead of a baseURL/dirHandle pair,
// so the same store backs both the dev-server path and an OPFS-unpacked
// .pixl package.

import type { AssetSource, AssetSourceInput } from '@pixlland/engine-core';
import { createAssetSource } from '@pixlland/engine-core';

import Asset from './Asset.js';
import GLTFAsset from './GLTFAsset.js';
import JSONAsset from './JSONAsset.js';
import SoundAsset from './SoundAsset.js';
import TextureAsset from './TextureAsset.js';
import type { AssetOptions } from '../types.js';

type AssetSubclass = new (
  source: AssetSource,
  path: string,
  store: AssetStore,
) => Asset;

const ASSET_TYPES: ReadonlyArray<{ subclass: AssetSubclass; extensions: string[] }> = [
  { subclass: GLTFAsset, extensions: ['.gltf', '.glb'] },
  { subclass: TextureAsset, extensions: ['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.ktx2', '.hdr'] },
  { subclass: SoundAsset, extensions: ['.wav', '.mp3', '.ogg'] },
  { subclass: JSONAsset, extensions: ['.json', '.pixlscene.json', '.pixlproject.json'] },
];

const hasExtension = (path: string, extensions: string[]): boolean => (
  extensions.some((ext) => path.toLowerCase().endsWith(ext))
);

class AssetStore {
  source: AssetSource;
  assetOptions: AssetOptions;
  loadedAssets: Map<string, Asset>;

  constructor(input: AssetSourceInput | AssetSource, assetOptions: AssetOptions = {}) {
    this.source = isAssetSource(input) ? input : createAssetSource(input);
    this.assetOptions = assetOptions;
    this.loadedAssets = new Map();
  }

  static getAssetSubclass(path: string): AssetSubclass {
    const match = ASSET_TYPES.find((entry) => hasExtension(path, entry.extensions));
    if (!match) {
      throw new Error(`AssetStore: unable to identify asset subclass for: ${path}`);
    }
    return match.subclass;
  }

  /**
   * Fetches and caches the asset at the given path.
   */
  async load(path: string): Promise<Asset> {
    const cached = this.loadedAssets.get(path);
    if (cached) return cached;

    const AssetSubclass = AssetStore.getAssetSubclass(path);
    const asset = new AssetSubclass(this.source, path, this);
    await asset.load();
    this.loadedAssets.set(path, asset);
    return asset;
  }

  get(path: string): Asset | undefined {
    return this.loadedAssets.get(path);
  }

  unload(path: string): void {
    const asset = this.loadedAssets.get(path);
    if (!asset) return;
    asset.unload();
    this.loadedAssets.delete(path);
  }

  unloadAll(): void {
    for (const path of [...this.loadedAssets.keys()]) {
      this.unload(path);
    }
    this.source.unload();
  }
}

const isAssetSource = (value: unknown): value is AssetSource => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AssetSource>;
  return typeof candidate.resolve === 'function'
    && typeof candidate.readBytes === 'function'
    && typeof candidate.readText === 'function';
};

export default AssetStore;
