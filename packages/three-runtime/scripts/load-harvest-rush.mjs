#!/usr/bin/env node
/**
 * Smoke demo for @pixlland/three-runtime (ADR-003 Phase A).
 *
 * Reads the real Harvest Rush 3D project document, runs it through the
 * pixlSchemaAdapter, and prints the resulting Wes-shape SceneJSON tree.
 * Node-only — does not touch the DOM, Three's WebGLRenderer or Rapier.
 *
 * Usage:
 *   pnpm --filter @pixlland/three-runtime build
 *   node engine/packages/three-runtime/scripts/load-harvest-rush.mjs
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  pixlProjectToWesGame,
  pixlSceneToWesScene,
} from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const projectPath = path.join(
  repoRoot,
  'apps', 'portal', 'games-src', 'harvest-rush-3d', 'pixlplayground', 'project.pixlproject.json',
);

const text = readFileSync(projectPath, 'utf8');
const project = JSON.parse(text);

console.log('PixlPlayground three-runtime smoke');
console.log('---------------------------------');
console.log('Project:    ', project.name, `(${project.slug})`);
console.log('Schema v:   ', project.version);
console.log('Active scn: ', project.activeSceneId);
console.log('Scenes:     ', project.scenes.length);

const { game, scenesByPath, initialScene } = pixlProjectToWesGame(project);

console.log('\n>>> pixlProjectToWesGame produced:');
console.log('  initialScene:', initialScene);
console.log('  scenes paths:', Object.keys(game.scenes));

const activeScene = project.scenes.find((s) => s.id === project.activeSceneId)
  ?? project.scenes[0];
const sceneJson = pixlSceneToWesScene(activeScene);

const countObjects = (list) => list.reduce(
  (acc, obj) => acc + 1 + countObjects(obj.children ?? []),
  0,
);

console.log('\n>>> pixlSceneToWesScene("', activeScene.name, '") produced:');
console.log('  root gameObjects:', sceneJson.gameObjects.length);
console.log('  total nodes:     ', countObjects(sceneJson.gameObjects));
console.log('  background:      ', sceneJson.background);
console.log('  gravity:         ', sceneJson.gravity);

const previewObjects = sceneJson.gameObjects.slice(0, 5);
previewObjects.forEach((obj) => {
  const componentTypes = (obj.components ?? []).map((c) => c.type).join(', ');
  console.log(`  - ${obj.name} (${obj.type})  components:[${componentTypes}]  children:${(obj.children ?? []).length}`);
});

console.log('\nOK — adapter round-trip clean.');
