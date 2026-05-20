import type { SceneObject } from '@/stores/editorStore';
import type { ScriptContext, ScriptRuntimeState } from './types';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { scriptRegistry } from './registry';
import { eventBus } from './events';
import { inputManager } from './input';

class ScriptExecutor {
  private runtimeStates: Map<string, ScriptRuntimeState> = new Map();
  private elapsed: number = 0;
  private running: boolean = false;

  start(): void {
    this.running = true;
    this.elapsed = 0;
    this.runtimeStates.clear();
    inputManager.init();
  }

  stop(): void {
    this.running = false;
    inputManager.destroy();
    eventBus.clear();
  }

  reset(): void {
    this.runtimeStates.clear();
    this.elapsed = 0;
  }

  isRunning(): boolean {
    return this.running;
  }

  executeFrame(
    objects: SceneObject[],
    delta: number,
    rigidBodies: Map<string, RapierRigidBody>,
    groups: Map<string, THREE.Group>
  ): void {
    if (!this.running) return;

    this.elapsed += delta;
    inputManager.update();

    const player = objects.find(o => o.type === 'player') || null;
    const camera = objects.find(o => o.type === 'camera') || null;

    // Clean up runtime states for objects that no longer exist
    const validObjectIds = new Set(objects.map(o => o.id));
    for (const key of this.runtimeStates.keys()) {
      const objectId = key.split(':')[0];
      if (!validObjectIds.has(objectId)) {
        this.runtimeStates.delete(key);
      }
    }

    for (const obj of objects) {
      if (!obj.scriptInstances?.length) continue;

      for (const instance of obj.scriptInstances) {
        if (!instance.enabled) continue;

        const script = scriptRegistry.get(instance.scriptId);
        if (!script) continue;

        const stateKey = `${obj.id}:${instance.id}`;
        let runtimeState = this.runtimeStates.get(stateKey);

        if (!runtimeState) {
          runtimeState = {
            instanceId: instance.id,
            objectId: obj.id,
            started: false,
            state: {},
          };
          this.runtimeStates.set(stateKey, runtimeState);
        }

        const ctx = this.createContext(
          obj,
          delta,
          objects,
          player,
          camera,
          rigidBodies.get(obj.id) || null,
          groups.get(obj.id) || null,
          instance.parameters,
          runtimeState.state
        );

        try {
          // Call onStart once
          if (!runtimeState.started && script.onStart) {
            script.onStart(ctx);
            runtimeState.started = true;
          }

          // Call onUpdate every frame
          if (script.onUpdate) {
            script.onUpdate(ctx);
          }
        } catch (error) {
          console.error(`Script error in "${script.id}" on object "${obj.name}":`, error);
        }
      }
    }
  }

  executeCollision(
    objectA: SceneObject,
    objectB: SceneObject,
    type: 'enter' | 'stay' | 'exit',
    isTrigger: boolean,
    rigidBodies: Map<string, RapierRigidBody>,
    groups: Map<string, THREE.Group>,
    allObjects: SceneObject[]
  ): void {
    if (!this.running) return;

    const player = allObjects.find(o => o.type === 'player') || null;
    const camera = allObjects.find(o => o.type === 'camera') || null;

    for (const instance of objectA.scriptInstances || []) {
      if (!instance.enabled) continue;

      const script = scriptRegistry.get(instance.scriptId);
      if (!script) continue;

      const stateKey = `${objectA.id}:${instance.id}`;
      const runtimeState = this.runtimeStates.get(stateKey);

      const ctx = this.createContext(
        objectA,
        0,
        allObjects,
        player,
        camera,
        rigidBodies.get(objectA.id) || null,
        groups.get(objectA.id) || null,
        instance.parameters,
        runtimeState?.state || {}
      );

      try {
        if (isTrigger) {
          if (type === 'enter' && script.onTriggerEnter) script.onTriggerEnter(ctx, objectB);
          if (type === 'stay' && script.onTriggerStay) script.onTriggerStay(ctx, objectB);
          if (type === 'exit' && script.onTriggerExit) script.onTriggerExit(ctx, objectB);
        } else {
          if (type === 'enter' && script.onCollisionEnter) script.onCollisionEnter(ctx, objectB);
          if (type === 'stay' && script.onCollisionStay) script.onCollisionStay(ctx, objectB);
          if (type === 'exit' && script.onCollisionExit) script.onCollisionExit(ctx, objectB);
        }
      } catch (error) {
        console.error(`Collision script error in "${script.id}":`, error);
      }
    }
  }

