import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import Component, { type ComponentJSON } from '../Component.js';
import GLTFAsset from '../assets/GLTFAsset.js';
import { optimizeStaticObject3D, setObject3DProps } from '../util/ThreeJSHelpers.js';

export interface GltfNodeComponentJSON extends ComponentJSON {
  assetPath: string;
  nodeName: string;
  /** Optional fallback if nodeName lookup fails (used when source data is dirty). */
  nodeIndex?: number;
}

class GltfNodeComponent extends Component {
  async load(): Promise<void> {
    const json = this.jsonData as GltfNodeComponentJSON;
    const scene = this.gameObject.getScene();
    const asset = await scene.game.loadAsset(json.assetPath);
    if (!(asset instanceof GLTFAsset) || !asset.data) {
      throw new Error(
        `GltfNodeComponent: asset at ${json.assetPath} is not a loaded GLTFAsset`,
      );
    }
    const gltfScene = asset.data.scene;

    // Pixl projects sometimes carry "<name>" as the node identifier. Try
    // exact match first, fall back to a normalized comparison (lowercase,
    // strip non-alphanumerics) so trivial drift (Farm.glb vs farm.glb,
    // "ground 002.001" vs "ground_002_001") doesn't sink the object.
    let node = gltfScene.getObjectByName(json.nodeName) ?? null;
    if (!node && json.nodeName) {
      const wanted = normalize(json.nodeName);
      gltfScene.traverse((object) => {
        if (!node && normalize(object.name) === wanted) node = object;
      });
    }
    if (!node) {
      // Don't throw — log via console and continue with an empty group so
      // one bad node doesn't sink the whole scene of 11k+ objects.
      // eslint-disable-next-line no-console
      console.warn(`GltfNodeComponent: node "${json.nodeName}" not in ${json.assetPath}`);
      return;
    }

    const cloned = clone(node);
    // Reset cloned-node's local transform: the gameObject's threeJSGroup
    // already carries the editor's position/rotation/scale. The node's
    // original transform is part of the GLB authoring and shouldn't double-
    // apply on top of the editor transform.
    cloned.position.set(0, 0, 0);
    cloned.rotation.set(0, 0, 0);
    cloned.scale.set(1, 1, 1);

    const objectProps = { ...(this.jsonData as Record<string, unknown>) };
    delete (objectProps as { assetPath?: unknown }).assetPath;
    delete (objectProps as { nodeName?: unknown }).nodeName;
    delete (objectProps as { nodeIndex?: unknown }).nodeIndex;
    delete (objectProps as { type?: unknown }).type;
    delete (objectProps as { name?: unknown }).name;
    setObject3DProps(cloned, objectProps);
    optimizeStaticObject3D(cloned);

    cloned.userData.glbNodeRef = { url: json.assetPath, name: json.nodeName };
    this.gameObject.threeJSGroup.add(cloned);
    this.gameObject.threeJSGroup.updateMatrixWorld(true);
  }
}

const normalize = (value: string | undefined): string =>
  (value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();

export default GltfNodeComponent;
