// Adapted from tools/vendor/three-game-engine/src/assets/Asset.ts
// (MIT, WesUnwin/three-game-engine). Bridged to @pixlland/engine-core's
// AssetSource instead of Wes' bespoke baseURL/dirHandle pair.

import type { AssetSource } from '@pixlland/engine-core';

import EventEmitter from '../util/EventEmitter.js';

import type AssetStore from './AssetStore.js';

abstract class Asset<TData = unknown> {
  assetStore: AssetStore;
  assetSource: AssetSource;
  path: string;
  data: TData | null;
  eventEmitter: EventEmitter;

  constructor(assetSource: AssetSource, path: string, assetStore: AssetStore) {
    this.assetSource = assetSource;
    this.assetStore = assetStore;
    this.path = path;
    this.data = null;
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Resolves the path to a fetchable URL — either the dev-server URL or an
   * `URL.createObjectURL(...)` minted from an OPFS handle. Cached by the
   * AssetSource implementation.
   */
  getFullURL(): Promise<string> {
    return this.assetSource.resolve(this.path);
  }

  abstract load(): Promise<void>;

  getData(): TData | null {
    return this.data;
  }

  /**
   * Allows changing an asset's data in memory without reloading from disk
   * (used by the editor when authoring a scene before saving).
   */
  setData(data: TData): void {
    this.data = data;
    this.eventEmitter.emit('change');
  }

  once(eventName: string, fn: (args: unknown) => void): void {
    this.eventEmitter.once(eventName, fn);
  }

  unload(): void {
    // Object URLs minted via AssetSource are released in AssetSource.unload();
    // override in subclass for additional disposal (e.g. THREE.Texture.dispose()).
  }
}

export default Asset;
