import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============ TYPES ============

export type InputType = 'keyboard' | 'gamepad' | 'touch';

export interface KeyboardBinding {
  type: 'keyboard';
  code: string; // e.g., 'KeyW', 'Space', 'ArrowUp'
  label: string; // Human-readable label
}

export interface GamepadBinding {
  type: 'gamepad';
  button?: number; // Button index (0-17)
  axis?: number; // Axis index (0-3)
  axisDirection?: 'positive' | 'negative';
  label: string;
}

export interface TouchBinding {
  type: 'touch';
  gesture: 'joystick_up' | 'joystick_down' | 'joystick_left' | 'joystick_right' | 
           'button_jump' | 'button_action1' | 'button_action2' | 'swipe_up' | 'swipe_down';
  label: string;
}

export type InputBinding = KeyboardBinding | GamepadBinding | TouchBinding;

export interface InputAction {
  id: string;
  name: string;
  description?: string;
  bindings: InputBinding[];
  isBuiltIn?: boolean; // Built-in actions cannot be deleted
}

// ============ DEFAULTS ============

const DEFAULT_ACTIONS: InputAction[] = [
  {
    id: 'move_forward',
    name: 'Mover Frente',
    description: 'Move o personagem para frente',
    isBuiltIn: true,
    bindings: [
      { type: 'keyboard', code: 'KeyW', label: 'W' },
      { type: 'keyboard', code: 'ArrowUp', label: '↑' },
      { type: 'gamepad', axis: 1, axisDirection: 'negative', label: 'L-Stick ↑' },
      { type: 'touch', gesture: 'joystick_up', label: 'Joystick ↑' },
    ],
  },
  {
    id: 'move_backward',
    name: 'Mover Trás',
    description: 'Move o personagem para trás',
    isBuiltIn: true,
    bindings: [
      { type: 'keyboard', code: 'KeyS', label: 'S' },
      { type: 'keyboard', code: 'ArrowDown', label: '↓' },
      { type: 'gamepad', axis: 1, axisDirection: 'positive', label: 'L-Stick ↓' },
      { type: 'touch', gesture: 'joystick_down', label: 'Joystick ↓' },
    ],
  },
  {
    id: 'move_left',
    name: 'Mover Esquerda',
    description: 'Move o personagem para a esquerda',
    isBuiltIn: true,
    bindings: [
      { type: 'keyboard', code: 'KeyA', label: 'A' },
      { type: 'keyboard', code: 'ArrowLeft', label: '←' },
      { type: 'gamepad', axis: 0, axisDirection: 'negative', label: 'L-Stick ←' },
      { type: 'touch', gesture: 'joystick_left', label: 'Joystick ←' },
    ],
  },
  {
    id: 'move_right',
    name: 'Mover Direita',
    description: 'Move o personagem para a direita',
    isBuiltIn: true,
    bindings: [
      { type: 'keyboard', code: 'KeyD', label: 'D' },
      { type: 'keyboard', code: 'ArrowRight', label: '→' },
      { type: 'gamepad', axis: 0, axisDirection: 'positive', label: 'L-Stick →' },
      { type: 'touch', gesture: 'joystick_right', label: 'Joystick →' },
    ],
  },
  {
    id: 'jump',
    name: 'Pular',
    description: 'Faz o personagem pular',
    isBuiltIn: true,
    bindings: [
      { type: 'keyboard', code: 'Space', label: 'Espaço' },
      { type: 'gamepad', button: 0, label: 'A / X' },
      { type: 'touch', gesture: 'button_jump', label: 'Botão Pulo' },
    ],
  },
  {
    id: 'attack',
    name: 'Atacar',
    description: 'Executa ataque primário',
    isBuiltIn: true,
    bindings: [
      { type: 'keyboard', code: 'KeyE', label: 'E' },
      { type: 'keyboard', code: 'Mouse0', label: 'Clique Esquerdo' },
      { type: 'gamepad', button: 2, label: 'X / □' },
      { type: 'touch', gesture: 'button_action1', label: 'Botão A' },
    ],
  },
  {
    id: 'interact',
    name: 'Interagir',
    description: 'Interage com objetos ou NPCs',
    isBuiltIn: true,
    bindings: [
      { type: 'keyboard', code: 'KeyF', label: 'F' },
      { type: 'gamepad', button: 3, label: 'Y / △' },
      { type: 'touch', gesture: 'button_action2', label: 'Botão B' },
    ],
  },
  {
    id: 'sprint',
    name: 'Correr',
    description: 'Aumenta a velocidade de movimento',
    isBuiltIn: true,
    bindings: [
      { type: 'keyboard', code: 'ShiftLeft', label: 'Shift' },
      { type: 'gamepad', button: 10, label: 'L3' },
    ],
  },
  {
    id: 'crouch',
    name: 'Agachar',
    description: 'Abaixa o personagem',
    isBuiltIn: true,
    bindings: [
      { type: 'keyboard', code: 'ControlLeft', label: 'Ctrl' },
      { type: 'keyboard', code: 'KeyC', label: 'C' },
      { type: 'gamepad', button: 11, label: 'R3' },
    ],
  },
  {
    id: 'pause',
    name: 'Pausar',
    description: 'Pausa o jogo',
    isBuiltIn: true,
    bindings: [
      { type: 'keyboard', code: 'Escape', label: 'ESC' },
      { type: 'gamepad', button: 9, label: 'Start' },
    ],
  },
];

// ============ STORE ============

interface InputMapStore {
  actions: InputAction[];
  
