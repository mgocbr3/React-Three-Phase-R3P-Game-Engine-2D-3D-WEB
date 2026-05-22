// Adapted from tools/vendor/three-game-engine/src/assets/TextureAsset.ts
// (MIT, WesUnwin/three-game-engine).

import * as THREE from 'three';

import Asset from './Asset.js';

class TextureAsset extends Asset<THREE.Texture> {
  async load(): Promise<void> {
    const fullURL = await this.getFullURL();
    const loader = new THREE.TextureLoader();
    this.data = await new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(
        fullURL,
        (texture) => resolve(texture),
        undefined,
        (error) => reject(error),
      );
    });
  }

  unload(): void {
    this.data?.dispose();
  }
}

export default TextureAsset;
