// Adapted from tools/vendor/three-game-engine/src/components/RigidBodyComponent.ts
// (MIT, WesUnwin/three-game-engine).

import RAPIER from '@dimforge/rapier3d-compat';

import Component, { type ComponentJSON } from '../Component.js';

export interface RigidBodyComponentJSON extends ComponentJSON {
  rigidBodyType: 'dynamic' | 'fixed' | 'kinematicPositionBased' | 'kinematicVelocityBased';
  enabledTranslations?: { x: boolean; y: boolean; z: boolean };
  enabledRotations?: { x: boolean; y: boolean; z: boolean };
  colliders?: ColliderData[];
}

export interface ColliderData {
  type:
    | 'ball'
    | 'capsule'
    | 'cone'
    | 'convexHull'
    | 'convexMesh'
    | 'cuboid'
    | 'cylinder'
    | 'polyline'
    | 'roundCone'
    | 'roundConvexHull'
    | 'roundConvexMesh'
    | 'roundCuboid'
    | 'roundCylinder'
    | 'roundTriangle'
    | 'trimesh'
    | 'heightfield';
  density?: number;
  friction?: number;
  sensor?: boolean;
  hx?: number;
  hy?: number;
  hz?: number;
  halfHeight?: number;
  radius?: number;
  borderRadius?: number;
  vertices?: Float32Array;
  indices?: Uint32Array;
  points?: Float32Array;
  nrows?: number;
  ncols?: number;
  heights?: Float32Array;
  scale?: RAPIER.Vector;
  a?: RAPIER.Vector;
  b?: RAPIER.Vector;
  c?: RAPIER.Vector;
}

const REQUIRED_PROPS: Record<ColliderData['type'], string[]> = {
  ball: ['radius'],
  capsule: ['halfHeight', 'radius'],
  cone: ['halfHeight', 'radius'],
  convexHull: ['points'],
  convexMesh: ['vertices', 'indices'],
  cuboid: ['hx', 'hy', 'hz'],
  cylinder: ['halfHeight', 'radius'],
  polyline: ['vertices', 'indices'],
  roundCone: ['halfHeight', 'radius', 'borderRadius'],
  roundConvexHull: ['points', 'borderRadius'],
  roundConvexMesh: ['vertices', 'indices', 'borderRadius'],
  roundCuboid: ['hx', 'hy', 'hz', 'borderRadius'],
  roundCylinder: ['halfHeight', 'radius', 'borderRadius'],
  roundTriangle: ['a', 'b', 'c', 'borderRadius'],
  trimesh: ['vertices', 'indices'],
  heightfield: ['nrows', 'ncols', 'heights', 'scale'],
};

const getErrorMessage = (error: unknown): string => (
  error instanceof Error && error.message ? error.message : String(error || 'unknown')
);

class RigidBodyComponent extends Component {
  rapierRigidBody: RAPIER.RigidBody | null = null;

  private recordPhysicsLoadFailure(phase: string, error: unknown): void {
    const message = `${phase}: ${getErrorMessage(error)}`;
    this.gameObject.threeJSGroup.userData.pixlPhysicsDebug = message;
    console.warn(`RigidBodyComponent.load: ${message}; physics disabled for ${this.gameObject.name || this.gameObject.id}.`, error);
  }

  load(): void {
    const json = this.jsonData as RigidBodyComponentJSON;
    const scene = this.gameObject.getScene();
    if (!scene.rapierWorld) {
      if (scene.game.gameOptions.disablePhysics) return;
      this.recordPhysicsLoadFailure('missing-world', 'scene has no Rapier world');
      return;
    }

    try {
      const rigidBodyDesc = RigidBodyComponent._createRigidBodyDesc(json.rigidBodyType);
      this.rapierRigidBody = scene.rapierWorld.createRigidBody(rigidBodyDesc);

      const { x, y, z } = this.gameObject.threeJSGroup.position;
      this.rapierRigidBody.setTranslation(new RAPIER.Vector3(x, y, z), true);
      const q = this.gameObject.threeJSGroup.quaternion;
      this.rapierRigidBody.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);

      if (json.enabledTranslations) {
        const t = json.enabledTranslations;
        this.rapierRigidBody.setEnabledTranslations(t.x ?? true, t.y ?? true, t.z ?? true, true);
      }
      if (json.enabledRotations) {
        const r = json.enabledRotations;
        this.rapierRigidBody.setEnabledRotations(r.x ?? true, r.y ?? true, r.z ?? true, true);
      }
    } catch (error) {
      this.rapierRigidBody = null;
      this.recordPhysicsLoadFailure('rigid-body', error);
      return;
    }

