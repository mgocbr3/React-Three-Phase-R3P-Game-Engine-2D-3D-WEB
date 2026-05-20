import { useRef, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider, useRevoluteJoint } from '@react-three/rapier';
import * as THREE from 'three';

interface VehicleControllerProps {
  position?: [number, number, number];
  color?: string;
  maxSpeed?: number;
  acceleration?: number;
  turnSpeed?: number;
  nitroMultiplier?: number;
  driftFactor?: number;
}

// Nitro flame effect
const NitroFlame = ({ active }: { active: boolean }) => {
  const flameRef = useRef<THREE.Mesh>(null);
  const [intensity, setIntensity] = useState(0);
  
  useFrame(() => {
    if (active) {
      setIntensity(prev => Math.min(prev + 0.1, 1));
    } else {
      setIntensity(prev => Math.max(prev - 0.1, 0));
    }
    
    if (flameRef.current && intensity > 0) {
      flameRef.current.scale.z = 0.5 + Math.random() * 0.5 * intensity;
    }
  });
  
  if (intensity <= 0) return null;
  
  return (
    <group position={[0, 0.1, 2.3]}>
      <mesh ref={flameRef}>
        <coneGeometry args={[0.15, 0.8, 8]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.8 * intensity} />
      </mesh>
      <pointLight color="#ff4400" intensity={2 * intensity} distance={5} />
    </group>
  );
};

// Drift smoke effect
const DriftSmoke = ({ active, side }: { active: boolean; side: 'left' | 'right' }) => {
  if (!active) return null;
  
  const xPos = side === 'left' ? -0.9 : 0.9;
  
  return (
    <group position={[xPos, -0.2, 1.5]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0, i * 0.5]}>
          <sphereGeometry args={[0.2 + i * 0.1, 6, 6]} />
          <meshBasicMaterial color="#888888" transparent opacity={0.4 - i * 0.1} />
        </mesh>
      ))}
    </group>
  );
};

// Brake lights
const BrakeLights = ({ active }: { active: boolean }) => {
  return (
    <>
      <mesh position={[0.7, 0.2, 2]}>
        <boxGeometry args={[0.3, 0.15, 0.05]} />
        <meshStandardMaterial 
          color="#ff0000" 
          emissive="#ff0000" 
          emissiveIntensity={active ? 3 : 1}
        />
      </mesh>
      <mesh position={[-0.7, 0.2, 2]}>
        <boxGeometry args={[0.3, 0.15, 0.05]} />
        <meshStandardMaterial 
          color="#ff0000" 
          emissive="#ff0000" 
          emissiveIntensity={active ? 3 : 1}
        />
      </mesh>
    </>
  );
};

// Wheel component that attaches to chassis
const Wheel = ({ 
  position, 
  chassisRef, 
  isFront = false,
  isLeft = false,
  color = '#333333'
}: { 
  position: [number, number, number]; 
  chassisRef: React.RefObject<any>;
  isFront?: boolean;
  isLeft?: boolean;
  color?: string;
}) => {
  const wheelRef = useRef<any>(null);
  
  // Create revolute joint between wheel and chassis
  useRevoluteJoint(chassisRef, wheelRef, [
    position, // Anchor on chassis
    [0, 0, 0], // Anchor on wheel
    [1, 0, 0], // Rotation axis (X for wheel spin)
  ]);
  
  return (
    <RigidBody
      ref={wheelRef}
      position={[position[0], position[1] - 0.3, position[2]]}
      colliders={false}
      type="dynamic"
      mass={0.5}
    >
      <CuboidCollider args={[0.1, 0.3, 0.3]} friction={2} />
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
    </RigidBody>
  );
};

