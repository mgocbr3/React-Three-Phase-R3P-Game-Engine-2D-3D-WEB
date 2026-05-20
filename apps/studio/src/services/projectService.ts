import { pixllandClient } from '@/integrations/pixlland/client';
import { firstExistingColumn, getPixllandTableColumns } from '@/services/pixllandSchema';

// Extended Project interface for UI compatibility
export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  status: 'draft' | 'published' | 'archived';
  category?: string;
  game_data?: any;
  template_id?: string;
  play_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  template_id?: string;
  game_data?: any;
  category?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  thumbnail_url?: string;
  status?: 'draft' | 'published' | 'archived';
  category?: string;
  game_data?: any;
}

// Get current user
async function getCurrentUser() {
  const { data: { user } } = await pixllandClient.auth.getUser();
  return user;
}

// Fetch all projects for the current user
// Note: Pixlland schema may use 'owner_id' or 'creator_id' instead of 'user_id'
export async function fetchUserProjects(): Promise<Project[]> {
  const user = await getCurrentUser();
  
  if (!user) {
    console.log('[ProjectService] No user logged in');
    return [];
  }

  // Detect columns from Pixlland schema (avoids hardcoded owner_id/user_id mismatches)
  const cols = await getPixllandTableColumns('projects');
  const ownerCol = firstExistingColumn(cols, [
    'user_id',
    'owner_id',
    'creator_id',
    'profile_id',
    'author_id',
    'created_by',
    'created_by_id',
  ]);

  let data: any[] | null = null;
  let error: any = null;

  let q = (pixllandClient.from('projects') as any).select('*');
  if (ownerCol) q = q.eq(ownerCol, user.id);
  q = q.order('updated_at', { ascending: false });

  const result = await q;
  if (!result.error) {
    data = result.data;
  } else {
    error = result.error;
  }

  if (error) {
    console.error('[ProjectService] Error fetching projects:', error);
    // Return empty array instead of throwing - graceful degradation
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    user_id: row.user_id || row.owner_id || row.creator_id || row.profile_id || row.author_id || user.id,
    name: row.name || row.title || 'Untitled',
    description: row.description || undefined,
    thumbnail_url: row.thumbnail_url || row.cover_url || undefined,
    status: (row.status as 'draft' | 'published' | 'archived') || 'draft',
    category: row.category || undefined,
    game_data: row.game_data || row.data || undefined,
    template_id: row.template_id || undefined,
    play_count: row.play_count || row.plays || 0,
    like_count: row.like_count || row.likes || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

// Fetch a single project by ID
export async function fetchProject(projectId: string): Promise<Project | null> {
  // Log detalhado para debug
  const user = await getCurrentUser();
  console.log('[ProjectService] Fetching project:', { projectId, userId: user?.id });

  const { data, error } = await (pixllandClient
    .from('projects') as any)
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    console.error('[ProjectService] Error fetching project:', error, { projectId, userId: user?.id });
    throw error;
  }

  if (!data) {
    console.warn('[ProjectService] Project not found:', { projectId, userId: user?.id });
    console.warn('[ProjectService] Possible causes:');
    console.warn('  1. Project does not exist');
    console.warn('  2. RLS policy blocking access (user not owner)');
    console.warn('  3. User not authenticated');
    return null;
  }

  console.log('[ProjectService] Project fetched successfully:', { projectId, ownerId: data.user_id });

  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    description: data.description || undefined,
    thumbnail_url: data.thumbnail_url || undefined,
    status: (data.status as 'draft' | 'published' | 'archived') || 'draft',
    category: data.category || undefined,
    game_data: data.game_data,
    template_id: data.template_id || undefined,
    play_count: data.play_count || 0,
    like_count: data.like_count || 0,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Create a new project
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('User must be logged in to create a project');
  }

  const cols = await getPixllandTableColumns('projects');
  const ownerCol = firstExistingColumn(cols, [
    'user_id',
    'owner_id',
    'creator_id',
    'profile_id',
    'author_id',
    'created_by',
    'created_by_id',
  ]);
  const nameCol = firstExistingColumn(cols, ['name', 'title', 'project_name']);
  const descriptionCol = firstExistingColumn(cols, ['description', 'summary', 'about']);
  const loglineCol = firstExistingColumn(cols, ['logline', 'tagline', 'subtitle']);
  const statusCol = firstExistingColumn(cols, ['status', 'state']);
  const templateCol = firstExistingColumn(cols, ['template_id', 'template']);
  const gameDataCol = firstExistingColumn(cols, ['game_data', 'data', 'payload']);
  const categoryCol = firstExistingColumn(cols, ['category']);
  const genreCol = firstExistingColumn(cols, ['genre']);

  if (!nameCol) {
    console.error('[ProjectService] Pixlland schema mismatch: no name/title column in projects', {
      columns: Array.from(cols),
    });
    throw new Error('Backend de projetos incompatível (schema).');
  }

  const payload: Record<string, any> = {
    [nameCol]: input.name,
  };
  if (ownerCol) {
    payload[ownerCol] = user.id;
    console.log(`[ProjectService] Setting owner: ${ownerCol} = ${user.id}`);
  } else {
    console.error('[ProjectService]  WARNING: No owner column found! Project may not be accessible after creation');
  }
  if (descriptionCol) payload[descriptionCol] = input.description ?? null;
  if (loglineCol) payload[loglineCol] = input.description ?? '';
  if (statusCol) payload[statusCol] = 'draft';
  if (templateCol) payload[templateCol] = input.template_id ?? null;
  if (gameDataCol) payload[gameDataCol] = input.game_data ?? null;
  if (categoryCol) payload[categoryCol] = input.category ?? null;
  if (genreCol) payload[genreCol] = input.category ?? 'other';

  // Log only in dev flows to help diagnose Pixlland schema differences
  console.log('[ProjectService] Creating project with columns:', {
    ownerCol,
    nameCol,
    descriptionCol,
    loglineCol,
    statusCol,
    templateCol,
    gameDataCol,
    categoryCol,
    genreCol,
  });

  const { data, error } = await (pixllandClient.from('projects') as any)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[ProjectService] Error creating project:', error, { payload });
    throw error;
  }

  return {
    id: data.id,
    user_id: data.user_id || data.owner_id || data.creator_id || data.profile_id || data.author_id || user.id,
    name: data.name || data.title || input.name,
    description: data.description || undefined,
    thumbnail_url: data.thumbnail_url || undefined,
    status: (data.status as 'draft' | 'published' | 'archived') || 'draft',
    category: data.category || undefined,
    game_data: data.game_data || data.data,
    template_id: data.template_id || undefined,
    play_count: data.play_count || 0,
    like_count: data.like_count || 0,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Update an existing project
export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
  // Detect column names dynamically
  const cols = await getPixllandTableColumns('projects');
  const nameCol = firstExistingColumn(cols, ['name', 'title', 'project_name']);
  const descriptionCol = firstExistingColumn(cols, ['description', 'summary', 'about']);
  const thumbnailCol = firstExistingColumn(cols, ['thumbnail_url', 'cover_url', 'image_url']);
  const statusCol = firstExistingColumn(cols, ['status', 'state']);
  const categoryCol = firstExistingColumn(cols, ['category']);
  const gameDataCol = firstExistingColumn(cols, ['game_data', 'data', 'payload', 'content']);

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  
  if (input.name !== undefined && nameCol) updateData[nameCol] = input.name;
  if (input.description !== undefined && descriptionCol) updateData[descriptionCol] = input.description;
  if (input.thumbnail_url !== undefined && thumbnailCol) updateData[thumbnailCol] = input.thumbnail_url;
  if (input.status !== undefined && statusCol) updateData[statusCol] = input.status;
  if (input.category !== undefined && categoryCol) updateData[categoryCol] = input.category;
  if (input.game_data !== undefined && gameDataCol) updateData[gameDataCol] = input.game_data;

  const { data, error } = await (pixllandClient
    .from('projects') as any)
    .update(updateData)
    .eq('id', projectId)
    .select()
    .single();

  if (error) {
    console.error('[ProjectService] Error updating project:', error);
    throw error;
  }

  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    description: data.description || undefined,
    thumbnail_url: data.thumbnail_url || undefined,
    status: (data.status as 'draft' | 'published' | 'archived') || 'draft',
    category: data.category || undefined,
    game_data: data.game_data,
    template_id: data.template_id || undefined,
    play_count: data.play_count || 0,
    like_count: data.like_count || 0,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Delete a project
export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await (pixllandClient
    .from('projects') as any)
    .delete()
    .eq('id', projectId);

  if (error) {
    console.error('[ProjectService] Error deleting project:', error);
    throw error;
  }
}

