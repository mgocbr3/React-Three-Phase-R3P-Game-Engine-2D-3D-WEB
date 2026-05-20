import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Asset from Pixlland platform
export interface PixllandAsset {
  id: string;
  name: string;
  type: 'model' | 'texture' | 'audio' | 'prefab' | 'script';
  category: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  description?: string;
  author?: string;
  license: string;
  tags?: string[];
  addedAt: number;
}

// Connection status with Pixlland
export interface PixllandConnectionStatus {
  isConnected: boolean;
  userId: string | null;
  username: string | null;
  avatarUrl: string | null;
  lastSync: number | null;
}

interface PixllandAssetStore {
  // Connection status
  connection: PixllandConnectionStatus;
  
  // My Library - Assets acquired from Pixlland Store
  libraryAssets: PixllandAsset[];
  
  // Project Assets - Assets linked to current project
  projectAssets: PixllandAsset[];
  
  // Loading states
  isLoadingLibrary: boolean;
  isLoadingProject: boolean;
  isSyncing: boolean;
  
  // Actions - Connection
  setConnection: (status: Partial<PixllandConnectionStatus>) => void;
  disconnect: () => void;
  
  // Actions - Library
  setLibraryAssets: (assets: PixllandAsset[]) => void;
  addToLibrary: (asset: PixllandAsset) => void;
  removeFromLibrary: (assetId: string) => void;
  
  // Actions - Project
  setProjectAssets: (assets: PixllandAsset[]) => void;
  addToProject: (asset: PixllandAsset) => void;
  removeFromProject: (assetId: string) => void;
  linkAssetToProject: (assetId: string) => void;
  
  // Actions - Loading
  setLoadingLibrary: (loading: boolean) => void;
  setLoadingProject: (loading: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  
  // Utility
  getAssetById: (assetId: string) => PixllandAsset | undefined;
  isInProject: (assetId: string) => boolean;
  isInLibrary: (assetId: string) => boolean;
}

export const usePixllandAssetStore = create<PixllandAssetStore>()(
  persist(
    (set, get) => ({
      // Initial state
      connection: {
        isConnected: false,
        userId: null,
        username: null,
        avatarUrl: null,
        lastSync: null,
      },
      libraryAssets: [],
      projectAssets: [],
      isLoadingLibrary: false,
      isLoadingProject: false,
      isSyncing: false,

      // Connection actions
      setConnection: (status) => set((state) => ({
        connection: { ...state.connection, ...status },
      })),
      
      disconnect: () => set({
        connection: {
          isConnected: false,
          userId: null,
          username: null,
          avatarUrl: null,
          lastSync: null,
        },
        libraryAssets: [],
        projectAssets: [],
      }),

      // Library actions
      setLibraryAssets: (assets) => set({ libraryAssets: assets }),
      
      addToLibrary: (asset) => set((state) => {
        if (state.libraryAssets.some(a => a.id === asset.id)) return state;
        return { libraryAssets: [...state.libraryAssets, asset] };
      }),
      
      removeFromLibrary: (assetId) => set((state) => ({
        libraryAssets: state.libraryAssets.filter(a => a.id !== assetId),
        projectAssets: state.projectAssets.filter(a => a.id !== assetId),
      })),

      // Project actions
      setProjectAssets: (assets) => set({ projectAssets: assets }),
      
      addToProject: (asset) => set((state) => {
        if (state.projectAssets.some(a => a.id === asset.id)) return state;
        return { projectAssets: [...state.projectAssets, asset] };
      }),
      
      removeFromProject: (assetId) => set((state) => ({
        projectAssets: state.projectAssets.filter(a => a.id !== assetId),
      })),
      
      linkAssetToProject: (assetId) => {
        const { libraryAssets, projectAssets } = get();
        const asset = libraryAssets.find(a => a.id === assetId);
        if (asset && !projectAssets.some(a => a.id === assetId)) {
          set({ projectAssets: [...projectAssets, asset] });
        }
      },

      // Loading actions
      setLoadingLibrary: (loading) => set({ isLoadingLibrary: loading }),
      setLoadingProject: (loading) => set({ isLoadingProject: loading }),
      setSyncing: (syncing) => set({ isSyncing: syncing }),

      // Utility
      getAssetById: (assetId) => {
        const { libraryAssets, projectAssets } = get();
        return libraryAssets.find(a => a.id === assetId) || 
               projectAssets.find(a => a.id === assetId);
      },
      
      isInProject: (assetId) => get().projectAssets.some(a => a.id === assetId),
      isInLibrary: (assetId) => get().libraryAssets.some(a => a.id === assetId),
    }),
    {
      name: 'pixlland-assets',
      partialize: (state) => ({
        connection: state.connection,
        libraryAssets: state.libraryAssets,
        projectAssets: state.projectAssets,
      }),
    }
  )
);