  // Actions CRUD
  addAction: (action: Omit<InputAction, 'id'>) => void;
  updateAction: (id: string, updates: Partial<InputAction>) => void;
  removeAction: (id: string) => void;
  
  // Binding management
  addBinding: (actionId: string, binding: InputBinding) => void;
  removeBinding: (actionId: string, bindingIndex: number) => void;
  updateBinding: (actionId: string, bindingIndex: number, binding: InputBinding) => void;
  
  // Utils
  getActionById: (id: string) => InputAction | undefined;
  isKeyBound: (code: string) => { actionId: string; actionName: string } | null;
  resetToDefaults: () => void;
}

export const useInputMapStore = create<InputMapStore>()(
  persist(
    (set, get) => ({
      actions: DEFAULT_ACTIONS,
      
      addAction: (action) => {
        const id = `action_${Date.now()}`;
        set((state) => ({
          actions: [...state.actions, { ...action, id }],
        }));
      },
      
      updateAction: (id, updates) => {
        set((state) => ({
          actions: state.actions.map((a) => 
            a.id === id ? { ...a, ...updates } : a
          ),
        }));
      },
      
      removeAction: (id) => {
        set((state) => ({
          actions: state.actions.filter((a) => a.id !== id || a.isBuiltIn),
        }));
      },
      
      addBinding: (actionId, binding) => {
        set((state) => ({
          actions: state.actions.map((a) => 
            a.id === actionId 
              ? { ...a, bindings: [...a.bindings, binding] }
              : a
          ),
        }));
      },
      
      removeBinding: (actionId, bindingIndex) => {
        set((state) => ({
          actions: state.actions.map((a) => 
            a.id === actionId 
              ? { ...a, bindings: a.bindings.filter((_, i) => i !== bindingIndex) }
              : a
          ),
        }));
      },
      
      updateBinding: (actionId, bindingIndex, binding) => {
        set((state) => ({
          actions: state.actions.map((a) => 
            a.id === actionId 
              ? { 
                  ...a, 
                  bindings: a.bindings.map((b, i) => i === bindingIndex ? binding : b)
                }
              : a
          ),
        }));
      },
      
      getActionById: (id) => get().actions.find((a) => a.id === id),
      
      isKeyBound: (code) => {
        for (const action of get().actions) {
          for (const binding of action.bindings) {
            if (binding.type === 'keyboard' && binding.code === code) {
              return { actionId: action.id, actionName: action.name };
            }
          }
        }
        return null;
      },
      
      resetToDefaults: () => set({ actions: DEFAULT_ACTIONS }),
    }),
    {
      name: 'pixl-input-map',
      version: 1,
    }
  )
);

// ============ HELPERS ============

export const KEYBOARD_LABELS: Record<string, string> = {
  KeyA: 'A', KeyB: 'B', KeyC: 'C', KeyD: 'D', KeyE: 'E', KeyF: 'F',
  KeyG: 'G', KeyH: 'H', KeyI: 'I', KeyJ: 'J', KeyK: 'K', KeyL: 'L',
  KeyM: 'M', KeyN: 'N', KeyO: 'O', KeyP: 'P', KeyQ: 'Q', KeyR: 'R',
  KeyS: 'S', KeyT: 'T', KeyU: 'U', KeyV: 'V', KeyW: 'W', KeyX: 'X',
  KeyY: 'Y', KeyZ: 'Z',
  Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
  Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',
  Space: 'Espaço', Enter: 'Enter', Escape: 'ESC', Tab: 'Tab',
  ShiftLeft: 'Shift', ShiftRight: 'Shift Dir', 
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl Dir',
  AltLeft: 'Alt', AltRight: 'Alt Dir',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Backspace: 'Backspace', Delete: 'Delete',
  Mouse0: 'Clique Esquerdo', Mouse1: 'Clique Meio', Mouse2: 'Clique Direito',
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
  F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
};

export const GAMEPAD_BUTTON_LABELS: Record<number, string> = {
  0: 'A / X',
  1: 'B / ○',
  2: 'X / □',
  3: 'Y / △',
  4: 'LB / L1',
  5: 'RB / R1',
  6: 'LT / L2',
  7: 'RT / R2',
  8: 'Back / Select',
  9: 'Start',
  10: 'L3',
  11: 'R3',
  12: 'D-Pad ↑',
  13: 'D-Pad ↓',
  14: 'D-Pad ←',
  15: 'D-Pad →',
  16: 'Guide / Home',
  17: 'Touchpad',
};

export const TOUCH_GESTURE_LABELS: Record<string, string> = {
  joystick_up: 'Joystick ↑',
  joystick_down: 'Joystick ↓',
  joystick_left: 'Joystick ←',
  joystick_right: 'Joystick →',
  button_jump: 'Botão Pulo',
  button_action1: 'Botão A',
  button_action2: 'Botão B',
  swipe_up: 'Deslizar ↑',
  swipe_down: 'Deslizar ↓',
};

export const getBindingLabel = (binding: InputBinding): string => {
  if (binding.type === 'keyboard') {
    return KEYBOARD_LABELS[binding.code] || binding.code;
  }
  if (binding.type === 'gamepad') {
    if (binding.button !== undefined) {
      return GAMEPAD_BUTTON_LABELS[binding.button] || `Botão ${binding.button}`;
    }
    if (binding.axis !== undefined) {
      const dir = binding.axisDirection === 'positive' ? '+' : '-';
      return `Eixo ${binding.axis} ${dir}`;
    }
  }
  if (binding.type === 'touch') {
    return TOUCH_GESTURE_LABELS[binding.gesture] || binding.gesture;
  }
  return 'Desconhecido';
};
