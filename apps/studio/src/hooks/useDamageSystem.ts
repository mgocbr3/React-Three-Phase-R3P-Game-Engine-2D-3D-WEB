import { useCallback, useRef } from 'react';
import { useEditorStore, EntitySettings, DEFAULT_ENTITY_SETTINGS, SceneObject } from '@/stores/editorStore';
import { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

// Types for damage events
export interface DamageEvent {
  sourceId: string;          // Who dealt the damage
  targetId: string;          // Who received the damage
  damage: number;            // Amount of damage
  knockback?: THREE.Vector3; // Direction and force of knockback
  damageType?: 'melee' | 'ranged' | 'stomp' | 'contact' | 'explosion';
  isCritical?: boolean;
}

export interface DeathEvent {
  objectId: string;
  killerId?: string;
  position: [number, number, number];
  deathParticle?: string;
  deathSound?: string;
}

// Runtime health state (separate from editor store to avoid constant rerenders)
const runtimeHealthMap = new Map<string, number>();
const invulnerabilityMap = new Map<string, number>(); // objectId -> invulnerable until timestamp
const deathCallbacks: ((event: DeathEvent) => void)[] = [];
const damageCallbacks: ((event: DamageEvent) => void)[] = [];

/**
 * Hook for managing damage and health system across all game entities.
 * This enables combat between player, enemies, and destructible objects
 * while keeping the system modular for asset replacement.
 */
export function useDamageSystem() {
  const { objects, updateObject, deleteObject } = useEditorStore();

  /**
   * Initialize health for an entity based on its EntitySettings
   */
  const initializeHealth = useCallback((objectId: string, maxHealth: number) => {
    if (!runtimeHealthMap.has(objectId)) {
      runtimeHealthMap.set(objectId, maxHealth);
    }
  }, []);

  /**
   * Get current health for an entity
   */
  const getHealth = useCallback((objectId: string): number => {
    const obj = objects.find(o => o.id === objectId);
    const entity = obj?.entitySettings || DEFAULT_ENTITY_SETTINGS;
    return runtimeHealthMap.get(objectId) ?? entity.currentHealth;
  }, [objects]);

  /**
   * Set health directly (for healing, etc.)
   */
  const setHealth = useCallback((objectId: string, health: number) => {
    const obj = objects.find(o => o.id === objectId);
    if (!obj) return;
    
    const entity = obj.entitySettings || DEFAULT_ENTITY_SETTINGS;
    const clampedHealth = Math.max(0, Math.min(health, entity.maxHealth));
    runtimeHealthMap.set(objectId, clampedHealth);
    
    // Sync to editor store for persistence
    updateObject(objectId, {
      entitySettings: { ...entity, currentHealth: clampedHealth }
    });
  }, [objects, updateObject]);

  /**
   * Check if an entity is currently invulnerable (i-frames)
   */
  const isInvulnerable = useCallback((objectId: string): boolean => {
    const obj = objects.find(o => o.id === objectId);
    const entity = obj?.entitySettings || DEFAULT_ENTITY_SETTINGS;
    
    if (entity.isInvulnerable) return true;
    
    const invulnerableUntil = invulnerabilityMap.get(objectId);
    if (invulnerableUntil && Date.now() < invulnerableUntil) {
      return true;
    }
    
    return false;
  }, [objects]);

  /**
   * Apply damage to an entity
   * Returns true if damage was applied, false if blocked (invulnerable, wrong team, etc.)
   */
  const applyDamage = useCallback((
    targetId: string,
    damage: number,
    sourceId?: string,
    knockback?: THREE.Vector3,
    damageType: DamageEvent['damageType'] = 'melee',
    rigidBody?: RapierRigidBody
  ): boolean => {
    const target = objects.find(o => o.id === targetId);
    if (!target) return false;
    
    const entity = target.entitySettings || DEFAULT_ENTITY_SETTINGS;
    
    // Check invulnerability
    if (isInvulnerable(targetId)) return false;
    
    // Check team (can't damage same team by default)
    if (sourceId) {
      const source = objects.find(o => o.id === sourceId);
      const sourceEntity = source?.entitySettings || DEFAULT_ENTITY_SETTINGS;
      
      // Same team (except neutral can damage/be damaged by anyone)
      if (entity.team === sourceEntity.team && entity.team !== 'neutral') {
        return false;
      }
    }
    
    // Get current health
    const currentHealth = getHealth(targetId);
    const newHealth = Math.max(0, currentHealth - damage);
    runtimeHealthMap.set(targetId, newHealth);
    
    // Apply i-frames
    if (entity.invulnerabilityDuration > 0) {
      invulnerabilityMap.set(targetId, Date.now() + entity.invulnerabilityDuration * 1000);
    }
    
    // Apply knockback
    if (knockback && rigidBody) {
      const resistance = entity.knockbackResistance || 0;
      const knockbackForce = knockback.clone().multiplyScalar(1 - resistance);
      
      try {
        rigidBody.applyImpulse(
          { x: knockbackForce.x, y: knockbackForce.y, z: knockbackForce.z },
          true
        );
      } catch (e) {
        // RigidBody may be invalid
      }
    }
    
    // Notify damage callbacks
    const damageEvent: DamageEvent = {
      sourceId: sourceId || '',
      targetId,
      damage,
      knockback,
      damageType,
    };
    damageCallbacks.forEach(cb => cb(damageEvent));
    
    // Check for death
    if (newHealth <= 0) {
      handleDeath(targetId, sourceId);
    }
    
    return true;
  }, [objects, getHealth, isInvulnerable]);

  /**
   * Handle entity death
   */
  const handleDeath = useCallback((objectId: string, killerId?: string) => {
    const obj = objects.find(o => o.id === objectId);
    if (!obj) return;
    
    const entity = obj.entitySettings || DEFAULT_ENTITY_SETTINGS;
    
    const deathEvent: DeathEvent = {
      objectId,
      killerId,
      position: obj.position,
      deathParticle: entity.deathParticle,
      deathSound: entity.deathSound,
    };
    
    // Notify death callbacks
    deathCallbacks.forEach(cb => cb(deathEvent));
    
    // Destroy object if configured
    if (entity.destroyOnDeath) {
      // Small delay to allow effects to play
      setTimeout(() => {
        deleteObject(objectId);
        runtimeHealthMap.delete(objectId);
        invulnerabilityMap.delete(objectId);
      }, 100);
    }
  }, [objects, deleteObject]);

  /**
   * Reset health for an entity
   */
  const resetHealth = useCallback((objectId: string) => {
    const obj = objects.find(o => o.id === objectId);
    if (!obj) return;
    
    const entity = obj.entitySettings || DEFAULT_ENTITY_SETTINGS;
    runtimeHealthMap.set(objectId, entity.maxHealth);
    invulnerabilityMap.delete(objectId);
  }, [objects]);

  /**
   * Reset all runtime health state (for game restart)
   */
  const resetAllHealth = useCallback(() => {
    runtimeHealthMap.clear();
    invulnerabilityMap.clear();
    
    // Re-initialize from editor store
    objects.forEach(obj => {
      const entity = obj.entitySettings;
      if (entity) {
        runtimeHealthMap.set(obj.id, entity.maxHealth);
      }
    });
  }, [objects]);

  /**
   * Get all entities of a specific team
   */
  const getEntitiesByTeam = useCallback((team: EntitySettings['team']): SceneObject[] => {
    return objects.filter(o => o.entitySettings?.team === team);
  }, [objects]);

  /**
   * Get all entities with a specific tag
   */
  const getEntitiesByTag = useCallback((tag: string): SceneObject[] => {
    return objects.filter(o => o.logicSettings?.tags?.includes(tag));
  }, [objects]);

  /**
   * Find nearest entity of a specific team from a position
   */
  const findNearestEntity = useCallback((
    position: THREE.Vector3,
    team: EntitySettings['team'],
    maxDistance?: number
  ): SceneObject | null => {
    const entities = getEntitiesByTeam(team);
    
    let nearest: SceneObject | null = null;
    let nearestDist = maxDistance ?? Infinity;
    
    entities.forEach(entity => {
      const entityPos = new THREE.Vector3(...entity.position);
      const dist = position.distanceTo(entityPos);
      
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    });
    
    return nearest;
  }, [getEntitiesByTeam]);

  /**
   * Subscribe to damage events
   */
  const onDamage = useCallback((callback: (event: DamageEvent) => void) => {
    damageCallbacks.push(callback);
    return () => {
      const index = damageCallbacks.indexOf(callback);
      if (index !== -1) damageCallbacks.splice(index, 1);
    };
  }, []);

  /**
   * Subscribe to death events
   */
  const onDeath = useCallback((callback: (event: DeathEvent) => void) => {
    deathCallbacks.push(callback);
    return () => {
      const index = deathCallbacks.indexOf(callback);
      if (index !== -1) deathCallbacks.splice(index, 1);
    };
  }, []);

  return {
    // Health management
    initializeHealth,
    getHealth,
    setHealth,
    applyDamage,
    resetHealth,
    resetAllHealth,
    isInvulnerable,
    
    // Entity queries
    getEntitiesByTeam,
    getEntitiesByTag,
    findNearestEntity,
    
    // Event subscriptions
    onDamage,
    onDeath,
  };
}

// Export singleton functions for use outside of React components
export const DamageSystem = {
  getHealth: (objectId: string) => runtimeHealthMap.get(objectId) ?? 100,
  
  isInvulnerable: (objectId: string) => {
    const invulnerableUntil = invulnerabilityMap.get(objectId);
    return invulnerableUntil ? Date.now() < invulnerableUntil : false;
  },
  
  setInvulnerable: (objectId: string, durationMs: number) => {
    invulnerabilityMap.set(objectId, Date.now() + durationMs);
  },
  
  clearInvulnerability: (objectId: string) => {
    invulnerabilityMap.delete(objectId);
  },
};