// Publish a project
export async function publishProject(projectId: string): Promise<Project> {
  return updateProject(projectId, { status: 'published' });
}

// Unpublish a project
export async function unpublishProject(projectId: string): Promise<Project> {
  return updateProject(projectId, { status: 'draft' });
}

// Save game data to a project
export async function saveGameData(projectId: string, gameData: any): Promise<Project> {
  return updateProject(projectId, { game_data: gameData });
}

// =====================================================
// Project Assets (placeholder - for future implementation)
// =====================================================

export interface ProjectAsset {
  id: string;
  project_id: string;
  name: string;
  asset_type: string | null;
  asset_url: string | null;
  category: string | null;
  source: string | null;
  metadata: any | null;
  created_at: string | null;
}

// Placeholder - assets functionality not implemented yet
export async function fetchProjectAssets(_projectId: string): Promise<ProjectAsset[]> {
  console.log('[ProjectService] fetchProjectAssets - not implemented');
  return [];
}

export async function addAssetToProject(
  _projectId: string,
  _asset: {
    name: string;
    asset_type?: string;
    asset_url?: string;
    category?: string;
    source?: string;
    metadata?: any;
  }
): Promise<ProjectAsset> {
  throw new Error('Asset management not implemented');
}

export async function removeAssetFromProject(_assetId: string): Promise<void> {
  throw new Error('Asset management not implemented');
}

// =====================================================
// User Inventory (placeholder)
// =====================================================

export interface InventoryItem {
  id: string;
  user_id: string;
  asset_id: string;
  acquired_at: string | null;
  asset?: {
    id: string;
    name: string;
    asset_type: string | null;
    asset_url: string | null;
    thumbnail_url: string | null;
    category: string | null;
  };
}

export async function fetchUserInventory(): Promise<InventoryItem[]> {
  console.log('[ProjectService] fetchUserInventory - not implemented');
  return [];
}

export async function addInventoryAssetToProject(
  _projectId: string,
  _inventoryItem: InventoryItem
): Promise<ProjectAsset> {
  throw new Error('Inventory asset management not implemented');
}
