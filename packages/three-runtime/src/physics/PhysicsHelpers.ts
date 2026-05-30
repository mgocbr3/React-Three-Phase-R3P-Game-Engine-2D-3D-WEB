// Adapted from tools/vendor/three-game-engine/src/physics/PhysicsHelpers.ts
// (MIT, WesUnwin/three-game-engine).

import RAPIER from '@dimforge/rapier3d-compat';

let rapierInitialized = false;

export const initRAPIER = async (): Promise<void> => {
  if (rapierInitialized) return;
  await RAPIER.init();
  rapierInitialized = true;
};

export const createRapierWorld = (gravity: { x: number; y: number; z: number }): RAPIER.World => {
  if (['x', 'y', 'z'].some((prop) => typeof gravity[prop as 'x' | 'y' | 'z'] !== 'number')) {
    throw new Error(`createRapierWorld: gravity vector must provide numeric x/y/z. given: ${gravity}`);
  }
  return new RAPIER.World(gravity);
};
