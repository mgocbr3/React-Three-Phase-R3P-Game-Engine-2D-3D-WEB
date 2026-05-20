/**
 * Three.js Resource Cleanup Utilities
 * 
 * Previne memory leaks limpando recursos WebGL corretamente
 * Part of Phase 1 - Sprint 1.2: Memory Management
 */

import * as THREE from 'three';

/**
 * Limpa todos os recursos de um Material
 */
export function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  
  materials.forEach((mat) => {
    // Limpar texturas comuns
    const textures: (THREE.Texture | null | undefined)[] = [];
    
    // Texturas comuns a todos os materiais
    if ('map' in mat) textures.push((mat as any).map);
    if ('lightMap' in mat) textures.push((mat as any).lightMap);
    if ('alphaMap' in mat) textures.push((mat as any).alphaMap);
    if ('envMap' in mat) textures.push((mat as any).envMap);
    if ('aoMap' in mat) textures.push((mat as any).aoMap);
    
    // Texturas específicas de MeshStandardMaterial/MeshPhysicalMaterial
    if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
      textures.push(
        mat.bumpMap,
        mat.normalMap,
        mat.displacementMap,
        mat.roughnessMap,
        mat.metalnessMap,
        mat.emissiveMap
      );
    }

    // Dispose de todas as texturas válidas
    textures.filter(Boolean).forEach((texture) => {
      (texture as THREE.Texture).dispose();
    });

    // Dispose do material
    mat.dispose();
  });
}

/**
 * Limpa todos os recursos de uma Geometry
 */
export function disposeGeometry(geometry: THREE.BufferGeometry): void {
  geometry.dispose();
}

/**
 * Limpa recursivamente todos os recursos de um Object3D
 * Inclui: geometries, materials, textures, e todos os children
 */
export function disposeObject3D(object: THREE.Object3D): void {
  // Limpar children recursivamente
  while (object.children.length > 0) {
    const child = object.children[0];
    object.remove(child);
    disposeObject3D(child);
  }

  // Limpar geometry e material se for Mesh
  if (object instanceof THREE.Mesh) {
    if (object.geometry) {
      disposeGeometry(object.geometry);
    }
    
    if (object.material) {
      disposeMaterial(object.material);
    }
  }

  // Limpar Line
  if (object instanceof THREE.Line) {
    if (object.geometry) {
      disposeGeometry(object.geometry);
    }
    
    if (object.material) {
      disposeMaterial(object.material);
    }
  }

  // Limpar Points
  if (object instanceof THREE.Points) {
    if (object.geometry) {
      disposeGeometry(object.geometry);
    }
    
    if (object.material) {
      disposeMaterial(object.material);
    }
  }

  // Limpar SkinnedMesh (modelos com animação)
  if (object instanceof THREE.SkinnedMesh) {
    if (object.skeleton) {
      // Liberar recursos do skeleton
      object.skeleton.dispose();
    }
  }

  // Remover da memória
  (object as any).geometry = null;
  (object as any).material = null;
}

/**
 * Limpa toda a Scene recursivamente
 */
export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || 
        object instanceof THREE.Line || 
        object instanceof THREE.Points) {
      
      if (object.geometry) {
        disposeGeometry(object.geometry);
      }
      
      if (object.material) {
        disposeMaterial(object.material);
      }
    }
  });

  // Limpar todos os children
  while (scene.children.length > 0) {
    const child = scene.children[0];
    scene.remove(child);
  }
}

/**
 * Limpa Renderer e força garbage collection
 */
export function disposeRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.dispose();
  renderer.forceContextLoss();
  (renderer as any).domElement = null;
}

/**
 * Obtém estatísticas de memória do Renderer
 */
export function getRendererMemoryStats(renderer: THREE.WebGLRenderer): {
  geometries: number;
  textures: number;
  programs: number;
} {
  return {
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    programs: renderer.info.programs?.length || 0,
  };
}

/**
 * Log de estatísticas de memória para debug
 */
export function logMemoryStats(renderer: THREE.WebGLRenderer, label: string = ''): void {
  const stats = getRendererMemoryStats(renderer);
  console.log(`[ThreeCleanup] ${label} Memory:`, stats);
}

/**
 * Hook para limpar GameObject quando deletado do editor
 */
export function cleanupGameObject(object: THREE.Object3D): void {
  console.log('[ThreeCleanup] Cleaning up GameObject:', object.name || object.uuid);
  disposeObject3D(object);
}
