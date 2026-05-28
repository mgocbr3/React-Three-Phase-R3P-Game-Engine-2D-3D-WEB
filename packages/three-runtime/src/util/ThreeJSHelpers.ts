// Adapted from tools/vendor/three-game-engine/src/util/ThreeJSHelpers.ts
// (MIT, WesUnwin/three-game-engine). Tightened typing for our TS-strict
// build; runtime behavior preserved.

import * as THREE from 'three';

import type { SceneLightJSON, SceneSoundJSON } from '../types.js';

type Vec3Like = { x?: number; y?: number; z?: number };
type EulerLike = Vec3Like & { order?: string };
type ColorLike = THREE.ColorRepresentation;
type ShadowedLight = THREE.Light & { shadow?: THREE.LightShadow };

const hasNumberAxis = (value: unknown): value is Vec3Like => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Vec3Like;
  return ['x', 'y', 'z'].some((axis) => typeof v[axis as keyof Vec3Like] === 'number');
};

const isEulerOrder = (value: unknown): value is THREE.EulerOrder => (
  typeof value === 'string' && ['XYZ', 'YZX', 'ZXY', 'XZY', 'YXZ', 'ZYX'].includes(value)
);

export const setObject3DProps = (object3D: THREE.Object3D, props: Record<string, unknown>): void => {
  for (const prop in props) {
    const value = props[prop];
    switch (prop) {
      case 'position': {
        if (value instanceof THREE.Vector3) {
          object3D.position.copy(value);
        } else if (hasNumberAxis(value)) {
          const v = value as Vec3Like;
          object3D.position.set(v.x ?? 0, v.y ?? 0, v.z ?? 0);
        } else {
          throw new Error('GameObject: object3D position must be either a THREE.Vector3 or an object with x/y/z properties as numbers');
        }
        break;
      }
      case 'rotation': {
        if (value instanceof THREE.Euler) {
          object3D.rotation.copy(value);
        } else if (hasNumberAxis(value)) {
          const v = value as EulerLike;
          const order = isEulerOrder(v.order) ? v.order : undefined;
          object3D.rotation.set(v.x ?? 0, v.y ?? 0, v.z ?? 0, order);
        } else {
          throw new Error('GameObject: object3D rotation must be either a THREE.Euler or an object with properties: x/y/z/order');
        }
        break;
      }
      case 'scale': {
        if (value instanceof THREE.Vector3) {
          object3D.scale.copy(value);
        } else if (hasNumberAxis(value)) {
          const v = value as Vec3Like;
          object3D.scale.set(v.x ?? 0, v.y ?? 0, v.z ?? 0);
        } else {
          throw new Error('GameObject: object3D scale must be either a THREE.Vector3 or an object with x/y/z properties as numbers');
        }
        break;
      }
      case 'color':
      case 'groundColor': {
        const lightWithColor = object3D as unknown as Record<string, unknown>;
        if (value instanceof THREE.Color) {
          lightWithColor[prop] = value;
        } else if (typeof value === 'number' || typeof value === 'string') {
          lightWithColor[prop] = new THREE.Color(value as ColorLike);
        } else {
          throw new Error(`GameObject: object3D ${prop} must be set to either a THREE.Color instance or a string/number`);
        }
        break;
      }
      default: {
        (object3D as unknown as Record<string, unknown>)[prop] = value;
      }
    }
  }
};

export const optimizeStaticObject3D = (object3D: THREE.Object3D): void => {
  object3D.traverse((object) => {
    if (object instanceof THREE.Bone || (object as THREE.SkinnedMesh).isSkinnedMesh) return;
    object.updateMatrix();
    object.matrixAutoUpdate = false;
    object.matrixWorldNeedsUpdate = true;

    const geometry = (object as THREE.Mesh).geometry;
    if (geometry && !geometry.boundingSphere) geometry.computeBoundingSphere();
  });
};

const finite = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

export const configureLightQuality = (light: THREE.Light, data: Record<string, unknown>): void => {
  const shadowed = light as ShadowedLight;
  if (!shadowed.shadow) return;
  shadowed.castShadow = data.castShadow === true;
  if (!shadowed.castShadow) return;
  const mapSize = finite(data.shadowMapSize, 2048);
  shadowed.shadow.mapSize.set(mapSize, mapSize);
  shadowed.shadow.bias = finite(data.shadowBias, -0.00015);
  shadowed.shadow.normalBias = finite(data.shadowNormalBias, 0.025);
  shadowed.shadow.radius = finite(data.shadowRadius, 2);
  if (light instanceof THREE.DirectionalLight) {
    const size = finite(data.shadowCameraSize, 120);
    const camera = light.shadow.camera as THREE.OrthographicCamera;
    camera.left = -size;
    camera.right = size;
    camera.top = size;
    camera.bottom = -size;
    camera.near = 0.5;
    camera.far = finite(data.shadowCameraFar, 500);
    camera.updateProjectionMatrix();
  }
};

const LIGHT_TYPES: Record<string, new () => THREE.Light> = {
  AmbientLight: THREE.AmbientLight,
  DirectionalLight: THREE.DirectionalLight,
  HemisphereLight: THREE.HemisphereLight,
  PointLight: THREE.PointLight,
  RectAreaLight: THREE.RectAreaLight as unknown as new () => THREE.Light,
  SpotLight: THREE.SpotLight,
};

export const createLight = (lightData: SceneLightJSON): THREE.Light => {
  const lightType = lightData.type ?? '';
  const LightClass = LIGHT_TYPES[lightType];
  if (!LightClass) {
    throw new Error(`GameObject: error creating ThreeJS light: unknown light type: ${lightType}`);
  }

  const light = new LightClass();
  light.name = lightType.toLowerCase();

  const objectProps: Record<string, unknown> = { ...lightData };
  delete objectProps.type;
  setObject3DProps(light, objectProps);
  configureLightQuality(light, objectProps);

  return light;
};

export const createAudio = (
  soundData: SceneSoundJSON,
  audioBuffer: AudioBuffer,
  audioListener: THREE.AudioListener,
  name: string,
): THREE.Audio => {
  const audio = new THREE.Audio(audioListener);
  audio.name = name;
  audio.setBuffer(audioBuffer);

  if (typeof soundData.loop === 'boolean') {
    audio.setLoop(soundData.loop);
  }
  if (typeof soundData.autoplay === 'boolean') {
    audio.autoplay = soundData.autoplay;
  }
  if (typeof soundData.volume === 'number') {
    audio.setVolume(soundData.volume);
  }
  if (typeof soundData.playbackRate === 'number') {
    audio.setPlaybackRate(soundData.playbackRate);
  }

  // NOTE: detune can not be set until the sound is played as that is when
  // positionalAudio.source is established (not during setBuffer).

  return audio;
};
