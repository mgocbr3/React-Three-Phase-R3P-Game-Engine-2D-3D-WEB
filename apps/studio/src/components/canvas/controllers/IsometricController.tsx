import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';

interface IsometricControllerProps {
  position?: [number, number, number];
  color?: string;
  speed?: number;
  cameraHeight?: number;
  cameraDistance?: number;
}

export const IsometricController = forwardRef<THREE.Object3D, IsometricControllerProps>(({
  position = [0, 1, 0],
  color = '#22c55e',
  speed = 6,
  cameraHeight = 20,
  cameraDistance = 15,
}, ref) => {
  const rigidBodyRef = useRef<any>(null);
  const meshRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // Expose position to parent
  useImperativeHandle(ref, () => meshRef.current as THREE.Object3D, []);
  
  const movement = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });
  
  const targetPosition = useRef<THREE.Vector3 | null>(null);
  const isClickToMove = useRef(false);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      targetPosition.current = null; // Cancel click-to-move when using keyboard
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
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Set up isometric camera
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 35; // Narrower FOV for more isometric feel
      camera.updateProjectionMatrix();
    }
  }, [camera]);
  
  useFrame(() => {
    if (!rigidBodyRef.current) return;
    
    const rb = rigidBodyRef.current;
    const pos = rb.translation();
    const currentVel = rb.linvel();
    
    // Calculate movement direction (in world space for top-down)
    let moveX = 0;
    let moveZ = 0;
    
    if (movement.current.forward) moveZ -= 1;
    if (movement.current.backward) moveZ += 1;
    if (movement.current.left) moveX -= 1;
    if (movement.current.right) moveX += 1;
    
    // Click-to-move logic
    if (targetPosition.current) {
      const dir = new THREE.Vector3(
        targetPosition.current.x - pos.x,
        0,
        targetPosition.current.z - pos.z
      );
      
      if (dir.length() > 0.5) {
        dir.normalize();
        moveX = dir.x;
        moveZ = dir.z;
      } else {
        targetPosition.current = null;
      }
    }
    
    // Normalize diagonal movement
    if (moveX !== 0 && moveZ !== 0) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= length;
      moveZ /= length;
    }
    
    // Apply velocity
    rb.setLinvel({ x: moveX * speed, y: currentVel.y, z: moveZ * speed }, true);
    
    // Update mesh position
    if (meshRef.current) {
      meshRef.current.position.set(pos.x, pos.y, pos.z);
      
      // Rotate to face movement direction
      if (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1) {
        const targetRotation = Math.atan2(moveX, moveZ);
        meshRef.current.rotation.y = THREE.MathUtils.lerp(
          meshRef.current.rotation.y,
          targetRotation,
          0.15
        );
      }
    }
    
    // Update camera - isometric view following player
    const cameraPos = new THREE.Vector3(
      pos.x + cameraDistance * 0.7,
      cameraHeight,
      pos.z + cameraDistance * 0.7
    );
    
    camera.position.lerp(cameraPos, 0.05);
    camera.lookAt(pos.x, pos.y, pos.z);
  });
  
  return (
    <>
      <group ref={meshRef}>
        {/* Character body */}
        <mesh castShadow position={[0, 0.5, 0]}>
          <capsuleGeometry args={[0.4, 0.8, 8, 16]} />
          <meshStandardMaterial 
            color={color} 
            emissive={color}
            emissiveIntensity={0.2}
            metalness={0.3}
            roughness={0.6}
          />
        </mesh>
        
        {/* Character indicator ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.5, 0.7, 32]} />
          <meshStandardMaterial 
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
        
        {/* Direction indicator */}
        <mesh position={[0, 0.5, -0.5]}>
          <coneGeometry args={[0.15, 0.3, 8]} />
          <meshStandardMaterial 
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.3}
          />
        </mesh>
      </group>
      
      <RigidBody
        ref={rigidBodyRef}
        position={position}
        colliders={false}
        lockRotations
        linearDamping={0.8}
        mass={1}
      >
        <CapsuleCollider args={[0.4, 0.4]} />
      </RigidBody>
    </>
  );
});

IsometricController.displayName = 'IsometricController';
