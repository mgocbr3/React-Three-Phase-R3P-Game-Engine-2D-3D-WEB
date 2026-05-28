// Adapted from tools/vendor/three-game-engine/src/Renderer.ts
// (MIT, WesUnwin/three-game-engine). VR support and ThreeMeshUI integration
// dropped from Phase A — see ADR-003. Re-introduce as opt-in later.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import type Game from './Game.js';
import type {
  RendererOptions,
  RendererPostProcessingOptions,
  RendererShadowMapType,
  RendererToneMapping,
} from './types.js';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const FILMIC_GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    brightness: { value: 0 },
    contrast: { value: 0 },
    saturation: { value: 0 },
    hue: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float contrast;
    uniform float saturation;
    uniform float hue;
    varying vec2 vUv;

    vec3 hueShift(vec3 color, float angle) {
      float s = sin(angle), c = cos(angle);
      mat3 m = mat3(
        0.299 + 0.701 * c + 0.168 * s, 0.587 - 0.587 * c + 0.330 * s, 0.114 - 0.114 * c - 0.497 * s,
        0.299 - 0.299 * c - 0.328 * s, 0.587 + 0.413 * c + 0.035 * s, 0.114 - 0.114 * c + 0.292 * s,
        0.299 - 0.300 * c + 1.250 * s, 0.587 - 0.588 * c - 1.050 * s, 0.114 + 0.886 * c - 0.203 * s
      );
      return clamp(m * color, 0.0, 1.0);
    }

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 color = tex.rgb + brightness;
      color = (color - 0.5) * (1.0 + contrast) + 0.5;
      color = mix(vec3(dot(color, vec3(0.299, 0.587, 0.114))), color, 1.0 + saturation);
      color = hueShift(color, hue);
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), tex.a);
    }
  `,
};

const asNumber = (value: number | undefined, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const resolveRendererToneMapping = (toneMapping?: RendererToneMapping) => {
  switch (toneMapping) {
    case 'aces': return THREE.ACESFilmicToneMapping;
    case 'cineon': return THREE.CineonToneMapping;
    case 'reinhard': return THREE.ReinhardToneMapping;
    case 'linear': return THREE.LinearToneMapping;
    case 'none': return THREE.NoToneMapping;
    default: return THREE.ACESFilmicToneMapping;
  }
};

export const resolveRendererShadowMapType = (shadowMapType?: RendererShadowMapType) => {
  switch (shadowMapType) {
    case 'basic': return THREE.BasicShadowMap;
    case 'percentage':
    case 'soft':
    case 'variance':
    default: return THREE.PCFShadowMap;
  }
};

export const shouldUseRendererPostProcessing = (
  options?: RendererPostProcessingOptions,
): boolean => options?.enabled === true;

class Renderer {
  game: Game;
  options: RendererOptions;
  threeJSRenderer: THREE.WebGLRenderer;
  threeJSCamera: THREE.PerspectiveCamera;
  threeJSCameraAudioListener: THREE.AudioListener;
  private previousRenderTime: number | undefined;
  private running: boolean;
  private animationFrameId: number | null;
  private composer: EffectComposer | null;
  private composerScene: THREE.Scene | null;
  private bloomPass: UnrealBloomPass | null;
  private gradePass: ShaderPass | null;
  private defaultEnvironment: THREE.Texture | null;

  constructor(game: Game, options: RendererOptions = {}) {
    this.game = game;
    this.options = options;
    this.running = false;
    this.animationFrameId = null;
    this.previousRenderTime = undefined;
    this.composer = null;
    this.composerScene = null;
    this.bloomPass = null;
    this.gradePass = null;
    this.defaultEnvironment = null;

    const rendererOpts: THREE.WebGLRendererParameters = { antialias: true };
    if (options.canvas) {
      rendererOpts.canvas = options.canvas;
      if (!this.options.width) this.options.width = options.canvas.width;
      if (!this.options.height) this.options.height = options.canvas.height;
    }

    this.threeJSRenderer = new THREE.WebGLRenderer(rendererOpts);
    this.threeJSRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.threeJSRenderer.shadowMap.enabled = options.shadows ?? true;
    this.threeJSRenderer.shadowMap.type = resolveRendererShadowMapType(options.shadowMapType);
    this.applyRendererColorSettings();

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
    this.composer?.setSize(width, height);
  }

  setPostProcessingOptions(options?: RendererPostProcessingOptions): void {
    this.options.postProcessing = options;
    this.applyRendererColorSettings();
    this.disposeComposer();
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

  isPlaying(): boolean {
    return this.running;
  }

  pause(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  renderStillFrame(): void {
    this.renderScene();
  }

  dispose(): void {
    this.pause();
    this.disposeComposer();
    this.defaultEnvironment?.dispose();
    this.defaultEnvironment = null;
    this.threeJSRenderer.dispose();
  }

  private _renderFrame(ctx: { deltaTimeInSec: number; time: number }): void {
    const scene = this.game.scene;
    if (!scene) return;

    scene.advancePhysics();
    scene.beforeRender({ deltaTimeInSec: ctx.deltaTimeInSec });
    scene.forEachGameObject((g) => g.beforeRender({ deltaTimeInSec: ctx.deltaTimeInSec }));

    this.options.beforeRender?.({ deltaTimeInSec: ctx.deltaTimeInSec, time: ctx.time });
    this.renderScene();
  }

  private applyRendererColorSettings(): void {
    const post = this.options.postProcessing;
    this.threeJSRenderer.toneMapping = resolveRendererToneMapping(post?.toneMapping ?? (post?.enabled ? 'aces' : 'none'));
    this.threeJSRenderer.toneMappingExposure = asNumber(post?.toneMappingExposure, post?.enabled ? 1.08 : 1);
  }

  private disposeComposer(): void {
    this.composer?.dispose();
    this.composer = null;
    this.composerScene = null;
    this.bloomPass = null;
    this.gradePass = null;
  }

  private getDefaultEnvironment(): THREE.Texture {
    if (this.defaultEnvironment) return this.defaultEnvironment;
    const pmrem = new THREE.PMREMGenerator(this.threeJSRenderer);
    const room = new RoomEnvironment();
    this.defaultEnvironment = pmrem.fromScene(room).texture;
    room.dispose();
    pmrem.dispose();
    return this.defaultEnvironment;
  }

  private applySceneRenderDefaults(scene: THREE.Scene): void {
    scene.environment ??= this.getDefaultEnvironment();
    scene.environmentIntensity = scene.environmentIntensity || 0.7;
  }

  private getComposer(scene: THREE.Scene): EffectComposer {
    if (this.composer && this.composerScene === scene) return this.composer;
    this.disposeComposer();

    const size = new THREE.Vector2();
    this.threeJSRenderer.getSize(size);
    const composer = new EffectComposer(this.threeJSRenderer);
    composer.setPixelRatio(this.options.pixelRatio ?? 1);
    composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(scene, this.threeJSCamera));

    const post = this.options.postProcessing;
    if (post?.bloom) {
      this.bloomPass = new UnrealBloomPass(
        size,
        asNumber(post.bloomIntensity, 0.45),
        asNumber(post.bloomRadius, 0.45),
        asNumber(post.bloomThreshold, 0.86),
      );
      composer.addPass(this.bloomPass);
    }

    this.gradePass = new ShaderPass(FILMIC_GRADE_SHADER);
    composer.addPass(this.gradePass);
    composer.addPass(new OutputPass());

    this.composer = composer;
    this.composerScene = scene;
    return composer;
  }

  private updatePostProcessingPasses(): void {
    const post = this.options.postProcessing ?? {};
    if (this.bloomPass) {
      this.bloomPass.strength = asNumber(post.bloomIntensity, 0.45);
      this.bloomPass.radius = asNumber(post.bloomRadius, 0.45);
      this.bloomPass.threshold = asNumber(post.bloomThreshold, 0.86);
    }

    if (!this.gradePass) return;
    const uniforms = this.gradePass.uniforms;
    uniforms.brightness.value = asNumber(post.brightness, 0);
    uniforms.contrast.value = asNumber(post.contrast, post.colorGrading ? 0.08 : 0);
    uniforms.saturation.value = asNumber(post.saturation, post.colorGrading ? 0.06 : 0);
    uniforms.hue.value = asNumber(post.hue, 0);
  }

  private renderScene(): void {
    const scene = this.game.scene;
    if (!scene) return;
    this.applySceneRenderDefaults(scene.threeJSScene);

    if (!shouldUseRendererPostProcessing(this.options.postProcessing)) {
      this.threeJSRenderer.render(scene.threeJSScene, this.threeJSCamera);
      return;
    }

    const composer = this.getComposer(scene.threeJSScene);
    this.updatePostProcessingPasses();
    composer.render();
  }
}

export default Renderer;
