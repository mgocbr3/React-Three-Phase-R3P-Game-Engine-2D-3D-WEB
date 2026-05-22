// Adapted from tools/vendor/three-game-engine/src/components/ModelComponent.ts
// (MIT, WesUnwin/three-game-engine).

import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import Component, { type ComponentJSON } from '../Component.js';
import GLTFAsset from '../assets/GLTFAsset.js';
import { setObject3DProps } from '../util/ThreeJSHelpers.js';
import type { Vector3Data } from '../types.js';

export interface ModelComponentJSON extends ComponentJSON {
  assetPath: string;
  position?: Vector3Data;
}

class ModelComponent extends Component {
  async load(): Promise<void> {
    const json = this.jsonData as ModelComponentJSON;
    const scene = this.gameObject.getScene();
    const asset = await scene.game.loadAsset(json.assetPath);
    if (!(asset instanceof GLTFAsset) || !asset.data) {
      throw new Error(`ModelComponent: asset found at ${json.assetPath} in AssetStore should be a loaded GLTFAsset`);
    }
    const clonedScene = clone(asset.data.scene);
    clonedScene.children.forEach((object3D) => {
      const objectProps = { ...(this.jsonData as Record<string, unknown>) };
      delete (objectProps as { assetPath?: unknown }).assetPath;
      delete (objectProps as { type?: unknown }).type;
      delete (objectProps as { name?: unknown }).name;
      setObject3DProps(object3D, objectProps);
      object3D.userData.model = true;
      this.gameObject.threeJSGroup.add(object3D);
    });
  }
}

export default ModelComponent;
