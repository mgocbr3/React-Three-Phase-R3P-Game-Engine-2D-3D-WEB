import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import {
  fetchUserProjects,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  publishProject,
  saveGameData,
  fetchProjectAssets,
  addAssetToProject,
  removeAssetFromProject,
  fetchUserInventory,
  addInventoryAssetToProject,
  type Project,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ProjectAsset,
  type InventoryItem,
} from '@/services/projectService';
import { createBlankGameData } from '@/lib/blankTemplate';

// Query keys
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: string) => [...projectKeys.lists(), { filters }] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  assets: (projectId: string) => [...projectKeys.all, 'assets', projectId] as const,
  inventory: () => [...projectKeys.all, 'inventory'] as const,
};

// Fetch all user projects
export function useProjects() {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: fetchUserProjects,
    enabled: !!user,
    staleTime: 1000 * 60, // 1 minute
  });
}

// Fetch a single project
export function useProject(projectId: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(projectId || ''),
    queryFn: () => fetchProject(projectId!),
    enabled: !!projectId,
  });
}

// Create a new project
export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: CreateProjectInput) => {
      // SEMPRE garantir que tem game_data com objetos essenciais
      if (!input.game_data || !input.game_data.objects || input.game_data.objects.length === 0) {
        input.game_data = createBlankGameData(input.template_id);
        console.log('[useCreateProject]  Criando projeto com objetos padrão:', input.game_data.objects.length);
      }
      return createProject(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

// Update a project
export function useUpdateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProjectInput & { id: string }) => 
      updateProject(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.setQueryData(projectKeys.detail(data.id), data);
    },
  });
}

// Delete a project
export function useDeleteProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

// Publish a project
export function usePublishProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (projectId: string) => publishProject(projectId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.setQueryData(projectKeys.detail(data.id), data);
    },
  });
}

// Save game data
export function useSaveGameData() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectId, gameData }: { projectId: string; gameData: any }) => 
      saveGameData(projectId, gameData),
    onSuccess: (data) => {
      queryClient.setQueryData(projectKeys.detail(data.id), data);
    },
  });
}

// =====================================================
// Project Assets Hooks
// =====================================================

// Fetch project assets
export function useProjectAssets(projectId: string | null) {
  return useQuery({
    queryKey: projectKeys.assets(projectId || ''),
    queryFn: () => fetchProjectAssets(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 minute
  });
}

// Add asset to project
export function useAddAssetToProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectId, asset }: { 
      projectId: string; 
      asset: { 
        name: string; 
        asset_type?: string; 
        asset_url?: string; 
        category?: string; 
        source?: string; 
        metadata?: any; 
      } 
    }) => addAssetToProject(projectId, asset),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.assets(data.project_id) });
    },
  });
}

// Remove asset from project
export function useRemoveAssetFromProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ assetId, projectId }: { assetId: string; projectId: string }) => 
      removeAssetFromProject(assetId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.assets(variables.projectId) });
    },
  });
}

// =====================================================
// User Inventory Hooks (assets from Pixlland store)
// =====================================================

// Fetch user's inventory
export function useUserInventory() {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: projectKeys.inventory(),
    queryFn: fetchUserInventory,
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Add inventory asset to project
export function useAddInventoryAssetToProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectId, inventoryItem }: { 
      projectId: string; 
      inventoryItem: InventoryItem;
    }) => addInventoryAssetToProject(projectId, inventoryItem),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.assets(data.project_id) });
    },
  });
}
