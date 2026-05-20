import { create } from 'zustand';

export type TemplateId = 'adventure' | 'fps-horror' | 'racing' | 'rpg-topdown' | 'platformer-2d' | 'social-hub' | 'hyper-realistic' | 'gta6-vice-city' | 'blank';

export interface GameTemplate {
  id: TemplateId;
  name: string;
  description: string;
  icon: string;
  color: 'purple' | 'cyan' | 'pink' | 'green' | 'orange' | 'red' | 'blue';
  features: string[];
}

export const GAME_TEMPLATES: GameTemplate[] = [
  {
    id: 'adventure',
    name: 'Adventure',
    description: 'Terceira pessoa estilo Zelda/Mario com plataformas e exploração',
    icon: '',
    color: 'purple',
    features: ['3ª Pessoa', 'Física', 'Plataformas', 'NPCs'],
  },
  {
    id: 'fps-horror',
    name: 'FPS Horror',
    description: 'Primeira pessoa com atmosfera tensa, lanterna e neblina',
    icon: '',
    color: 'red',
    features: ['1ª Pessoa', 'Lanterna', 'Neblina', 'Sustos'],
  },
  {
    id: 'racing',
    name: 'Racing',
    description: 'Corrida arcade com física de veículos e obstáculos',
    icon: '',
    color: 'orange',
    features: ['Veículos', 'Pista', 'Power-ups', 'Turbo'],
  },
  {
    id: 'rpg-topdown',
    name: 'RPG Top-Down',
    description: 'Vista isométrica estilo Diablo com combate e inventário',
    icon: '',
    color: 'cyan',
    features: ['Vista Top', 'Combate', 'Loot', 'Skills'],
  },
  {
    id: 'platformer-2d',
    name: '2.5D Platformer',
    description: 'Plataforma lateral em 3D estilo Inside/Limbo',
    icon: '',
    color: 'pink',
    features: ['Sidescroller', 'Puzzles', 'Atmosférico', 'Física'],
  },
  {
    id: 'social-hub',
    name: 'Social Hub',
    description: 'Espaço social multiplayer para encontros e interação',
    icon: '',
    color: 'green',
    features: ['Multiplayer', 'Chat', 'Emotes', 'Minigames'],
  },
  {
    id: 'hyper-realistic',
    name: 'Hyper-Realistic',
    description: 'Cenários fotorealistas com Gaussian Splatting + física híbrida',
    icon: '',
    color: 'blue',
    features: ['Splat 3DGS', 'Fotorealismo', 'WebGPU Ready', 'Física Híbrida'],
  },
  {
    id: 'gta6-vice-city',
    name: 'GTA 6 Vice City',
    description: 'Open world estilo Miami com prédios Art Deco, neons, praia e carros',
    icon: '',
    color: 'pink',
    features: ['Open World', 'Vice City', 'Carros', 'Neon Lights'],
  },
];

interface GameState {
  currentTemplate: TemplateId | null;
  isPlaying: boolean;
  isEditing: boolean;
  playerPosition: [number, number, number];
  health: number;
  score: number;
  
  // Actions
  setCurrentTemplate: (template: TemplateId | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsEditing: (editing: boolean) => void;
  setPlayerPosition: (pos: [number, number, number]) => void;
  updateHealth: (delta: number) => void;
  addScore: (points: number) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentTemplate: null,
  isPlaying: false,
  isEditing: false,
  playerPosition: [0, 2, 0],
  health: 100,
  score: 0,
  
  setCurrentTemplate: (template) => set({ currentTemplate: template }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsEditing: (editing) => set({ isEditing: editing }),
  setPlayerPosition: (pos) => set({ playerPosition: pos }),
  updateHealth: (delta) => set((state) => ({ health: Math.max(0, Math.min(100, state.health + delta)) })),
  addScore: (points) => set((state) => ({ score: state.score + points })),
  resetGame: () => set({ health: 100, score: 0, playerPosition: [0, 2, 0] }),
}));
