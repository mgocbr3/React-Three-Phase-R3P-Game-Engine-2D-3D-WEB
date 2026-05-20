import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { PlayerSettings } from '@/stores/editorStore';

interface PlatformerControllerProps {
  position?: [number, number, number];
  color?: string;
  playerSettings?: PlayerSettings;
  cameraDistance?: number;
}

// Dash effect
const DashEffect = ({ active, direction }: { active: boolean; direction: number }) => {
  if (!active) return null;
  
  return (
    <>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[direction * -0.3 * (i + 1), 0, 0]} scale={[1 - i * 0.25, 1 - i * 0.25, 1]}>
          <capsuleGeometry args={[0.4, 0.5, 4, 8]} />
          <meshBasicMaterial color="#88ddff" transparent opacity={0.4 - i * 0.12} />
        </mesh>
      ))}
    </>
  );
};

// Attack slash effect
const SlashEffect = ({ active, direction }: { active: boolean; direction: number }) => {
  if (!active) return null;
  
  return (
    <mesh position={[direction * 0.8, 0.2, 0]} rotation={[0, 0, direction * -0.5]}>
      <planeGeometry args={[1.5, 0.3]} />
      <meshBasicMaterial color="#ffaa44" transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
};

// Wall slide indicator
const WallSlideParticles = ({ active }: { active: boolean }) => {
  if (!active) return null;
  
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, -0.5 - i * 0.3, 0.5]}>
          <sphereGeometry args={[0.05, 4, 4]} />
          <meshBasicMaterial color="#aaaaaa" transparent opacity={0.6 - i * 0.1} />
        </mesh>
      ))}
    </>
  );
};

