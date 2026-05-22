import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_PERSISTED_VERSION_OBJECTS = 1000;

const compactVersionData = (data: any) => {
  const objectCount = Array.isArray(data?.objects) ? data.objects.length : 0;
  if (objectCount <= MAX_PERSISTED_VERSION_OBJECTS) return data;

  return {
    truncated: true,
    objectCount,
    currentTemplateId: data?.currentTemplateId ?? null,
    gameScript: data?.gameScript,
    timestamp: data?.timestamp ?? Date.now(),
  };
};

export interface ProjectVersion {
  id: string;
  timestamp: number;
  name: string;
  data: any;
  autoSaved: boolean;
}

interface AutoSaveStore {
  // Current save state
  lastSaveTime: number | null;
  lastSaveStatus: 'saving' | 'saved' | 'unsaved' | 'error';
  saveMessage: string;
  
  // Project versions (history)
  versions: ProjectVersion[];
  currentVersionId: string | null;
  
  // Actions
  setSaveStatus: (status: 'saving' | 'saved' | 'unsaved' | 'error', message?: string) => void;
  recordVersion: (name: string, data: any, autoSaved?: boolean) => void;
  getVersion: (versionId: string) => ProjectVersion | undefined;
  getAllVersions: () => ProjectVersion[];
  restoreVersion: (versionId: string) => void;
  deleteVersion: (versionId: string) => void;
  clearOldVersions: (keepLast?: number) => void;
}

const getInitialAutoSaveState = (): Pick<
  AutoSaveStore,
  'lastSaveTime' | 'lastSaveStatus' | 'saveMessage' | 'versions' | 'currentVersionId'
> => ({
  lastSaveTime: null,
  lastSaveStatus: 'unsaved',
  saveMessage: 'Projeto não salvo',
  versions: [],
  currentVersionId: null,
});

export const useAutoSaveStore = create<AutoSaveStore>()(
  persist(
    (set, get) => ({
      ...getInitialAutoSaveState(),
      
      setSaveStatus: (status, message) => {
        const timestamp = Date.now();
        let defaultMessage = '';
        
        switch (status) {
          case 'saving':
            defaultMessage = ' Salvando...';
            break;
          case 'saved':
            defaultMessage = ` Salvo às ${new Date(timestamp).toLocaleTimeString('pt-BR')}`;
            break;
          case 'unsaved':
            defaultMessage = ' Não salvo';
            break;
          case 'error':
            defaultMessage = ' Erro ao salvar';
            break;
        }
        
        set({
          lastSaveStatus: status,
          lastSaveTime: timestamp,
          saveMessage: message || defaultMessage,
        });
      },
      
      recordVersion: (name, data, autoSaved = false) => {
        const versionId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newVersion: ProjectVersion = {
          id: versionId,
          timestamp: Date.now(),
          name,
          data: compactVersionData(data),
          autoSaved,
        };
        
        set((state) => {
          // Keep only last 50 versions to avoid bloating storage
          const versions = [newVersion, ...state.versions].slice(0, 50);
          
          return {
            versions,
            currentVersionId: versionId,
          };
        });
        
        console.log(` Versão salva: ${name} (${autoSaved ? 'auto' : 'manual'})`);
        
        return versionId;
      },
      
      getVersion: (versionId) => get().versions.find(v => v.id === versionId),
      
      getAllVersions: () => [...get().versions].sort((a, b) => b.timestamp - a.timestamp),
      
      restoreVersion: (versionId) => {
        const version = get().getVersion(versionId);
        if (version) {
          set({ currentVersionId: versionId });
          console.log(` Versão restaurada: ${version.name}`);
        }
      },
      
      deleteVersion: (versionId) => set((state) => ({
        versions: state.versions.filter(v => v.id !== versionId),
        currentVersionId: state.currentVersionId === versionId ? null : state.currentVersionId,
      })),
      
      clearOldVersions: (keepLast = 10) => set((state) => ({
        versions: state.versions.slice(0, keepLast),
      })),
    }),
    {
      name: 'pixl-autosave-store',
      version: 2,
      migrate: () => getInitialAutoSaveState(),
      partialize: (state) => ({
        lastSaveTime: state.lastSaveTime,
        lastSaveStatus: state.lastSaveStatus,
        saveMessage: state.saveMessage,
        versions: state.versions.map((version) => ({
          ...version,
          data: compactVersionData(version.data),
        })),
        currentVersionId: state.currentVersionId,
      }),
    }
  )
);
