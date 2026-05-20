import type { GameScript } from '../types';
import { scriptRegistry } from '../registry';
import * as THREE from 'three';

const chaseScript: GameScript = {
  id: 'builtin:chase',
  name: 'Chase',
  description: 'Persegue o jogador ou outro objeto alvo',
  category: 'movement',
  icon: 'Target',
  
  parameters: [
    {
      key: 'speed',
      label: 'Velocidade',
      type: 'number',
      default: 3,
      min: 0.5,
      max: 20,
      step: 0.5,
      description: 'Velocidade de perseguição',
    },
    {
      key: 'targetTag',
      label: 'Tag do Alvo',
      type: 'string',
      default: '',
      description: 'Tag do objeto alvo (vazio = jogador)',
    },
    {
      key: 'detectionRange',
      label: 'Alcance de Detecção',
      type: 'number',
      default: 15,
      min: 1,
      max: 100,
      step: 1,
      description: 'Distância máxima para começar a perseguir',
    },
    {
      key: 'stopDistance',
      label: 'Distância de Parada',
      type: 'number',
      default: 1.5,
      min: 0.5,
      max: 10,
      step: 0.5,
      description: 'Distância mínima do alvo',
    },
    {
      key: 'lookAtTarget',
      label: 'Olhar para Alvo',
      type: 'boolean',
      default: true,
      description: 'Rotaciona para encarar o alvo',
    },
  ],

  onUpdate: (ctx) => {
    const speed = ctx.params.speed ?? 3;
    const targetTag = ctx.params.targetTag ?? '';
    const detectionRange = ctx.params.detectionRange ?? 15;
    const stopDistance = ctx.params.stopDistance ?? 1.5;
    const lookAtTarget = ctx.params.lookAtTarget ?? true;
    
    // Find target
    let target: { position: [number, number, number] } | null = null;
    
    if (targetTag) {
      const tagged = ctx.scene.getObjectsByTag(targetTag);
      if (tagged.length > 0) target = tagged[0];
    } else {
      target = ctx.scene.player;
    }
    
    if (!target) return;
    
    const myPos = ctx.transform.getPosition();
    const targetPos = new THREE.Vector3(...target.position);
    
    const distance = myPos.distanceTo(targetPos);
    
    // Check if in range
    if (distance > detectionRange) return;
    
    // Check if too close
    if (distance < stopDistance) return;
    
    // Calculate direction
    const direction = targetPos.clone().sub(myPos).normalize();
    
    // Move towards target
    const movement = direction.multiplyScalar(speed * ctx.delta);
    ctx.transform.setPosition(
      myPos.x + movement.x,
      myPos.y,
      myPos.z + movement.z
    );
    
    // Look at target
    if (lookAtTarget && ctx.transform.group) {
      const lookTarget = new THREE.Vector3(targetPos.x, myPos.y, targetPos.z);
      ctx.transform.lookAt(lookTarget);
    }
  },
};

scriptRegistry.register(chaseScript);
export default chaseScript;
