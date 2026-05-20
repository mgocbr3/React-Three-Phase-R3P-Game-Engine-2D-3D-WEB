import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { Ground } from '../primitives/Ground';

// Creepy ambient particle - optimized with useMemo and throttled update
const FloatingDust = () => {
  const count = 25; // Reduced from 50 for stability
  const particles = useRef<THREE.Points>(null);
  const frameSkip = useRef(0);
  
  // Memoize positions to prevent recreation on every render
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      pos[i] = (Math.random() - 0.5) * 30;
      pos[i + 1] = Math.random() * 5;
      pos[i + 2] = (Math.random() - 0.5) * 30;
    }
    return pos;
  }, []);
  
  // Throttle to every 3rd frame
  useFrame((state) => {
    frameSkip.current++;
    if (frameSkip.current < 3) return;
    frameSkip.current = 0;
    
    if (particles.current) {
      particles.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });
  
  return (
    <points ref={particles} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#ff6600" transparent opacity={0.4} depthWrite={false} />
    </points>
  );
};

// Flickering light component
const FlickeringLight = ({ position, color = '#ff6600', baseIntensity = 8 }: { position: [number, number, number]; color?: string; baseIntensity?: number }) => {
  const lightRef = useRef<THREE.PointLight>(null);
  
  useFrame((state) => {
    if (lightRef.current) {
      const flicker = Math.sin(state.clock.elapsedTime * 20) * 0.5 + Math.sin(state.clock.elapsedTime * 7) * 0.3;
      lightRef.current.intensity = baseIntensity + flicker;
    }
  });
  
  return (
    <pointLight
      ref={lightRef}
      position={position}
      color={color}
      intensity={baseIntensity}
      distance={25}
      castShadow
    />
  );
};

// Creepy decoration
const CreepyDecoration = ({ position }: { position: [number, number, number] }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });
  
  return (
    <mesh ref={meshRef} position={position} castShadow>
      <boxGeometry args={[0.3, 2, 0.3]} />
      <meshStandardMaterial color="#2a0a0a" emissive="#330000" emissiveIntensity={0.2} />
    </mesh>
  );
};

