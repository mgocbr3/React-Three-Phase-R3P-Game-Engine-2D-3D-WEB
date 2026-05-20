import type { GameScript } from '../types';
import { scriptRegistry } from '../registry';

const rotateScript: GameScript = {
  id: 'builtin:rotate',
  name: 'Rotate',
  description: 'Rotaciona o objeto continuamente em torno de um eixo',
  category: 'movement',
  icon: 'RotateCw',
  
  parameters: [
    {
      key: 'speed',
      label: 'Velocidade',
      type: 'number',
      default: 1,
      min: 0.1,
      max: 10,
      step: 0.1,
      description: 'Velocidade de rotação em radianos por segundo',
    },
    {
      key: 'axis',
      label: 'Eixo',
      type: 'select',
      default: 'y',
      options: [
        { label: 'X (Pitch)', value: 'x' },
        { label: 'Y (Yaw)', value: 'y' },
        { label: 'Z (Roll)', value: 'z' },
      ],
      description: 'Eixo de rotação',
    },
  ],

  onUpdate: (ctx) => {
    const speed = ctx.params.speed ?? 1;
    const axis = ctx.params.axis ?? 'y';
    
    if (!ctx.transform.group) return;
    
    const rotation = ctx.transform.getRotation();
    
    switch (axis) {
      case 'x':
        rotation.x += ctx.delta * speed;
        break;
      case 'y':
        rotation.y += ctx.delta * speed;
        break;
      case 'z':
        rotation.z += ctx.delta * speed;
        break;
    }
    
    ctx.transform.setRotation(rotation.x, rotation.y, rotation.z);
  },
};

scriptRegistry.register(rotateScript);
export default rotateScript;
