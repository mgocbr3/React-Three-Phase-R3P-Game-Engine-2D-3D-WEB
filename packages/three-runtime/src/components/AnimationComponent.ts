import * as THREE from 'three';

import Component, { type ComponentJSON, type ComponentTickContext } from '../Component.js';
import GLTFAsset from '../assets/GLTFAsset.js';

export interface AnimationComponentJSON extends ComponentJSON {
  assetPath: string;
  clip?: string;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  paused?: boolean;
}

const findClip = (clips: THREE.AnimationClip[], name?: string): THREE.AnimationClip | null => {
  if (!clips.length) return null;
  const wanted = name?.trim().toLowerCase();
  if (!wanted) return clips[0];
  return clips.find((clip) => clip.name.toLowerCase() === wanted)
    ?? clips.find((clip) => clip.name.toLowerCase().includes(wanted))
    ?? clips.find((clip) => clip.name.toLowerCase().includes('idle'))
    ?? clips[0];
};

class AnimationComponent extends Component {
  private mixer: THREE.AnimationMixer | null = null;
  private action: THREE.AnimationAction | null = null;
  private currentClipName: string | null = null;

  async load(): Promise<void> {
    const json = this.jsonData as AnimationComponentJSON;
    const asset = await this.gameObject.getScene().game.loadAsset(json.assetPath);
    if (!(asset instanceof GLTFAsset) || !asset.data) {
      throw new Error(`AnimationComponent: asset found at ${json.assetPath} must be a loaded GLTFAsset`);
    }

    const clip = findClip(asset.data.animations ?? [], json.clip);
    if (!clip) return;

    this.mixer = new THREE.AnimationMixer(this.gameObject.threeJSGroup);
    this.action = this.mixer.clipAction(clip);
    this.currentClipName = clip.name;
    this.action.setEffectiveTimeScale(typeof json.speed === 'number' ? json.speed : 1);
    this.action.setLoop(json.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    if (json.autoPlay !== false) this.action.play();
  }

  beforeRender(ctx: ComponentTickContext): void {
    if ((this.jsonData as AnimationComponentJSON).paused) return;
    this.mixer?.update(ctx.deltaTimeInSec);
  }

  unload(): void {
    this.mixer?.stopAllAction();
    if (this.mixer) this.mixer.uncacheRoot(this.gameObject.threeJSGroup);
    this.action = null;
    this.mixer = null;
    this.currentClipName = null;
  }

  getCurrentClipName(): string | null {
    return this.currentClipName;
  }
}

export default AnimationComponent;
