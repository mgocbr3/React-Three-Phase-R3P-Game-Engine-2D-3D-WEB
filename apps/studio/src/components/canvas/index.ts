// Asset Loading
export { ModelLoader, preloadModel, useModelLoader } from './ModelLoader';
export type { ModelLoaderProps, ModelLoaderRef } from './ModelLoader';

export { TexturedMaterial, preloadTextures, usePBRTextures } from './TexturedMaterial';
export type { PBRTextureSet, TexturedMaterialProps } from './TexturedMaterial';

export { AnimatedModel } from './AnimatedModel';
export type { AnimatedModelProps, AnimatedModelRef, AnimationState } from './AnimatedModel';

// Animation System
export { AnimationController } from './AnimationController';
export type { AnimationControllerProps, AnimationControllerRef } from './AnimationController';

// Transform Gizmo (Professional Unity/Unreal-style transform controls)
export { TransformGizmo, GizmoInteractionLock } from './TransformGizmo';

// Performance & Optimization
export { PerformanceMonitor, usePerformanceMetrics } from './PerformanceMonitor';
export { AdaptivePerformance, usePerformanceStore } from './AdaptivePerformance';
export { AutoInstancer, useIsInstanced } from './AutoInstancer';
export { AutoLOD, SimpleLODMesh } from './AutoLOD';
export type { AutoLODProps, SimpleLODMeshProps } from './AutoLOD';

export { LODObject, SimpleLOD } from './LODObject';
export type { LODLevel, LODObjectProps, SimpleLODProps } from './LODObject';

export { InstancedMesh, useInstanceData, instanceGenerators } from './InstancedMesh';
export type { InstanceData, InstancedMeshProps } from './InstancedMesh';

// Particle System
export { ParticleEmitter, getDefaultParticleSettings, applyParticlePreset, particlePresets } from './ParticleEmitter';
export type { ParticleSettings, ParticlePreset } from './ParticleEmitter';
