import { create } from 'zustand';
import type { GameScript } from '@/scripts/types';
import { scriptRegistry } from '@/scripts/registry';

// Import all built-in scripts (registers them automatically)
import '@/scripts/built-in';

interface ScriptStore {
  // Custom scripts created by user
  customScripts: GameScript[];
  
  // Getters
  getAllScripts: () => GameScript[];
  getScript: (id: string) => GameScript | undefined;
  getBuiltInScripts: () => GameScript[];
  getCustomScripts: () => GameScript[];
  getScriptsByCategory: (category: GameScript['category']) => GameScript[];
  
  // Actions
  registerCustomScript: (script: GameScript) => void;
  updateCustomScript: (id: string, updates: Partial<GameScript>) => void;
  removeCustomScript: (id: string) => void;
  clearCustomScripts: () => void;
}

export const useScriptStore = create<ScriptStore>((set, get) => ({
  customScripts: [],
  
  getAllScripts: () => {
    const builtIn = scriptRegistry.getAll();
    const custom = get().customScripts;
    return [...builtIn, ...custom];
  },
  
  getScript: (id: string) => {
    const fromRegistry = scriptRegistry.get(id);
    if (fromRegistry) return fromRegistry;
    return get().customScripts.find(s => s.id === id);
  },
  
  getBuiltInScripts: () => {
    return scriptRegistry.getBuiltIn();
  },
  
  getCustomScripts: () => {
    return get().customScripts;
  },
  
  getScriptsByCategory: (category) => {
    return get().getAllScripts().filter(s => s.category === category);
  },
  
  registerCustomScript: (script) => {
    set(state => ({
      customScripts: [...state.customScripts, { ...script, id: `custom:${script.id}` }],
    }));
  },
  
  updateCustomScript: (id, updates) => {
    set(state => ({
      customScripts: state.customScripts.map(s =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
  },
  
  removeCustomScript: (id) => {
    set(state => ({
      customScripts: state.customScripts.filter(s => s.id !== id),
    }));
  },
  
  clearCustomScripts: () => {
    set({ customScripts: [] });
  },
}));
