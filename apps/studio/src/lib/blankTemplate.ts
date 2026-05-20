/**
 * Template Blank - Objetos essenciais para qualquer jogo
 * 
 * IMPORTANTE: Esta é a fonte única da verdade (Single Source of Truth)
 * para projetos em branco. Todos os projetos devem começar com:
 * - Sun Light (iluminação principal)
 * - Main Camera (câmera que segue o player)
 * - Player (personagem controlável)
 * - Ground (chão para andar)
 * 
 *  NUNCA crie projetos vazios sem estes objetos!
 */

import type { SceneObject } from '@/stores/editorStore';

export function getBlankTemplateObjects(): SceneObject[] {
  return [
    // Sun Light - Iluminação principal
    {
      id: 'sun-main',
      name: 'Sun Light',
      type: 'sunlight' as const,
      position: [50, 100, 50] as [number, number, number],
      rotation: [-Math.PI / 3, Math.PI / 4, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      color: '#ffffff',
      visible: true,
      locked: false,
      isStatic: true,
      lightSettings: {
        intensity: 1.5,
        distance: 0,
        decay: 2,
        temperature: 5600,
        useTemperature: false,
        angle: Math.PI / 6,
        penumbra: 0.5,
        sunElevation: 45,
        sunAzimuth: 180,
        castShadow: true,
        shadowMapSize: 2048,
        shadowBias: -0.0001,
        shadowNormalBias: 0.02,
        shadowRadius: 2,
        shadowCameraSize: 50,
        volumetric: false,
        volumetricIntensity: 0.5,
        helperVisible: false,
      },
    },

    // Main Camera - Câmera que segue o player
    {
      id: 'camera-main',
      name: 'Main Camera',
      type: 'camera' as const,
      position: [0, 10, 15] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      color: '#ffffff',
      visible: true,
      locked: false,
      cameraSettings: {
        mode: 'third-person' as const,
        distance: 15,
        height: 10,
        fov: 60,
        followPlayer: true,
        targetId: 'player-1',
        lockedZ: false,
        lockedY: false,
        smoothing: 0.1,
      },
    },

    // Player - Personagem controlável
    {
      id: 'player-1',
      name: 'Player',
      type: 'player' as const,
      position: [0, 1, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 2, 1] as [number, number, number],
      color: '#4a90e2',
      visible: true,
      locked: false,
      isStatic: false,
      playerSettings: {
        speed: 10,
        jumpForce: 12,
        gravity: 30,
        maxHealth: 100,
        movementMode: 'free' as const,
        canDoubleJump: false,
        doubleJumpForce: 10,
        coyoteTime: 0.1,
        jumpBufferTime: 0.1,
        canSprint: false,
        sprintSpeed: 15,
        sprintStaminaCost: 10,
        maxStamina: 100,
        staminaRegenRate: 10,
        canCrouch: false,
        crouchSpeed: 3,
        crouchHeightMultiplier: 0.5,
        canDodge: false,
        dodgeDistance: 5,
        dodgeDuration: 0.3,
        dodgeCooldown: 1,
        dodgeInvincibilityFrames: false,
        attackEnabled: false,
        attackType: 'melee' as const,
        attackDamage: 10,
        attackCooldown: 0.5,
        attackRange: 2,
        meleeWeaponType: 'fist' as const,
        meleeComboEnabled: false,
        meleeComboHits: 3,
        meleeKnockback: 5,
        meleeSweepAngle: 60,
        projectileSpeed: 20,
        projectileGravity: 0,
        projectileSpread: 0,
        projectilesPerShot: 1,
        ammoEnabled: false,
        maxAmmo: 100,
        ammoPerShot: 1,
        reloadTime: 2,
        projectileType: 'bullet' as const,
        explosionRadius: 3,
        explosionForce: 10,
        stompEnabled: false,
        stompDamage: 20,
        stompBounceForce: 15,
        stompRequiresDownward: true,
        canWallJump: false,
        canWallSlide: false,
        wallSlideSpeed: 2,
        wallJumpForce: 12,
        canSwim: false,
        swimSpeed: 5,
        airControlMultiplier: 0.5,
        gamePreset: 'custom' as const,
      },
    },

    // Ground - Chão
    {
      id: 'ground-1',
      name: 'Chão',
      type: 'plane' as const,
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [100, 1, 100] as [number, number, number],
      color: '#3d3d3d',
      visible: true,
      locked: false,
      isStatic: true,
      visualSettings: {
        textureUrl: '',
        opacity: 1,
        metalness: 0,
        roughness: 0.8,
        emissiveIntensity: 0,
        wireframe: false,
        castShadow: false,
        receiveShadow: true,
      },
    },
  ];
}

/**
 * Cria game_data completo com objetos padrão
 */
export function createBlankGameData(templateId?: string) {
  return {
    objects: getBlankTemplateObjects(),
    currentTemplateId: templateId || 'blank',
    gameScript: '// Game Script\n// Escreva sua lógica aqui\n',
  };
}
