import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Ground } from '../primitives/Ground';

// Track piece component for modular track building
const TrackPiece = ({ 
  position, 
  rotation = [0, 0, 0], 
  size = [8, 0.3, 20],
  color = '#3a3a4a'
}: { 
  position: [number, number, number]; 
  rotation?: [number, number, number];
  size?: [number, number, number];
  color?: string;
}) => (
  <RigidBody type="fixed" position={position} rotation={rotation}>
    <mesh receiveShadow castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.7} />
    </mesh>
  </RigidBody>
);

// Checkpoint/Gate component
const Checkpoint = ({ 
  position, 
  rotation = 0,
  index
}: { 
  position: [number, number, number]; 
  rotation?: number;
  index: number;
}) => (
  <group position={position} rotation={[0, rotation, 0]}>
    {/* Gate posts */}
    <mesh position={[-4, 3, 0]} castShadow>
      <boxGeometry args={[0.5, 6, 0.5]} />
      <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
    </mesh>
    <mesh position={[4, 3, 0]} castShadow>
      <boxGeometry args={[0.5, 6, 0.5]} />
      <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
    </mesh>
    {/* Top bar */}
    <mesh position={[0, 6, 0]} castShadow>
      <boxGeometry args={[8.5, 0.3, 0.3]} />
      <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
    </mesh>
    {/* Checkpoint number */}
    <mesh position={[0, 7, 0]}>
      <boxGeometry args={[1.5, 1.5, 0.1]} />
      <meshStandardMaterial 
        color={index === 0 ? '#fbbf24' : '#3b82f6'} 
        emissive={index === 0 ? '#fbbf24' : '#3b82f6'} 
        emissiveIntensity={0.8} 
      />
    </mesh>
  </group>
);

// Barrier/Guardrail component
const Barrier = ({ 
  position, 
  rotation = [0, 0, 0], 
  length = 10,
  color = '#ef4444'
}: { 
  position: [number, number, number]; 
  rotation?: [number, number, number];
  length?: number;
  color?: string;
}) => (
  <RigidBody type="fixed" position={position} rotation={rotation} restitution={0.5}>
    <mesh receiveShadow castShadow>
      <boxGeometry args={[0.5, 1, length]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color} 
        emissiveIntensity={0.2}
        metalness={0.6}
        roughness={0.4}
      />
    </mesh>
  </RigidBody>
);

