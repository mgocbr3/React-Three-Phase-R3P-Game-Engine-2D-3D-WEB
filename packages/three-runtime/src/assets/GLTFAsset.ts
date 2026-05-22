// Adapted from tools/vendor/three-game-engine/src/assets/GLTFAsset.ts
// (MIT, WesUnwin/three-game-engine). Loads via the standard
// `three/examples/jsm/loaders/GLTFLoader.js`. DRACO support optional.

import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

import Asset from './Asset.js';
import type { DracoLoaderOptions } from '../types.js';

class GLTFAsset extends Asset<GLTF> {
  // As recommended by Three.js, create one DRACOLoader and reuse it.
  private static _dracoLoader: DRACOLoader | null = null;

  static getDracoLoader(options: DracoLoaderOptions): DRACOLoader {
    if (!GLTFAsset._dracoLoader) {
      const loader = new DRACOLoader();
      loader.setDecoderPath(options.path);
      if (options.decoderConfig) {
        loader.setDecoderConfig(options.decoderConfig);
      }
      if (typeof options.workerLimit === 'number') {
        loader.setWorkerLimit(options.workerLimit);
      }
      GLTFAsset._dracoLoader = loader;
    }
    return GLTFAsset._dracoLoader;
  }

  async load(): Promise<void> {
    const loader = new GLTFLoader();

    const { dracoLoaderOptions } = this.assetStore.assetOptions;
    if (dracoLoaderOptions) {
      loader.setDRACOLoader(GLTFAsset.getDracoLoader(dracoLoaderOptions));
    }

    const fullURL = await this.getFullURL();
    this.data = await new Promise<GLTF>((resolve, reject) => {
      loader.load(
        fullURL,
        (gltf) => resolve(gltf),
        undefined,
        (error) => reject(error),
      );
    });
  }
}

export default GLTFAsset;
