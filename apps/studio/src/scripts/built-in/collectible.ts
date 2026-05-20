import type { GameScript } from '../types';
import { scriptRegistry } from '../registry';

const collectibleScript: GameScript = {
  id: 'builtin:collectible',
  name: 'Collectible',
  description: 'Item que pode ser coletado pelo jogador',
  category: 'interaction',
  icon: 'Star',
  
  parameters: [
    {
      key: 'points',
      label: 'Pontos',
      type: 'number',
      default: 10,
      min: 1,
      max: 1000,
      step: 1,
      description: 'Pontos ganhos ao coletar',
    },
    {
      key: 'floatEffect',
      label: 'Efeito Flutuante',
      type: 'boolean',
      default: true,
      description: 'Adiciona animação de flutuação',
    },
    {
      key: 'rotateEffect',
      label: 'Efeito de Rotação',
      type: 'boolean',
      default: true,
      description: 'Adiciona rotação contínua',
    },
    {
      key: 'collectRadius',
      label: 'Raio de Coleta',
      type: 'number',
      default: 1.5,
      min: 0.5,
      max: 10,
      step: 0.5,
      description: 'Distância para coletar o item',
    },
  ],

  onStart: (ctx) => {
    ctx.state.initialY = ctx.transform.getPosition().y;
    ctx.state.collected = false;
  },

  onUpdate: (ctx) => {
    if (ctx.state.collected) return;
    
    const floatEffect = ctx.params.floatEffect ?? true;
    const rotateEffect = ctx.params.rotateEffect ?? true;
    const collectRadius = ctx.params.collectRadius ?? 1.5;
    
    const pos = ctx.transform.getPosition();
    
    // Float effect
    if (floatEffect) {
      const offset = Math.sin(ctx.elapsed * 2) * 0.3;
      ctx.transform.setPosition(pos.x, ctx.state.initialY + offset, pos.z);
    }
    
    // Rotate effect
    if (rotateEffect && ctx.transform.group) {
      const rotation = ctx.transform.getRotation();
      ctx.transform.setRotation(rotation.x, rotation.y + ctx.delta * 2, rotation.z);
    }
    
    // Check for player proximity
    const player = ctx.scene.player;
    if (!player) return;
    
    const playerPos = player.position;
    const dx = pos.x - playerPos[0];
    const dy = pos.y - playerPos[1];
    const dz = pos.z - playerPos[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance < collectRadius) {
      ctx.state.collected = true;
      
      // Emit collect event
      ctx.events.emit('collectible:collected', {
        objectId: ctx.object.id,
        points: ctx.params.points ?? 10,
      });
      
      // Emit score event
      ctx.events.emit('score:add', {
        points: ctx.params.points ?? 10,
      });
      
      // Emit destroy event
      ctx.events.emit('object:destroy', {
        id: ctx.object.id,
      });
    }
  },
};

scriptRegistry.register(collectibleScript);
export default collectibleScript;
