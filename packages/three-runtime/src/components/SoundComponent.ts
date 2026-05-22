// Adapted from tools/vendor/three-game-engine/src/components/SoundComponent.ts
// (MIT, WesUnwin/three-game-engine).

import * as THREE from 'three';

import Component, { type ComponentJSON } from '../Component.js';
import SoundAsset from '../assets/SoundAsset.js';

export interface SoundComponentJSON extends ComponentJSON {
  assetPath: string;
  name: string;
  loop?: boolean;
  autoplay?: boolean;
  volume?: number;
  playbackRate?: number;
  refDistance?: number;
  rolloffFactor?: number;
  distanceModel?: DistanceModelType;
  maxDistance?: number;
  directionalCone?: {
    coneInnerAngle: number;
    coneOuterAngle: number;
    coneOuterGain: number;
  };
}

class SoundComponent extends Component {
  positionalAudio: THREE.PositionalAudio | null = null;

  async load(): Promise<void> {
    const json = this.jsonData as SoundComponentJSON;
    const scene = this.gameObject.getScene();
    const asset = await scene.game.loadAsset(json.assetPath);
    if (!(asset instanceof SoundAsset) || !asset.data) {
      throw new Error(`SoundComponent: asset at ${json.assetPath} must be a loaded SoundAsset`);
    }
    const audioListener = scene.game.renderer.getCameraAudioListener();
    const audio = new THREE.PositionalAudio(audioListener);
    audio.name = json.name || 'sound';
    audio.setBuffer(asset.data);

    if (typeof json.loop === 'boolean') audio.setLoop(json.loop);
    if (typeof json.autoplay === 'boolean') audio.autoplay = json.autoplay;
    if (typeof json.volume === 'number') audio.setVolume(json.volume);
    if (typeof json.playbackRate === 'number') audio.setPlaybackRate(json.playbackRate);
    if (typeof json.refDistance === 'number') audio.setRefDistance(json.refDistance);
    if (typeof json.rolloffFactor === 'number') audio.setRolloffFactor(json.rolloffFactor);
    if (typeof json.distanceModel === 'string') audio.setDistanceModel(json.distanceModel);
    if (typeof json.maxDistance === 'number') audio.setMaxDistance(json.maxDistance);
    if (json.directionalCone) {
      audio.setDirectionalCone(
        json.directionalCone.coneInnerAngle,
        json.directionalCone.coneOuterAngle,
        json.directionalCone.coneOuterGain,
      );
    }

    this.positionalAudio = audio;
    this.gameObject.threeJSGroup.add(audio);
  }

  playSound(delayInSec = 0, detune: number | null = null): void {
    if (!this.positionalAudio) return;
    if (this.positionalAudio.isPlaying) {
      this.positionalAudio.pause();
    }
    this.positionalAudio.play(delayInSec);
    if (detune !== null) {
      this.positionalAudio.setDetune(detune);
    }
  }

  unload(): void {
    if (this.positionalAudio) {
      this.gameObject.threeJSGroup.remove(this.positionalAudio);
      this.positionalAudio = null;
    }
  }
}

export default SoundComponent;
