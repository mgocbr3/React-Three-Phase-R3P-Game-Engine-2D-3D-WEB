import { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, BallCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { PlayerSettings, CameraSettings, useEditorStore, DEFAULT_ENTITY_SETTINGS } from '@/stores/editorStore';
import { touchInput, consumeJump } from '@/components/canvas/MobileGameControls';
import { DamageSystem } from '@/hooks/useDamageSystem';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';

interface ThirdPersonControllerProps {
  position?: [number, number, number];
  color?: string;
  playerSettings?: PlayerSettings;
  cameraSettings?: CameraSettings;
  cameraOffset?: [number, number, number];
  cameraLookOffset?: [number, number, number];
}

// Projectile data interface
interface ProjectileData {
  id: number;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  damage: number;
  gravity: number;
  type: 'bullet' | 'arrow' | 'fireball' | 'laser' | 'grenade';
  sourceId?: string; // Who fired this projectile
}

// Get projectile visual properties based on type
const getProjectileVisual = (type: string) => {
  switch (type) {
    case 'arrow':
      return { color: '#8B4513', emissive: '#654321', size: 0.05, trailLength: 0.4, lightColor: '#ffffff', lightIntensity: 0.1 };
    case 'fireball':
      return { color: '#ff4400', emissive: '#ff2200', size: 0.15, trailLength: 0.5, lightColor: '#ff4400', lightIntensity: 2 };
    case 'laser':
      return { color: '#00ffff', emissive: '#00ffff', size: 0.03, trailLength: 0.8, lightColor: '#00ffff', lightIntensity: 1.5 };
    case 'grenade':
      return { color: '#444444', emissive: '#222222', size: 0.12, trailLength: 0.1, lightColor: '#ff0000', lightIntensity: 0.3 };
    case 'bullet':
    default:
      return { color: '#ffaa00', emissive: '#ff6600', size: 0.08, trailLength: 0.3, lightColor: '#ff8844', lightIntensity: 0.5 };
  }
};

// Single projectile component
const TPSProjectile = ({ 
  data, 
  onRemove 
}: { 
  data: ProjectileData; 
  onRemove: (id: number) => void;
}) => {
  const rigidBodyRef = useRef<any>(null);
  const lifeTime = useRef(0);
  const maxLifeTime = data.type === 'grenade' ? 3 : 5;
  const hasHit = useRef(false);
  const visual = getProjectileVisual(data.type);
  
  const handleCollision = useCallback((event: any) => {
    if (hasHit.current) return;
    hasHit.current = true;
    
    const otherRigidBody = event.other?.rigidBody;
    if (otherRigidBody && rigidBodyRef.current) {
      try {
        const impulseStrength = data.type === 'fireball' ? data.speed * 3 : data.speed * 2;
        const impulse = {
          x: data.direction.x * impulseStrength,
          y: data.direction.y * impulseStrength + 3,
          z: data.direction.z * impulseStrength
        };
        otherRigidBody.applyImpulse(impulse, true);
      } catch (e) {}
    }
    setTimeout(() => onRemove(data.id), 50);
  }, [data.id, data.direction, data.speed, data.type, onRemove]);
  
  useFrame((_, delta) => {
    if (!rigidBodyRef.current || hasHit.current) return;
    lifeTime.current += delta;
    if (lifeTime.current > maxLifeTime) {
      onRemove(data.id);
    }
  });
  
  const initialVelocity: [number, number, number] = [
    data.direction.x * data.speed,
    data.direction.y * data.speed,
    data.direction.z * data.speed
  ];
  
  return (
    <RigidBody
      ref={rigidBodyRef}
      position={[data.position.x, data.position.y, data.position.z]}
      colliders={false}
      gravityScale={data.gravity}
      onCollisionEnter={handleCollision}
      sensor={false}
      ccd={true}
      linearVelocity={initialVelocity}
    >
      <BallCollider args={[visual.size]} />
      <mesh castShadow>
        <sphereGeometry args={[visual.size, 8, 8]} />
        <meshStandardMaterial 
          color={visual.color} 
          emissive={visual.emissive}
          emissiveIntensity={2}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0, visual.trailLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.04, visual.trailLength, 6]} />
        <meshBasicMaterial color="#ffff88" transparent opacity={0.6} />
      </mesh>
      <pointLight color={visual.lightColor} intensity={visual.lightIntensity} distance={2} decay={2} />
    </RigidBody>
  );
};