export const PlatformerController = forwardRef<THREE.Object3D, PlatformerControllerProps>(({
  position = [0, 2, 0],
  color = '#fbbf24',
  playerSettings,
  cameraDistance = 20,
}, ref) => {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // Extract settings with platformer defaults
  const speed = playerSettings?.speed ?? 8;
  const jumpForce = playerSettings?.jumpForce ?? 14;
  const canDoubleJump = playerSettings?.canDoubleJump ?? true;
  const doubleJumpForce = playerSettings?.doubleJumpForce ?? 10;
  const coyoteTime = playerSettings?.coyoteTime ?? 0.12;
  const jumpBufferTime = playerSettings?.jumpBufferTime ?? 0.15;
  
  // Wall mechanics
  const canWallJump = playerSettings?.canWallJump ?? true;
  const canWallSlide = playerSettings?.canWallSlide ?? true;
  const wallSlideSpeed = playerSettings?.wallSlideSpeed ?? 2;
  const wallJumpForce = playerSettings?.wallJumpForce ?? 12;
  
  // Dash
  const canDodge = playerSettings?.canDodge ?? true;
  const dodgeDistance = playerSettings?.dodgeDistance ?? 5;
  const dodgeDuration = playerSettings?.dodgeDuration ?? 0.2;
  const dodgeCooldown = playerSettings?.dodgeCooldown ?? 0.5;
  
  // Attack
  const attackEnabled = playerSettings?.attackEnabled ?? true;
  const attackCooldown = playerSettings?.attackCooldown ?? 0.3;
  
  // Air control
  const airControlMultiplier = playerSettings?.airControlMultiplier ?? 0.9;
  
  // Expose position to parent
  useImperativeHandle(ref, () => meshRef.current as THREE.Object3D, []);
  
  const movement = useRef({
    left: false,
    right: false,
    jump: false,
    dash: false,
    attack: false,
  });
  
  // State
  const isGrounded = useRef(true);
  const wasGrounded = useRef(true);
  const facingRight = useRef(true);
  const jumpCooldown = useRef(0);
  const coyoteTimer = useRef(0);
  const jumpBufferTimer = useRef(0);
  const hasDoubleJumped = useRef(false);
  
  // Wall state
  const touchingWall = useRef(0); // -1 left, 0 none, 1 right
  const [isWallSliding, setIsWallSliding] = useState(false);
  
  // Dash state
  const [isDashing, setIsDashing] = useState(false);
  const dashTimer = useRef(0);
  const dashCooldownTimer = useRef(0);
  const dashDirection = useRef(1);
  
  // Attack state
  const [isAttacking, setIsAttacking] = useState(false);
  const attackCooldownTimer = useRef(0);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyA':
        case 'ArrowLeft':
          movement.current.left = true;
          facingRight.current = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          movement.current.right = true;
          facingRight.current = true;
          break;
        case 'Space':
        case 'KeyW':
        case 'ArrowUp':
          movement.current.jump = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyQ':
          movement.current.dash = true;
          break;
        case 'KeyX':
        case 'KeyE':
          movement.current.attack = true;
          break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyA':
        case 'ArrowLeft':
          movement.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          movement.current.right = false;
          break;
        case 'Space':
        case 'KeyW':
        case 'ArrowUp':
          movement.current.jump = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyQ':
          movement.current.dash = false;
          break;
        case 'KeyX':
        case 'KeyE':
          movement.current.attack = false;
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  useFrame((state, delta) => {
    if (!rigidBodyRef.current) return;
    
    const rb = rigidBodyRef.current;
    const pos = rb.translation();
    const currentVel = rb.linvel();
    
    // Update cooldowns
    if (jumpCooldown.current > 0) jumpCooldown.current -= delta;
    if (dashCooldownTimer.current > 0) dashCooldownTimer.current -= delta;
    if (attackCooldownTimer.current > 0) attackCooldownTimer.current -= delta;
    
    // Ground detection
    wasGrounded.current = isGrounded.current;
    isGrounded.current = pos.y < 1.5 && currentVel.y <= 0.1;
    
    // Reset on landing
    if (isGrounded.current && !wasGrounded.current) {
      hasDoubleJumped.current = false;
    }
    
    // Coyote time
    if (wasGrounded.current && !isGrounded.current && currentVel.y <= 0) {
      coyoteTimer.current = coyoteTime;
    }
    if (coyoteTimer.current > 0) coyoteTimer.current -= delta;
    
    // Jump buffer
    if (movement.current.jump) {
      jumpBufferTimer.current = jumpBufferTime;
    }
    if (jumpBufferTimer.current > 0) jumpBufferTimer.current -= delta;
    
    // Wall detection (simplified - check X velocity hitting a wall)
    // In a real game, you'd use raycasts
    touchingWall.current = 0;
    if (!isGrounded.current) {
      if (movement.current.left && Math.abs(currentVel.x) < 0.5) {
        touchingWall.current = -1;
      } else if (movement.current.right && Math.abs(currentVel.x) < 0.5) {
        touchingWall.current = 1;
      }
    }
    
    // Wall slide
    const sliding = canWallSlide && touchingWall.current !== 0 && currentVel.y < 0;
    setIsWallSliding(sliding);
    
    // Handle dash
    if (isDashing) {
      dashTimer.current -= delta;
      if (dashTimer.current <= 0) {
        setIsDashing(false);
      } else {
        const dashSpeed = dodgeDistance / dodgeDuration;
        rb.setLinvel({ x: dashDirection.current * dashSpeed, y: 0, z: 0 }, true);
        
        // Force Z
        if (Math.abs(pos.z) > 0.01) {
          rb.setTranslation({ x: pos.x, y: pos.y, z: 0 }, true);
        }
        
        // Update mesh
        if (meshRef.current) {
          meshRef.current.position.set(pos.x, pos.y, pos.z);
        }
        return;
      }
    }
    
    // Horizontal movement
    let moveX = 0;
    if (movement.current.left) moveX -= 1;
    if (movement.current.right) moveX += 1;
    
    let effectiveSpeed = speed;
    if (!isGrounded.current) {
      effectiveSpeed *= airControlMultiplier;
    }
    
    // Trigger dash
    if (canDodge && movement.current.dash && dashCooldownTimer.current <= 0 && !isDashing) {
      setIsDashing(true);
      dashTimer.current = dodgeDuration;
      dashCooldownTimer.current = dodgeCooldown;
      dashDirection.current = facingRight.current ? 1 : -1;
      movement.current.dash = false;
      hasDoubleJumped.current = false; // Reset double jump on dash
    }
    
    // Trigger attack
    if (attackEnabled && movement.current.attack && attackCooldownTimer.current <= 0 && !isAttacking) {
      setIsAttacking(true);
      attackCooldownTimer.current = attackCooldown;
      movement.current.attack = false;
      setTimeout(() => setIsAttacking(false), 150);
    }
    
    // Jump logic
    let yVel = currentVel.y;
    const canJumpGround = isGrounded.current || coyoteTimer.current > 0;
    const wantsToJump = jumpBufferTimer.current > 0 && jumpCooldown.current <= 0;
    
    if (wantsToJump && canJumpGround) {
      // Ground jump
      yVel = jumpForce;
      jumpCooldown.current = 0.2;
      coyoteTimer.current = 0;
      jumpBufferTimer.current = 0;
    } else if (wantsToJump && canWallJump && touchingWall.current !== 0) {
      // Wall jump
      yVel = wallJumpForce;
      moveX = -touchingWall.current * 1.5; // Push away from wall
      facingRight.current = touchingWall.current < 0;
      jumpCooldown.current = 0.3;
      jumpBufferTimer.current = 0;
      hasDoubleJumped.current = false; // Reset double jump on wall jump
    } else if (wantsToJump && canDoubleJump && !hasDoubleJumped.current && !isGrounded.current && touchingWall.current === 0) {
      // Double jump
      yVel = doubleJumpForce;
      hasDoubleJumped.current = true;
      jumpCooldown.current = 0.2;
      jumpBufferTimer.current = 0;
    }
    
    // Wall slide - slow fall
    if (sliding) {
      yVel = Math.max(yVel, -wallSlideSpeed);
    }
    
    // Apply velocity - Z locked to 0 for 2.5D
    rb.setLinvel({ x: moveX * effectiveSpeed, y: yVel, z: 0 }, true);
    
    // Force Z position
    if (Math.abs(pos.z) > 0.01) {
      rb.setTranslation({ x: pos.x, y: pos.y, z: 0 }, true);
    }
    
    // Update mesh
    if (meshRef.current) {
      meshRef.current.position.set(pos.x, pos.y, pos.z);
      
      // Face movement direction with squash/stretch
      const targetRotation = facingRight.current ? Math.PI / 2 : -Math.PI / 2;
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotation, 0.2);
      
      // Squash on landing, stretch when jumping
      if (isGrounded.current && !wasGrounded.current) {
        meshRef.current.scale.set(1.2, 0.8, 1);
      } else if (Math.abs(currentVel.y) > 5) {
        meshRef.current.scale.set(0.85, 1.15, 1);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
    }
    
    // Camera follow
    const cameraPos = new THREE.Vector3(pos.x, pos.y + 3, cameraDistance);
    camera.position.lerp(cameraPos, 0.08);
    camera.lookAt(pos.x, pos.y + 1, 0);
  });
  
  return (
    <>
      <group ref={meshRef}>
        {/* Character body */}
        <mesh castShadow position={[0, 0, 0]}>
          <capsuleGeometry args={[0.5, 0.6, 8, 16]} />
          <meshStandardMaterial 
            color={isDashing ? '#88ddff' : isAttacking ? '#ffaa44' : color} 
            emissive={isDashing ? '#88ddff' : isAttacking ? '#ff6622' : color}
            emissiveIntensity={isDashing ? 0.8 : isAttacking ? 1 : 0.3}
            metalness={0.2}
            roughness={0.5}
          />
        </mesh>
        
        {/* Eyes */}
        <mesh position={[0.2, 0.4, 0.45]} castShadow>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[-0.2, 0.4, 0.45]} castShadow>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
        </mesh>
        
        {/* Pupils */}
        <mesh position={[0.22, 0.4, 0.55]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        <mesh position={[-0.18, 0.4, 0.55]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        
        {/* Ground shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]}>
          <circleGeometry args={[0.6, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.3} />
        </mesh>
        
        {/* Dash effect */}
        <DashEffect active={isDashing} direction={dashDirection.current} />
        
        {/* Attack slash */}
        <SlashEffect active={isAttacking} direction={facingRight.current ? 1 : -1} />
        
        {/* Wall slide particles */}
        <WallSlideParticles active={isWallSliding} />
      </group>
      
      <RigidBody
        ref={rigidBodyRef}
        position={position}
        colliders={false}
        lockRotations
        linearDamping={0.3}
        mass={1}
        gravityScale={2}
      >
        <CapsuleCollider args={[0.3, 0.5]} />
      </RigidBody>
    </>
  );
});

PlatformerController.displayName = 'PlatformerController';PlatformerController.displayName = 'PlatformerController';
