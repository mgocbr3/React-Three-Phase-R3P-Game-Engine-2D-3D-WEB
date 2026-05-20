import type { GameScript } from '../types';
import { scriptRegistry } from '../registry';

const floatScript: GameScript = {
  id: 'builtin:float',
  name: 'Float',
  description: 'Faz o objeto flutuar suavemente para cima e para baixo',
  category: 'movement',
  icon: 'ArrowUpDown',
  
  parameters: [
    {
      key: 'speed',
      label: 'Velocidade',
      type: 'number',
      default: 2,
      min: 0.1,
      max: 10,
      step: 0.1,
      description: 'Velocidade da oscilação',
    },
    {
      key: 'amplitude',
      label: 'Amplitude',
      type: 'number',
      default: 0.5,
      min: 0.1,
      max: 5,
      step: 0.1,
      description: 'Altura máxima do movimento',
    },
  ],

  onStart: (ctx) => {
    // Store initial Y position
    ctx.state.initialY = ctx.transform.getPosition().y;
  },

  onUpdate: (ctx) => {
    const speed = ctx.params.speed ?? 2;
    const amplitude = ctx.params.amplitude ?? 0.5;
    const initialY = ctx.state.initialY ?? 0;
    
    const offset = Math.sin(ctx.elapsed * speed) * amplitude;
    const pos = ctx.transform.getPosition();
    
    ctx.transform.setPosition(pos.x, initialY + offset, pos.z);
  },
};

scriptRegistry.register(floatScript);
export default floatScript;