// Attack effect component
const AttackEffect = ({ active, range, color }: { active: boolean; range: number; color: string }) => {
  const ref = useRef<THREE.Mesh>(null);
  const [scale, setScale] = useState(0.5);
  const [opacity, setOpacity] = useState(0.8);
  
  useFrame(() => {
    if (active && ref.current) {
      setScale(prev => THREE.MathUtils.lerp(prev, range * 2, 0.3));
      setOpacity(prev => THREE.MathUtils.lerp(prev, 0, 0.2));
    } else {
      setScale(0.5);
      setOpacity(0.8);
    }
  });
  
  if (!active) return null;
  
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]} scale={[scale, scale, 1]}>
      <ringGeometry args={[0.3, 0.5, 16]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
};

// Dodge trail effect
const DodgeTrail = ({ active, color }: { active: boolean; color: string }) => {
  if (!active) return null;
  
  return (
    <>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0, 0.3 * (i + 1)]} scale={[1 - i * 0.2, 1 - i * 0.2, 1 - i * 0.2]}>
          <capsuleGeometry args={[0.4, 0.8, 4, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.3 - i * 0.1} />
        </mesh>
      ))}
    </>
  );
};

export const ThirdPersonController = forwardRef<THREE.Object3D, ThirdPersonControllerProps>(({ 
  position = [0, 3, 0], 
  color = '#6366f1',
  playerSettings,
  cameraSettings,
  cameraOffset: propCameraOffset,
  cameraLookOffset: propCameraLookOffset
}, ref) => {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const cameraTargetPos = useRef(new THREE.Vector3());
  
  // Calculate camera offset based on mode - use useMemo to react to settings changes
  const cameraOffset = useMemo((): [number, number, number] => {
    if (propCameraOffset) return propCameraOffset;
    if (!cameraSettings) return [0, 8, 12];
    
    const distance = cameraSettings.distance ?? 12;
    const height = cameraSettings.height ?? 8;
    
    switch (cameraSettings.mode) {
      case 'top-down':
        // Camera directly above player
        return [0, height, 0.01];
      case 'side-2d':
        // Camera to the side
        return [0, height, distance];
      case 'third-person':
      default:
        // Behind and above
        return [0, height, distance];
    }
  }, [propCameraOffset, cameraSettings?.mode, cameraSettings?.distance, cameraSettings?.height]);
  
  const cameraLookOffset = useMemo((): [number, number, number] => {
    if (propCameraLookOffset) return propCameraLookOffset;
    if (!cameraSettings) return [0, 2, 0];
    
    switch (cameraSettings.mode) {
      case 'top-down':
        // Look straight down at player
        return [0, 0, 0];
      case 'side-2d':
        return [0, 1, 0];
      case 'third-person':
      default:
        return [0, 2, 0];
    }
  }, [propCameraLookOffset, cameraSettings?.mode]);
  
  const cameraCurrentPos = useRef(new THREE.Vector3(...cameraOffset));
  
  // Update camera position immediately when settings change
  useEffect(() => {
    // Get current player position if available
    const rigidBody = rigidBodyRef.current;
    if (rigidBody) {
      const pos = rigidBody.translation();
      // Set camera to new offset relative to player position
      cameraCurrentPos.current.set(
        pos.x + cameraOffset[0],
        pos.y + cameraOffset[1],
        pos.z + cameraOffset[2]
      );
    } else {
      // No player yet, just update the offset
      cameraCurrentPos.current.set(cameraOffset[0], cameraOffset[1], cameraOffset[2]);
    }
  }, [cameraOffset]);
  
  // Apply FOV from camera settings
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
  
  // Sprint settings
  const canSprint = playerSettings?.canSprint ?? true;
  const sprintSpeed = playerSettings?.sprintSpeed ?? 8;
  const maxStamina = playerSettings?.maxStamina ?? 100;
  const sprintStaminaCost = playerSettings?.sprintStaminaCost ?? 10;
  const staminaRegenRate = playerSettings?.staminaRegenRate ?? 15;
  
  // Crouch settings
  const canCrouch = playerSettings?.canCrouch ?? true;
  const crouchSpeed = playerSettings?.crouchSpeed ?? 2.5;
  const crouchHeightMultiplier = playerSettings?.crouchHeightMultiplier ?? 0.5;
  
  // Jump settings
  const canDoubleJump = playerSettings?.canDoubleJump ?? false;
  const doubleJumpForce = playerSettings?.doubleJumpForce ?? 6;
  const coyoteTime = playerSettings?.coyoteTime ?? 0.15;
  const jumpBufferTime = playerSettings?.jumpBufferTime ?? 0.1;
  
  // Dodge settings
  const canDodge = playerSettings?.canDodge ?? true;
  const dodgeDistance = playerSettings?.dodgeDistance ?? 4;
  const dodgeDuration = playerSettings?.dodgeDuration ?? 0.3;
  const dodgeCooldown = playerSettings?.dodgeCooldown ?? 0.8;
  
  // Attack settings
  const attackEnabled = playerSettings?.attackEnabled ?? true;
  const attackCooldown = playerSettings?.attackCooldown ?? 0.5;
  const attackRange = playerSettings?.attackRange ?? 2;
  const attackType = playerSettings?.attackType ?? 'melee';
  const attackDamage = playerSettings?.attackDamage ?? 25;
  
  // Ranged attack settings
  const projectileSpeed = playerSettings?.projectileSpeed ?? 50;
  const projectileGravity = playerSettings?.projectileGravity ?? 0.1;
  const projectileSpread = playerSettings?.projectileSpread ?? 0;
  const projectilesPerShot = playerSettings?.projectilesPerShot ?? 1;
  const projectileType = playerSettings?.projectileType ?? 'bullet';
  
  // Air control
  const airControlMultiplier = playerSettings?.airControlMultiplier ?? 0.7;
  
  // Expose mesh position to parent
  useImperativeHandle(ref, () => meshRef.current as THREE.Object3D, []);
  
  // Movement inputs
  const movement = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    crouch: false,
    dodge: false,
    attack: false,
  });
  
  // Physics state
  const velocity = useRef(new THREE.Vector3());
  const isGrounded = useRef(true);
  const wasGrounded = useRef(true);
  const coyoteTimer = useRef(0);
  const jumpBufferTimer = useRef(0);
  const hasDoubleJumped = useRef(false);
  const stamina = useRef(maxStamina);
  
  // Visual state
  const [isCrouching, setIsCrouching] = useState(false);
  const [isDodging, setIsDodging] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [projectiles, setProjectiles] = useState<ProjectileData[]>([]);
  
  // Timers
  const crouchLerp = useRef(1);
  const dodgeTimer = useRef(0);
  const dodgeCooldownTimer = useRef(0);
  const attackCooldownTimer = useRef(0);
  const dodgeDirection = useRef(new THREE.Vector3());
  const projectileIdCounter = useRef(0);
  
  // Spawn projectile function for ranged attacks
  const spawnProjectile = useCallback(() => {
    if (!rigidBodyRef.current || !meshRef.current) return;
    
    const pos = rigidBodyRef.current.translation();
    const spawnPos = new THREE.Vector3(pos.x, pos.y + 1.2, pos.z);
    
    // Get direction player is facing based on mesh rotation
    const rotationY = meshRef.current.rotation.y;
    const baseDirection = new THREE.Vector3(
      Math.sin(rotationY),
      0,
      Math.cos(rotationY)
    ).normalize();
    
    // Offset spawn position forward
    spawnPos.add(baseDirection.clone().multiplyScalar(1));
    
    const newProjectiles: ProjectileData[] = [];
    
    for (let i = 0; i < projectilesPerShot; i++) {
      const direction = baseDirection.clone();
      
      if (projectileSpread > 0) {
        const spreadRadians = (projectileSpread * Math.PI) / 180;
        const spreadX = (Math.random() - 0.5) * 2 * spreadRadians;
        const spreadY = (Math.random() - 0.5) * 2 * spreadRadians;
        direction.applyAxisAngle(new THREE.Vector3(1, 0, 0), spreadY);
        direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadX);
        direction.normalize();
      }
      
      const projectileSpawnPos = spawnPos.clone().add(direction.clone().multiplyScalar(0.5));
      
      newProjectiles.push({
        id: projectileIdCounter.current++,
        position: projectileSpawnPos,
        direction: direction,
        speed: projectileSpeed,
        damage: attackDamage,
        gravity: projectileGravity,
        type: projectileType as 'bullet' | 'arrow' | 'fireball' | 'laser' | 'grenade',
      });
    }
    
    setProjectiles(prev => [...prev, ...newProjectiles]);
  }, [projectilesPerShot, projectileSpread, projectileSpeed, attackDamage, projectileGravity, projectileType]);
  
  // Remove projectile callback
  const removeProjectile = useCallback((id: number) => {
    setProjectiles(prev => prev.filter(p => p.id !== id));
  }, []);
  
  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default browser behavior for Space (prevents page scroll)
      if (e.code === 'Space') {
        e.preventDefault();
      }
      
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          movement.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          movement.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          movement.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          movement.current.right = true;
          break;
        case 'Space':
          movement.current.jump = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          movement.current.sprint = true;
          break;
        case 'KeyC':
        case 'ControlLeft':
          movement.current.crouch = true;
          break;
        case 'KeyQ':
        case 'AltLeft':
          movement.current.dodge = true;
          break;
        case 'KeyE':
          movement.current.attack = true;
          break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          movement.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          movement.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          movement.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          movement.current.right = false;
          break;
        case 'Space':
          movement.current.jump = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          movement.current.sprint = false;
          break;
        case 'KeyC':
        case 'ControlLeft':
          movement.current.crouch = false;
          break;
        case 'KeyQ':
        case 'AltLeft':
          movement.current.dodge = false;
          break;
        case 'KeyE':
          movement.current.attack = false;
          break;
      }
    };
    
    // Mouse attack
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) movement.current.attack = true;
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) movement.current.attack = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  
  // Get runtime game store for AI tracking
  const setPlayerPosition = useRuntimeGameStore(state => state.setPlayerPosition);
  
  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;
    
    const rb = rigidBodyRef.current;
    const pos = rb.translation();
    const currentVel = rb.linvel();
    
    // Update player position in runtime store for AI to track
    setPlayerPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
    
    // Update timers
    if (dodgeCooldownTimer.current > 0) dodgeCooldownTimer.current -= delta;
    if (attackCooldownTimer.current > 0) attackCooldownTimer.current -= delta;
    
    // Ground check
    wasGrounded.current = isGrounded.current;
    isGrounded.current = pos.y < 1.2 && currentVel.y <= 0.5;
    
    // Reset double jump on landing
    if (isGrounded.current && !wasGrounded.current) {
      hasDoubleJumped.current = false;
    }
    
    // Coyote time
    if (wasGrounded.current && !isGrounded.current && currentVel.y <= 0) {
      coyoteTimer.current = coyoteTime;
    }
    if (coyoteTimer.current > 0) coyoteTimer.current -= delta;
    
    // Jump buffer
    const touchJump = consumeJump();
    if (movement.current.jump || touchJump) {
      jumpBufferTimer.current = jumpBufferTime;
    }
    if (jumpBufferTimer.current > 0) jumpBufferTimer.current -= delta;
    
    // Handle dodging
    if (isDodging) {
      dodgeTimer.current -= delta;
      if (dodgeTimer.current <= 0) {
        setIsDodging(false);
      } else {
        const dodgeSpeed = dodgeDistance / dodgeDuration;
        rb.setLinvel({
          x: dodgeDirection.current.x * dodgeSpeed,
          y: Math.max(currentVel.y, 0),
          z: dodgeDirection.current.z * dodgeSpeed
        }, true);
        return;
      }
    }
    
    // Crouch state
    if (canCrouch && movement.current.crouch && isGrounded.current) {
      setIsCrouching(true);
      crouchLerp.current = THREE.MathUtils.lerp(crouchLerp.current, crouchHeightMultiplier, 0.2);
    } else {
      setIsCrouching(false);
      crouchLerp.current = THREE.MathUtils.lerp(crouchLerp.current, 1, 0.2);
    }
    
    // Determine speed
    let currentSpeed = speed;
    const sprintActive = canSprint && movement.current.sprint && !isCrouching && stamina.current > 0;
    setIsSprinting(sprintActive);
    
    if (isCrouching) {
      currentSpeed = crouchSpeed;
    } else if (sprintActive) {
      currentSpeed = sprintSpeed;
      stamina.current = Math.max(0, stamina.current - sprintStaminaCost * delta);
    } else {
      stamina.current = Math.min(maxStamina, stamina.current + staminaRegenRate * delta);
    }
    
    // Air control reduction
    if (!isGrounded.current) {
      currentSpeed *= airControlMultiplier;
    }
    
    // Calculate movement
    let moveX = 0;
    let moveZ = 0;
    const hasTouchInput = Math.abs(touchInput.movement.x) > 0.1 || Math.abs(touchInput.movement.y) > 0.1;
    
    if (movementMode === '2d-sidescroll') {
      if (hasTouchInput) {
        moveX = touchInput.movement.x;
      } else {
        if (movement.current.left) moveX -= 1;
        if (movement.current.right) moveX += 1;
      }
      moveZ = 0;
    } else if (movementMode === 'top-down') {
      if (hasTouchInput) {
        moveX = touchInput.movement.x;
        moveZ = -touchInput.movement.y;
      } else {
        if (movement.current.forward) moveZ -= 1;
        if (movement.current.backward) moveZ += 1;
        if (movement.current.left) moveX -= 1;
        if (movement.current.right) moveX += 1;
      }
    } else {
      const moveDirection = new THREE.Vector3();
      
      if (hasTouchInput) {
        moveDirection.x = touchInput.movement.x;
        moveDirection.z = -touchInput.movement.y;
      } else {
        if (movement.current.forward) moveDirection.z -= 1;
        if (movement.current.backward) moveDirection.z += 1;
        if (movement.current.left) moveDirection.x -= 1;
        if (movement.current.right) moveDirection.x += 1;
      }
      
      moveDirection.normalize();
      
      const cameraDirection = new THREE.Vector3();
      camera.getWorldDirection(cameraDirection);
      cameraDirection.y = 0;
      cameraDirection.normalize();
      
      const cameraRight = new THREE.Vector3();
      cameraRight.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize();
      
      const resultDir = new THREE.Vector3();
      resultDir.add(cameraDirection.clone().multiplyScalar(-moveDirection.z));
      resultDir.add(cameraRight.clone().multiplyScalar(-moveDirection.x));
      
      moveX = resultDir.x;
      moveZ = resultDir.z;
    }
    
    // Store direction for dodge
    if (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1) {
      dodgeDirection.current.set(moveX, 0, moveZ).normalize();
    }
    
    // Trigger dodge
    if (canDodge && movement.current.dodge && dodgeCooldownTimer.current <= 0 && !isDodging) {
      setIsDodging(true);
      dodgeTimer.current = dodgeDuration;
      dodgeCooldownTimer.current = dodgeCooldown;
      movement.current.dodge = false;
      
      if (dodgeDirection.current.length() < 0.1) {
        if (meshRef.current) {
          const backward = new THREE.Vector3(0, 0, 1);
          backward.applyQuaternion(meshRef.current.quaternion);
          dodgeDirection.current.copy(backward);
        } else {
          dodgeDirection.current.set(0, 0, 1);
        }
      }
    }
    
    // Trigger attack - handle both melee and ranged
    if (attackEnabled && movement.current.attack && attackCooldownTimer.current <= 0 && !isAttacking) {
      attackCooldownTimer.current = attackCooldown;
      movement.current.attack = false;
      
      // Check attack type
      if (attackType === 'ranged' || attackType === 'combo') {
        // Ranged attack - spawn projectile
        spawnProjectile();
        setIsAttacking(true);
        setTimeout(() => setIsAttacking(false), 100);
      } else {
        // Melee attack - show attack effect
        setIsAttacking(true);
        setTimeout(() => setIsAttacking(false), 200);
      }
    }
    
    // Apply velocity
    velocity.current.set(moveX * currentSpeed, currentVel.y, moveZ * currentSpeed);
    
    // Jump with coyote time and buffer
    const canJumpGround = isGrounded.current || coyoteTimer.current > 0;
    const wantsToJump = jumpBufferTimer.current > 0;
    
    if (wantsToJump && canJumpGround) {
      velocity.current.y = jumpForce;
      coyoteTimer.current = 0;
      jumpBufferTimer.current = 0;
    } else if (wantsToJump && canDoubleJump && !hasDoubleJumped.current && !isGrounded.current) {
      velocity.current.y = doubleJumpForce;
      hasDoubleJumped.current = true;
      jumpBufferTimer.current = 0;
    }
    
    // Lock Z for 2D
    if (movementMode === '2d-sidescroll') {
      velocity.current.z = 0;
      if (Math.abs(pos.z) > 0.1) {
        rb.setTranslation({ x: pos.x, y: pos.y, z: 0 }, true);
      }
    }
    
    rb.setLinvel(velocity.current, true);
    
    // Update mesh
    if (meshRef.current) {
      meshRef.current.scale.y = crouchLerp.current;
      meshRef.current.position.y = (1 - crouchLerp.current) * -0.5;
      
      if (movementMode === '2d-sidescroll') {
        if (moveX > 0) meshRef.current.rotation.y = Math.PI / 2;
        else if (moveX < 0) meshRef.current.rotation.y = -Math.PI / 2;
      } else if (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1) {
        const targetRotation = Math.atan2(moveX, moveZ);
        meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotation, 0.1);
      }
    }
    
    // Camera follow
    cameraTargetPos.current.set(
      pos.x + cameraOffset[0],
      pos.y + cameraOffset[1],
      pos.z + cameraOffset[2]
    );
    
    cameraCurrentPos.current.lerp(cameraTargetPos.current, 0.05);
    camera.position.copy(cameraCurrentPos.current);
    
    const lookTarget = new THREE.Vector3(
      pos.x + cameraLookOffset[0],
      pos.y + cameraLookOffset[1],
      pos.z + cameraLookOffset[2]
    );
    camera.lookAt(lookTarget);
  });
  
  // Only show melee attack effect, not for ranged
  const showMeleeEffect = isAttacking && (attackType === 'melee' || attackType === 'stomp');
  
  return (
    <>
      {/* Projectiles for ranged attacks */}
      {projectiles.map(proj => (
        <TPSProjectile key={proj.id} data={proj} onRemove={removeProjectile} />
      ))}
      
      <RigidBody
        ref={rigidBodyRef}
        position={position}
        colliders={false}
        lockRotations
        linearDamping={0.5}
        mass={1}
      >
        <CapsuleCollider args={[0.5, 0.5]} />
        <group ref={meshRef}>
          {/* Body */}
          <mesh castShadow position={[0, 0, 0]}>
            <capsuleGeometry args={[0.5, 1, 8, 16]} />
            <meshStandardMaterial 
              color={isDodging ? '#ffffff' : color} 
              emissive={isDodging ? '#88aaff' : isAttacking ? '#ff4444' : color}
              emissiveIntensity={isDodging ? 0.8 : isAttacking ? 1 : isSprinting ? 0.5 : 0.3}
              metalness={0.2}
              roughness={0.5}
            />
          </mesh>
          
          {/* Eyes */}
          <mesh position={[0.15, 0.6, 0.4]} castShadow>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[-0.15, 0.6, 0.4]} castShadow>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
          
          {/* Sprint effect */}
          {isSprinting && (
            <mesh position={[0, -0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.1, 0.4, 8]} />
              <meshBasicMaterial color="#88ccff" transparent opacity={0.5} />
            </mesh>
          )}
          
          {/* Dodge trail */}
          <DodgeTrail active={isDodging} color={color} />
          
          {/* Attack effect - only for melee attacks */}
          <AttackEffect active={showMeleeEffect} range={attackRange} color="#ff6644" />
        </group>
      </RigidBody>
    </>
  );
});

ThirdPersonController.displayName = 'ThirdPersonController';