export const FPSHorrorTemplate = () => {
  const rigidBodyRef = useRef<any>(null);
  const { camera, gl } = useThree();
  const [isLocked, setIsLocked] = useState(false);

  // Flashlight follows camera (don't rely on passing camera.position as prop)
  const flashlightPointRef = useRef<THREE.PointLight | null>(null);
  const flashlightSpotRef = useRef<THREE.SpotLight | null>(null);
  const flashlightTargetRef = useRef<THREE.Object3D | null>(null);
  const tmpForward = useRef(new THREE.Vector3());
  const tmpTarget = useRef(new THREE.Vector3());
  
  const movement = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    run: false,
  });
  
  const rotation = useRef({ x: 0, y: 0 });
  const headBob = useRef(0);
  const breathEffect = useRef(0);
  
  useEffect(() => {
    const canvas = gl.domElement;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': movement.current.forward = true; break;
        case 'KeyS': movement.current.backward = true; break;
        case 'KeyA': movement.current.left = true; break;
        case 'KeyD': movement.current.right = true; break;
        case 'ShiftLeft': movement.current.run = true; break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': movement.current.forward = false; break;
        case 'KeyS': movement.current.backward = false; break;
        case 'KeyA': movement.current.left = false; break;
        case 'KeyD': movement.current.right = false; break;
        case 'ShiftLeft': movement.current.run = false; break;
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        rotation.current.y -= e.movementX * 0.002;
        rotation.current.x -= e.movementY * 0.002;
        rotation.current.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, rotation.current.x));
      }
    };
    
    const handleClick = () => {
      canvas.requestPointerLock();
    };
    
    const handleLockChange = () => {
      setIsLocked(document.pointerLockElement === canvas);
    };
    
    canvas.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      canvas.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [gl]);
  
  useFrame((state, delta) => {
    if (!rigidBodyRef.current) return;
    
    const rb = rigidBodyRef.current;
    const pos = rb.translation();
    const currentVel = rb.linvel();
    
    // Movement speed (slower = more tense)
    const walkSpeed = 4;
    const runSpeed = 7;
    const speed = movement.current.run ? runSpeed : walkSpeed;
    
    // Calculate movement direction
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current.y);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current.y);
    
    const moveDir = new THREE.Vector3();
    
    if (movement.current.forward) moveDir.add(forward);
    if (movement.current.backward) moveDir.sub(forward);
    if (movement.current.left) moveDir.sub(right);
    if (movement.current.right) moveDir.add(right);
    
    const isMoving = moveDir.length() > 0;
    moveDir.normalize().multiplyScalar(speed);
    
    // Apply velocity
    rb.setLinvel({ x: moveDir.x, y: currentVel.y, z: moveDir.z }, true);
    
    // Head bob effect when moving
    if (isMoving) {
      headBob.current += delta * (movement.current.run ? 15 : 10);
    }
    
    // Breathing effect (always present for tension)
    breathEffect.current += delta * 1.5;
    
    // Update camera
    const bobOffset = isMoving ? Math.sin(headBob.current) * 0.05 : 0;
    const breathOffset = Math.sin(breathEffect.current) * 0.02;
    
    camera.position.set(pos.x, pos.y + 1.6 + bobOffset + breathOffset, pos.z);
    
    const euler = new THREE.Euler(rotation.current.x, rotation.current.y, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    // Flashlight follow + aim
    const forwardDir = tmpForward.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const targetPos = tmpTarget.current.copy(camera.position).addScaledVector(forwardDir, 10);

    if (flashlightTargetRef.current) {
      flashlightTargetRef.current.position.copy(targetPos);
      flashlightTargetRef.current.updateMatrixWorld();
    }

    if (flashlightPointRef.current) {
      flashlightPointRef.current.position.copy(camera.position);
    }

    if (flashlightSpotRef.current) {
      flashlightSpotRef.current.position.copy(camera.position);
      if (flashlightTargetRef.current) {
        flashlightSpotRef.current.target = flashlightTargetRef.current;
        flashlightSpotRef.current.target.updateMatrixWorld();
      }
      flashlightSpotRef.current.updateMatrixWorld();
    }
  });

  return (
    <>
      {/* ===== PLAYER ===== */}
      <RigidBody
        ref={rigidBodyRef}
        position={[0, 2, 8]}
        colliders={false}
        lockRotations
        linearDamping={0.9}
        mass={1}
      >
        <CapsuleCollider args={[0.5, 0.5]} />
      </RigidBody>
      
      {/* ===== FLASHLIGHT ===== */}
      <object3D ref={flashlightTargetRef} />
      <pointLight
        ref={flashlightPointRef}
        intensity={35}
        distance={60}
        color="#ffffff"
      />
      <spotLight
        ref={flashlightSpotRef}
        angle={0.85}
        penumbra={0.35}
        intensity={80}
        distance={120}
        decay={1}
        color="#fffaf0"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      
      {/* ===== ENVIRONMENT ===== */}
      <Ground size={[50, 50]} color="#1a1a1a" />
      <fog attach="fog" args={['#0a0a0a', 5, 40]} />
      
      {/* ===== CORRIDOR WALLS ===== */}
      {/* Main hallway */}
      <RigidBody type="fixed" position={[-6, 3, 0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[0.5, 6, 40]} />
          <meshStandardMaterial color="#0a0a0a" metalness={0.1} roughness={0.9} />
        </mesh>
      </RigidBody>
      
      <RigidBody type="fixed" position={[6, 3, 0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[0.5, 6, 40]} />
          <meshStandardMaterial color="#0a0a0a" metalness={0.1} roughness={0.9} />
        </mesh>
      </RigidBody>
      
      {/* End wall with ominous door */}
      <RigidBody type="fixed" position={[0, 3, -20]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[12, 6, 0.5]} />
          <meshStandardMaterial color="#080808" />
        </mesh>
      </RigidBody>
      
      {/* Door frame */}
      <mesh position={[0, 2.5, -19.7]}>
        <boxGeometry args={[2.5, 5, 0.2]} />
        <meshStandardMaterial color="#1a0505" emissive="#220000" emissiveIntensity={0.1} />
      </mesh>
      
      {/* ===== CREEPY OBJECTS ===== */}
      {/* Scattered crates */}
      <RigidBody position={[3, 0.75, -5]} mass={5}>
        <mesh castShadow>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
      </RigidBody>
      
      <RigidBody position={[-4, 0.5, -10]} mass={3}>
        <mesh castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#151515" roughness={0.9} />
        </mesh>
      </RigidBody>
      
      <RigidBody position={[4, 0.4, 5]} mass={2}>
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshStandardMaterial color="#121212" roughness={0.9} />
        </mesh>
      </RigidBody>
      
      {/* Creepy poles/pillars */}
      <CreepyDecoration position={[-4, 1, -15]} />
      <CreepyDecoration position={[4, 1, -12]} />
      <CreepyDecoration position={[-3, 1, 0]} />
      
      {/* ===== LIGHTING ===== */}
      <FlickeringLight position={[0, 4, -10]} color="#ff6644" baseIntensity={10} />
      <FlickeringLight position={[0, 4, 5]} color="#ff8855" baseIntensity={10} />
      <FlickeringLight position={[0, 4, -3]} color="#ffaa66" baseIntensity={8} />
      
      {/* Ceiling lights along corridor */}
      <pointLight position={[-3, 4, 0]} color="#ffcc99" intensity={5} distance={15} />
      <pointLight position={[3, 4, -8]} color="#ffcc99" intensity={5} distance={15} />
      <pointLight position={[-3, 4, -15]} color="#ffcc99" intensity={5} distance={15} />
      
      {/* Ominous red glow from the end */}
      <pointLight position={[0, 2, -18]} color="#ff2200" intensity={8} distance={15} />
      
      {/* Better ambient lighting */}
      <ambientLight intensity={0.15} color="#554433" />
      <hemisphereLight args={['#443322', '#111111', 0.3]} />
      
      {/* ===== PARTICLES ===== */}
      <FloatingDust />
      
      {/* ===== UI HINT ===== */}
      {!isLocked && (
        <group position={[0, 2, 5]}>
          <mesh>
            <planeGeometry args={[4, 1]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.8} />
          </mesh>
        </group>
      )}
    </>
  );
};
