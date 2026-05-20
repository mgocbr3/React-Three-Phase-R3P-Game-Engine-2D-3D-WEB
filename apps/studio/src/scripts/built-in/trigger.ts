import type { GameScript } from '../types';
import { scriptRegistry } from '../registry';

const triggerScript: GameScript = {
  id: 'builtin:trigger',
  name: 'Trigger Zone',
  description: 'Zona que detecta quando objetos entram ou saem',
  category: 'interaction',
  icon: 'Square',
  
  parameters: [
    {
      key: 'triggerOnce',
      label: 'Ativar Uma Vez',
      type: 'boolean',
      default: false,
      description: 'Se verdadeiro, só ativa na primeira vez',
    },
    {
      key: 'eventName',
      label: 'Nome do Evento',
      type: 'string',
      default: 'trigger:activated',
      description: 'Evento emitido quando ativado',
    },
    {
      key: 'targetTag',
      label: 'Tag do Ativador',
      type: 'string',
      default: '',
      description: 'Apenas objetos com esta tag ativam (vazio = qualquer)',
    },
    {
      key: 'showDebug',
      label: 'Mostrar Debug',
      type: 'boolean',
      default: false,
      description: 'Mostra visual de debug em play mode',
    },
  ],

  onStart: (ctx) => {
    ctx.state.triggered = false;
    ctx.state.objectsInside = new Set<string>();
  },

  onTriggerEnter: (ctx, other) => {
    const triggerOnce = ctx.params.triggerOnce ?? false;
    const eventName = ctx.params.eventName ?? 'trigger:activated';
    const targetTag = ctx.params.targetTag ?? '';
    
    // Check if already triggered (one-shot mode)
    if (triggerOnce && ctx.state.triggered) return;
    
    // Check tag filter
    if (targetTag && !other.logicSettings?.tags?.includes(targetTag)) {
      // Also check if it's the player when targetTag is empty
      if (other.type !== 'player') return;
    }
    
    ctx.state.objectsInside.add(other.id);
    ctx.state.triggered = true;
    
    ctx.events.emit(eventName, {
      triggerId: ctx.object.id,
      triggerName: ctx.object.name,
      enteredObjectId: other.id,
      enteredObjectName: other.name,
      enteredObjectType: other.type,
    });
    
    ctx.events.emit('trigger:enter', {
      triggerId: ctx.object.id,
      objectId: other.id,
    });
  },

  onTriggerExit: (ctx, other) => {
    const eventName = ctx.params.eventName ?? 'trigger:activated';
    
    ctx.state.objectsInside.delete(other.id);
    
    ctx.events.emit(`${eventName}:exit`, {
      triggerId: ctx.object.id,
      exitedObjectId: other.id,
    });
    
    ctx.events.emit('trigger:exit', {
      triggerId: ctx.object.id,
      objectId: other.id,
    });
  },
};

scriptRegistry.register(triggerScript);
export default triggerScript;
