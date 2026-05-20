import { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, BallCollider, useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { PlayerSettings, useEditorStore, DEFAULT_ENTITY_SETTINGS } from '@/stores/editorStore';
import { DamageSystem } from '@/hooks/useDamageSystem';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';

interface FPSControllerProps {
  position?: [number, number, number];
  playerSettings?: PlayerSettings;
  sensitivity?: number;
}

interface ProjectileData {
  id: number;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  damage: number;
  gravity: number;
  type: 'bullet' | 'arrow' | 'fireball' | 'laser' | 'grenade';
  sourceId?: string; // Who fired this projectile (for damage attribution)
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

// Single projectile component with physics
const Projectile = ({ 
  data, 
  onRemove 
}: { 
  data: ProjectileData; 
  onRemove: (id: number) => void;
}) => {
  const rigidBodyRef = useRef<any>(null);
  const lifeTime = useRef(0);
  const maxLifeTime = data.type === 'grenade' ? 3 : 5; // Grenades explode after 3s
  const hasHit = useRef(false);
  const visual = getProjectileVisual(data.type);
  
  useFrame((_, delta) => {
    if (!rigidBodyRef.current || hasHit.current) return;
    
    lifeTime.current += delta;
    if (lifeTime.current > maxLifeTime) {
      onRemove(data.id);
      return;
    }
    
    // For laser type, keep velocity constant (no gravity effect visually)
    if (data.type === 'laser') {
      const velocity = data.direction.clone().multiplyScalar(data.speed);
      rigidBodyRef.current.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
    }
  });
  
  const handleCollision = useCallback((event: any) => {
    if (hasHit.current) return;
    hasHit.current = true;
    
    // Try to apply impulse and damage to hit object
    const otherRigidBody = event.other?.rigidBody;
    const otherColliderObject = event.other?.colliderObject;
    
    if (otherRigidBody && rigidBodyRef.current) {
      try {
        // Calculate impulse direction based on projectile velocity
        const impulseStrength = data.type === 'fireball' ? data.speed * 3 : data.speed * 2;
        const impulse = {
          x: data.direction.x * impulseStrength,
          y: data.direction.y * impulseStrength + 3, // Add upward component
          z: data.direction.z * impulseStrength
        };
        
        // Apply impulse to the hit object
        otherRigidBody.applyImpulse(impulse, true);
        
        // Try to find the object ID from userData to apply damage
        // This works with the entity system
        let targetId: string | null = null;
        let current = otherColliderObject;
        while (current && !targetId) {
          if (current.userData?.objectId) {
            targetId = current.userData.objectId;
          }
          current = current.parent;
        }
        
        // If we found an object ID, the damage system will handle it
        // Note: Actual damage application is done by the entity that has the useDamageSystem hook
        if (targetId) {
          // Store hit info for damage system to process
          console.log(`[Projectile] Hit entity ${targetId} for ${data.damage} damage`);
        }
      } catch (e) {
        // Object might not support impulse
      }
    }
    
    // Remove projectile after short delay for visual feedback
    setTimeout(() => onRemove(data.id), 50);
  }, [data.id, data.direction, data.speed, data.type, data.damage, onRemove]);
  
  // Initial velocity for physics-based projectiles
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
      ccd={true} // Continuous collision detection for fast objects
      linearVelocity={initialVelocity}
    >
      <BallCollider args={[visual.size]} />
      
      {/* Projectile visual based on type */}
      {data.type === 'arrow' ? (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <coneGeometry args={[0.03, 0.15, 6]} />
            <meshStandardMaterial color={visual.color} metalness={0.3} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.35, 6]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
        </group>
      ) : data.type === 'fireball' ? (
        <group>
          <mesh castShadow>
            <sphereGeometry args={[visual.size, 12, 12]} />
            <meshStandardMaterial color={visual.color} emissive={visual.emissive} emissiveIntensity={3} />
          </mesh>
          <pointLight color={visual.lightColor} intensity={visual.lightIntensity} distance={5} decay={2} />
        </group>
      ) : data.type === 'laser' ? (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[visual.size, visual.size, visual.trailLength, 8]} />
            <meshBasicMaterial color={visual.color} transparent opacity={0.9} />
          </mesh>
          <pointLight color={visual.lightColor} intensity={visual.lightIntensity} distance={3} decay={2} />
        </group>
      ) : data.type === 'grenade' ? (
        <mesh castShadow>
          <sphereGeometry args={[visual.size, 8, 8]} />
          <meshStandardMaterial color={visual.color} metalness={0.5} roughness={0.5} />
        </mesh>
      ) : (
        <>
          {/* Default bullet */}
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
          {/* Tracer trail */}
          <mesh position={[0, 0, visual.trailLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.04, visual.trailLength, 6]} />
            <meshBasicMaterial color="#ffff88" transparent opacity={0.6} />
          </mesh>
          <pointLight color={visual.lightColor} intensity={visual.lightIntensity} distance={2} decay={2} />
        </>
      )}
    </RigidBody>
  );
};