    (json.colliders ?? []).forEach((data) => {
      try {
        const desc = RigidBodyComponent._createColliderDesc(data);
        const collider = scene.rapierWorld!.createCollider(desc, this.rapierRigidBody ?? undefined);
        if (typeof data.density === 'number') collider.setDensity(data.density);
        if (typeof data.friction === 'number') collider.setFriction(data.friction);
        if (typeof data.sensor === 'boolean') collider.setSensor(data.sensor);
      } catch (error) {
        this.recordPhysicsLoadFailure(`collider-${data.type}`, error);
      }
    });
  }

  getRapierRigidBody(): RAPIER.RigidBody | null {
    return this.rapierRigidBody;
  }

  unload(): void {
    if (!this.rapierRigidBody) return;
    this.gameObject.getScene().rapierWorld?.removeRigidBody(this.rapierRigidBody);
    this.rapierRigidBody = null;
  }

  private static _createRigidBodyDesc(
    type: RigidBodyComponentJSON['rigidBodyType'],
  ): RAPIER.RigidBodyDesc {
    switch (type) {
      case 'fixed':
        return RAPIER.RigidBodyDesc.fixed();
      case 'dynamic':
        return RAPIER.RigidBodyDesc.dynamic();
      case 'kinematicPositionBased':
        return RAPIER.RigidBodyDesc.kinematicPositionBased();
      case 'kinematicVelocityBased':
        return RAPIER.RigidBodyDesc.kinematicVelocityBased();
      default:
        throw new Error(`RigidBodyComponent: unknown rigidBodyType: ${type}`);
    }
  }

  private static _createColliderDesc(data: ColliderData): RAPIER.ColliderDesc {
    const required = REQUIRED_PROPS[data.type];
    if (!required) {
      throw new Error(`RigidBodyComponent: invalid collider type: ${data.type}`);
    }
    const missing = required.filter((prop) => (data as unknown as Record<string, unknown>)[prop] === undefined);
    if (missing.length) {
      throw new Error(`RigidBodyComponent: collider ${data.type} missing props: ${missing.join(', ')}`);
    }
    switch (data.type) {
      case 'ball':
        return RAPIER.ColliderDesc.ball(data.radius!);
      case 'capsule':
        return RAPIER.ColliderDesc.capsule(data.halfHeight!, data.radius!);
      case 'cone':
        return RAPIER.ColliderDesc.cone(data.halfHeight!, data.radius!);
      case 'convexHull':
        return RAPIER.ColliderDesc.convexHull(data.points!) ?? RAPIER.ColliderDesc.ball(0.5);
      case 'convexMesh':
        return RAPIER.ColliderDesc.convexMesh(data.vertices!, data.indices!) ?? RAPIER.ColliderDesc.ball(0.5);
      case 'cuboid':
        return RAPIER.ColliderDesc.cuboid(data.hx!, data.hy!, data.hz!);
      case 'cylinder':
        return RAPIER.ColliderDesc.cylinder(data.halfHeight!, data.radius!);
      case 'polyline':
        return RAPIER.ColliderDesc.polyline(data.vertices!, data.indices);
      case 'roundCone':
        return RAPIER.ColliderDesc.roundCone(data.halfHeight!, data.radius!, data.borderRadius!);
      case 'roundConvexHull':
        return RAPIER.ColliderDesc.roundConvexHull(data.points!, data.borderRadius!) ?? RAPIER.ColliderDesc.ball(0.5);
      case 'roundConvexMesh':
        return RAPIER.ColliderDesc.roundConvexMesh(data.vertices!, data.indices!, data.borderRadius!) ?? RAPIER.ColliderDesc.ball(0.5);
      case 'roundCuboid':
        return RAPIER.ColliderDesc.roundCuboid(data.hx!, data.hy!, data.hz!, data.borderRadius!);
      case 'roundCylinder':
        return RAPIER.ColliderDesc.roundCylinder(data.halfHeight!, data.radius!, data.borderRadius!);
      case 'roundTriangle':
        return RAPIER.ColliderDesc.roundTriangle(data.a!, data.b!, data.c!, data.borderRadius!);
      case 'trimesh':
        return RAPIER.ColliderDesc.trimesh(data.vertices!, data.indices!);
      case 'heightfield':
        return RAPIER.ColliderDesc.heightfield(data.nrows!, data.ncols!, data.heights!, data.scale!);
      default:
        throw new Error(`RigidBodyComponent: invalid collider type: ${data.type}`);
    }
  }
}

export default RigidBodyComponent;
