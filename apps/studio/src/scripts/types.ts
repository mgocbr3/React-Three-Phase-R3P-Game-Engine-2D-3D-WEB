import type { SceneObject } from '@/stores/editorStore';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

// Contexto passado para cada script em runtime
export interface ScriptContext {
  object: SceneObject;
  delta: number;
  elapsed: number;
  
  // Referências da cena
  scene: {
    objects: SceneObject[];
    player: SceneObject | null;
    camera: SceneObject | null;
    getObjectById: (id: string) => SceneObject | undefined;
    getObjectsByTag: (tag: string) => SceneObject[];
  };
  
  // Controle de física
  physics: {
    rigidBody: RapierRigidBody | null;
    setVelocity: (x: number, y: number, z: number) => void;
    applyImpulse: (x: number, y: number, z: number) => void;
    setPosition: (x: number, y: number, z: number) => void;
  };
  
  // Input do jogador
  input: {
    keys: Set<string>;
    isKeyDown: (key: string) => boolean;
    isKeyPressed: (key: string) => boolean;
    mouse: { x: number; y: number; buttons: number };
  };
  
  // Sistema de eventos
  events: {
    emit: (eventName: string, data?: any) => void;
    on: (eventName: string, callback: (data: any) => void) => () => void;
  };
  
  // Referência ao mesh/group 3D
  transform: {
    group: THREE.Group | null;
    getPosition: () => THREE.Vector3;
    setPosition: (x: number, y: number, z: number) => void;
    getRotation: () => THREE.Euler;
    setRotation: (x: number, y: number, z: number) => void;
    lookAt: (target: THREE.Vector3) => void;
  };
  
  // Parâmetros configurados no Inspector
  params: Record<string, any>;
  
  // Estado local do script (persistido entre frames)
  state: Record<string, any>;
}

// Definição de parâmetro configurável
export interface ScriptParameter {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'color' | 'vector3' | 'select' | 'objectRef';
  default: any;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
  description?: string;
}

// Definição completa de um script
export interface GameScript {
  id: string;
  name: string;
  description: string;
  category: 'movement' | 'interaction' | 'visual' | 'audio' | 'logic' | 'custom';
  icon?: string;
  
  // Parâmetros editáveis no Inspector
  parameters: ScriptParameter[];
  
  // Ciclo de vida
  onStart?: (ctx: ScriptContext) => void;
  onUpdate?: (ctx: ScriptContext) => void;
  onFixedUpdate?: (ctx: ScriptContext) => void;
  onDestroy?: (ctx: ScriptContext) => void;
  
  // Eventos de colisão
  onCollisionEnter?: (ctx: ScriptContext, other: SceneObject) => void;
  onCollisionStay?: (ctx: ScriptContext, other: SceneObject) => void;
  onCollisionExit?: (ctx: ScriptContext, other: SceneObject) => void;
  
  // Eventos de trigger (sensor)
  onTriggerEnter?: (ctx: ScriptContext, other: SceneObject) => void;
  onTriggerStay?: (ctx: ScriptContext, other: SceneObject) => void;
  onTriggerExit?: (ctx: ScriptContext, other: SceneObject) => void;
}

// Instância de script anexada a um objeto
export interface ScriptInstance {
  id: string;
  scriptId: string;
  parameters: Record<string, any>;
  enabled: boolean;
}

// Estado de execução de um script
export interface ScriptRuntimeState {
  instanceId: string;
  objectId: string;
  started: boolean;
  state: Record<string, any>;
}