// Projectile manager component
const ProjectileManager = ({ 
  projectiles, 
  onRemove 
}: { 
  projectiles: ProjectileData[]; 
  onRemove: (id: number) => void;
}) => {
  return (
    <>
      {projectiles.map(proj => (
        <Projectile key={proj.id} data={proj} onRemove={onRemove} />
      ))}
    </>
  );
};

// Muzzle flash effect
const MuzzleFlash = ({ active }: { active: boolean }) => {
  if (!active) return null;
  
  return (
    <group position={[0, 0, -1]}>
      <pointLight color="#ffaa44" intensity={3} distance={5} decay={2} />
      <mesh>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#ffff88" transparent opacity={0.9} />
      </mesh>
    </group>
  );
};

// Simple crosshair rendered in 3D space (alternative: use HTML overlay)
const Crosshair = ({ isAiming }: { isAiming: boolean }) => {
  const size = isAiming ? 0.003 : 0.005;
  const gap = isAiming ? 0.004 : 0.008;
  
  return (
    <group position={[0, 0, -0.5]}>
      {/* Top */}
      <mesh position={[0, gap + size, 0]}>
        <planeGeometry args={[0.001, size * 2]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -gap - size, 0]}>
        <planeGeometry args={[0.001, size * 2]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* Left */}
      <mesh position={[-gap - size, 0, 0]}>
        <planeGeometry args={[size * 2, 0.001]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      {/* Right */}
      <mesh position={[gap + size, 0, 0]}>
        <planeGeometry args={[size * 2, 0.001]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// Gun model
const GunModel = ({ isAiming, isShooting }: { isAiming: boolean; isShooting: boolean }) => {
  const gunRef = useRef<THREE.Group>(null);
  const targetPos = isAiming 
    ? new THREE.Vector3(0, -0.15, -0.4) 
    : new THREE.Vector3(0.25, -0.25, -0.5);
  
  useFrame(() => {
    if (gunRef.current) {
      gunRef.current.position.lerp(targetPos, 0.15);
      
      // Recoil
      if (isShooting) {
        gunRef.current.position.z += 0.03;
        gunRef.current.rotation.x -= 0.05;
      } else {
        gunRef.current.rotation.x = THREE.MathUtils.lerp(gunRef.current.rotation.x, 0, 0.1);
      }
    }
  });
  
  return (
    <group ref={gunRef} position={[0.25, -0.25, -0.5]}>
      {/* Gun body */}
      <mesh castShadow>
        <boxGeometry args={[0.06, 0.08, 0.35]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Barrel */}
      <mesh position={[0, 0.02, -0.2]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.15, 8]} />
        <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Handle */}
      <mesh position={[0, -0.06, 0.08]} castShadow>
        <boxGeometry args={[0.04, 0.1, 0.06]} />
        <meshStandardMaterial color="#444444" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Muzzle flash */}
      <group position={[0, 0.02, -0.28]}>
        <MuzzleFlash active={isShooting} />
      </group>
    </group>
  );
};

// Melee weapon model for FPS (sword/knife style)
const MeleeWeaponModel = ({ isAttacking }: { isAttacking: boolean }) => {
  const weaponRef = useRef<THREE.Group>(null);
  const basePos = new THREE.Vector3(0.3, -0.2, -0.4);
  const attackPos = new THREE.Vector3(0.1, 0, -0.6);
  const baseRot = new THREE.Euler(0, 0, -0.3);
  const attackRot = new THREE.Euler(-0.5, 0, 0);
  
  useFrame(() => {
    if (weaponRef.current) {
      const targetPos = isAttacking ? attackPos : basePos;
      const targetRot = isAttacking ? attackRot : baseRot;
      
      weaponRef.current.position.lerp(targetPos, isAttacking ? 0.4 : 0.15);
      weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, targetRot.x, 0.3);
      weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, targetRot.z, 0.3);
    }
  });
  
  return (
    <group ref={weaponRef} position={[0.3, -0.2, -0.4]} rotation={[0, 0, -0.3]}>
      {/* Blade */}
      <mesh castShadow position={[0, 0, -0.2]}>
        <boxGeometry args={[0.02, 0.08, 0.4]} />
        <meshStandardMaterial 
          color="#aabbcc" 
          metalness={0.95} 
          roughness={0.1}
          emissive={isAttacking ? "#4488ff" : "#000000"}
          emissiveIntensity={isAttacking ? 0.5 : 0}
        />
      </mesh>
      {/* Handle */}
      <mesh castShadow position={[0, 0, 0.1]}>
        <cylinderGeometry args={[0.02, 0.02, 0.15, 8]} />
        <meshStandardMaterial color="#4a3728" metalness={0.1} roughness={0.8} />
      </mesh>
      {/* Guard */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.02]} />
        <meshStandardMaterial color="#8B7355" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Swing trail effect */}
      {isAttacking && (
        <mesh position={[0, 0, -0.25]} rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[0.3, 0.5]} />
          <meshBasicMaterial color="#88ccff" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};

