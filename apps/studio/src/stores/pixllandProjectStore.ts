import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Game project from Pixlland platform
export interface PixllandProject {
  id: string;
  name: string;
  thumbnailUrl?: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: number;
  updatedAt: number;
  playCount?: number;
  likeCount?: number;
  category?: string;
  gameData?: any;
}

interface PixllandProjectStore {
  // Projects from Pixlland
  projects: PixllandProject[];
  currentProjectId: string | null;
  
  // Loading states
  isLoadingProjects: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  
  // Actions
  setProjects: (projects: PixllandProject[]) => void;
  addProject: (project: PixllandProject) => void;
  updateProject: (projectId: string, updates: Partial<PixllandProject>) => void;
  removeProject: (projectId: string) => void;
  setCurrentProjectId: (projectId: string | null) => void;
  
  // Loading actions
  setLoadingProjects: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setPublishing: (publishing: boolean) => void;
  
  // Utility
  getProjectById: (projectId: string) => PixllandProject | undefined;
  clearProjects: () => void;
}

export const usePixllandProjectStore = create<PixllandProjectStore>()(
  persist(
    (set, get) => ({
      // Initial state
      projects: [],
      currentProjectId: null,
      isLoadingProjects: false,
      isSaving: false,
      isPublishing: false,

      // Project actions
      setProjects: (projects) => set({ projects }),
      
      addProject: (project) => set((state) => {
        if (state.projects.some(p => p.id === project.id)) {
          return {
            projects: state.projects.map(p => 
              p.id === project.id ? { ...p, ...project } : p
            ),
          };
        }
        return { projects: [project, ...state.projects] };
      }),
      
      updateProject: (projectId, updates) => set((state) => ({
        projects: state.projects.map(p => 
          p.id === projectId ? { ...p, ...updates, updatedAt: Date.now() } : p
        ),
      })),
      
      removeProject: (projectId) => set((state) => ({
        projects: state.projects.filter(p => p.id !== projectId),
        currentProjectId: state.currentProjectId === projectId ? null : state.currentProjectId,
      })),
      
      setCurrentProjectId: (projectId) => set({ currentProjectId: projectId }),

      // Loading actions
      setLoadingProjects: (loading) => set({ isLoadingProjects: loading }),
      setSaving: (saving) => set({ isSaving: saving }),
      setPublishing: (publishing) => set({ isPublishing: publishing }),

      // Utility
      getProjectById: (projectId) => get().projects.find(p => p.id === projectId),
      
      clearProjects: () => set({ 
        projects: [], 
        currentProjectId: null,
      }),
    }),
    {
      name: 'pixlland-projects',
      partialize: (state) => ({
        projects: state.projects,
        currentProjectId: state.currentProjectId,
      }),
    }
  )
);
