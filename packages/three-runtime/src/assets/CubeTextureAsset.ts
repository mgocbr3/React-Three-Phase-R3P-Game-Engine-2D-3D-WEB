// Adapted from tools/vendor/three-game-engine/src/assets/CubeTextureAsset.ts
// (MIT, WesUnwin/three-game-engine).

import * as THREE from 'three';

import Asset from './Asset.js';

class CubeTextureAsset extends Asset<THREE.CubeTexture> {
  async load(): Promise<void> {
    const fullURL = await this.getFullURL();
    const loader = new THREE.CubeTextureLoader();
    this.data = await new Promise<THREE.CubeTexture>((resolve, reject) => {
      loader
        .setPath(fullURL)
        .load(
          ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'],
          (cube) => resolve(cube),
          undefined,
          (error) => reject(error),
        );
    });
  }

  unload(): void {
    this.data?.dispose();
  }
}

export default CubeTextureAsset;
