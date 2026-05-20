/**
 * Hook para limpar objetos Three.js quando deletados do editor
 * 
 * Monitora mudanças na lista de objects e limpa recursos dos objetos removidos
 * Part of Phase 1 - Sprint 1.2: Memory Management
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { disposeObject3D } from '@/lib/threeCleanup';
import type { SceneObject } from '@/stores/editorStore';

/**
 * Hook que detecta objetos removidos e limpa seus recursos Three.js
 */
export function useGameObjectCleanup(
  objects: SceneObject[],
  objectRefs: Map<string, THREE.Object3D>
): void {
  const previousObjectIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentObjectIds = new Set(objects.map((obj) => obj.id));
    
    // Encontrar objetos que foram removidos
    const removedIds: string[] = [];
    previousObjectIds.current.forEach((id) => {
      if (!currentObjectIds.has(id)) {
        removedIds.push(id);
      }
    });

    // Limpar recursos dos objetos removidos
    if (removedIds.length > 0) {
      console.log('[useGameObjectCleanup] Cleaning up removed objects:', removedIds);
      
      removedIds.forEach((id) => {
        const object3D = objectRefs.get(id);
        if (object3D) {
          disposeObject3D(object3D);
          objectRefs.delete(id);
        }
      });
    }

    // Atualizar lista de IDs para próxima comparação
    previousObjectIds.current = currentObjectIds;
  }, [objects, objectRefs]);
}
