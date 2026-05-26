import { create } from 'zustand';

export type FontFamily = 'Inter' | 'Roboto' | 'Orbitron' | 'Press Start 2P' | 'Bangers' | 'Permanent Marker' | 'Righteous';
export type BackgroundType = 'color' | 'gradient' | 'image' | 'animated' | '3d-scene';
export type AnimatedBackground = 'particles' | 'stars' | 'waves' | 'none';

export interface MenuButton {
  id: string;
  label: string;
  action: 'start' | 'options' | 'exit' | 'custom';
  customAction?: string;
  visible: boolean;
  enabled: boolean;
  order: number;
}

export interface UIConfig {
  // General
  title: string;
  subtitle: string;
  fontFamily: FontFamily;
  titleSize: number;
  buttonSize: number;
  
  // Background
  backgroundType: BackgroundType;
  backgroundColor: string;
  gradientStart: string;
  gradientEnd: string;
  backgroundImage: string;
  animatedBackground: AnimatedBackground;
  
  // 3D Scene
  use3DScene: boolean;
  sceneOpacity: number;
  menuCameraEnabled: boolean;
  menuCameraPosition: { x: number; y: number; z: number };
  menuCameraTarget: { x: number; y: number; z: number };
  menuCameraRotation: { x: number; y: number; z: number };
  menuCameraFov: number;
  
  // Colors
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  buttonColor: string;
  buttonHoverColor: string;
  buttonTextColor: string;
  
  // 3D Title
  show3DTitle: boolean;
  title3DColor: string;
  title3DDepth: number;
  title3DSize: number;
  title3DFont: string;
  title3DMetalness: number;
  title3DRoughness: number;
  
  // Buttons
  buttons: MenuButton[];
}

interface UIStore {
  config: UIConfig;
  updateConfig: (updates: Partial<UIConfig>) => void;
  updateButton: (id: string, updates: Partial<MenuButton>) => void;
  addButton: (button: MenuButton) => void;
  removeButton: (id: string) => void;
  reorderButtons: (buttons: MenuButton[]) => void;
  resetToDefaults: () => void;
}

const defaultButtons: MenuButton[] = [
  { id: '1', label: 'Jogar', action: 'start', visible: true, enabled: true, order: 0 },
  { id: '2', label: 'Opções', action: 'options', visible: true, enabled: true, order: 1 },
  { id: '3', label: 'Sair', action: 'exit', visible: true, enabled: true, order: 2 },
];

const defaultConfig: UIConfig = {
  // General
  title: 'Meu Jogo',
  subtitle: '',
  fontFamily: 'Roboto',
  titleSize: 64,
  buttonSize: 18,
  
  // Background
  backgroundType: 'gradient',
  backgroundColor: '#1a1a2e',
  gradientStart: '#1a1a2e',
  gradientEnd: '#16213e',
  backgroundImage: '',
  animatedBackground: 'none',
  
  // 3D Scene
  use3DScene: false,
  sceneOpacity: 1.0,
  menuCameraEnabled: false,
  menuCameraPosition: { x: 0, y: 5, z: 10 },
  menuCameraTarget: { x: 0, y: 0, z: 0 },
  menuCameraRotation: { x: 0, y: 0, z: 0 },
  menuCameraFov: 60,
  
  // Colors
  primaryColor: '#3b82f6',
  secondaryColor: '#1e40af',
  textColor: '#ffffff',
  buttonColor: '#3b82f6',
  buttonHoverColor: '#2563eb',
  buttonTextColor: '#ffffff',
  
  // 3D Title
  show3DTitle: false,
  title3DColor: '#3b82f6',
  title3DDepth: 2,
  title3DSize: 2,
  title3DFont: '/fonts/helvetiker_regular.typeface.json',
  title3DMetalness: 0.5,
  title3DRoughness: 0.2,
  
  // Buttons
  buttons: defaultButtons,
};

export const useUIStore = create<UIStore>((set) => ({
  config: defaultConfig,
  
  updateConfig: (updates) =>
    set((state) => ({
      config: { ...state.config, ...updates },
    })),
  
  updateButton: (id, updates) =>
    set((state) => ({
      config: {
        ...state.config,
        buttons: state.config.buttons.map((btn) =>
          btn.id === id ? { ...btn, ...updates } : btn
        ),
      },
    })),
  
  addButton: (button) =>
    set((state) => ({
      config: {
        ...state.config,
        buttons: [...state.config.buttons, button],
      },
    })),
  
  removeButton: (id) =>
    set((state) => ({
      config: {
        ...state.config,
        buttons: state.config.buttons.filter((btn) => btn.id !== id),
      },
    })),
  
  reorderButtons: (buttons) =>
    set((state) => ({
      config: {
        ...state.config,
        buttons,
      },
    })),
  
  resetToDefaults: () =>
    set(() => ({
      config: defaultConfig,
    })),
}));
