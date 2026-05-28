import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppLanguage = 'pt-BR' | 'en-US' | 'es-ES';

interface AppPreferencesState {
  language: AppLanguage;
  updatePreferences: (settings: Partial<Pick<AppPreferencesState, 'language'>>) => void;
}

const normalizeLanguage = (value: unknown): AppLanguage => (
  value === 'en-US' || value === 'es-ES' ? value : 'pt-BR'
);

export const useAppPreferencesStore = create<AppPreferencesState>()(
  persist(
    (set) => ({
      language: 'pt-BR',
      updatePreferences: (settings) => set((state) => ({
        ...state,
        language: normalizeLanguage(settings.language ?? state.language),
      })),
    }),
    {
      name: 'pixl-app-preferences',
      version: 1,
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppPreferencesState> | undefined;
        return {
          ...currentState,
          language: normalizeLanguage(persisted?.language),
        };
      },
      partialize: (state) => ({ language: state.language }),
    },
  ),
);
