import type { GameScript } from '../types';
import { scriptRegistry } from '../registry';

const patrolScript: GameScript = {
  id: 'builtin:patrol',
  name: 'Patrol',
  description: 'Move o objeto de um lado para outro em patrulha',
  category: 'movement',
  icon: 'MoveHorizontal',
  
  parameters: [
    {
      key: 'speed',
      label: 'Velocidade',
      type: 'number',
      default: 1,
      min: 0.1,
      max: 10,
      step: 0.1,
      description: 'Velocidade do movimento',
    },
    {
      key: 'distance',
      label: 'Distância',
      type: 'number',
      default: 5,
      min: 1,
      max: 50,
      step: 0.5,
      description: 'Distância total do percurso',
    },
    {
      key: 'axis',
      label: 'Eixo',
      type: 'select',
      default: 'x',
      options: [
        { label: 'X (Horizontal)', value: 'x' },
        { label: 'Z (Profundidade)', value: 'z' },
      ],
      description: 'Eixo do movimento',
    },
  ],

  onStart: (ctx) => {
    const pos = ctx.transform.getPosition();
    ctx.state.initialX = pos.x;
    ctx.state.initialZ = pos.z;
  },

  onUpdate: (ctx) => {
    const speed = ctx.params.speed ?? 1;
    const distance = ctx.params.distance ?? 5;
    const axis = ctx.params.axis ?? 'x';
    
    const offset = Math.sin(ctx.elapsed * speed) * (distance / 2);
    const pos = ctx.transform.getPosition();
    
    if (axis === 'x') {
      const initialX = ctx.state.initialX ?? pos.x;
      ctx.transform.setPosition(initialX + offset, pos.y, pos.z);
    } else {
      const initialZ = ctx.state.initialZ ?? pos.z;
      ctx.transform.setPosition(pos.x, pos.y, initialZ + offset);
    }
  },
};

scriptRegistry.register(patrolScript);
export default patrolScript;
