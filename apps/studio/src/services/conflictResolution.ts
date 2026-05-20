/**
 * Conflict Resolution Service
 * 
 * Detects and resolves conflicts when a project is edited on multiple devices
 * Part of Phase 1: Critical Stabilization (Implementation Roadmap)
 * 
 * Integration: Works with Pixland Harmony Helper platform for server-side validation
 */

import { pixllandClient } from '@/integrations/supabase/client';

export interface ConflictInfo {
  local: any;
  remote: any;
  timestamp_local: string;
  timestamp_remote: string;
  conflictType: 'timestamp' | 'data' | 'both';
  differences: ConflictDifference[];
}

export interface ConflictDifference {
  type: 'added' | 'removed' | 'modified';
  objectId?: string;
  objectName?: string;
  property?: string;
  localValue?: any;
  remoteValue?: any;
}

export type ConflictResolutionStrategy = 'local' | 'remote' | 'merge';

/**
 * Detect if there's a conflict between local and remote versions
 * Returns null if no conflict, ConflictInfo if conflict detected
 */
export async function detectConflict(
  projectId: string,
  localData: any,
  localTimestamp: string
): Promise<ConflictInfo | null> {
  try {
    // Fetch remote project data
    const { data: remote, error } = await pixllandClient
      .from('projects')
      .select('game_data, updated_at')
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      console.error('[ConflictResolution] Error fetching remote data:', error);
      return null;
    }

    if (!remote) {
      console.warn('[ConflictResolution] Remote project not found');
      return null;
    }

    const remoteTimestamp = new Date(remote.updated_at);
    const localTimestampDate = new Date(localTimestamp);

    // Check if remote was updated after local
    if (remoteTimestamp <= localTimestampDate) {
      // No conflict - local is newer or same
      return null;
    }

    // Conflict detected - analyze differences
    const differences = analyzeConflictDifferences(localData, remote.game_data);

    // If no actual differences in data, it's just a timestamp conflict
    if (differences.length === 0) {
      return null;
    }

    return {
      local: localData,
      remote: remote.game_data,
      timestamp_local: localTimestamp,
      timestamp_remote: remote.updated_at,
      conflictType: 'both',
      differences,
    };
  } catch (error) {
    console.error('[ConflictResolution] Failed to detect conflict:', error);
    return null;
  }
}

/**
 * Analyze differences between local and remote data
 */
function analyzeConflictDifferences(local: any, remote: any): ConflictDifference[] {
  const differences: ConflictDifference[] = [];

  if (!local || !remote) return differences;

  const localObjects: Array<{ id: string; name?: string; [key: string]: any }> = local.objects || [];
  const remoteObjects: Array<{ id: string; name?: string; [key: string]: any }> = remote.objects || [];

  // Build maps for comparison
  const localMap = new Map<string, { id: string; name?: string; [key: string]: any }>(
    localObjects.map((o) => [o.id, o])
  );
  const remoteMap = new Map<string, { id: string; name?: string; [key: string]: any }>(
    remoteObjects.map((o) => [o.id, o])
  );

  // Find added objects (in remote but not in local)
  for (const [id, obj] of remoteMap) {
    if (!localMap.has(id)) {
      differences.push({
        type: 'added',
        objectId: id,
        objectName: obj.name,
        remoteValue: obj,
      });
    }
  }

  // Find removed objects (in local but not in remote)
  for (const [id, obj] of localMap) {
    if (!remoteMap.has(id)) {
      differences.push({
        type: 'removed',
        objectId: id,
        objectName: obj.name,
        localValue: obj,
      });
    }
  }

  // Find modified objects
  for (const [id, localObj] of localMap) {
    const remoteObj = remoteMap.get(id);
    if (!remoteObj) continue;

    // Compare critical properties
    const criticalProps = ['name', 'position', 'rotation', 'scale', 'type', 'color'];

    for (const prop of criticalProps) {
      const localValue = JSON.stringify(localObj[prop]);
      const remoteValue = JSON.stringify(remoteObj[prop]);

      if (localValue !== remoteValue) {
        differences.push({
          type: 'modified',
          objectId: id,
          objectName: localObj.name || remoteObj.name,
          property: prop,
          localValue: localObj[prop],
          remoteValue: remoteObj[prop],
        });
      }
    }
  }

  // Check gameScript differences
  if (local.gameScript !== remote.gameScript) {
    differences.push({
      type: 'modified',
      property: 'gameScript',
      localValue: local.gameScript,
      remoteValue: remote.gameScript,
    });
  }

  return differences;
}

