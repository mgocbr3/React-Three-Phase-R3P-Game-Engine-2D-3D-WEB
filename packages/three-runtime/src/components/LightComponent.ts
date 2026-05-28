// Adapted from tools/vendor/three-game-engine/src/components/LightComponent.ts
// (MIT, WesUnwin/three-game-engine).

import * as THREE from 'three';

import Component, { type ComponentJSON } from '../Component.js';
import { configureLightQuality, setObject3DProps } from '../util/ThreeJSHelpers.js';
import type { Vector3Data } from '../types.js';

export interface LightComponentJSON extends ComponentJSON {
  lightType: string;
  position?: Vector3Data;
}

const LIGHT_TYPES: Record<string, new () => THREE.Light> = {
  AmbientLight: THREE.AmbientLight,
  DirectionalLight: THREE.DirectionalLight,
  HemisphereLight: THREE.HemisphereLight,
  PointLight: THREE.PointLight,
  RectAreaLight: THREE.RectAreaLight as unknown as new () => THREE.Light,
  SpotLight: THREE.SpotLight,
};

class LightComponent extends Component {
  light: THREE.Light | null = null;

  load(): void {
    const json = this.jsonData as LightComponentJSON;
    const LightClass = LIGHT_TYPES[json.lightType];
    if (!LightClass) {
      throw new Error(`LightComponent: unknown light type: ${json.lightType}`);
    }
    const light = new LightClass();
    light.name = json.lightType.toLowerCase();

    const objectProps = { ...(this.jsonData as Record<string, unknown>) };
    delete (objectProps as { lightType?: unknown }).lightType;
    delete (objectProps as { type?: unknown }).type;
    delete (objectProps as { name?: unknown }).name;
    setObject3DProps(light, objectProps);
    configureLightQuality(light, objectProps);

    this.light = light;
    this.gameObject.threeJSGroup.add(this.light);
  }

  unload(): void {
    if (this.light) {
      this.gameObject.threeJSGroup.remove(this.light);
      this.light = null;
    }
  }
}

export default LightComponent;
