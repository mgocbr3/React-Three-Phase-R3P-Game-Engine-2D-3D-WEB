// Adapted from tools/vendor/three-game-engine/src/Renderer.ts
// (MIT, WesUnwin/three-game-engine). VR support and ThreeMeshUI integration
// dropped from Phase A — see ADR-003. Re-introduce as opt-in later.

import * as THREE from 'three';

import type Game from './Game.js';
import type { RendererOptions } from './types.js';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

class Renderer {
  game: Game;
  options: RendererOptions;
  threeJSRenderer: THREE.WebGLRenderer;
  threeJSCamera: THREE.PerspectiveCamera;
  threeJSCameraAudioListener: THREE.AudioListener;
  private previousRenderTime: number | undefined;
  private running: boolean;
  private animationFrameId: number | null;

  constructor(game: Game, options: RendererOptions = {}) {
    this.game = game;
    this.options = options;
    this.running = false;
    this.animationFrameId = null;
    this.previousRenderTime = undefined;

    const rendererOpts: THREE.WebGLRendererParameters = { antialias: true };
    if (options.canvas) {
      rendererOpts.canvas = options.canvas;
      if (!this.options.width) this.options.width = options.canvas.width;
      if (!this.options.height) this.options.height = options.canvas.height;
    }

    this.threeJSRenderer = new THREE.WebGLRenderer(rendererOpts);
    this.threeJSRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.threeJSRenderer.shadowMap.enabled = true;
    this.threeJSRenderer.shadowMap.type = THREE.PCFShadowMap;
    this.threeJSRenderer.toneMapping = THREE.NoToneMapping;
    this.threeJSRenderer.toneMappingExposure = 1;

    if (typeof window !== 'undefined') {
      this.options.width ??= window.innerWidth;
      this.options.height ??= window.innerHeight;
      this.options.pixelRatio ??= window.devicePixelRatio;
    }

    this.threeJSRenderer.setPixelRatio(this.options.pixelRatio ?? 1);
    this.threeJSRenderer.setSize(this.options.width ?? 800, this.options.height ?? 600);

    const cameraOpts = {
      fov: 50,
      aspect: (this.options.width ?? 800) / (this.options.height ?? 600),
      near: 0.01,
      far: 1000,
      ...(options.cameraOptions ?? {}),
    };
    this.threeJSCamera = new THREE.PerspectiveCamera(
      cameraOpts.fov,
      cameraOpts.aspect,
      cameraOpts.near,
      cameraOpts.far,
    );
    const camPos: Vec3 = { x: 0, y: 1.5, z: 5 };
    this.threeJSCamera.position.set(camPos.x, camPos.y, camPos.z);
    this.threeJSCamera.updateProjectionMatrix();

    this.threeJSCameraAudioListener = new THREE.AudioListener();
    this.threeJSCamera.add(this.threeJSCameraAudioListener);
  }

  getCanvas(): HTMLCanvasElement {
    return this.threeJSRenderer.domElement;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.threeJSCamera;
  }

  getCameraAudioListener(): THREE.AudioListener {
    return this.threeJSCameraAudioListener;
  }

  setSize(width: number, height: number): void {
    this.options.width = width;
    this.options.height = height;
    this.threeJSCamera.aspect = width / height;
    this.threeJSCamera.updateProjectionMatrix();
    this.threeJSRenderer.setSize(width, height);
  }

  play(): void {
    if (this.running) return;
    this.running = true;
    this.previousRenderTime = undefined;
    const tick = (time: number) => {
      if (!this.running) return;
      const previous = this.previousRenderTime ?? time;
      const deltaTimeInSec = Math.max(0, (time - previous) / 1000);
      this.previousRenderTime = time;
      this._renderFrame({ deltaTimeInSec, time });
      this.animationFrameId = requestAnimationFrame(tick);
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  pause(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private _renderFrame(ctx: { deltaTimeInSec: number; time: number }): void {
    const scene = this.game.scene;
    if (!scene) return;

    scene.advancePhysics();
    scene.beforeRender({ deltaTimeInSec: ctx.deltaTimeInSec });
    scene.forEachGameObject((g) => g.beforeRender({ deltaTimeInSec: ctx.deltaTimeInSec }));

    this.options.beforeRender?.({ deltaTimeInSec: ctx.deltaTimeInSec, time: ctx.time });
    this.threeJSRenderer.render(scene.threeJSScene, this.threeJSCamera);
  }
}

export default Renderer;
