/**
 * Project Versioning Service
 * 
 * Provides version control for projects, allowing users to:
 * - Auto-save versions on significant changes
 * - Restore previous versions
 * - Track version history
 * 
 * Part of Phase 1: Critical Stabilization (Implementation Roadmap)
 * 
 * NOTE: This service uses local storage as fallback when project_versions table
 * doesn't exist in the database. A migration to create the table is recommended.
 */

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  game_data: any;
  created_at: string;
  created_by: string;
  description?: string;
}

const LOCAL_VERSIONS_KEY = 'pixl-project-versions';

/**
 * Get versions from localStorage
 */
function getLocalVersions(projectId: string): ProjectVersion[] {
  try {
    const allVersions = JSON.parse(localStorage.getItem(LOCAL_VERSIONS_KEY) || '{}');
    return allVersions[projectId] || [];
  } catch {
    return [];
  }
}

/**
 * Save versions to localStorage
 */
function saveLocalVersions(projectId: string, versions: ProjectVersion[]): void {
  try {
    const allVersions = JSON.parse(localStorage.getItem(LOCAL_VERSIONS_KEY) || '{}');
    allVersions[projectId] = versions;
    localStorage.setItem(LOCAL_VERSIONS_KEY, JSON.stringify(allVersions));
  } catch (error) {
    console.error('[ProjectVersioning] Error saving to localStorage:', error);
  }
}

/**
 * Get all versions for a project, sorted by version number descending
 * Uses localStorage since project_versions table may not exist
 */
export async function getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  try {
    const versions = getLocalVersions(projectId);
    return versions.sort((a, b) => b.version_number - a.version_number);
  } catch (error) {
    console.error('[ProjectVersioning] Failed to get versions:', error);
    return [];
  }
}

/**
 * Save a new version of the project
 * Uses localStorage since project_versions table may not exist
 */
export async function saveProjectVersion(
  projectId: string,
  gameData: any,
  description?: string
): Promise<ProjectVersion | null> {
  try {
    const versions = getLocalVersions(projectId);
    const nextVersion = versions.length + 1;

    const newVersion: ProjectVersion = {
      id: `${projectId}-v${nextVersion}`,
      project_id: projectId,
      version_number: nextVersion,
      game_data: gameData,
      created_at: new Date().toISOString(),
      created_by: 'local',
      description: description || `Auto-save v${nextVersion}`,
    };

    versions.push(newVersion);
    saveLocalVersions(projectId, versions);

    console.log(`[ProjectVersioning] Saved version ${nextVersion} for project ${projectId}`);
    return newVersion;
  } catch (error) {
    console.error('[ProjectVersioning] Failed to save version:', error);
    return null;
  }
}

/**
 * Restore a specific version of the project
 * Returns the game_data of the restored version
 */
export async function restoreProjectVersion(
  projectId: string,
  versionNumber: number
): Promise<any | null> {
  try {
    const versions = getLocalVersions(projectId);
    const version = versions.find(v => v.version_number === versionNumber);

    if (!version) {
      console.warn(`[ProjectVersioning] Version ${versionNumber} not found`);
      return null;
    }

    console.log(`[ProjectVersioning] Restored version ${versionNumber} for project ${projectId}`);
    return version.game_data;
  } catch (error) {
    console.error('[ProjectVersioning] Failed to restore version:', error);
    return null;
  }
}

/**
 * Delete old versions to save space
 * Keeps only the most recent N versions
 */
export async function cleanupOldVersions(
  projectId: string,
  keepCount: number = 10
): Promise<void> {
  try {
    const versions = getLocalVersions(projectId);

    if (versions.length <= keepCount) {
      return; // Nothing to cleanup
    }

    // Sort by version number descending and keep only the most recent
    const sortedVersions = versions.sort((a, b) => b.version_number - a.version_number);
    const versionsToKeep = sortedVersions.slice(0, keepCount);
    
    saveLocalVersions(projectId, versionsToKeep);

    console.log(`[ProjectVersioning] Cleaned up ${versions.length - keepCount} old versions for project ${projectId}`);
  } catch (error) {
    console.error('[ProjectVersioning] Failed to cleanup versions:', error);
  }
}

/**
 * Check if changes are significant enough to warrant a new version
 * 
 * Significant changes:
 * - Different number of objects
 * - Different object IDs (additions/deletions)
 * - Changes to critical properties (position, type, name)
 */
export function hasSignificantChanges(oldData: any, newData: any): boolean {
  if (!oldData || !newData) return true;

  const oldObjects = oldData.objects || [];
  const newObjects = newData.objects || [];

  // Different object count
  if (oldObjects.length !== newObjects.length) {
    return true;
  }

  // Check if object IDs changed (additions/deletions)
  const oldIds = new Set(oldObjects.map((o: any) => o.id));
  const newIds = new Set(newObjects.map((o: any) => o.id));

  if (oldIds.size !== newIds.size) {
    return true;
  }

  for (const id of oldIds) {
    if (!newIds.has(id)) {
      return true;
    }
  }

  // Check for significant property changes
  for (const newObj of newObjects) {
    const oldObj = oldObjects.find((o: any) => o.id === newObj.id);
    
    if (!oldObj) continue;

    // Check critical properties
    const criticalProps = ['type', 'name', 'position', 'rotation', 'scale'];
    
    for (const prop of criticalProps) {
      const oldValue = JSON.stringify(oldObj[prop]);
      const newValue = JSON.stringify(newObj[prop]);
      
      if (oldValue !== newValue) {
        return true;
      }
    }
  }

  // Check gameScript changes
  if (oldData.gameScript !== newData.gameScript) {
    return true;
  }

  return false;
}
