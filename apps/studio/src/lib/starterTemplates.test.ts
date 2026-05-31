import { describe, expect, it } from 'vitest';

import {
  buildStarterProjectDocument,
  createStarterTemplateObjects,
  listStarterTemplates,
} from './starterTemplates';

describe('starterTemplates', () => {
  it('exposes only first-person and third-person 3D templates', () => {
    const templates = listStarterTemplates();

    expect(templates.map((template) => template.id)).toEqual(['first-person', 'third-person']);
    expect(templates.map((template) => template.name).join(' ')).not.toMatch(/placeholder|sample|demo/i);
  });

  it.each(['first-person', 'third-person'] as const)('builds a dry %s starter project', (templateId) => {
    const doc = buildStarterProjectDocument({
      id: 'starter-test',
      name: 'Starter Test',
      templateId,
      createdAt: 10,
    });
    const scene = doc.scenes[0];
    const objects = createStarterTemplateObjects(templateId);
    const player = scene.rootObjects.find((object) => object.id === 'main-player');
    const camera = scene.rootObjects.find((object) => object.id === 'main-camera');
    const ground = scene.rootObjects.find((object) => object.id === 'ground-1');
    const arenaIds = scene.rootObjects.map((object) => object.id);

    expect(doc.game.templateId).toBe(templateId);
    expect(doc.runtime).toEqual({ primary: 'three-3d', renderers: ['three'], physics: ['rapier'] });
    expect(scene.kind).toBe('3d');
    expect(scene.physics).toEqual({ engine: 'rapier', gravity: [0, -9.81, 0] });
    expect(scene.environment.background).toBe('#7bc7ee');
    expect(arenaIds).toEqual(expect.arrayContaining([
      'sunlight-main',
      'main-camera',
      'main-player',
      'ground-1',
      'arena-main-platform',
      'arena-back-wall',
      'arena-front-ramp',
      'arena-stair-7',
      'arena-orange-roof-cube',
    ]));
    expect(new Set(arenaIds).size).toBe(scene.rootObjects.length);
    expect(objects.map((object) => object.id)).toEqual(arenaIds);
    expect(player?.components.some((component) => component.type === 'pixl.mesh')).toBe(true);
    expect(player?.components.find((component) => component.type === 'pixl.physics')?.data.colliders).toEqual([
      expect.objectContaining({ type: 'capsule' }),
    ]);
    expect(player?.components.find((component) => component.type === 'pixl.animation')?.data).toEqual(
      expect.objectContaining({
        currentAnimation: 'idle',
        availableAnimations: ['idle', 'walk', 'run', 'agree', 'headShake', 'sad_pose', 'sneak_pose'],
        autoPlay: true,
      }),
    );
    expect(camera?.components.find((component) => component.type === 'pixl.camera3d')?.data).toEqual(
      expect.objectContaining({
        mode: templateId,
        followPlayer: true,
        targetId: 'main-player',
      }),
    );
    expect(ground?.type).toBe('box');
    expect(ground?.transform.scale).toEqual([72, 0.2, 72]);
    expect(ground?.data?.editor).toEqual(expect.objectContaining({ isStatic: true }));
    expect(ground?.components.find((component) => component.type === 'pixl.physics')?.data.colliders).toEqual([
      expect.objectContaining({ type: 'cuboid', hx: 36, hy: 0.1, hz: 36 }),
    ]);
    expect(doc.assets.entries.map((asset) => asset.path)).toEqual(expect.arrayContaining(['/models/manequin/mixamo/xbot.glb']));
  });
});
