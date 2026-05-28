// Engine-level system prompt shared by all LLM providers.
// Goal: keep a consistent behavior and avoid verbose boilerplate replies.

export const VIBE_CODE_SYSTEM_PROMPT = `/no_think
Você é o Vibe Code AI da PixlPlayground Engine.

Seu escopo principal é desenvolvimento de jogos na engine com:
- 2D: Phaser
- 3D: Three.js e React Three Fiber (R3F), com drei e rapier quando aplicável

## Regras de resposta (obrigatórias)
1. Seja direto e prático. Não escreva manual longo automaticamente.
2. Se o usuário só cumprimentar (ex.: "oi", "olá"), responda em no máximo 1 frase curta e pergunte o objetivo.
3. Não liste catálogo de comandos, exemplos extensos ou documentação, a menos que o usuário peça explicitamente.
4. Quando for executar ações na cena, explique em 1 linha o que vai fazer e já execute.
5. Mantenha foco no pedido atual, sem introduções repetitivas.

## Estratégia técnica
1. Se o pedido for claramente 2D, priorize Phaser.
2. Se for 3D e o app for React, priorize R3F.
3. Se for 3D sem React, priorize Three.js.
4. Se faltar contexto, faça uma pergunta curta e objetiva.

## Formato de ação da engine (Agent Mode)
Quando precisar alterar a cena, use blocos \`agent-action\` com ações como:
- add_object
- update_object
- delete_object
- add_script
- update_player
- update_camera
- create_group

Use nomes claros, coordenadas válidas e parâmetros físicos coerentes.`;

// Generate context about current scene for the AI
export const generateSceneContext = (objects: any[]): string => {
  if (!objects || objects.length === 0) {
    return 'A cena está vazia.';
  }

  const objectDescriptions = objects.map(obj => {
    const pos = obj.position ? `pos(${obj.position.join(', ')})` : '';
    const scale = obj.scale ? `scale(${obj.scale.join(', ')})` : '';
    const physics = obj.physicsSettings?.bodyType || 'dynamic';
    const behavior = obj.logicSettings?.behavior || 'none';
    
    return `- **${obj.name}** (${obj.type}): ${pos} ${scale} [${physics}] ${behavior !== 'none' ? `behavior:${behavior}` : ''}`;
  }).join('\n');

  const player = objects.find(o => o.type === 'player');
  const camera = objects.find(o => o.type === 'camera');

  let context = `## Cena Atual (${objects.length} objetos)\n${objectDescriptions}`;

  if (player?.playerSettings) {
    const ps = player.playerSettings;
    context += `\n\n## Player: speed=${ps.speed}, jump=${ps.jumpForce}, mode=${ps.movementMode}`;
  }

  if (camera?.cameraSettings) {
    const cs = camera.cameraSettings;
    context += `\n## Camera: mode=${cs.mode}, distance=${cs.distance}, height=${cs.height}`;
  }

  return context;
};

// Available scripts for reference
export const AVAILABLE_SCRIPTS = [
  { id: 'rotate', name: 'Rotate', description: 'Rotação contínua em um eixo' },
  { id: 'float', name: 'Float', description: 'Movimento flutuante para cima/baixo' },
  { id: 'bounce', name: 'Bounce', description: 'Efeito de bounce/pulo' },
  { id: 'patrol', name: 'Patrol', description: 'Movimento de patrulha entre pontos' },
  { id: 'lookAt', name: 'Look At', description: 'Sempre olha para o player' },
  { id: 'chase', name: 'Chase', description: 'Persegue o player' },
  { id: 'collectible', name: 'Collectible', description: 'Coletável que desaparece ao tocar' },
  { id: 'trigger', name: 'Trigger', description: 'Zona de trigger para eventos' },
];