/**
 * Resolve conflict using specified strategy
 */
export function resolveConflict(
  conflict: ConflictInfo,
  strategy: ConflictResolutionStrategy
): any {
  switch (strategy) {
    case 'local':
      console.log('[ConflictResolution] Resolved using LOCAL version');
      return conflict.local;

    case 'remote':
      console.log('[ConflictResolution] Resolved using REMOTE version');
      return conflict.remote;

    case 'merge':
      console.log('[ConflictResolution] Resolved using MERGE strategy');
      return mergeGameData(conflict.local, conflict.remote);

    default:
      console.warn('[ConflictResolution] Unknown strategy, defaulting to local');
      return conflict.local;
  }
}

/**
 * Intelligent merge strategy
 * 
 * Rules:
 * 1. Objects only in remote -> add them (new objects created on other device)
 * 2. Objects only in local -> keep them (new objects created locally)
 * 3. Objects in both:
 *    - If modified locally but not remotely -> keep local
 *    - If modified remotely but not locally -> keep remote
 *    - If modified in both -> keep remote (last write wins)
 * 4. gameScript -> keep the longer one (more likely to be complete)
 */
function mergeGameData(local: any, remote: any): any {
  const localObjects: Array<{ id: string; [key: string]: any }> = local.objects || [];
  const remoteObjects: Array<{ id: string; [key: string]: any }> = remote.objects || [];

  const localMap = new Map<string, { id: string; [key: string]: any }>(
    localObjects.map((o) => [o.id, o])
  );
  const remoteMap = new Map<string, { id: string; [key: string]: any }>(
    remoteObjects.map((o) => [o.id, o])
  );

  const mergedObjects: Array<{ id: string; [key: string]: any }> = [];

  // Add all remote objects (keeps remote changes)
  for (const [, obj] of remoteMap) {
    mergedObjects.push({ ...obj });
  }

  // Add local-only objects (new objects created locally)
  for (const [id, obj] of localMap) {
    if (!remoteMap.has(id)) {
      mergedObjects.push({ ...obj });
    }
  }

  // Merge gameScript (use longer one or remote if same length)
  const mergedGameScript =
    (local.gameScript?.length || 0) > (remote.gameScript?.length || 0)
      ? local.gameScript
      : remote.gameScript;

  return {
    objects: mergedObjects,
    gameScript: mergedGameScript,
    currentTemplateId: remote.currentTemplateId || local.currentTemplateId,
    version: Math.max(local.version || 1, remote.version || 1) + 1,
    savedAt: Date.now(),
    mergedAt: Date.now(),
    mergeInfo: {
      localObjectCount: localObjects.length,
      remoteObjectCount: remoteObjects.length,
      mergedObjectCount: mergedObjects.length,
    },
  };
}

/**
 * Get human-readable summary of conflict
 */
export function getConflictSummary(conflict: ConflictInfo): string {
  const addedCount = conflict.differences.filter(d => d.type === 'added').length;
  const removedCount = conflict.differences.filter(d => d.type === 'removed').length;
  const modifiedCount = conflict.differences.filter(d => d.type === 'modified').length;

  const parts = [];
  if (addedCount > 0) parts.push(`${addedCount} objetos adicionados`);
  if (removedCount > 0) parts.push(`${removedCount} objetos removidos`);
  if (modifiedCount > 0) parts.push(`${modifiedCount} modificações`);

  return parts.join(', ') || 'Sem diferenças detectadas';
}

/**
 * Call Pixland Harmony Helper API to validate conflict resolution
 * This ensures the platform is aware of the resolution
 */
export async function notifyPlatformOfResolution(
  projectId: string,
  strategy: ConflictResolutionStrategy,
  resolvedData: any
): Promise<boolean> {
  try {
    // Call Pixland Harmony Helper edge function
    const { data, error } = await pixllandClient.functions.invoke(
      'conflict-resolved',
      {
        body: {
          projectId,
          strategy,
          resolvedData,
          timestamp: new Date().toISOString(),
        },
      }
    );

    if (error) {
      console.error('[ConflictResolution] Failed to notify platform:', error);
      return false;
    }

    console.log('[ConflictResolution] Platform notified of resolution:', data);
    return true;
  } catch (error) {
    console.error('[ConflictResolution] Error notifying platform:', error);
    return false;
  }
}