  private createContext(
    object: SceneObject,
    delta: number,
    objects: SceneObject[],
    player: SceneObject | null,
    camera: SceneObject | null,
    rigidBody: RapierRigidBody | null,
    group: THREE.Group | null,
    params: Record<string, any>,
    state: Record<string, any>
  ): ScriptContext {
    const rbAny = rigidBody as any;
    
    // Safely determine if body is kinematic, with error handling
    let isKinematic = false;
    if (rigidBody) {
      try {
        isKinematic = Boolean(
          typeof rbAny?.isKinematic === 'function' && rbAny.isKinematic() ||
          typeof rbAny?.isKinematicPositionBased === 'function' && rbAny.isKinematicPositionBased() ||
          typeof rbAny?.isKinematicVelocityBased === 'function' && rbAny.isKinematicVelocityBased() ||
          (typeof rbAny?.bodyType === 'function' && (rbAny.bodyType() === 2 || rbAny.bodyType() === 3))
        );
      } catch (e) {
        // If accessing kinematic state fails, the rigid body is likely invalid
        // Treat it as if it doesn't exist
        isKinematic = false;
      }
    }

    const getRbPosition = () => {
      if (!rigidBody) return null;
      try {
        const t = rigidBody.translation();
        return new THREE.Vector3(t.x, t.y, t.z);
      } catch (e) {
        // Rigid body is in an invalid state
        return null;
      }
    };

    const getRbRotationEuler = () => {
      if (!rigidBody) return null;
      try {
        const r = rigidBody.rotation();
        const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
        return new THREE.Euler().setFromQuaternion(q);
      } catch (e) {
        // Rigid body is in an invalid state
        return null;
      }
    };

    const setRbRotationEuler = (euler: THREE.Euler) => {
      if (!rigidBody) return;
      try {
        const q = new THREE.Quaternion().setFromEuler(euler);
        if (isKinematic && typeof (rigidBody as any).setNextKinematicRotation === 'function') {
          (rigidBody as any).setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
          return;
        }
        rigidBody.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      } catch (e) {
        // Rigid body is in an invalid state, fail silently
      }
    };

    const setRbTranslation = (x: number, y: number, z: number) => {
      if (!rigidBody) return;
      try {
        if (isKinematic && typeof (rigidBody as any).setNextKinematicTranslation === 'function') {
          (rigidBody as any).setNextKinematicTranslation({ x, y, z });
          return;
        }
        rigidBody.setTranslation({ x, y, z }, true);
      } catch (e) {
        // Rigid body is in an invalid state, fail silently
      }
    };

    const tempLookAt = new THREE.Object3D();

    return {
      object,
      delta,
      elapsed: this.elapsed,
      
      scene: {
        objects,
        player,
        camera,
        getObjectById: (id: string) => objects.find(o => o.id === id),
        getObjectsByTag: (tag: string) => 
          objects.filter(o => o.logicSettings?.tags?.includes(tag)),
      },
      
      physics: {
        rigidBody,
        setVelocity: (x, y, z) => {
          if (!rigidBody) return;
          try {
            rigidBody.setLinvel({ x, y, z }, true);
          } catch (e) {
            // Rigid body is in an invalid state
          }
        },
        applyImpulse: (x, y, z) => {
          if (!rigidBody) return;
          try {
            rigidBody.applyImpulse({ x, y, z }, true);
          } catch (e) {
            // Rigid body is in an invalid state
          }
        },
        setPosition: (x, y, z) => {
          setRbTranslation(x, y, z);
        },
      },
      
      input: {
        keys: inputManager.getKeys(),
        isKeyDown: (key) => inputManager.isKeyDown(key),
        isKeyPressed: (key) => inputManager.isKeyPressed(key),
        mouse: inputManager.getMouse(),
      },
      
      events: {
        emit: (eventName, data) => eventBus.emit(eventName, data),
        on: (eventName, callback) => eventBus.on(eventName, callback),
      },
      
      transform: {
        group,
        getPosition: () => {
          const rbPos = getRbPosition();
          if (rbPos) return rbPos;
          return group?.position.clone() || new THREE.Vector3();
        },
        setPosition: (x, y, z) => {
          // If the object has physics, move the rigidbody (not the visual group)
          if (rigidBody) {
            setRbTranslation(x, y, z);
            return;
          }
          if (group) group.position.set(x, y, z);
        },
        getRotation: () => {
          const rbRot = getRbRotationEuler();
          if (rbRot) return rbRot;
          return group?.rotation.clone() || new THREE.Euler();
        },
        setRotation: (x, y, z) => {
          // If the object has physics, rotate the rigidbody (not the visual group)
          if (rigidBody) {
            setRbRotationEuler(new THREE.Euler(x, y, z));
            return;
          }
          if (group) group.rotation.set(x, y, z);
        },
        lookAt: (target) => {
          // Compute lookAt rotation without mutating the visual group (avoids double rotations)
          const pos = getRbPosition() || group?.position || new THREE.Vector3();
          tempLookAt.position.copy(pos);
          tempLookAt.lookAt(target);

          if (rigidBody) {
            setRbRotationEuler(tempLookAt.rotation);
            return;
          }
          if (group) group.lookAt(target);
        },
      },
      
      params,
      state,
    };
  }
}

export const scriptExecutor = new ScriptExecutor();
