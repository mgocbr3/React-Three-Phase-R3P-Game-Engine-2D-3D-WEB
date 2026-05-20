/**
 * React Hook for Three.js Resource Cleanup
 * 
 * Gerencia lifecycle de objetos Three.js automaticamente
 * Part of Phase 1 - Sprint 1.2: Memory Management
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { disposeObject3D, logMemoryStats } from '@/lib/threeCleanup';

/**
 * Hook para limpar um Object3D quando o componente desmonta
 */
export function useThreeObjectCleanup(object: THREE.Object3D | null): void {
  const objectRef = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    objectRef.current = object;

    return () => {
      if (objectRef.current) {
        console.log('[useThreeObjectCleanup] Cleaning up object:', objectRef.current.name);
        disposeObject3D(objectRef.current);
        objectRef.current = null;
      }
    };
  }, [object]);
}

/**
 * Hook para limpar Scene quando componente desmonta
 */
export function useThreeSceneCleanup(scene: THREE.Scene | null, renderer: THREE.WebGLRenderer | null): void {
  useEffect(() => {
    return () => {
      if (scene && renderer) {
        console.log('[useThreeSceneCleanup] Cleaning up scene');
        logMemoryStats(renderer, 'Before cleanup');
        
        // Limpar todos os objetos da scene
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh || 
              object instanceof THREE.Line || 
              object instanceof THREE.Points) {
            disposeObject3D(object);
          }
        });

        logMemoryStats(renderer, 'After cleanup');
      }
    };
  }, [scene, renderer]);
}

/**
 * Hook para monitorar memória a cada X segundos
 */
export function useThreeMemoryMonitor(
  renderer: THREE.WebGLRenderer | null,
  intervalSeconds: number = 30
): void {
  useEffect(() => {
    if (!renderer) return;

    const interval = setInterval(() => {
      const stats = renderer.info;
      const memoryMB = (performance as any).memory?.usedJSHeapSize 
        ? ((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2)
        : 'N/A';

      console.log('[ThreeMemoryMonitor]', {
        geometries: stats.memory.geometries,
        textures: stats.memory.textures,
        programs: stats.programs?.length || 0,
        drawCalls: stats.render.calls,
        triangles: stats.render.triangles,
        heapMB: memoryMB,
      });

      // Alerta se muitos recursos
      if (stats.memory.geometries > 500) {
        console.warn('[ThreeMemoryMonitor]  Too many geometries:', stats.memory.geometries);
      }
      if (stats.memory.textures > 100) {
        console.warn('[ThreeMemoryMonitor]  Too many textures:', stats.memory.textures);
      }
    }, intervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [renderer, intervalSeconds]);
}