export const VehicleController = forwardRef<THREE.Object3D, VehicleControllerProps>(({
  position = [0, 2, 0],
  color = '#ff4444',
  maxSpeed = 30,
  acceleration = 20,
  turnSpeed = 2.5,
  nitroMultiplier = 1.5,
  driftFactor = 1.5,
}, ref) => {
  const chassisRef = useRef<any>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // Expose chassis position to parent
  useImperativeHandle(ref, () => meshRef.current as THREE.Object3D, []);
  
  const controls = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
    nitro: false,
    lookBack: false,
  });
  
  const currentSpeed = useRef(0);
  const currentTurn = useRef(0);
  const nitroAmount = useRef(100);
  const wheelRotation = useRef(0);
  
  // Visual states
  const [isNitroActive, setIsNitroActive] = useState(false);
  const [isDrifting, setIsDrifting] = useState(false);
  const [isBraking, setIsBraking] = useState(false);
  
  // Camera state
  const cameraOffset = useRef(new THREE.Vector3(0, 5, 12));
  const cameraLookAt = useRef(new THREE.Vector3());
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          controls.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          controls.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          controls.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          controls.current.right = true;
          break;
        case 'Space':
          controls.current.brake = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          controls.current.nitro = true;
          break;
        case 'KeyC':
          controls.current.lookBack = true;
          break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          controls.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          controls.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          controls.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          controls.current.right = false;
          break;
        case 'Space':
          controls.current.brake = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          controls.current.nitro = false;
          break;
        case 'KeyC':
          controls.current.lookBack = false;
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
    if (!chassisRef.current) return;
    
    const rb = chassisRef.current;
    const pos = rb.translation();
    const rot = rb.rotation();
    
    // Update mesh position for camera tracking
    if (meshRef.current) {
      meshRef.current.position.set(pos.x, pos.y, pos.z);
      meshRef.current.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    }
    
    // Get forward direction from rotation
    const forward = new THREE.Vector3(0, 0, -1);
    const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    forward.applyQuaternion(quaternion);
    
    // Nitro management
    const nitroActive = controls.current.nitro && nitroAmount.current > 0 && controls.current.forward;
    setIsNitroActive(nitroActive);
    
    if (nitroActive) {
      nitroAmount.current = Math.max(0, nitroAmount.current - 30 * delta);
    } else {
      nitroAmount.current = Math.min(100, nitroAmount.current + 10 * delta);
    }
    
    // Calculate effective max speed and acceleration
    const effectiveMaxSpeed = nitroActive ? maxSpeed * nitroMultiplier : maxSpeed;
    const effectiveAcceleration = nitroActive ? acceleration * nitroMultiplier : acceleration;
    
    // Acceleration/Braking
    if (controls.current.forward) {
      currentSpeed.current = Math.min(currentSpeed.current + effectiveAcceleration * delta, effectiveMaxSpeed);
    } else if (controls.current.backward) {
      currentSpeed.current = Math.max(currentSpeed.current - acceleration * delta, -effectiveMaxSpeed * 0.4);
    } else {
      // Natural deceleration
      currentSpeed.current *= 0.98;
    }
    
    // Handbrake drift
    const drifting = controls.current.brake && Math.abs(currentSpeed.current) > maxSpeed * 0.3;
    setIsDrifting(drifting);
    setIsBraking(controls.current.brake);
    
    if (controls.current.brake) {
      if (drifting) {
        // Drift mode - reduced grip, more rotation
        currentSpeed.current *= 0.98;
      } else {
        // Normal brake
        currentSpeed.current *= 0.9;
      }
    }
    
    // Steering (only when moving)
    const speedFactor = Math.abs(currentSpeed.current) / maxSpeed;
    const driftTurnMultiplier = drifting ? driftFactor : 1;
    
    if (controls.current.left) {
      currentTurn.current = THREE.MathUtils.lerp(
        currentTurn.current, 
        turnSpeed * speedFactor * driftTurnMultiplier, 
        drifting ? 0.05 : 0.1
      );
    } else if (controls.current.right) {
      currentTurn.current = THREE.MathUtils.lerp(
        currentTurn.current, 
        -turnSpeed * speedFactor * driftTurnMultiplier, 
        drifting ? 0.05 : 0.1
      );
    } else {
      currentTurn.current = THREE.MathUtils.lerp(currentTurn.current, 0, 0.1);
    }
    
    // Apply angular velocity for turning
    rb.setAngvel({ x: 0, y: currentTurn.current, z: 0 }, true);
    
    // Apply linear velocity in forward direction
    const velocity = forward.multiplyScalar(currentSpeed.current);
    const currentVel = rb.linvel();
    
    // Add sideways drift when handbraking
    if (drifting) {
      const right = new THREE.Vector3(1, 0, 0);
      right.applyQuaternion(quaternion);
      const driftVelocity = right.multiplyScalar(currentTurn.current * 3);
      rb.setLinvel({ 
        x: velocity.x + driftVelocity.x, 
        y: currentVel.y, 
        z: velocity.z + driftVelocity.z 
      }, true);
    } else {
      rb.setLinvel({ x: velocity.x, y: currentVel.y, z: velocity.z }, true);
    }
    
    // Wheel rotation
    wheelRotation.current += currentSpeed.current * delta * 0.5;
    
    // Camera follow with look-back option
    const targetOffset = controls.current.lookBack 
      ? new THREE.Vector3(0, 4, -10) 
      : new THREE.Vector3(0, 5 + speedFactor * 2, 12 + speedFactor * 3);
    
    cameraOffset.current.lerp(targetOffset, 0.05);
    
    const cameraWorldOffset = cameraOffset.current.clone().applyQuaternion(quaternion);
    const targetCameraPos = new THREE.Vector3(pos.x, pos.y, pos.z).add(cameraWorldOffset);
    
    camera.position.lerp(targetCameraPos, 0.08);
    
    // Look at target
    const lookAtOffset = controls.current.lookBack 
      ? new THREE.Vector3(0, 0, 10) 
      : new THREE.Vector3(0, 1, -5);
    const worldLookAt = lookAtOffset.applyQuaternion(quaternion);
    cameraLookAt.current.lerp(new THREE.Vector3(pos.x, pos.y, pos.z).add(worldLookAt), 0.1);
    camera.lookAt(cameraLookAt.current);
  });
  
  return (
    <>
      {/* Tracking mesh for camera */}
      <group ref={meshRef} />
      
      {/* Chassis */}
      <RigidBody
        ref={chassisRef}
        position={position}
        colliders={false}
        mass={10}
        linearDamping={0.5}
        angularDamping={2}
      >
        <CuboidCollider args={[1, 0.4, 2]} />
        
        {/* Car Body */}
        <group>
          {/* Main chassis */}
          <mesh castShadow position={[0, 0.2, 0]}>
            <boxGeometry args={[2, 0.6, 4]} />
            <meshStandardMaterial 
              color={color} 
              metalness={0.8} 
              roughness={0.2}
            />
          </mesh>
          
          {/* Cabin */}
          <mesh castShadow position={[0, 0.7, -0.3]}>
            <boxGeometry args={[1.6, 0.6, 2]} />
            <meshStandardMaterial 
              color="#222222" 
              metalness={0.9} 
              roughness={0.1}
              transparent
              opacity={0.7}
            />
          </mesh>
          
          {/* Spoiler */}
          <mesh castShadow position={[0, 0.5, 1.8]}>
            <boxGeometry args={[1.8, 0.1, 0.4]} />
            <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
          </mesh>
          
          {/* Headlights */}
          <mesh position={[0.6, 0.1, -2]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial 
              color="#ffffff" 
              emissive="#ffff00" 
              emissiveIntensity={2}
            />
          </mesh>
          <mesh position={[-0.6, 0.1, -2]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial 
              color="#ffffff" 
              emissive="#ffff00" 
              emissiveIntensity={2}
            />
          </mesh>
          
          {/* Brake lights */}
          <BrakeLights active={isBraking} />
          
          {/* Nitro flames */}
          <NitroFlame active={isNitroActive} />
          
          {/* Drift smoke */}
          <DriftSmoke active={isDrifting && controls.current.left} side="right" />
          <DriftSmoke active={isDrifting && controls.current.right} side="left" />
          
          {/* Simple wheels (visual only) */}
          {[
            [-0.9, -0.3, -1.3],
            [0.9, -0.3, -1.3],
            [-0.9, -0.3, 1.3],
            [0.9, -0.3, 1.3],
          ].map((pos, i) => (
            <mesh 
              key={i} 
              position={pos as [number, number, number]} 
              rotation={[wheelRotation.current, i < 2 ? currentTurn.current * 0.3 : 0, Math.PI / 2]} 
              castShadow
            >
              <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
              <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} />
            </mesh>
          ))}
        </group>
      </RigidBody>
    </>
  );
});

VehicleController.displayName = 'VehicleController';
