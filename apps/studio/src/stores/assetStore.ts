import { create } from 'zustand';
import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface LoadedModel {
  id: string;
  name: string;
  url: string;
  gltf: GLTF;
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  loadedAt: number;
  size: number; // in bytes
}

export interface LoadedTexture {
  id: string;
  name: string;
  url: string;
  texture: THREE.Texture;
  type: 'albedo' | 'normal' | 'roughness' | 'metalness' | 'ao' | 'emissive' | 'height';
  loadedAt: number;
}

export interface AssetLoadProgress {
  id: string;
  name: string;
  progress: number; // 0-100
  status: 'loading' | 'complete' | 'error';
  error?: string;
}

export interface ProjectAsset {
  id: string;
  name: string;
  type: 'model' | 'texture' | 'image' | 'sprite' | 'spritesheet' | 'tilemap' | 'audio' | 'script';
  url: string;
  path?: string;
  thumbnail?: string;
  folder: string;
  createdAt: number;
  metadata?: {
    polyCount?: number;
    animations?: string[];
    dimensions?: { width: number; height: number };
    format?: string;
    [key: string]: unknown;
  };
}

interface AssetStore {
  // Caches
  modelCache: Map<string, LoadedModel>;
  textureCache: Map<string, LoadedTexture>;
  
  // Project assets (user's imported files)
  projectAssets: ProjectAsset[];
  
  // Loading state
  loadingAssets: AssetLoadProgress[];
  
  // Selected asset for inspector
  selectedAssetId: string | null;
  
  // Actions
  addModelToCache: (model: LoadedModel) => void;
  removeModelFromCache: (id: string) => void;
  getModelFromCache: (url: string) => LoadedModel | undefined;
  
  addTextureToCache: (texture: LoadedTexture) => void;
  removeTextureFromCache: (id: string) => void;
  getTextureFromCache: (url: string) => LoadedTexture | undefined;
  
  addProjectAsset: (asset: Omit<ProjectAsset, 'id' | 'createdAt'>) => string;
  removeProjectAsset: (id: string) => void;
  updateProjectAsset: (id: string, updates: Partial<ProjectAsset>) => void;
  
  setLoadingProgress: (id: string, name: string, progress: number, status: AssetLoadProgress['status'], error?: string) => void;
  removeLoadingProgress: (id: string) => void;
  
  selectAsset: (id: string | null) => void;
  
  // Utility
  clearCache: () => void;
  getCacheSize: () => { models: number; textures: number; totalBytes: number };
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useAssetStore = create<AssetStore>((set, get) => ({
  modelCache: new Map(),
  textureCache: new Map(),
  projectAssets: [],
  loadingAssets: [],
  selectedAssetId: null,
  
  addModelToCache: (model) => {
    set((state) => {
      const newCache = new Map(state.modelCache);
      newCache.set(model.url, model);
      return { modelCache: newCache };
    });
  },
  
  removeModelFromCache: (id) => {
    set((state) => {
      const newCache = new Map(state.modelCache);
      for (const [url, model] of newCache) {
        if (model.id === id) {
          // Dispose Three.js resources
          model.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry?.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material?.dispose();
              }
            }
          });
          newCache.delete(url);
          break;
        }
      }
      return { modelCache: newCache };
    });
  },
  
  getModelFromCache: (url) => {
    return get().modelCache.get(url);
  },
  
  addTextureToCache: (texture) => {
    set((state) => {
      const newCache = new Map(state.textureCache);
      newCache.set(texture.url, texture);
      return { textureCache: newCache };
    });
  },
  
  removeTextureFromCache: (id) => {
    set((state) => {
      const newCache = new Map(state.textureCache);
      for (const [url, tex] of newCache) {
        if (tex.id === id) {
          tex.texture.dispose();
          newCache.delete(url);
          break;
        }
      }
      return { textureCache: newCache };
    });
  },
  
  getTextureFromCache: (url) => {
    return get().textureCache.get(url);
  },
  
  addProjectAsset: (asset) => {
    const id = generateId();
    set((state) => ({
      projectAssets: [...state.projectAssets, {
        ...asset,
        id,
        createdAt: Date.now(),
      }],
    }));
    return id;
  },
  
  removeProjectAsset: (id) => {
    set((state) => ({
      projectAssets: state.projectAssets.filter(a => a.id !== id),
      selectedAssetId: state.selectedAssetId === id ? null : state.selectedAssetId,
    }));
  },
  
  updateProjectAsset: (id, updates) => {
    set((state) => ({
      projectAssets: state.projectAssets.map(a =>
        a.id === id ? { ...a, ...updates } : a
      ),
    }));
  },
  
  setLoadingProgress: (id, name, progress, status, error) => {
    set((state) => {
      const existing = state.loadingAssets.find(a => a.id === id);
      if (existing) {
        return {
          loadingAssets: state.loadingAssets.map(a =>
            a.id === id ? { ...a, progress, status, error } : a
          ),
        };
      }
      return {
        loadingAssets: [...state.loadingAssets, { id, name, progress, status, error }],
      };
    });
  },
  
  removeLoadingProgress: (id) => {
    set((state) => ({
      loadingAssets: state.loadingAssets.filter(a => a.id !== id),
    }));
  },
  
  selectAsset: (id) => {
    set({ selectedAssetId: id });
  },
  
  clearCache: () => {
    const { modelCache, textureCache } = get();
    
    // Dispose all models
    modelCache.forEach((model) => {
      model.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
    });
    
    // Dispose all textures
    textureCache.forEach((tex) => {
      tex.texture.dispose();
    });
    
    set({
      modelCache: new Map(),
      textureCache: new Map(),
    });
  },
  
  getCacheSize: () => {
    const { modelCache, textureCache } = get();
    let totalBytes = 0;
    
    modelCache.forEach(m => totalBytes += m.size);
    
    return {
      models: modelCache.size,
      textures: textureCache.size,
      totalBytes,
    };
  },
}));
