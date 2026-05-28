import * as THREE from 'three';

import Component, { type ComponentJSON } from '../Component.js';
import { optimizeStaticObject3D } from '../util/ThreeJSHelpers.js';

export type PrimitiveShape = 'box' | 'sphere' | 'cone' | 'cylinder' | 'torus' | 'plane';

export interface PrimitiveComponentJSON extends ComponentJSON {
  shape?: PrimitiveShape;
  size?: { x?: number; y?: number; z?: number };
  radius?: number;
  height?: number;
  tube?: number;
  radialSegments?: number;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  metalness?: number;
  roughness?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

const buildGeometry = (json: PrimitiveComponentJSON): THREE.BufferGeometry => {
  const shape = json.shape ?? 'box';
  const size = json.size ?? {};
  const radius = json.radius ?? 0.5;
  const height = json.height ?? 1;
  const tube = json.tube ?? 0.1;
  const segments = json.radialSegments ?? 24;

  switch (shape) {
    case 'box':
      return new THREE.BoxGeometry(size.x ?? 1, size.y ?? 1, size.z ?? 1);
    case 'sphere':
      return new THREE.SphereGeometry(radius, segments, segments);
    case 'cone':
      return new THREE.ConeGeometry(radius, height, segments);
    case 'cylinder':
      return new THREE.CylinderGeometry(radius, radius, height, segments);
    case 'torus':
      return new THREE.TorusGeometry(radius, tube, 16, Math.max(segments, 48));
    case 'plane':
      return new THREE.PlaneGeometry(size.x ?? 1, size.y ?? 1);
    default:
      // Unknown shape — fall back to a debug-friendly magenta box so it's
      // obvious something went wrong without crashing the scene.
      // eslint-disable-next-line no-console
      console.warn(`PrimitiveComponent: unknown shape "${shape}", falling back to box`);
      return new THREE.BoxGeometry(1, 1, 1);
  }
};

const parseColor = (value: string | undefined, fallback: number): THREE.Color => {
  if (!value) return new THREE.Color(fallback);
  try {
    return new THREE.Color(value);
  } catch {
    return new THREE.Color(fallback);
  }
};

class PrimitiveComponent extends Component {
  mesh: THREE.Mesh | null = null;

  load(): void {
    const json = this.jsonData as PrimitiveComponentJSON;

    const geometry = buildGeometry(json);
    const opacity = typeof json.opacity === 'number' && Number.isFinite(json.opacity)
      ? Math.max(0, Math.min(1, json.opacity))
      : 1;
    const material = new THREE.MeshStandardMaterial({
      color: parseColor(json.color, 0xcccccc),
      metalness: json.metalness ?? 0,
      roughness: json.roughness ?? 0.7,
      opacity,
      transparent: opacity < 1,
    });
    if (json.emissive) {
      material.emissive = parseColor(json.emissive, 0x000000);
      material.emissiveIntensity = json.emissiveIntensity ?? 1;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = json.name ?? 'primitive';
    // Default castShadow on (visual entities), receiveShadow off unless the
    // caller flags it (e.g. ground plane). Mirrors common Three.js patterns.
    mesh.castShadow = json.castShadow !== false;
    mesh.receiveShadow = json.receiveShadow === true;

    // Plane geometry is built on XY by default — flip it to XZ so it lies
    // flat (callers expect "ground" to be flat without authoring rotation).
    if ((json.shape ?? 'box') === 'plane') {
      mesh.rotation.x = -Math.PI / 2;
    }
    optimizeStaticObject3D(mesh);

    this.mesh = mesh;
    this.gameObject.threeJSGroup.add(mesh);
    this.gameObject.threeJSGroup.updateMatrixWorld(true);
  }

  unload(): void {
    if (this.mesh) {
      this.gameObject.threeJSGroup.remove(this.mesh);
      this.mesh.geometry.dispose();
      const mat = this.mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
      this.mesh = null;
    }
  }
}

export default PrimitiveComponent;
