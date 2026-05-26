// Default 3rd-person player controller.
//
// Replaces the deleted MinecraftPlayer.tsx — same physics & input model
// (RigidBody + CapsuleCollider + WASD + jump with coyote/buffer +
// optional sprint + 2d-sidescroll lock + camera follow + touch input
// bridge), but the visual is a GLTF (default: manequim CC-BY-4.0 at
// `/models/manequin/scene.gltf`). Combat/melee/ranged/projectile logic
// from MinecraftPlayer was stripped; bring it back as a Script if needed.

import { useRef, useEffect, forwardRef, useImperativeHandle, useMemo, Suspense } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { PlayerSettings, CameraSettings } from '@/stores/editorStore';
import { touchInput, consumeJump } from '@/components/canvas/MobileGameControls';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { PlayerGltfModel } from './PlayerGltfModel';

interface DefaultPlayerProps {
  position?: [number, number, number];
  modelUrl?: string;
  playerSettings?: Partial<PlayerSettings>;
  cameraSettings?: Partial<CameraSettings>;
  cameraOffset?: [number, number, number];
  cameraLookOffset?: [number, number, number];
}

export const DefaultPlayer = forwardRef<THREE.Object3D, DefaultPlayerProps>(
  (
    {
      position = [0, 3, 0],
      modelUrl = '/models/manequin/scene.gltf',
      playerSettings,
      cameraSettings,
      cameraOffset: propCameraOffset,
      cameraLookOffset: propCameraLookOffset,
    },
    ref,
  ) => {
    const rigidBodyRef = useRef<RapierRigidBody | null>(null);
    const meshRef = useRef<THREE.Group>(null);
    const { camera } = useThree();
    const cameraTargetPos = useRef(new THREE.Vector3());

    // Camera offset based on mode (kept identical to the old player so
    // existing camera config dialed in by the user still feels right).
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
      const rb = rigidBodyRef.current;
      if (rb) {
        const pos = rb.translation();
        cameraCurrentPos.current.set(pos.x + cameraOffset[0], pos.y + cameraOffset[1], pos.z + cameraOffset[2]);
      }
    }, [cameraOffset]);

    useEffect(() => {
      if (cameraSettings?.fov && 'fov' in camera) {
        (camera as THREE.PerspectiveCamera).fov = cameraSettings.fov;
        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
      }
    }, [camera, cameraSettings?.fov]);

    // Core settings (same defaults the old player exposed)
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

    const movement = useRef({
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
    });

    const velocity = useRef(new THREE.Vector3());
    const isGrounded = useRef(true);
    const wasGrounded = useRef(true);
    const coyoteTimer = useRef(0);
    const jumpBufferTimer = useRef(0);
    const hasDoubleJumped = useRef(false);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') e.preventDefault();
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
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }, []);

    const setPlayerPosition = useRuntimeGameStore((state) => state.setPlayerPosition);

    useFrame((_, delta) => {
      const rb = rigidBodyRef.current;
      if (!rb) return;

      const pos = rb.translation();
      const vel = rb.linvel();
      setPlayerPosition(new THREE.Vector3(pos.x, pos.y, pos.z));

      wasGrounded.current = isGrounded.current;
      isGrounded.current = Math.abs(vel.y) < 0.1;
      if (wasGrounded.current && !isGrounded.current) {
        coyoteTimer.current = coyoteTime;
      }
      coyoteTimer.current -= delta;
      if (isGrounded.current && !wasGrounded.current) {
        hasDoubleJumped.current = false;
      }

      // Read input
      let moveX = 0;
      let moveZ = 0;
      if (touchInput.movement.x !== 0 || touchInput.movement.y !== 0) {
        moveX = touchInput.movement.x;
        moveZ = -touchInput.movement.y;
      } else {
        if (movement.current.forward) moveZ -= 1;
        if (movement.current.backward) moveZ += 1;
        if (movement.current.left) moveX -= 1;
        if (movement.current.right) moveX += 1;
      }
      if (movementMode === '2d-sidescroll') moveZ = 0;

      const moveLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (moveLength > 0) {
        moveX /= moveLength;
        moveZ /= moveLength;
      }

      const isSprintingNow = canSprint && movement.current.sprint && isGrounded.current && moveLength > 0;
      const currentSpeed = isSprintingNow ? sprintSpeed : speed;
      const controlMultiplier = isGrounded.current ? 1 : airControlMultiplier;

      velocity.current.set(moveX * currentSpeed * controlMultiplier, vel.y, moveZ * currentSpeed * controlMultiplier);

      const wantsToJump = movement.current.jump || consumeJump();
      if (wantsToJump) jumpBufferTimer.current = jumpBufferTime;
      jumpBufferTimer.current -= delta;
      const canCoyoteJump = coyoteTimer.current > 0 || isGrounded.current;
      if (jumpBufferTimer.current > 0 && canCoyoteJump) {
        velocity.current.y = jumpForce;
        jumpBufferTimer.current = 0;
        coyoteTimer.current = 0;
        hasDoubleJumped.current = false;
      } else if (wantsToJump && canDoubleJump && !hasDoubleJumped.current && !isGrounded.current && coyoteTimer.current <= 0) {
        velocity.current.y = doubleJumpForce;
        hasDoubleJumped.current = true;
      }

      rb.setLinvel({ x: velocity.current.x, y: velocity.current.y, z: velocity.current.z }, true);

      // Face movement direction
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
      cameraTargetPos.current.set(pos.x + cameraOffset[0], pos.y + cameraOffset[1], pos.z + cameraOffset[2]);
      cameraCurrentPos.current.lerp(cameraTargetPos.current, 0.08);
      camera.position.copy(cameraCurrentPos.current);
      camera.lookAt(
        new THREE.Vector3(pos.x + cameraLookOffset[0], pos.y + cameraLookOffset[1], pos.z + cameraLookOffset[2]),
      );
    });

    const fallback = (
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.3, 1.2, 4, 8]} />
        <meshStandardMaterial color="#8a8a8a" />
      </mesh>
    );

    return (
      <RigidBody ref={rigidBodyRef} position={position} colliders={false} lockRotations linearDamping={0.5} mass={1}>
        <CapsuleCollider args={[0.5, 0.3]} position={[0, 1, 0]} />
        <group ref={meshRef}>
          <Suspense fallback={fallback}>
            <PlayerGltfModel url={modelUrl} />
          </Suspense>
        </group>
      </RigidBody>
    );
  },
);

DefaultPlayer.displayName = 'DefaultPlayer';