export const RacingTemplate = () => {
  const carRef = useRef<any>(null);
  const { camera } = useThree();
  
  const controls = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
  });
  
  const currentSpeed = useRef(0);
  const currentRotation = useRef(0);
  const driftAngle = useRef(0);
  
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
    if (!carRef.current) return;
    
    const rb = carRef.current;
    const pos = rb.translation();
    
    const maxSpeed = 30;
    const acceleration = 20;
    const deceleration = 15;
    const turnSpeed = 2.5;
    const brakePower = 40;
    
    // Acceleration/Braking
    if (controls.current.forward) {
      currentSpeed.current = Math.min(currentSpeed.current + acceleration * delta, maxSpeed);
    } else if (controls.current.backward) {
      currentSpeed.current = Math.max(currentSpeed.current - acceleration * delta, -maxSpeed * 0.4);
    } else {
      // Natural deceleration
      if (currentSpeed.current > 0) {
        currentSpeed.current = Math.max(0, currentSpeed.current - deceleration * delta);
      } else {
        currentSpeed.current = Math.min(0, currentSpeed.current + deceleration * delta);
      }
    }
    
    // Brake
    if (controls.current.brake) {
      if (currentSpeed.current > 0) {
        currentSpeed.current = Math.max(0, currentSpeed.current - brakePower * delta);
      } else {
        currentSpeed.current = Math.min(0, currentSpeed.current + brakePower * delta);
      }
      // Drift effect
      driftAngle.current = THREE.MathUtils.lerp(driftAngle.current, 0.3, 0.1);
    } else {
      driftAngle.current = THREE.MathUtils.lerp(driftAngle.current, 0, 0.05);
    }
    
    // Steering (only when moving)
    const speedFactor = Math.abs(currentSpeed.current) / maxSpeed;
    const effectiveTurnSpeed = turnSpeed * speedFactor * (controls.current.brake ? 1.5 : 1);
    
    if (controls.current.left) {
      currentRotation.current += effectiveTurnSpeed * delta;
    }
    if (controls.current.right) {
      currentRotation.current -= effectiveTurnSpeed * delta;
    }
    
    // Apply physics
    const forward = new THREE.Vector3(
      Math.sin(currentRotation.current + driftAngle.current),
      0,
      Math.cos(currentRotation.current + driftAngle.current)
    );
    
    const velocity = forward.multiplyScalar(currentSpeed.current);
    const currentVel = rb.linvel();
    
    rb.setLinvel({ x: velocity.x, y: currentVel.y, z: velocity.z }, true);
    rb.setRotation(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, currentRotation.current, 0)),
      true
    );
    
    // Camera follow with lag
    const cameraOffset = new THREE.Vector3(
      -Math.sin(currentRotation.current) * 15,
      8,
      -Math.cos(currentRotation.current) * 15
    );
    
    const targetCamPos = new THREE.Vector3(
      pos.x + cameraOffset.x,
      pos.y + cameraOffset.y,
      pos.z + cameraOffset.z
    );
    
    camera.position.lerp(targetCamPos, 0.08);
    camera.lookAt(pos.x, pos.y + 1, pos.z);
  });
  
  return (
    <>
      {/* ===== VEHICLE ===== */}
      <RigidBody 
        ref={carRef} 
        position={[0, 1, 0]} 
        colliders={false}
        mass={10}
        linearDamping={0.3}
        angularDamping={0.5}
      >
        <CuboidCollider args={[1.2, 0.5, 2.5]} />
        <group>
          {/* Main chassis */}
          <mesh castShadow position={[0, 0.2, 0]}>
            <boxGeometry args={[2.4, 0.7, 5]} />
            <meshStandardMaterial color="#f97316" metalness={0.9} roughness={0.1} />
          </mesh>
          
          {/* Cabin/Cockpit */}
          <mesh castShadow position={[0, 0.7, -0.5]}>
            <boxGeometry args={[2, 0.6, 2.5]} />
            <meshStandardMaterial color="#1a1a2e" metalness={0.9} roughness={0.1} transparent opacity={0.8} />
          </mesh>
          
          {/* Spoiler */}
          <mesh castShadow position={[0, 0.6, 2.3]}>
            <boxGeometry args={[2.2, 0.1, 0.5]} />
            <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh castShadow position={[0, 0.9, 2.3]}>
            <boxGeometry args={[2.4, 0.08, 0.6]} />
            <meshStandardMaterial color="#f97316" metalness={0.9} roughness={0.1} />
          </mesh>
          
          {/* Headlights */}
          {[[-0.8, 0.1, -2.5], [0.8, 0.1, -2.5]].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffff88" emissiveIntensity={2} />
            </mesh>
          ))}
          
          {/* Taillights */}
          {[[-0.9, 0.3, 2.5], [0.9, 0.3, 2.5]].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <boxGeometry args={[0.4, 0.2, 0.1]} />
              <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1.5} />
            </mesh>
          ))}
          
          {/* Wheels */}
          {[
            [-1.1, -0.3, -1.5],
            [1.1, -0.3, -1.5],
            [-1.1, -0.3, 1.5],
            [1.1, -0.3, 1.5]
          ].map((pos, i) => (
            <mesh key={i} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.45, 0.45, 0.35, 16]} />
              <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.5} />
            </mesh>
          ))}
        </group>
      </RigidBody>
      
      {/* ===== TRACK ===== */}
      <Ground size={[200, 200]} color="#1a3a1a" />
      
      {/* Main track surface - oval layout */}
      <TrackPiece position={[0, 0.15, 0]} size={[10, 0.3, 40]} />
      <TrackPiece position={[0, 0.15, -50]} size={[10, 0.3, 40]} />
      <TrackPiece position={[0, 0.15, 50]} size={[10, 0.3, 40]} />
      <TrackPiece position={[30, 0.15, 0]} size={[10, 0.3, 40]} />
      <TrackPiece position={[-30, 0.15, 0]} size={[10, 0.3, 40]} />
      
      {/* Corners */}
      <TrackPiece position={[15, 0.15, -60]} rotation={[0, Math.PI / 4, 0]} size={[10, 0.3, 25]} />
      <TrackPiece position={[-15, 0.15, -60]} rotation={[0, -Math.PI / 4, 0]} size={[10, 0.3, 25]} />
      <TrackPiece position={[15, 0.15, 60]} rotation={[0, -Math.PI / 4, 0]} size={[10, 0.3, 25]} />
      <TrackPiece position={[-15, 0.15, 60]} rotation={[0, Math.PI / 4, 0]} size={[10, 0.3, 25]} />
      
      {/* ===== BARRIERS ===== */}
      <Barrier position={[-6, 0.5, 0]} length={40} />
      <Barrier position={[6, 0.5, 0]} length={40} />
      <Barrier position={[-6, 0.5, -50]} length={40} />
      <Barrier position={[6, 0.5, -50]} length={40} />
      <Barrier position={[-6, 0.5, 50]} length={40} />
      <Barrier position={[6, 0.5, 50]} length={40} />
      
      {/* ===== CHECKPOINTS ===== */}
      <Checkpoint position={[0, 0, -30]} rotation={0} index={0} />
      <Checkpoint position={[0, 0, 30]} rotation={0} index={1} />
      
      {/* ===== DECORATIONS ===== */}
      {/* Tire stacks */}
      {[[-12, 0.5, 20], [12, 0.5, 20], [-12, 0.5, -20], [12, 0.5, -20]].map((p, i) => (
        <group key={i} position={p as [number, number, number]}>
          {[0, 0.5, 1].map((y, j) => (
            <mesh key={j} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.4, 0.2, 8, 16]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          ))}
        </group>
      ))}
      
      {/* Pit area indicators */}
      <mesh position={[20, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 15]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.3} />
      </mesh>
      
      {/* Ambient lighting */}
      <pointLight position={[0, 20, 0]} intensity={0.5} color="#ffffff" />
      <pointLight position={[0, 10, -50]} intensity={0.3} color="#3b82f6" />
      <pointLight position={[0, 10, 50]} intensity={0.3} color="#ef4444" />
    </>
  );
};
