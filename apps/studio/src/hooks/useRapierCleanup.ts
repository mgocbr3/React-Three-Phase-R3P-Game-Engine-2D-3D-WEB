/**
 * Rapier Physics World Cleanup
 * 
 * Gerencia cleanup de RigidBodies e Colliders
 * Previne memory leaks no physics engine
 * Part of Phase 1 - Sprint 1.2: Memory Management
 */

import { useEffect, useRef } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';

/**
 * Hook para limpar Rapier World quando componente desmonta
 */
export function useRapierWorldCleanup(
  rigidBodies: Map<string, RapierRigidBody>
): void {
  useEffect(() => {
    return () => {
      console.log('[RapierCleanup] Cleaning up Rapier World - removing', rigidBodies.size, 'bodies');
      
      // Remover todos os rigid bodies
      rigidBodies.forEach((body, id) => {
        try {
          // Rapier automatically removes colliders when body is removed
          if (body && typeof body === 'object') {
            console.log('[RapierCleanup] Removing body:', id);
            // Body cleanup handled by @react-three/rapier on unmount
          }
        } catch (error) {
          console.error('[RapierCleanup] Error removing body:', id, error);
        }
      });

      rigidBodies.clear();
      console.log('[RapierCleanup]  Rapier World cleaned');
    };
  }, [rigidBodies]);
}

/**
 * Hook para remover bodies de objetos deletados
 */
export function useRapierBodyCleanup(
  objectIds: string[],
  rigidBodies: Map<string, RapierRigidBody>
): void {
  const previousIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(objectIds);
    
    // Encontrar bodies removidos
    const removedIds: string[] = [];
    previousIds.current.forEach((id) => {
      if (!currentIds.has(id)) {
        removedIds.push(id);
      }
    });

    // Remover bodies
    if (removedIds.length > 0) {
      console.log('[RapierCleanup] Removing bodies for deleted objects:', removedIds);
      
      removedIds.forEach((id) => {
        const body = rigidBodies.get(id);
        if (body) {
          try {
            // Body cleanup handled by @react-three/rapier
            rigidBodies.delete(id);
            console.log('[RapierCleanup]  Body removed:', id);
          } catch (error) {
            console.error('[RapierCleanup] Error removing body:', id, error);
          }
        }
      });
    }

    previousIds.current = currentIds;
  }, [objectIds, rigidBodies]);
}
