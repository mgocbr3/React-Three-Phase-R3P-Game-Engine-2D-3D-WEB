import * as THREE from 'three';

import Component, { type ComponentJSON, type ComponentTickContext } from '../Component.js';
import GLTFAsset from '../assets/GLTFAsset.js';

export interface AnimationComponentJSON extends ComponentJSON {
  assetPath: string;
  clip?: string;
  movementClips?: Partial<Record<'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'crouch' | 'crouchWalk', string>>;
  driveByController?: boolean;
  crossFadeDuration?: number;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  paused?: boolean;
}

interface LocomotionState {
  moving?: boolean;
  sprinting?: boolean;
  crouching?: boolean;
  grounded?: boolean;
  jumping?: boolean;
  speed?: number;
  verticalVelocity?: number;
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
  private clips: THREE.AnimationClip[] = [];

  async load(): Promise<void> {
    const json = this.jsonData as AnimationComponentJSON;
    const asset = await this.gameObject.getScene().game.loadAsset(json.assetPath);
    if (!(asset instanceof GLTFAsset) || !asset.data) {
      throw new Error(`AnimationComponent: asset found at ${json.assetPath} must be a loaded GLTFAsset`);
    }

    this.clips = asset.data.animations ?? [];
    const clip = findClip(this.clips, json.clip);

    this.mixer = new THREE.AnimationMixer(this.gameObject.threeJSGroup);
    if (clip && json.autoPlay !== false) this.playClip(clip.name, 0);
  }

  private selectLocomotionClip(state: LocomotionState): string {
    const map = {
      idle: 'idle',
      walk: 'walk',
      run: 'run',
      jump: 'jump',
      fall: 'jump',
      crouch: 'sneak_pose',
      crouchWalk: 'sneak_pose',
      ...((this.jsonData as AnimationComponentJSON).movementClips ?? {}),
    };
    if (state.jumping || state.grounded === false) {
      return state.verticalVelocity !== undefined && state.verticalVelocity < -0.1 ? map.fall : map.jump;
    }
    if (state.crouching) return state.moving ? map.crouchWalk : map.crouch;
    if (state.moving) return state.sprinting ? map.run : map.walk;
    return map.idle;
  }

  playClip(name: string | undefined, fadeDuration?: number): void {
    if (!this.mixer || !name) return;
    const json = this.jsonData as AnimationComponentJSON;
    const clip = findClip(this.clips, name);
    if (!clip || this.currentClipName === clip.name) return;

    const nextAction = this.mixer.clipAction(clip);
    nextAction.reset();
    nextAction.setEffectiveTimeScale(typeof json.speed === 'number' ? json.speed : 1);
    nextAction.setEffectiveWeight(1);
    nextAction.setLoop(json.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    nextAction.clampWhenFinished = json.loop === false;

    const fade = typeof fadeDuration === 'number' ? fadeDuration : (json.crossFadeDuration ?? 0.15);
    if (this.action) {
      if (fade > 0) {
        this.action.fadeOut(fade);
        nextAction.fadeIn(fade);
      } else {
        this.action.stop();
      }
    }
    nextAction.play();
    this.action = nextAction;
    this.currentClipName = clip.name;
  }

  beforeRender(ctx: ComponentTickContext): void {
    const json = this.jsonData as AnimationComponentJSON;
    if (json.paused) return;
    const state = this.gameObject.threeJSGroup.userData.pixlLocomotionState as LocomotionState | undefined;
    if (json.driveByController !== false && state) {
      this.playClip(this.selectLocomotionClip(state));
    }
    this.mixer?.update(ctx.deltaTimeInSec);
  }

  unload(): void {
    this.mixer?.stopAllAction();
    if (this.mixer) this.mixer.uncacheRoot(this.gameObject.threeJSGroup);
    this.action = null;
    this.mixer = null;
    this.currentClipName = null;
    this.clips = [];
  }

  getCurrentClipName(): string | null {
    return this.currentClipName;
  }
}

export default AnimationComponent;
