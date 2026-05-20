import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type InterfaceMode = 'auto' | 'mobile' | 'desktop';

interface InterfaceStore {
  interfaceMode: InterfaceMode;
  setInterfaceMode: (mode: InterfaceMode) => void;
}

export const useInterfaceStore = create<InterfaceStore>()(
  persist(
    (set) => ({
      interfaceMode: 'auto',
      setInterfaceMode: (mode) => set({ interfaceMode: mode }),
    }),
    {
      name: 'pixl-interface-mode',
    }
  )
);
