import type { GameScript } from '../types';
import { scriptRegistry } from '../registry';

const bounceScript: GameScript = {
  id: 'builtin:bounce',
  name: 'Bounce',
  description: 'Faz o objeto quicar/pular periodicamente',
  category: 'movement',
  icon: 'ArrowUp',
  
  parameters: [
    {
      key: 'height',
      label: 'Altura',
      type: 'number',
      default: 2,
      min: 0.5,
      max: 10,
      step: 0.5,
      description: 'Altura máxima do pulo',
    },
    {
      key: 'speed',
      label: 'Velocidade',
      type: 'number',
      default: 3,
      min: 0.5,
      max: 10,
      step: 0.5,
      description: 'Velocidade do movimento',
    },
    {
      key: 'squash',
      label: 'Efeito Squash',
      type: 'boolean',
      default: true,
      description: 'Adiciona efeito de achatamento',
    },
  ],

  onStart: (ctx) => {
    ctx.state.initialY = ctx.transform.getPosition().y;
  },

  onUpdate: (ctx) => {
    const height = ctx.params.height ?? 2;
    const speed = ctx.params.speed ?? 3;
    const squash = ctx.params.squash ?? true;
    
    // Use absolute value of sine for bouncing effect
    const t = ctx.elapsed * speed;
    const bounce = Math.abs(Math.sin(t)) * height;
    
    const pos = ctx.transform.getPosition();
    const initialY = ctx.state.initialY ?? 0;
    
    ctx.transform.setPosition(pos.x, initialY + bounce, pos.z);
    
    // Squash effect
    if (squash && ctx.transform.group) {
      const squashAmount = 1 - (Math.cos(t * 2) * 0.1);
      const stretchAmount = 1 + (Math.cos(t * 2) * 0.15);
      
      ctx.transform.group.scale.set(
        squashAmount,
        stretchAmount,
        squashAmount
      );
    }
  },
};

scriptRegistry.register(bounceScript);
export default bounceScript;
