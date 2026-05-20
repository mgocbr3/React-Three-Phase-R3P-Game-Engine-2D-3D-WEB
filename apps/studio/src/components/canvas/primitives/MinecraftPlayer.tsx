import { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, BallCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { PlayerSettings, CameraSettings, useEditorStore, DEFAULT_ENTITY_SETTINGS } from '@/stores/editorStore';
import { touchInput, consumeJump } from '@/components/canvas/MobileGameControls';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';

interface MinecraftPlayerProps {
  position?: [number, number, number];
  skinColors?: {
    skin?: string;
    hair?: string;
    shirt?: string;
    pants?: string;
    shoes?: string;
  };
  playerSettings?: Partial<PlayerSettings>;
  cameraSettings?: Partial<CameraSettings>;
  cameraOffset?: [number, number, number];
  cameraLookOffset?: [number, number, number];
}

// Projectile component
interface ProjectileData {
  id: number;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  damage: number;
  gravity: number;
  type: 'bullet' | 'arrow' | 'fireball' | 'laser' | 'grenade';
}

const getProjectileVisual = (type: string) => {
  switch (type) {
    case 'arrow':
      return { color: '#8B4513', emissive: '#654321', size: 0.05, trailLength: 0.4, lightColor: '#ffffff', lightIntensity: 0.1 };
    case 'fireball':
      return { color: '#ff4400', emissive: '#ff2200', size: 0.15, trailLength: 0.5, lightColor: '#ff4400', lightIntensity: 2 };
    default:
      return { color: '#ffaa00', emissive: '#ff6600', size: 0.08, trailLength: 0.3, lightColor: '#ff8844', lightIntensity: 0.5 };
  }
};

const Projectile = ({ data, onRemove }: { data: ProjectileData; onRemove: (id: number) => void }) => {
  const rigidBodyRef = useRef<any>(null);
  const lifeTime = useRef(0);
  const hasHit = useRef(false);
  const visual = getProjectileVisual(data.type);
  
  const handleCollision = useCallback(() => {
    if (hasHit.current) return;
    hasHit.current = true;
    setTimeout(() => onRemove(data.id), 50);
  }, [data.id, onRemove]);
  
  useFrame((_, delta) => {
    if (!rigidBodyRef.current || hasHit.current) return;
    lifeTime.current += delta;
    if (lifeTime.current > 5) onRemove(data.id);
  });
  
  return (
    <RigidBody
      ref={rigidBodyRef}
      position={[data.position.x, data.position.y, data.position.z]}
      colliders={false}
      gravityScale={data.gravity}
      onCollisionEnter={handleCollision}
      ccd={true}
      linearVelocity={[data.direction.x * data.speed, data.direction.y * data.speed, data.direction.z * data.speed]}
    >
      <BallCollider args={[visual.size]} />
      <mesh castShadow>
        <sphereGeometry args={[visual.size, 8, 8]} />
        <meshStandardMaterial color={visual.color} emissive={visual.emissive} emissiveIntensity={2} />
      </mesh>
    </RigidBody>
  );
};

// Minecraft Character Visual Component with attack animations
const MinecraftCharacterVisual = forwardRef<THREE.Group, {
  skinColors: {
    skin: string;
    hair: string;
    shirt: string;
    pants: string;
    shoes: string;
  };
  isMoving: boolean;
  isJumping: boolean;
  isSprinting: boolean;
  animationSpeed: number;
  isAttackingMelee: boolean;
  isAttackingRanged: boolean;
  attackProgress: number;
}>(({ skinColors, isMoving, isJumping, isSprinting, animationSpeed, isAttackingMelee, isAttackingRanged, attackProgress }, ref) => {
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  
  const { skin, hair, shirt, pants, shoes } = skinColors;

  useFrame((state) => {
    const t = state.clock.elapsedTime * animationSpeed;
    
    // Melee attack animation - strong arm swing
    if (isAttackingMelee) {
      const swingPhase = attackProgress * Math.PI;
      if (rightArmRef.current) {
        // Swing from back to front with rotation
        rightArmRef.current.rotation.x = -2.2 + Math.sin(swingPhase) * 2.5;
        rightArmRef.current.rotation.z = -0.3 + Math.sin(swingPhase * 0.5) * 0.2;
      }
      if (leftArmRef.current) {
        // Left arm pulls back for balance
        leftArmRef.current.rotation.x = 0.3 - Math.sin(swingPhase) * 0.4;
      }
      // Body twist for power
      if (bodyRef.current) {
        bodyRef.current.rotation.y = Math.sin(swingPhase) * 0.3;
      }
    }
    // Ranged attack animation - bow drawing motion
    else if (isAttackingRanged) {
      const drawPhase = attackProgress;
      if (rightArmRef.current) {
        // Right arm holds steady pointing forward
        rightArmRef.current.rotation.x = -1.5;
        rightArmRef.current.rotation.z = -0.2;
      }
      if (leftArmRef.current) {
        // Left arm pulls back like drawing a bow
        leftArmRef.current.rotation.x = -1.5 + drawPhase * 0.5;
        leftArmRef.current.rotation.z = 0.2;
      }
      // Slight body lean back
      if (bodyRef.current) {
        bodyRef.current.rotation.x = drawPhase * 0.1;
      }
    }
    else if (isJumping) {
      // Jump pose - arms and legs spread
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -0.5, 0.2);
        leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, 0.3, 0.2);
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -0.5, 0.2);
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, -0.3, 0.2);
      }
      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0.4, 0.2);
        rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.4, 0.2);
      }
    } else if (isMoving) {
      // Walking/Running animation
      const walkSpeed = isSprinting ? t * 1.5 : t;
      const armSwing = isSprinting ? 1.2 : 0.9;
      const legSwing = isSprinting ? 1.0 : 0.7;
      
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = Math.sin(walkSpeed) * armSwing;
        leftArmRef.current.rotation.z = 0;
        rightArmRef.current.rotation.x = Math.sin(walkSpeed + Math.PI) * armSwing;
        rightArmRef.current.rotation.z = 0;
      }
      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.x = Math.sin(walkSpeed + Math.PI) * legSwing;
        rightLegRef.current.rotation.x = Math.sin(walkSpeed) * legSwing;
      }
      // Body bob while running
      if (bodyRef.current) {
        bodyRef.current.position.y = Math.abs(Math.sin(walkSpeed * 2)) * 0.05;
        bodyRef.current.rotation.y = THREE.MathUtils.lerp(bodyRef.current.rotation.y, 0, 0.1);
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0, 0.1);
      }
    } else {
      // Idle animation - subtle breathing
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, Math.sin(t * 0.5) * 0.05, 0.1);
        leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, 0, 0.1);
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, Math.sin(t * 0.5 + Math.PI) * 0.05, 0.1);
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0, 0.1);
      }
      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, 0.1);
        rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, 0.1);
      }
      if (bodyRef.current) {
        bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0, 0.1);
        bodyRef.current.rotation.y = THREE.MathUtils.lerp(bodyRef.current.rotation.y, 0, 0.1);
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0, 0.1);
      }
    }
  });

  return (
    <group ref={ref}>
      <group ref={bodyRef}>
        {/* Head */}
        <mesh castShadow position={[0, 1.75, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        
        {/* Hair on top */}
        <mesh castShadow position={[0, 2.05, 0]}>
          <boxGeometry args={[0.52, 0.12, 0.52]} />
          <meshStandardMaterial color={hair} />
        </mesh>
        
        {/* Hair on back */}
        <mesh castShadow position={[0, 1.85, -0.2]}>
          <boxGeometry args={[0.52, 0.35, 0.15]} />
          <meshStandardMaterial color={hair} />
        </mesh>

        {/* Face - eyes */}
        <mesh position={[-0.12, 1.78, 0.251]}>
          <boxGeometry args={[0.08, 0.06, 0.01]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.12, 1.78, 0.251]}>
          <boxGeometry args={[0.08, 0.06, 0.01]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        {/* Pupils */}
        <mesh position={[-0.1, 1.78, 0.252]}>
          <boxGeometry args={[0.04, 0.04, 0.01]} />
          <meshStandardMaterial color="#3d2314" />
        </mesh>
        <mesh position={[0.14, 1.78, 0.252]}>
          <boxGeometry args={[0.04, 0.04, 0.01]} />
          <meshStandardMaterial color="#3d2314" />
        </mesh>
        
        {/* Mouth */}
        <mesh position={[0, 1.62, 0.251]}>
          <boxGeometry args={[0.15, 0.04, 0.01]} />
          <meshStandardMaterial color="#2a1a0a" />
        </mesh>

        {/* Body/Torso */}
        <mesh castShadow position={[0, 1.1, 0]}>
          <boxGeometry args={[0.5, 0.75, 0.25]} />
          <meshStandardMaterial color={shirt} />
        </mesh>

        {/* Left Arm - pivot at shoulder */}
        <group ref={leftArmRef} position={[-0.375, 1.45, 0]}>
          <mesh castShadow position={[0, -0.35, 0]}>
            <boxGeometry args={[0.25, 0.75, 0.25]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
          {/* Hand */}
          <mesh castShadow position={[0, -0.65, 0]}>
            <boxGeometry args={[0.22, 0.15, 0.22]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>

        {/* Right Arm - pivot at shoulder */}
        <group ref={rightArmRef} position={[0.375, 1.45, 0]}>
          <mesh castShadow position={[0, -0.35, 0]}>
            <boxGeometry args={[0.25, 0.75, 0.25]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
          {/* Hand */}
          <mesh castShadow position={[0, -0.65, 0]}>
            <boxGeometry args={[0.22, 0.15, 0.22]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>

        {/* Left Leg - pivot at hip */}
        <group ref={leftLegRef} position={[-0.125, 0.7, 0]}>
          <mesh castShadow position={[0, -0.35, 0]}>
            <boxGeometry args={[0.25, 0.55, 0.25]} />
            <meshStandardMaterial color={pants} />
          </mesh>
          {/* Shoe */}
          <mesh castShadow position={[0, -0.65, 0.03]}>
            <boxGeometry args={[0.24, 0.12, 0.3]} />
            <meshStandardMaterial color={shoes} />
          </mesh>
        </group>

        {/* Right Leg - pivot at hip */}
        <group ref={rightLegRef} position={[0.125, 0.7, 0]}>
          <mesh castShadow position={[0, -0.35, 0]}>
            <boxGeometry args={[0.25, 0.55, 0.25]} />
            <meshStandardMaterial color={pants} />
          </mesh>
          {/* Shoe */}
          <mesh castShadow position={[0, -0.65, 0.03]}>
            <boxGeometry args={[0.24, 0.12, 0.3]} />
            <meshStandardMaterial color={shoes} />
          </mesh>
        </group>
      </group>
    </group>
  );
});

MinecraftCharacterVisual.displayName = 'MinecraftCharacterVisual';

export const MinecraftPlayer = forwardRef<THREE.Object3D, MinecraftPlayerProps>(({
  position = [0, 3, 0],
  skinColors = {},
  playerSettings,
  cameraSettings,
  cameraOffset: propCameraOffset,
  cameraLookOffset: propCameraLookOffset
}, ref) => {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const cameraTargetPos = useRef(new THREE.Vector3());
  
  const finalSkinColors = {
    skin: skinColors.skin ?? '#c4a574',
    hair: skinColors.hair ?? '#3d2314',
    shirt: skinColors.shirt ?? '#00aaaa',
    pants: skinColors.pants ?? '#1a1a7a',
    shoes: skinColors.shoes ?? '#4a4a4a',
  };

  // Camera offset based on mode
  const cameraOffset = useMemo((): [number, number, number] => {
    if (propCameraOffset) return propCameraOffset;
    if (!cameraSettings) return [0, 6, 10];
    
    const distance = cameraSettings.distance ?? 10;
    const height = cameraSettings.height ?? 6;
    
    switch (cameraSettings.mode) {
      case 'top-down':
        return [0, height, 0.01];
      case 'side-2d':
        return [0, height, distance];
      case 'third-person':
      default:
        return [0, height, distance];
    }
  }, [propCameraOffset, cameraSettings?.mode, cameraSettings?.distance, cameraSettings?.height]);
  
  const cameraLookOffset = useMemo((): [number, number, number] => {
    if (propCameraLookOffset) return propCameraLookOffset;
    if (!cameraSettings) return [0, 1.5, 0];
    
    switch (cameraSettings.mode) {
      case 'top-down':
        return [0, 0, 0];
      case 'side-2d':
        return [0, 1, 0];
      default:
        return [0, 1.5, 0];
    }
  }, [propCameraLookOffset, cameraSettings?.mode]);
  
  const cameraCurrentPos = useRef(new THREE.Vector3(...cameraOffset));
  
  useEffect(() => {
    const rigidBody = rigidBodyRef.current;
    if (rigidBody) {
      const pos = rigidBody.translation();
      cameraCurrentPos.current.set(pos.x + cameraOffset[0], pos.y + cameraOffset[1], pos.z + cameraOffset[2]);
    }
  }, [cameraOffset]);
  
  useEffect(() => {
    if (cameraSettings?.fov && 'fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = cameraSettings.fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }, [camera, cameraSettings?.fov]);
  
  // Core settings
  const speed = playerSettings?.speed ?? 5;
  const jumpForce = playerSettings?.jumpForce ?? 8;
  const movementMode = playerSettings?.movementMode ?? 'free';
  const canSprint = playerSettings?.canSprint ?? true;
  const sprintSpeed = playerSettings?.sprintSpeed ?? 8;
  const canDoubleJump = playerSettings?.canDoubleJump ?? false;
  const doubleJumpForce = playerSettings?.doubleJumpForce ?? 6;
  const coyoteTime = playerSettings?.coyoteTime ?? 0.15;
  const jumpBufferTime = playerSettings?.jumpBufferTime ?? 0.1;
  const airControlMultiplier = playerSettings?.airControlMultiplier ?? 0.7;
  
  useImperativeHandle(ref, () => meshRef.current as THREE.Object3D, []);
  
  // Movement inputs
  const movement = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
  });
  
  // Physics state
  const velocity = useRef(new THREE.Vector3());
  const isGrounded = useRef(true);
  const wasGrounded = useRef(true);
  const coyoteTimer = useRef(0);
  const jumpBufferTimer = useRef(0);
  const hasDoubleJumped = useRef(false);
  
  // Animation state
  const [isMoving, setIsMoving] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [projectiles, setProjectiles] = useState<ProjectileData[]>([]);
  const [isAttackingMelee, setIsAttackingMelee] = useState(false);
  const [isAttackingRanged, setIsAttackingRanged] = useState(false);
  const [attackProgress, setAttackProgress] = useState(0);
  const attackCooldown = useRef(0);
  const meleeAttackDuration = 0.3;
  const rangedAttackDuration = 0.5;
  
  // Attack refs
  const attackStartTime = useRef(0);
  const isHoldingRanged = useRef(false);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault();
      
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': movement.current.forward = true; break;
        case 'KeyS': case 'ArrowDown': movement.current.backward = true; break;
        case 'KeyA': case 'ArrowLeft': movement.current.left = true; break;
        case 'KeyD': case 'ArrowRight': movement.current.right = true; break;
        case 'Space': movement.current.jump = true; break;
        case 'ShiftLeft': case 'ShiftRight': movement.current.sprint = true; break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': movement.current.forward = false; break;
        case 'KeyS': case 'ArrowDown': movement.current.backward = false; break;
        case 'KeyA': case 'ArrowLeft': movement.current.left = false; break;
        case 'KeyD': case 'ArrowRight': movement.current.right = false; break;
        case 'Space': movement.current.jump = false; break;
        case 'ShiftLeft': case 'ShiftRight': movement.current.sprint = false; break;
      }
    };

    // Mouse attack handlers
    const handleMouseDown = (e: MouseEvent) => {
      if (attackCooldown.current > 0) return;
      
      if (e.button === 0) {
        // Left click = Melee attack
        setIsAttackingMelee(true);
        attackStartTime.current = performance.now();
        attackCooldown.current = meleeAttackDuration + 0.1;
      } else if (e.button === 2) {
        // Right click = Ranged attack (hold to charge)
        isHoldingRanged.current = true;
        setIsAttackingRanged(true);
        attackStartTime.current = performance.now();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2 && isHoldingRanged.current) {
        // Release ranged attack - fire projectile
        isHoldingRanged.current = false;
        setIsAttackingRanged(false);
        
        // Fire projectile in player facing direction
        if (meshRef.current && rigidBodyRef.current) {
          const pos = rigidBodyRef.current.translation();
          const rotation = meshRef.current.rotation.y;
          const direction = new THREE.Vector3(
            Math.sin(rotation),
            0.1,
            Math.cos(rotation)
          ).normalize();
          
          const newProjectile: ProjectileData = {
            id: Date.now(),
            position: new THREE.Vector3(pos.x, pos.y + 1.5, pos.z),
            direction,
            speed: 20,
            damage: 10,
            gravity: 0.3,
            type: 'arrow'
          };
          
          setProjectiles(prev => [...prev, newProjectile]);
        }
        
        attackCooldown.current = rangedAttackDuration + 0.2;
        setAttackProgress(0);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);
  
  const setPlayerPosition = useRuntimeGameStore(state => state.setPlayerPosition);
  
  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;
    
    const rb = rigidBodyRef.current;
    const pos = rb.translation();
    const vel = rb.linvel();
    
    // Update player position in runtime store
    setPlayerPosition(new THREE.Vector3(pos.x, pos.y, pos.z));

    // Handle attack cooldown and animation progress
    if (attackCooldown.current > 0) {
      attackCooldown.current -= delta;
    }

    // Melee attack progress
    if (isAttackingMelee) {
      const elapsed = (performance.now() - attackStartTime.current) / 1000;
      const progress = Math.min(elapsed / meleeAttackDuration, 1);
      setAttackProgress(progress);
      
      if (progress >= 1) {
        setIsAttackingMelee(false);
        setAttackProgress(0);
      }
    }

    // Ranged attack charging progress
    if (isAttackingRanged && isHoldingRanged.current) {
      const elapsed = (performance.now() - attackStartTime.current) / 1000;
      const progress = Math.min(elapsed / rangedAttackDuration, 1);
      setAttackProgress(progress);
    }
    
    // Ground check
    wasGrounded.current = isGrounded.current;
    isGrounded.current = Math.abs(vel.y) < 0.1;
    
    // Coyote time
    if (wasGrounded.current && !isGrounded.current) {
      coyoteTimer.current = coyoteTime;
    }
    coyoteTimer.current -= delta;
    
    // Reset double jump on land
    if (isGrounded.current && !wasGrounded.current) {
      hasDoubleJumped.current = false;
      setIsJumping(false);
    }
    
    // Calculate movement direction
    let moveX = 0;
    let moveZ = 0;
    
    // Mobile touch input
    if (touchInput.movement.x !== 0 || touchInput.movement.y !== 0) {
      moveX = touchInput.movement.x;
      moveZ = -touchInput.movement.y;
    } else {
      if (movement.current.forward) moveZ -= 1;
      if (movement.current.backward) moveZ += 1;
      if (movement.current.left) moveX -= 1;
      if (movement.current.right) moveX += 1;
    }
    
    // 2D sidescroll mode - lock Z
    if (movementMode === '2d-sidescroll') {
      moveZ = 0;
    }
    
    // Normalize diagonal movement
    const moveLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveLength > 0) {
      moveX /= moveLength;
      moveZ /= moveLength;
    }
    
    // Determine speed
    const isSpringingNow = canSprint && movement.current.sprint && isGrounded.current && moveLength > 0;
    setIsSprinting(isSpringingNow);
    
    const currentSpeed = isSpringingNow ? sprintSpeed : speed;
    const controlMultiplier = isGrounded.current ? 1 : airControlMultiplier;
    
    // Apply movement
    velocity.current.set(
      moveX * currentSpeed * controlMultiplier,
      vel.y,
      moveZ * currentSpeed * controlMultiplier
    );
    
    // Update animation state
    setIsMoving(moveLength > 0.1);
    
    // Jump handling
    const wantsToJump = movement.current.jump || consumeJump();
    
    if (wantsToJump) {
      jumpBufferTimer.current = jumpBufferTime;
    }
    jumpBufferTimer.current -= delta;
    
    const canCoyoteJump = coyoteTimer.current > 0 || isGrounded.current;
    
    if (jumpBufferTimer.current > 0 && canCoyoteJump) {
      velocity.current.y = jumpForce;
      jumpBufferTimer.current = 0;
      coyoteTimer.current = 0;
      hasDoubleJumped.current = false;
      setIsJumping(true);
    } else if (wantsToJump && canDoubleJump && !hasDoubleJumped.current && !isGrounded.current && coyoteTimer.current <= 0) {
      velocity.current.y = doubleJumpForce;
      hasDoubleJumped.current = true;
      setIsJumping(true);
    }
    
    rb.setLinvel({ x: velocity.current.x, y: velocity.current.y, z: velocity.current.z }, true);
    
    // Rotate character to face movement direction
    if (meshRef.current) {
      if (movementMode === '2d-sidescroll') {
        if (moveX > 0) meshRef.current.rotation.y = Math.PI / 2;
        else if (moveX < 0) meshRef.current.rotation.y = -Math.PI / 2;
      } else if (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1) {
        const targetRotation = Math.atan2(moveX, moveZ);
        meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotation, 0.15);
      }
    }
    
    // Camera follow
    cameraTargetPos.current.set(
      pos.x + cameraOffset[0],
      pos.y + cameraOffset[1],
      pos.z + cameraOffset[2]
    );
    
    cameraCurrentPos.current.lerp(cameraTargetPos.current, 0.08);
    camera.position.copy(cameraCurrentPos.current);
    
    const lookTarget = new THREE.Vector3(
      pos.x + cameraLookOffset[0],
      pos.y + cameraLookOffset[1],
      pos.z + cameraLookOffset[2]
    );
    camera.lookAt(lookTarget);
  });
  
  const removeProjectile = useCallback((id: number) => {
    setProjectiles(prev => prev.filter(p => p.id !== id));
  }, []);
  
  return (
    <>
      {projectiles.map(proj => (
        <Projectile key={proj.id} data={proj} onRemove={removeProjectile} />
      ))}
      
      <RigidBody
        ref={rigidBodyRef}
        position={position}
        colliders={false}
        lockRotations
        linearDamping={0.5}
        mass={1}
      >
        <CapsuleCollider args={[0.5, 0.3]} position={[0, 1, 0]} />
        <group ref={meshRef}>
          <MinecraftCharacterVisual
            skinColors={finalSkinColors}
            isMoving={isMoving}
            isJumping={isJumping}
            isSprinting={isSprinting}
            animationSpeed={8}
            isAttackingMelee={isAttackingMelee}
            isAttackingRanged={isAttackingRanged}
            attackProgress={attackProgress}
          />
          
          {/* Player indicator */}
          <pointLight position={[0, 2.5, 0]} intensity={0.2} distance={4} color="#22d3ee" />
        </group>
      </RigidBody>
    </>
  );
});

MinecraftPlayer.displayName = 'MinecraftPlayer';
