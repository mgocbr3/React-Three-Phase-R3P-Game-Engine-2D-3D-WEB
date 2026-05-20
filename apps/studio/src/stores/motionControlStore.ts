import { create } from 'zustand';

export type MotionControlMode = 'off' | 'cursor' | 'character' | 'camera' | 'custom';

export type GestureAction = 'none' | 'click' | 'grab' | 'attack' | 'brake' | 'block' | 'special' | 'jump' | 'release' | 'interact' | 'shoot' | 'select' | 'aim';

export interface MotionControlMapping {
  // What hand movement controls
  handMovement: 'cursor' | 'rotation' | 'position' | 'none';
  // Gesture mappings
  pinchAction: GestureAction;
  fistAction: GestureAction;
  openHandAction: GestureAction;
  pointAction: GestureAction;
  // Sensitivity
  movementSensitivity: number;
  rotationSensitivity: number;
  // Smoothing
  smoothing: number;
}

interface MotionControlState {
  enabled: boolean;
  mode: MotionControlMode;
  mapping: MotionControlMapping;
  showPreview: boolean;
  showDebugOverlay: boolean;
  // Last processed hand position (smoothed)
  smoothedPosition: { x: number; y: number };
  // Actions
  setEnabled: (enabled: boolean) => void;
  setMode: (mode: MotionControlMode) => void;
  updateMapping: (mapping: Partial<MotionControlMapping>) => void;
  setShowPreview: (show: boolean) => void;
  setShowDebugOverlay: (show: boolean) => void;
  updateSmoothedPosition: (x: number, y: number) => void;
  resetToDefaults: () => void;
}

const defaultMapping: MotionControlMapping = {
  handMovement: 'cursor',
  pinchAction: 'click',
  fistAction: 'special',
  openHandAction: 'jump',
  pointAction: 'shoot',
  movementSensitivity: 1.0,
  rotationSensitivity: 1.0,
  smoothing: 0.15,
};

export const useMotionControlStore = create<MotionControlState>((set) => ({
  enabled: false,
  mode: 'off',
  mapping: defaultMapping,
  showPreview: true,
  showDebugOverlay: false,
  smoothedPosition: { x: 0, y: 0 },

  setEnabled: (enabled) => set({ enabled, mode: enabled ? 'cursor' : 'off' }),
  
  setMode: (mode) => set({ mode, enabled: mode !== 'off' }),
  
  updateMapping: (mapping) => set((state) => ({
    mapping: { ...state.mapping, ...mapping },
  })),
  
  setShowPreview: (showPreview) => set({ showPreview }),
  
  setShowDebugOverlay: (showDebugOverlay) => set({ showDebugOverlay }),
  
  updateSmoothedPosition: (x, y) => set((state) => {
    const smoothing = state.mapping.smoothing;
    return {
      smoothedPosition: {
        x: state.smoothedPosition.x + (x - state.smoothedPosition.x) * smoothing,
        y: state.smoothedPosition.y + (y - state.smoothedPosition.y) * smoothing,
      },
    };
  }),
  
  resetToDefaults: () => set({
    enabled: false,
    mode: 'off',
    mapping: defaultMapping,
    showPreview: true,
    showDebugOverlay: false,
    smoothedPosition: { x: 0, y: 0 },
  }),
}));
