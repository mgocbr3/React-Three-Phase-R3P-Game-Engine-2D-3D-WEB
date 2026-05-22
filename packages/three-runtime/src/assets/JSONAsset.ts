// Pixlland-specific. Uses fetch + JSON.parse for portability across runtime
// (Node + browser). Wes' implementation goes through THREE.FileLoader.

import Asset from './Asset.js';

class JSONAsset<TData = unknown> extends Asset<TData> {
  async load(): Promise<void> {
    const text = await this.assetSource.readText(this.path);
    this.data = JSON.parse(text) as TData;
  }
}

export default JSONAsset;