export const FPSController = forwardRef<THREE.Object3D, FPSControllerProps>(({
  position = [0, 2, 0],
  playerSettings,
  sensitivity = 0.002,
}, ref) => {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { camera, gl, scene } = useThree();
  const { world } = useRapier();
  
  // Settings
  const speed = playerSettings?.speed ?? 5;
  const jumpForce = playerSettings?.jumpForce ?? 6;
  const canSprint = playerSettings?.canSprint ?? true;
  const sprintSpeed = playerSettings?.sprintSpeed ?? 8;
  const canCrouch = playerSettings?.canCrouch ?? true;
  const crouchSpeed = playerSettings?.crouchSpeed ?? 2;
  const attackEnabled = playerSettings?.attackEnabled ?? true;
  const attackCooldown = playerSettings?.attackCooldown ?? 0.08;
  const maxStamina = playerSettings?.maxStamina ?? 100;
  const sprintStaminaCost = playerSettings?.sprintStaminaCost ?? 10;
  const staminaRegenRate = playerSettings?.staminaRegenRate ?? 15;
  const attackType = playerSettings?.attackType ?? 'ranged';
  const attackRange = playerSettings?.attackRange ?? 2;
  const meleeKnockback = playerSettings?.meleeKnockback ?? 5;
  
  // Projectile settings
  const projectileSpeed = playerSettings?.projectileSpeed ?? 50;
  const projectileGravity = playerSettings?.projectileGravity ?? 0.1;
  const projectileSpread = playerSettings?.projectileSpread ?? 0;
  const projectilesPerShot = playerSettings?.projectilesPerShot ?? 1;
  const attackDamage = playerSettings?.attackDamage ?? 25;
  const projectileType = playerSettings?.projectileType ?? 'bullet';
  
  // Expose position to parent
  useImperativeHandle(ref, () => meshRef.current as THREE.Object3D, []);
  
  const movement = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    crouch: false,
    aim: false,
    shoot: false,
  });
  
  const yaw = useRef(0);
  const pitch = useRef(0);
  const isLocked = useRef(false);
  const isGrounded = useRef(true);
  const stamina = useRef(maxStamina);
  
  // States
  const [isCrouching, setIsCrouching] = useState(false);
  const [isAiming, setIsAiming] = useState(false);
  const [isShooting, setIsShooting] = useState(false);
  const [projectiles, setProjectiles] = useState<ProjectileData[]>([]);
  
  const crouchHeight = useRef(1.6);
  const shootCooldownTimer = useRef(0);
  const projectileIdCounter = useRef(0);
  const baseFov = 75;
  const aimFov = 45;
  
  // Spawn projectile function
  const spawnProjectile = useCallback(() => {
    if (!rigidBodyRef.current) return;
    
    const pos = rigidBodyRef.current.translation();
    const spawnPos = new THREE.Vector3(
      pos.x,
      pos.y + crouchHeight.current - 0.4, // Eye level
      pos.z
    );
    
    // Direction camera is looking (including pitch)
    const baseDirection = new THREE.Vector3(0, 0, -1);
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ');
    baseDirection.applyEuler(euler);
    
    // Spawn multiple projectiles (for shotgun-style)
    const newProjectiles: ProjectileData[] = [];
    
    for (let i = 0; i < projectilesPerShot; i++) {
      const direction = baseDirection.clone();
      
      // Apply spread
      if (projectileSpread > 0) {
        const spreadRadians = (projectileSpread * Math.PI) / 180;
        const spreadX = (Math.random() - 0.5) * 2 * spreadRadians;
        const spreadY = (Math.random() - 0.5) * 2 * spreadRadians;
        direction.applyAxisAngle(new THREE.Vector3(1, 0, 0), spreadY);
        direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadX);
        direction.normalize();
      }
      
      // Offset spawn position slightly forward so bullet doesn't hit player
      const projectileSpawnPos = spawnPos.clone().add(direction.clone().multiplyScalar(0.8));
      
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
  
  // Perform melee attack with physics impulse on hit objects
  const performMeleeAttack = useCallback(() => {
    if (!rigidBodyRef.current) return;
    
    const pos = rigidBodyRef.current.translation();
    const eyePos = new THREE.Vector3(pos.x, pos.y + crouchHeight.current - 0.4, pos.z);
    
    // Direction camera is looking
    const direction = new THREE.Vector3(0, 0, -1);
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ');
    direction.applyEuler(euler);
    
    // Use Three.js raycaster for hit detection
    const raycaster = new THREE.Raycaster(eyePos, direction, 0, attackRange);
    
    // Find all intersecting objects in the scene
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
      // Find the first valid target (not self, not UI elements)
      for (const hit of intersects) {
        // Skip if it's the player mesh
        if (meshRef.current && hit.object.parent === meshRef.current) continue;
        
        // Try to find the rigid body associated with this object
        // Traverse up to find an object with userData containing rigidBody reference
        let current: THREE.Object3D | null = hit.object;
        let foundRigidBody: any = null;
        
        while (current && !foundRigidBody) {
          if ((current as any).rigidBody) {
            foundRigidBody = (current as any).rigidBody;
          } else if (current.userData?.rigidBody) {
            foundRigidBody = current.userData.rigidBody;
          }
          current = current.parent;
        }
        
        // If we found a rigid body, apply impulse
        if (foundRigidBody) {
          try {
            const impulseStrength = meleeKnockback * 3;
            const impulse = {
              x: direction.x * impulseStrength,
              y: direction.y * impulseStrength + 5,
              z: direction.z * impulseStrength
            };
            foundRigidBody.applyImpulse(impulse, true);
            break; // Only hit one object
          } catch (e) {
            // Object might be kinematic or static
          }
        }
        
        // Alternative: use rapier world to find rigid bodies near hit point
        if (!foundRigidBody && world) {
          try {
            const hitPoint = hit.point;
            // Cast a small sphere at the hit point to find physics bodies
            const origin = { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z };
            
            world.bodies.forEach((body: any) => {
              if (body === rigidBodyRef.current?.raw?.()) return; // Skip self
              
              const bodyPos = body.translation();
              const dx = bodyPos.x - hitPoint.x;
              const dy = bodyPos.y - hitPoint.y;
              const dz = bodyPos.z - hitPoint.z;
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
              
              if (dist < 2) { // Within 2 units of hit point
                try {
                  const impulseStrength = meleeKnockback * 3;
                  body.applyImpulse({
                    x: direction.x * impulseStrength,
                    y: direction.y * impulseStrength + 5,
                    z: direction.z * impulseStrength
                  }, true);
                } catch (e) {}
              }
            });
            break;
          } catch (e) {}
        }
      }
    }
  }, [attackRange, meleeKnockback, scene, world]);
  
  useEffect(() => {
    const canvas = gl.domElement;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default browser behavior for Space (prevents page scroll)
      if (e.code === 'Space') {
        e.preventDefault();
      }
      
      switch (e.code) {
        case 'KeyW': movement.current.forward = true; break;
        case 'KeyS': movement.current.backward = true; break;
        case 'KeyA': movement.current.left = true; break;
        case 'KeyD': movement.current.right = true; break;
        case 'Space': movement.current.jump = true; break;
        case 'ShiftLeft':
        case 'ShiftRight':
          movement.current.sprint = true;
          break;
        case 'KeyC':
        case 'ControlLeft':
          movement.current.crouch = true;
          break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': movement.current.forward = false; break;
        case 'KeyS': movement.current.backward = false; break;
        case 'KeyA': movement.current.left = false; break;
        case 'KeyD': movement.current.right = false; break;
        case 'Space': movement.current.jump = false; break;
        case 'ShiftLeft':
        case 'ShiftRight':
          movement.current.sprint = false;
          break;
        case 'KeyC':
        case 'ControlLeft':
          movement.current.crouch = false;
          break;
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isLocked.current) return;
      
      const sens = isAiming ? sensitivity * 0.5 : sensitivity;
      yaw.current -= e.movementX * sens;
      pitch.current -= e.movementY * sens;
      pitch.current = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch.current));
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) movement.current.shoot = true;
      if (e.button === 2) movement.current.aim = true;
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) movement.current.shoot = false;
      if (e.button === 2) movement.current.aim = false;
    };
    
    const handleClick = () => {
      canvas.requestPointerLock();
    };
    
    const handleLockChange = () => {
      isLocked.current = document.pointerLockElement === canvas;
    };
    
    const handleContextMenu = (e: Event) => {
      e.preventDefault(); // Prevent right-click menu
    };
    
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [gl, sensitivity, isAiming]);
  
  // Get runtime game store for AI tracking
  const setPlayerPosition = useRuntimeGameStore(state => state.setPlayerPosition);
  
  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;
    
    const rb = rigidBodyRef.current;
    const pos = rb.translation();
    const currentVel = rb.linvel();
    
    // Update player position in runtime store for AI to track
    setPlayerPosition(new THREE.Vector3(pos.x, pos.y, pos.z));
    
    // Update cooldown
    if (shootCooldownTimer.current > 0) shootCooldownTimer.current -= delta;
    
    // Crouch state
    if (canCrouch && movement.current.crouch) {
      setIsCrouching(true);
      crouchHeight.current = THREE.MathUtils.lerp(crouchHeight.current, 1.0, 0.1);
    } else {
      setIsCrouching(false);
      crouchHeight.current = THREE.MathUtils.lerp(crouchHeight.current, 1.6, 0.1);
    }
    
    // Aim state
    setIsAiming(movement.current.aim);
    
    // Attack - handle both melee and ranged based on attackType
    if (attackEnabled && movement.current.shoot && shootCooldownTimer.current <= 0) {
      shootCooldownTimer.current = attackCooldown;
      
      if (attackType === 'ranged' || attackType === 'combo') {
        // Ranged attack - spawn projectile
        setIsShooting(true);
        setTimeout(() => setIsShooting(false), 50);
        spawnProjectile();
      } else if (attackType === 'melee') {
        // Melee attack with raycast hit detection
        setIsShooting(true);
        setTimeout(() => setIsShooting(false), 150);
        
        // Perform melee hit detection using raycast
        performMeleeAttack();
      }
    }
    
    // Determine speed
    let currentSpeed = speed;
    const isSprinting = canSprint && movement.current.sprint && !isCrouching && !isAiming && stamina.current > 0;
    
    if (isCrouching) {
      currentSpeed = crouchSpeed;
    } else if (isAiming) {
      currentSpeed = speed * 0.5;
    } else if (isSprinting) {
      currentSpeed = sprintSpeed;
      stamina.current = Math.max(0, stamina.current - sprintStaminaCost * delta);
    } else {
      stamina.current = Math.min(maxStamina, stamina.current + staminaRegenRate * delta);
    }
    
    // Update camera rotation
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
    
    // FOV interpolation for aiming
    const targetFov = isAiming ? aimFov : baseFov;
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp(
        (camera as THREE.PerspectiveCamera).fov,
        targetFov,
        0.1
      );
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
    
    // Calculate movement direction relative to camera
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current);
    
    const moveDir = new THREE.Vector3();
    
    if (movement.current.forward) moveDir.add(forward);
    if (movement.current.backward) moveDir.sub(forward);
    if (movement.current.left) moveDir.sub(right);
    if (movement.current.right) moveDir.add(right);
    
    moveDir.normalize().multiplyScalar(currentSpeed);
    
    // Ground check
    isGrounded.current = pos.y < 1.8;
    
    // Apply velocity
    let yVel = currentVel.y;
    if (movement.current.jump && isGrounded.current) {
      yVel = jumpForce;
    }
    
    rb.setLinvel({ x: moveDir.x, y: yVel, z: moveDir.z }, true);
    
    // Update camera position (at eye height)
    camera.position.set(pos.x, pos.y + crouchHeight.current - 0.4, pos.z);
    
    // Update mesh ref
    if (meshRef.current) {
      meshRef.current.position.set(pos.x, pos.y, pos.z);
    }
  });
  
  // Determine if should show gun or melee weapon
  const showGun = attackType === 'ranged' || attackType === 'combo';
  const showMelee = attackType === 'melee';
  
  return (
    <>
      <group ref={meshRef} />
      
      <RigidBody
        ref={rigidBodyRef}
        position={position}
        colliders={false}
        lockRotations
        linearDamping={0.5}
        mass={1}
      >
        <CapsuleCollider args={[0.5, 0.5]} />
      </RigidBody>
      
      {/* Projectiles */}
      <ProjectileManager projectiles={projectiles} onRemove={removeProjectile} />
      
      {/* First person arms/weapons attached to camera */}
      <group>
        <primitive object={camera}>
          {showGun && <GunModel isAiming={isAiming} isShooting={isShooting} />}
          {showMelee && <MeleeWeaponModel isAttacking={isShooting} />}
          <Crosshair isAiming={isAiming} />
        </primitive>
      </group>
    </>
  );
});

FPSController.displayName = 'FPSController';
