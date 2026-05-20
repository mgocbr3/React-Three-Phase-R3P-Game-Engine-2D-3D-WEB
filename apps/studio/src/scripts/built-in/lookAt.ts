import type { GameScript } from '../types';
import { scriptRegistry } from '../registry';
import * as THREE from 'three';

const lookAtScript: GameScript = {
  id: 'builtin:lookAt',
  name: 'Look At',
  description: 'Faz o objeto sempre olhar para o jogador ou alvo',
  category: 'movement',
  icon: 'Eye',
  
  parameters: [
    {
      key: 'targetTag',
      label: 'Tag do Alvo',
      type: 'string',
      default: '',
      description: 'Tag do objeto alvo (vazio = jogador)',
    },
    {
      key: 'lockY',
      label: 'Travar Eixo Y',
      type: 'boolean',
      default: true,
      description: 'Só rotaciona horizontalmente',
    },
    {
      key: 'smoothing',
      label: 'Suavização',
      type: 'number',
      default: 5,
      min: 0,
      max: 20,
      step: 0.5,
      description: 'Velocidade de rotação suave (0 = instantâneo)',
    },
  ],

  onUpdate: (ctx) => {
    const targetTag = ctx.params.targetTag ?? '';
    const lockY = ctx.params.lockY ?? true;
    const smoothing = ctx.params.smoothing ?? 5;
    
    // Find target
    let target: { position: [number, number, number] } | null = null;
    
    if (targetTag) {
      const tagged = ctx.scene.getObjectsByTag(targetTag);
      if (tagged.length > 0) target = tagged[0];
    } else {
      target = ctx.scene.player;
    }
    
    if (!target || !ctx.transform.group) return;
    
    const myPos = ctx.transform.getPosition();
    let targetPos = new THREE.Vector3(...target.position);
    
    // Lock Y axis if needed
    if (lockY) {
      targetPos.y = myPos.y;
    }
    
    if (smoothing > 0) {
      // Smooth rotation using quaternions
      const targetQuat = new THREE.Quaternion();
      const lookMatrix = new THREE.Matrix4();
      lookMatrix.lookAt(myPos, targetPos, new THREE.Vector3(0, 1, 0));
      targetQuat.setFromRotationMatrix(lookMatrix);
      
      ctx.transform.group.quaternion.slerp(targetQuat, smoothing * ctx.delta);
    } else {
      ctx.transform.lookAt(targetPos);
    }
  },
};

scriptRegistry.register(lookAtScript);
export default lookAtScript;
