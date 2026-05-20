import { create } from 'zustand';
import * as THREE from 'three';

/**
 * Audio Store - Gerencia o sistema de áudio 3D da engine
 * Suporta múltiplas fontes de áudio com posicionamento espacial
 * Integrado com Web Audio API e Three.js PositionalAudio
 */

export interface AudioSource {
  id: string;
  name: string;
  url: string;
  volume: number; // 0-1
  loop: boolean;
  autoplay: boolean;
  distance: number; // Max distance for 3D audio
  refDistance: number; // Reference distance (onde volume é 1.0)
  rolloffFactor: number; // Como o volume cai com distância
  isPlaying: boolean;
}

export interface AudioSettings {
  masterVolume: number; // 0-1
  enabled3DAudio: boolean;
}

interface AudioStoreState {
  // Audio Context & Listener
  audioContext: AudioContext | null;
  audioListener: THREE.AudioListener | null;
  
  // Settings
  settings: AudioSettings;
  
  // Audio sources
  audioSources: Map<string, AudioSource>;
  
  // Methods
  initAudioContext: () => Promise<void>;
  createAudioListener: (camera: THREE.Camera) => THREE.AudioListener;
  addAudioSource: (source: AudioSource) => void;
  removeAudioSource: (id: string) => void;
  updateAudioSource: (id: string, updates: Partial<AudioSource>) => void;
  getAudioSource: (id: string) => AudioSource | undefined;
  setMasterVolume: (volume: number) => void;
  toggle3DAudio: (enabled: boolean) => void;
  reset: () => void;
}

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  audioContext: null,
  audioListener: null,
  
  settings: {
    masterVolume: 0.8,
    enabled3DAudio: true,
  },
  
  audioSources: new Map(),
  
  initAudioContext: async () => {
    // Initialize Web Audio API context if not exists
    if (!get().audioContext) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log(' AudioContext created:', audioContext.state);
        
        // Resume audio context if needed (Chrome requires user interaction)
        if (audioContext.state === 'suspended') {
          console.log('⏸️ AudioContext suspended, attempting to resume...');
          await audioContext.resume();
          console.log('▶️ AudioContext resumed:', audioContext.state);
        }
        
        set({ audioContext });
      } catch (error) {
        console.error(' Failed to initialize AudioContext:', error);
      }
    }
  },
  
  createAudioListener: (camera: THREE.Camera) => {
    const listener = new THREE.AudioListener();
    camera.add(listener);
    
    set({ audioListener: listener });
    return listener;
  },
  
  addAudioSource: (source: AudioSource) => {
    const sources = new Map(get().audioSources);
    sources.set(source.id, {
      ...source,
      isPlaying: false,
    });
    set({ audioSources: sources });
  },
  
  removeAudioSource: (id: string) => {
    const sources = new Map(get().audioSources);
    sources.delete(id);
    set({ audioSources: sources });
  },
  
  updateAudioSource: (id: string, updates: Partial<AudioSource>) => {
    const source = get().audioSources.get(id);
    if (!source) return;
    
    const sources = new Map(get().audioSources);
    sources.set(id, { ...source, ...updates });
    set({ audioSources: sources });
  },
  
  getAudioSource: (id: string) => {
    return get().audioSources.get(id);
  },
  
  setMasterVolume: (volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    set((state) => ({
      settings: { ...state.settings, masterVolume: clampedVolume },
    }));
  },
  
  toggle3DAudio: (enabled: boolean) => {
    set((state) => ({
      settings: { ...state.settings, enabled3DAudio: enabled },
    }));
  },
  
  /**
   * Cleanup - Fecha AudioContext e libera recursos
   * Deve ser chamado ao sair do editor/game
   */
  cleanup: async () => {
    const { audioContext } = get();
    
    if (audioContext && audioContext.state !== 'closed') {
      try {
        await audioContext.close();
        console.log('[AudioStore]  AudioContext closed');
      } catch (error) {
        console.error('[AudioStore] Error closing AudioContext:', error);
      }
    }
    
    get().reset();
  },
  
  reset: () => {
    set({
      audioContext: null,
      audioListener: null,
      settings: {
        masterVolume: 0.8,
        enabled3DAudio: true,
      },
      audioSources: new Map(),
    });
  },
}));
