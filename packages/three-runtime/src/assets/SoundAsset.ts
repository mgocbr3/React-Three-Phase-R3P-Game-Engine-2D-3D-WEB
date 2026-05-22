// Adapted from tools/vendor/three-game-engine/src/assets/SoundAsset.ts
// (MIT, WesUnwin/three-game-engine).

import * as THREE from 'three';

import Asset from './Asset.js';

class SoundAsset extends Asset<AudioBuffer> {
  async load(): Promise<void> {
    const fullURL = await this.getFullURL();
    const loader = new THREE.AudioLoader();
    this.data = await new Promise<AudioBuffer>((resolve, reject) => {
      loader.load(
        fullURL,
        (buffer) => resolve(buffer),
        undefined,
        (error) => reject(error),
      );
    });
  }
}

export default SoundAsset;
