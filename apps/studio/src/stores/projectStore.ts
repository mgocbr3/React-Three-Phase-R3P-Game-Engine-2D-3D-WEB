import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedProject {
  id: string;
  name: string;
  templateId: string | null;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
}

interface ProjectStore {
  projects: SavedProject[];
  currentProjectId: string | null;
  
  // Actions
  createProject: (name: string, templateId?: string | null) => SavedProject;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  updateProjectTimestamp: (id: string) => void;
  setCurrentProject: (id: string | null) => void;
  upsertProject: (project: SavedProject) => void;
  getProject: (id: string) => SavedProject | undefined;
}

const generateId = () => `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      
      createProject: (name: string, templateId: string | null = null) => {
        const newProject: SavedProject = {
          id: generateId(),
          name: name.trim() || 'Novo Projeto',
          templateId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        
        set((state) => ({
          projects: [newProject, ...state.projects],
          currentProjectId: newProject.id,
        }));
        
        return newProject;
      },
      
      deleteProject: (id: string) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
        }));
        // Also remove the saved project data from localStorage
        localStorage.removeItem(`pixl-project-${id}`);
      },
      
      renameProject: (id: string, name: string) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name: name.trim(), updatedAt: Date.now() } : p
          ),
        }));
      },
      
      updateProjectTimestamp: (id: string) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, updatedAt: Date.now() } : p
          ),
        }));
      },
      
      setCurrentProject: (id: string | null) => {
        set({ currentProjectId: id });
      },

      upsertProject: (project: SavedProject) => {
        set((state) => {
          const exists = state.projects.some((p) => p.id === project.id);
          return {
            projects: exists
              ? state.projects.map((p) => p.id === project.id ? { ...p, ...project } : p)
              : [project, ...state.projects],
            currentProjectId: project.id,
          };
        });
      },
      
      getProject: (id: string) => {
        return get().projects.find((p) => p.id === id);
      },
    }),
    {
      name: 'pixl-projects',
    }
  )
);
