import React, { useCallback, useMemo, useRef, useState, useEffect, Suspense } from 'react';
import { ThreeEvent, useFrame, useLoader } from '@react-three/fiber';
import { Outlines, useGLTF } from '@react-three/drei';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { SceneObject, useEditorStore, BehaviorType, PhysicsBodyType, EntitySettings } from '@/stores/editorStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { scriptRegistry } from '@/scripts/registry';
import { AudioSource } from './AudioSource';
import { ParticleEmitter } from './ParticleEmitter';
import { useIsInstanced } from './AutoInstancer';
import { TransformGizmo, GizmoInteractionLock } from './TransformGizmo';
import { useTapIntent } from './hooks/useTapIntent';
import { 
  MinecraftCharacter,
  MinecraftTree,
  MinecraftHouse,
  MinecraftLampPost,
  MinecraftFence,
  MinecraftGround
} from './primitives/MinecraftCharacter';
import { 
  MinecraftVillager, 
  MinecraftGuard, 
  MinecraftMerchant, 
  MinecraftZombie, 
  MinecraftSkeleton,
  StaticMinecraftNPC 
} from './primitives/MinecraftNPCs';

interface EditableObjectProps {
  object: SceneObject;
  rigidBodies?: React.MutableRefObject<Map<string, RapierRigidBody>>;
  groups?: React.MutableRefObject<Map<string, THREE.Group>>;
}

// Prevent decorative meshes from intercepting clicks (raycasting)
const NO_RAYCAST = () => null;

const markObjectPickHandled = () => {
  if (typeof window === 'undefined') return;
  (window as typeof window & { __PIXL_EDITOR_LAST_OBJECT_PICK__?: number }).__PIXL_EDITOR_LAST_OBJECT_PICK__ = performance.now();
};

const getObjectSelectionRole = (object: SceneObject) => {
  const customData = object.logicSettings?.customData ?? {};
  const role = customData.editorSelectionRole ?? customData.selectionRole;
  return typeof role === 'string' ? role : 'default';
};

const isSurfaceLikeObject = (object: SceneObject) => (
  object.type === 'plane' ||
  object.type === 'platform' ||
  getObjectSelectionRole(object) === 'surface' ||
  getObjectSelectionRole(object) === 'background'
);

const gltfNodeIndexCache = new WeakMap<THREE.Object3D, Map<string, THREE.Object3D>>();

const getGltfNodeIndex = (scene: THREE.Object3D) => {
  const cached = gltfNodeIndexCache.get(scene);
  if (cached) return cached;

  const index = new Map<string, THREE.Object3D>();
  scene.traverse((child) => {
    if (child.name && !index.has(child.name)) {
      index.set(child.name, child);
    }
  });
  gltfNodeIndexCache.set(scene, index);
  return index;
};

// Behavior component that handles object animations
const ObjectBehavior = ({ 
  object, 
  groupRef,
  rigidBodyRef,
  bodyType
}: { 
  object: SceneObject; 
  groupRef: React.RefObject<THREE.Group>;
  rigidBodyRef?: React.RefObject<RapierRigidBody>;
  bodyType?: PhysicsBodyType;
}) => {
  const logic = object.logicSettings;
  const behavior = logic?.behavior || 'none';
  const speed = logic?.behaviorSpeed || 1;
  const patrolDistance = logic?.patrolDistance || 5;
  const initialPosition = useRef<THREE.Vector3 | null>(null);
  const time = useRef(0);
  const tempObject = useRef(new THREE.Object3D());
  const { objects, isEditMode } = useEditorStore();

  const getCurrentPosition = useCallback(() => {
    if (rigidBodyRef?.current) {
      const t = rigidBodyRef.current.translation();
      return new THREE.Vector3(t.x, t.y, t.z);
    }
    if (groupRef.current) {
      return groupRef.current.position.clone();
    }
    return null;
  }, [groupRef, rigidBodyRef]);

  const setPosition = useCallback((pos: THREE.Vector3) => {
    if (rigidBodyRef?.current) {
      if (bodyType === 'kinematic') {
        rigidBodyRef.current.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
        return;
      }
      if (bodyType !== 'fixed') {
        rigidBodyRef.current.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
        return;
      }
    }
    if (groupRef.current) {
      groupRef.current.position.copy(pos);
    }
  }, [groupRef, rigidBodyRef, bodyType]);

  const setRotationFromEuler = useCallback((euler: THREE.Euler) => {
    if (rigidBodyRef?.current) {
      const q = new THREE.Quaternion().setFromEuler(euler);
      if (bodyType === 'kinematic') {
        rigidBodyRef.current.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        return;
      }
      if (bodyType !== 'fixed') {
        rigidBodyRef.current.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        return;
      }
    }
    if (groupRef.current) {
      groupRef.current.rotation.copy(euler);
    }
  }, [groupRef, rigidBodyRef, bodyType]);

  const getCurrentEuler = useCallback(() => {
    if (rigidBodyRef?.current) {
      const r = rigidBodyRef.current.rotation();
      const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      return new THREE.Euler().setFromQuaternion(q);
    }
    if (groupRef.current) {
      return groupRef.current.rotation.clone();
    }
    return null;
  }, [groupRef, rigidBodyRef]);
  
  useFrame((state, delta) => {
    if (!groupRef.current || behavior === 'none') return;
    // In Edit Mode, behaviors (rotate/float/patrol/lookAtPlayer) must be disabled
    // so objects stay static and selectable.
    if (isEditMode) return;
    
    // Store initial position
    if (!initialPosition.current) {
      const pos = getCurrentPosition();
      if (pos) initialPosition.current = pos;
    }
    
    time.current += delta;
    
    switch (behavior) {
      case 'rotate': {
        const euler = getCurrentEuler();
        if (!euler) break;
        euler.y += delta * speed;
        setRotationFromEuler(euler);
        break;
      }
        
      case 'float': {
        if (!initialPosition.current) break;
        const floatOffset = Math.sin(time.current * speed * 2) * 0.5;
        const newPos = initialPosition.current.clone();
        newPos.y += floatOffset;
        setPosition(newPos);
        break;
      }
        
      case 'patrol': {
        if (!initialPosition.current) break;
        const patrolOffset = Math.sin(time.current * speed) * patrolDistance;
        const newPos = initialPosition.current.clone();
        newPos.x += patrolOffset;
        setPosition(newPos);
        break;
      }
        
      case 'lookAtPlayer': {
        const player = objects.find(o => o.type === 'player');
        const currentPos = getCurrentPosition();
        if (player && currentPos) {
          const playerPos = new THREE.Vector3(...player.position);
          const obj = tempObject.current;
          obj.position.copy(currentPos);
          obj.lookAt(playerPos);
          setRotationFromEuler(obj.rotation.clone());
        }
        break;
      }
    }
  });
  
  return null;
};

// ===============================================
// Entity AI Behavior Component
// Handles chase, flee, guard, follow behaviors from EntitySettings
// ===============================================
const EntityAIBehavior = ({
  object,
  groupRef,
  rigidBodyRef,
  bodyType
}: {
  object: SceneObject;
  groupRef: React.RefObject<THREE.Group>;
  rigidBodyRef?: React.RefObject<RapierRigidBody>;
  bodyType?: PhysicsBodyType;
}) => {
  const entity = object.entitySettings;
  const { objects, isEditMode } = useEditorStore();
  // Get real-time player position from runtime store
  const playerPosition = useRuntimeGameStore(state => state.playerPosition);
  
  // Don't run if AI is not enabled
  if (!entity?.aiEnabled || entity.aiType === 'none') return null;
  
  const aiType = entity.aiType;
  const aiSpeed = entity.aiSpeed || 3;
  const detectionRange = entity.aiDetectionRange || 10;
  const attackRange = entity.aiAttackRange || 2;
  const patrolDistance = object.logicSettings?.patrolDistance || 5;
  
  const initialPosition = useRef<THREE.Vector3 | null>(null);
  const patrolDirection = useRef(1);
  const lastAttackTime = useRef(0);
  const tempObject = useRef(new THREE.Object3D());
  
  const getCurrentPosition = useCallback(() => {
    if (rigidBodyRef?.current) {
      try {
        const t = rigidBodyRef.current.translation();
        return new THREE.Vector3(t.x, t.y, t.z);
      } catch { return null; }
    }
    if (groupRef.current) {
      return groupRef.current.position.clone();
    }
    return null;
  }, [groupRef, rigidBodyRef]);

  const setPosition = useCallback((pos: THREE.Vector3) => {
    if (rigidBodyRef?.current) {
      try {
        if (bodyType === 'kinematic') {
          rigidBodyRef.current.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
          return;
        }
        if (bodyType !== 'fixed') {
          rigidBodyRef.current.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
          return;
        }
      } catch { /* RigidBody may be freed */ }
    }
    if (groupRef.current) {
      groupRef.current.position.copy(pos);
    }
  }, [groupRef, rigidBodyRef, bodyType]);

  const setRotationFromEuler = useCallback((euler: THREE.Euler) => {
    if (rigidBodyRef?.current) {
      try {
        const q = new THREE.Quaternion().setFromEuler(euler);
        if (bodyType === 'kinematic') {
          rigidBodyRef.current.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
          return;
        }
        if (bodyType !== 'fixed') {
          rigidBodyRef.current.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
          return;
        }
      } catch { /* RigidBody may be freed */ }
    }
    if (groupRef.current) {
      groupRef.current.rotation.copy(euler);
    }
  }, [groupRef, rigidBodyRef, bodyType]);
  
  // Find nearest ally to follow
  const getNearestAlly = useCallback((myPos: THREE.Vector3): THREE.Vector3 | null => {
    const allies = objects.filter(o => 
      o.entitySettings?.team === entity?.team && 
      o.id !== object.id
    );
    
    let nearest: THREE.Vector3 | null = null;
    let nearestDist = Infinity;
    
    allies.forEach(ally => {
      const allyPos = new THREE.Vector3(...ally.position);
      const dist = myPos.distanceTo(allyPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = allyPos;
      }
    });
    
    return nearest;
  }, [objects, entity?.team, object.id]);
  
  useFrame((state, delta) => {
    // Freeze entity AI (patrol/chase/etc.) in Edit Mode for stable editing/selection.
    if (isEditMode) return;
    const currentPos = getCurrentPosition();
    if (!currentPos) return;
    
    // Store initial position for patrol
    if (!initialPosition.current) {
      initialPosition.current = currentPos.clone();
    }
    
    // Use real-time player position from runtime store
    const playerPos = playerPosition.lengthSq() > 0 ? playerPosition : null;
    const distanceToPlayer = playerPos ? currentPos.distanceTo(playerPos) : Infinity;
    
    switch (aiType) {
      case 'patrol': {
        // Simple back and forth patrol on X axis
        const targetX = initialPosition.current.x + (patrolDirection.current * patrolDistance);
        const distToTarget = Math.abs(currentPos.x - targetX);
        
        if (distToTarget < 0.5) {
          // Reverse direction
          patrolDirection.current *= -1;
        }
        
        // Move towards target
        const moveDir = patrolDirection.current;
        const newPos = currentPos.clone();
        newPos.x += moveDir * aiSpeed * delta;
        setPosition(newPos);
        
        // Face movement direction
        const angle = moveDir > 0 ? -Math.PI / 2 : Math.PI / 2;
        setRotationFromEuler(new THREE.Euler(0, angle, 0));
        break;
      }
      
      case 'chase': {
        // Chase player if in detection range
        if (playerPos && distanceToPlayer < detectionRange && distanceToPlayer > attackRange) {
          // Move towards player
          const direction = new THREE.Vector3().subVectors(playerPos, currentPos).normalize();
          const newPos = currentPos.clone();
          newPos.x += direction.x * aiSpeed * delta;
          newPos.z += direction.z * aiSpeed * delta;
          setPosition(newPos);
          
          // Face player
          tempObject.current.position.copy(currentPos);
          tempObject.current.lookAt(playerPos);
          setRotationFromEuler(tempObject.current.rotation.clone());
        } else if (distanceToPlayer >= detectionRange) {
          // Return to patrol behavior when player is out of range
          const targetX = initialPosition.current.x + (patrolDirection.current * patrolDistance);
          const distToTarget = Math.abs(currentPos.x - targetX);
          
          if (distToTarget < 0.5) {
            patrolDirection.current *= -1;
          }
          
          const moveDir = patrolDirection.current;
          const newPos = currentPos.clone();
          newPos.x += moveDir * aiSpeed * 0.5 * delta; // Slower patrol
          setPosition(newPos);
        }
        break;
      }
      
      case 'flee': {
        // Flee from player if in detection range
        if (playerPos && distanceToPlayer < detectionRange) {
          // Move away from player
          const direction = new THREE.Vector3().subVectors(currentPos, playerPos).normalize();
          const newPos = currentPos.clone();
          newPos.x += direction.x * aiSpeed * delta;
          newPos.z += direction.z * aiSpeed * delta;
          setPosition(newPos);
          
          // Face away from player
          tempObject.current.position.copy(currentPos);
          const awayPoint = currentPos.clone().add(direction);
          tempObject.current.lookAt(awayPoint);
          setRotationFromEuler(tempObject.current.rotation.clone());
        }
        break;
      }
      
      case 'guard': {
        // Guard position - stay near initial position but face player if nearby
        const distFromHome = currentPos.distanceTo(initialPosition.current);
        
        if (playerPos && distanceToPlayer < detectionRange && distanceToPlayer > attackRange) {
          // Move towards player but stay within patrol distance from home
          if (distFromHome < patrolDistance) {
            const direction = new THREE.Vector3().subVectors(playerPos, currentPos).normalize();
            const newPos = currentPos.clone();
            newPos.x += direction.x * aiSpeed * delta;
            newPos.z += direction.z * aiSpeed * delta;
            setPosition(newPos);
          }
          
          // Always face player when guarding
          tempObject.current.position.copy(currentPos);
          tempObject.current.lookAt(playerPos);
          setRotationFromEuler(tempObject.current.rotation.clone());
        } else if (distFromHome > 0.5) {
          // Return to guard position
          const direction = new THREE.Vector3().subVectors(initialPosition.current, currentPos).normalize();
          const newPos = currentPos.clone();
          newPos.x += direction.x * aiSpeed * 0.5 * delta;
          newPos.z += direction.z * aiSpeed * 0.5 * delta;
          setPosition(newPos);
        }
        break;
      }
      
      case 'follow': {
        // Follow nearest ally or player
        let targetPos = getNearestAlly(currentPos);
        if (!targetPos && playerPos) {
          targetPos = playerPos;
        }
        
        if (targetPos) {
          const distToTarget = currentPos.distanceTo(targetPos);
          
          // Keep some distance from target
          if (distToTarget > 3) {
            const direction = new THREE.Vector3().subVectors(targetPos, currentPos).normalize();
            const newPos = currentPos.clone();
            newPos.x += direction.x * aiSpeed * delta;
            newPos.z += direction.z * aiSpeed * delta;
            setPosition(newPos);
          }
          
          // Face target
          tempObject.current.position.copy(currentPos);
          tempObject.current.lookAt(targetPos);
          setRotationFromEuler(tempObject.current.rotation.clone());
        }
        break;
      }
    }
  });
  
  return null;
};

// Volumetric cone shader for spotlight beam effect
const volumetricConeVertexShader = `
  varying vec2 vUv;
  varying float vY;
  void main() {
    vUv = uv;
    vY = position.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const volumetricConeFragmentShader = `
  uniform vec3 color;
  uniform float opacity;
  uniform float coneHeight;
  varying vec2 vUv;
  varying float vY;
  
  void main() {
    // Distance from center (0 at center, 1 at edge)
    float distFromCenter = length(vUv - vec2(0.5)) * 2.0;
    
    // Fade from top (bright) to bottom (transparent)
    float verticalFade = 1.0 - (vY / coneHeight + 0.5);
    verticalFade = pow(verticalFade, 1.5);
    
    // Radial fade (brighter at center)
    float radialFade = 1.0 - pow(distFromCenter, 0.8);
    
    // Combine fades
    float alpha = opacity * verticalFade * radialFade * 0.6;
    
    // Soft edge falloff
    alpha *= smoothstep(1.0, 0.7, distFromCenter);
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// SpotLight component with proper target configuration and volumetric beam
const SpotLightObject = ({
  object,
  isEditMode,
  isSelected,
  tapSelect,
  spotSettings,
}: {
  object: SceneObject;
  isEditMode: boolean;
  isSelected: boolean;
  tapSelect: any;
  spotSettings: SceneObject['lightSettings'];
}) => {
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  
  const distance = spotSettings?.distance ?? 10;
  const angle = spotSettings?.angle ?? Math.PI / 6;
  const intensity = spotSettings?.intensity ?? 2;
  const volumetric = spotSettings?.volumetric ?? true;
  const volumetricIntensity = spotSettings?.volumetricIntensity ?? 0.5;
  
  // Calculate cone dimensions
  const coneRadius = Math.tan(angle) * distance;
  const coneHeight = distance;
  
  // Create volumetric material
  const volumetricMaterial = useMemo(() => {
    const color = new THREE.Color(object.color);
    return new THREE.ShaderMaterial({
      vertexShader: volumetricConeVertexShader,
      fragmentShader: volumetricConeFragmentShader,
      uniforms: {
        color: { value: color },
        opacity: { value: volumetricIntensity },
        coneHeight: { value: coneHeight },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, [object.color, volumetricIntensity, coneHeight]);
  
  // Update material uniforms when settings change
  useEffect(() => {
    if (volumetricMaterial) {
      volumetricMaterial.uniforms.color.value = new THREE.Color(object.color);
      volumetricMaterial.uniforms.opacity.value = volumetricIntensity;
      volumetricMaterial.uniforms.coneHeight.value = coneHeight;
    }
  }, [object.color, volumetricIntensity, coneHeight, volumetricMaterial]);
  
  // Configure spotlight target on mount and when settings change
  useEffect(() => {
    if (spotLightRef.current && targetRef.current) {
      spotLightRef.current.target = targetRef.current;
    }
  }, []);
  
  return (
    <group>
      {/* Target object positioned below the spotlight */}
      <object3D ref={targetRef} position={[0, -distance, 0]} />
      
      {/* Light source visual (edit mode) */}
      {isEditMode && (
        <mesh
          onPointerDown={tapSelect.onPointerDown as any}
          onPointerMove={tapSelect.onPointerMove as any}
          onPointerUp={tapSelect.onPointerUp as any}
          rotation={[Math.PI, 0, 0]}
        >
          <coneGeometry args={[0.3, 0.6, 16]} />
          <meshStandardMaterial 
            color={object.color} 
            emissive={object.color} 
            emissiveIntensity={1.5}
            metalness={0.8}
            roughness={0.2}
          />
          {isSelected && <Outlines thickness={3} color="#ff8c00" />}
        </mesh>
      )}
      
      {/* Volumetric light beam cone */}
      {volumetric && intensity > 0 && (
        <mesh 
          rotation={[Math.PI, 0, 0]} 
          position={[0, -coneHeight / 2, 0]}
          raycast={NO_RAYCAST}
        >
          <coneGeometry args={[coneRadius, coneHeight, 32, 1, true]} />
          <primitive object={volumetricMaterial} attach="material" />
        </mesh>
      )}
      
      {/* Wireframe cone helper (edit mode only) */}
      {isEditMode && (
        <mesh rotation={[Math.PI, 0, 0]} position={[0, -coneHeight / 2, 0]} raycast={NO_RAYCAST}>
          <coneGeometry args={[coneRadius, coneHeight, 16, 1, true]} />
          <meshBasicMaterial 
            color={object.color} 
            transparent 
            opacity={0.1} 
            side={THREE.DoubleSide}
            wireframe
          />
        </mesh>
      )}
      
      {/* Actual spotlight with proper target */}
      <spotLight
        ref={spotLightRef}
        color={object.color}
        intensity={intensity}
        distance={distance}
        angle={angle}
        penumbra={spotSettings?.penumbra ?? 0.5}
        decay={spotSettings?.decay ?? 2}
        castShadow={spotSettings?.castShadow ?? true}
        shadow-mapSize-width={spotSettings?.shadowMapSize ?? 1024}
        shadow-mapSize-height={spotSettings?.shadowMapSize ?? 1024}
        shadow-bias={spotSettings?.shadowBias ?? -0.0001}
        shadow-normalBias={spotSettings?.shadowNormalBias ?? 0.02}
      />
    </group>
  );
};

// Textured material component (loads texture via useLoader)
const TexturedMaterialInner = ({
  textureUrl,
  color,
  visual,
  hasEmissive,
  isLight,
  extraProps,
  scale,
  textureFilter,
}: { 
  textureUrl: string;
  color: string;
  visual: SceneObject['visualSettings'];
  hasEmissive?: boolean;
  isLight?: boolean;
  extraProps?: Partial<THREE.MeshStandardMaterialParameters>;
  scale: [number, number, number];
  textureFilter: 'nearest' | 'bilinear' | 'trilinear';
}) => {
  const texture = useLoader(THREE.TextureLoader, textureUrl);
  
  // Apply filters dynamically when textureFilter changes (for real-time updates)
  useEffect(() => {
    if (!texture) return;

    const filter = textureFilter;
    switch (filter) {
      case 'nearest':
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestMipMapNearestFilter;
        texture.generateMipmaps = true;
        break;
      case 'bilinear':
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipMapNearestFilter;
        texture.generateMipmaps = true;
        break;
      case 'trilinear':
      default:
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipMapLinearFilter;
        texture.generateMipmaps = true;
        break;
    }

    texture.anisotropy = Math.min(8, texture.anisotropy || 1 * 4);
    texture.needsUpdate = true;
  }, [texture, textureFilter]);
  
  useEffect(() => {
    if (texture) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;

      const baseRepeat = visual?.textureRepeat || [1, 1];
      const offset = visual?.textureOffset || [0, 0];

      let effectiveRepeat: [number, number] = [...baseRepeat];
      if (visual?.textureAutoScale !== false) {
        const sx = Math.abs(scale[0] || 1);
        const sy = Math.abs(scale[1] || 1);
        const sz = Math.abs(scale[2] || 1);
        // Prefer X/Z for surfaces; fallback to X/Y if Z is tiny
        const u = sx;
        const v = Math.max(sz, sy);
        effectiveRepeat = [baseRepeat[0] * u, baseRepeat[1] * v];
      }

      texture.repeat.set(effectiveRepeat[0], effectiveRepeat[1]);
      texture.offset.set(offset[0], offset[1]);
      texture.rotation = visual?.textureRotation || 0;
      texture.flipY = visual?.textureFlipY ?? false;
      texture.needsUpdate = true;
    }
  }, [texture, visual, scale]);
  
  const materialProps = useMemo(() => {
    const props: any = {
      color: '#ffffff', // White to show true texture colors
      map: texture,
      transparent: (visual?.opacity ?? 1) < 1,
      opacity: visual?.opacity ?? 1,
      metalness: visual?.metalness ?? 0.3,
      roughness: visual?.roughness ?? 0.5,
      wireframe: visual?.wireframe ?? false,
      key: `mat-${textureFilter}`, // Force remount on filter change
    };
    
    if (hasEmissive || isLight || (visual?.emissiveIntensity ?? 0) > 0) {
      props.emissive = color;
      props.emissiveIntensity = visual?.emissiveIntensity ?? (isLight ? 2 : hasEmissive ? 0.3 : 0);
    }

    return { ...props, ...extraProps };
  }, [texture, color, visual, hasEmissive, isLight, extraProps, textureFilter]);
  
  return <meshStandardMaterial {...materialProps} />;
};

// Fallback material without texture
const FallbackMaterial = ({ 
  color,
  visual,
  hasEmissive,
  isLight,
  extraProps,
}: { 
  color: string;
  visual: SceneObject['visualSettings'];
  hasEmissive?: boolean;
  isLight?: boolean;
  extraProps?: Partial<THREE.MeshStandardMaterialParameters>;
}) => {
  const materialProps = useMemo(() => {
    const props: any = {
      color,
      transparent: (visual?.opacity ?? 1) < 1,
      opacity: visual?.opacity ?? 1,
      metalness: visual?.metalness ?? 0.3,
      roughness: visual?.roughness ?? 0.5,
      wireframe: visual?.wireframe ?? false,
    };
    
    if (hasEmissive || isLight || (visual?.emissiveIntensity ?? 0) > 0) {
      props.emissive = color;
      props.emissiveIntensity = visual?.emissiveIntensity ?? (isLight ? 2 : hasEmissive ? 0.3 : 0);
    }

    return { ...props, ...extraProps };
  }, [color, visual, hasEmissive, isLight, extraProps]);
  
  return <meshStandardMaterial {...materialProps} />;
};

// Material component that applies visual settings with texture support
const ObjectMaterial = ({ 
  object, 
  isSelected,
  isLight,
  hasEmissive,
  extraProps,
  scale
}: { 
  object: SceneObject;
  isSelected?: boolean;
  isLight?: boolean;
  hasEmissive?: boolean;
  extraProps?: Partial<THREE.MeshStandardMaterialParameters>;
  scale: [number, number, number];
}) => {
  const visual = object.visualSettings;
  const color = object.color;
  const textureUrl = visual?.textureUrl;
  const { textureFilterDefault } = useEngineSettings();
  const resolvedFilter = (visual?.textureFilter ?? textureFilterDefault ?? 'trilinear') as 'nearest' | 'bilinear' | 'trilinear';
  
  // No texture - use simple material
  if (!textureUrl) {
    return (
      <FallbackMaterial 
        color={color} 
        visual={visual} 
        hasEmissive={hasEmissive} 
        isLight={isLight} 
        extraProps={extraProps}
      />
    );
  }
  
  // With texture - wrap in Suspense for async loading
  return (
    <Suspense fallback={
      <FallbackMaterial 
        color={color} 
        visual={visual} 
        hasEmissive={hasEmissive} 
        isLight={isLight} 
        extraProps={extraProps}
      />
    }>
      <TexturedMaterialInner
        textureUrl={textureUrl}
        color={color}
        visual={visual}
        hasEmissive={hasEmissive}
        isLight={isLight}
        extraProps={extraProps}
        scale={scale}
        textureFilter={resolvedFilter}
      />
    </Suspense>
  );
};

// Component that loads and renders a GLTF/GLB model as replacement for placeholder geometry
// This allows swapping placeholders with final 3D assets while keeping all physics/combat mechanics
const GLTFModelLoader = ({
  url,
  nodeName,
  nodeIndex,
  entitySettings,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  isSelected,
  castShadow,
  receiveShadow,
}: {
  url: string;
  nodeName?: string;
  nodeIndex?: number;
  entitySettings?: EntitySettings;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void;
  isSelected?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) => {
  const { scene } = useGLTF(url);
  const sourceObject = useMemo(() => {
    if (!nodeName && nodeIndex === undefined) return scene;

    const byName = nodeName ? getGltfNodeIndex(scene).get(nodeName) : null;
    if (byName) return byName;

    if (nodeIndex !== undefined) {
      let found: THREE.Object3D | null = null;
      let currentIndex = 0;
      scene.traverse((child) => {
        if (found || !(child instanceof THREE.Mesh)) return;
        if (currentIndex === nodeIndex) found = child;
        currentIndex += 1;
      });
      if (found) return found;
    }

    return scene;
  }, [scene, nodeName, nodeIndex]);

  const clonedScene = useMemo(() => {
    const clone = sourceObject.clone(true);
    if (sourceObject !== scene) {
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      clone.quaternion.identity();
      clone.scale.set(1, 1, 1);
    }
    return clone;
  }, [scene, sourceObject]);
  
  // Apply shadows and entity settings to all meshes
  useEffect(() => {
    if (clonedScene) {
      clonedScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = castShadow ?? true;
          child.receiveShadow = receiveShadow ?? true;
        }
      });
    }
  }, [clonedScene, castShadow, receiveShadow]);
  
  // Apply entity model offsets
  const modelScale = entitySettings?.modelScale ?? 1;
  const modelOffset = entitySettings?.modelOffset ?? [0, 0, 0];
  const modelRotation = entitySettings?.modelRotationOffset ?? [0, 0, 0];
  
  return (
    <group
      onPointerDown={onPointerDown as any}
      onPointerMove={onPointerMove as any}
      onPointerUp={onPointerUp as any}
      position={modelOffset as any}
      rotation={modelRotation as any}
      scale={modelScale}
    >
      <primitive object={clonedScene} />
      {isSelected && <Outlines thickness={3} color="#ff8c00" />}
    </group>
  );
};

// Wrapper for GLTF model with Suspense fallback (shows placeholder while loading)
const GLTFModelWithFallback = ({
  url,
  nodeName,
  nodeIndex,
  entitySettings,
  fallbackGeometry,
  color,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  isSelected,
  castShadow,
  receiveShadow,
}: {
  url: string;
  nodeName?: string;
  nodeIndex?: number;
  entitySettings?: EntitySettings;
  fallbackGeometry: React.ReactNode;
  color: string;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void;
  isSelected?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) => {
  return (
    <Suspense fallback={fallbackGeometry}>
      <GLTFModelLoader
        url={url}
        nodeName={nodeName}
        nodeIndex={nodeIndex}
        entitySettings={entitySettings}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        isSelected={isSelected}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
      />
    </Suspense>
  );
};

export const EditableObject = ({ object, rigidBodies, groups }: EditableObjectProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const [refReady, setRefReady] = useState(false);
  const selectIsSelected = useCallback((state: ReturnType<typeof useEditorStore.getState>) => (
    state.isEditMode && state.selectedObjectId === object.id
  ), [object.id]);
  const selectTransformMode = useCallback((state: ReturnType<typeof useEditorStore.getState>) => (
    state.selectedObjectId === object.id ? state.transformMode : 'select'
  ), [object.id]);
  const selectTransformSpace = useCallback((state: ReturnType<typeof useEditorStore.getState>) => (
    state.selectedObjectId === object.id ? state.transformSpace : 'world'
  ), [object.id]);
  const isEditMode = useEditorStore((state) => state.isEditMode);
  const isSelected = useEditorStore(selectIsSelected);
  const transformMode = useEditorStore(selectTransformMode);
  const transformSpace = useEditorStore(selectTransformSpace);
  const selectObject = useEditorStore((state) => state.selectObject);
  const updateObject = useEditorStore((state) => state.updateObject);
  const saveToHistory = useEditorStore((state) => state.saveToHistory);

  const isInstanced = useIsInstanced(object.id);
  const hideVisualInPlay = !isEditMode && isInstanced;
  const visual = object.visualSettings;
  const physics = object.physicsSettings;
  const logic = object.logicSettings;
  const hasExternalModel = Boolean(object.animationSettings?.modelUrl);
  const renderOnly = Boolean(logic?.customData?.renderOnly);
  const hasBehavior = Boolean(logic?.behavior && logic.behavior !== 'none');
  const useScreenSpacePicking = isEditMode && Boolean(logic?.customData?.editableGlbPart) && !isSelected;

  const isStatic = object.isStatic || object.type === 'plane' || object.type === 'platform' || physics?.bodyType === 'fixed';
  const isLight = object.type === 'light' || object.type === 'sunlight' || object.type === 'spotlight';
  const isRing = object.type === 'ring';
  const hasEmissive = object.emissive || isLight || isRing || (visual?.emissiveIntensity ?? 0) > 0;

  // Track if transform is in progress to prevent deselection
  const isTransforming = useRef(false);

  // Clean selection handler - blocks clicks when gizmo is active
  // Handle selection - works with both pointer and click events for touch compatibility
  const handleSelect = useCallback(
    (e: ThreeEvent<PointerEvent | MouseEvent>) => {
      // Check gizmo state FIRST - before any other logic
      // This uses the real-time axis check to detect if pointer is over gizmo handles
      const gizmoActive = GizmoInteractionLock.isActive();
      
      // Also do a raycast check against gizmo picker meshes
      // This catches cases where the pointer is over a gizmo handle but axis isn't set yet
      let gizmoRaycastHit = false;
      if (!gizmoActive && e.pointer) {
        gizmoRaycastHit = GizmoInteractionLock.raycastGizmo(e.pointer);
      }
      
      if (!isEditMode || object.locked) {
        return;
      }

      // Block selection if gizmo is actively being used (hovering axis, dragging, locked, or raycast hit)
      if (gizmoActive || gizmoRaycastHit) {
        e.stopPropagation();
        return;
      }
      
      // If clicking on already selected object, do nothing (keep selection)
      if (isSelected) {
        markObjectPickHandled();
        e.stopPropagation();
        return;
      }
      
      const isSurfaceType = isSurfaceLikeObject(object);
      
      // For regular objects: always select immediately
      if (!isSurfaceType) {
        markObjectPickHandled();
        e.stopPropagation();
        selectObject(object.id);
        return;
      }
      
      // For broad surfaces: only select if no regular object also hit
      if (e.intersections && e.intersections.length > 0) {
        for (const intersection of e.intersections) {
          let current: THREE.Object3D | null = intersection.object;
          while (current) {
            const objId = current.userData?.objectId;
            const objType = current.userData?.objectType;
            const objSelectionRole = current.userData?.objectSelectionRole;
            const isSurfaceHit = (
              objType === 'plane' ||
              objType === 'platform' ||
              objSelectionRole === 'surface' ||
              objSelectionRole === 'background'
            );
            
            if (
              objId &&
              objId !== object.id &&
              objType &&
              !isSurfaceHit
            ) {
              return; // Regular object exists - let it handle selection
            }
            current = current.parent;
          }
        }
      }
      
      // Surface is the only thing hit - select it
      markObjectPickHandled();
      e.stopPropagation();
      selectObject(object.id);
    },
    [isEditMode, object.locked, object.id, object.type, object.name, selectObject, isSelected]
  );

  // Select on TAP (pointerup with minimal movement), not on pointerdown.
  // This prevents accidental selection of ground/objects behind the gizmo while starting a drag.
  const tapSelect = useTapIntent({ onTap: handleSelect, delayMs: 60 });
  const pointerSelectHandlers = useScreenSpacePicking ? {} : {
    onPointerDown: tapSelect.onPointerDown as any,
    onPointerMove: tapSelect.onPointerMove as any,
    onPointerUp: tapSelect.onPointerUp as any,
  };

  const handleTransformStart = useCallback(() => {
    isTransforming.current = true;
    GizmoInteractionLock.startDrag();
  }, []);

  const handleTransformEnd = useCallback(() => {
    isTransforming.current = false;
    GizmoInteractionLock.endDrag();
    // Safety: if TransformControls misses a "dragging-changed" false (pointercancel, lost capture, etc.)
    // we still must unlock, otherwise selection/camera can look "frozen".
    GizmoInteractionLock.unlock();
    // Commit transform to store
    const g = groupRef.current;
    if (!g) return;
    
    // Handle special case for plane - map the visual scale back to object scale
    let finalScale: [number, number, number];
    if (object.type === 'plane') {
      // Plane uses [scaleX, scaleZ, 1] visually but stores [scaleX, 1, scaleZ]
      // Ensure minimum scale and prevent deformation
      const scaleX = Math.max(0.1, g.scale.x);
      const scaleZ = Math.max(0.1, g.scale.y); // Visual Y maps to Z
      finalScale = [scaleX, 1, scaleZ];
    } else {
      finalScale = [g.scale.x, g.scale.y, g.scale.z];
    }
    
    // For planes, don't update rotation (keep it fixed at -90 on X)
    const finalRotation: [number, number, number] = object.type === 'plane' 
      ? object.rotation 
      : [g.rotation.x, g.rotation.y, g.rotation.z];
    
    updateObject(object.id, {
      position: [g.position.x, g.position.y, g.position.z],
      rotation: finalRotation,
      scale: finalScale,
    });
    saveToHistory();
  }, [object.id, object.type, object.rotation, updateObject, saveToHistory]);

  const handleTransformChange = useCallback((position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3) => {
    // Live update preview - no need to save here, will save on end
  }, []);

  const rotation = useMemo<[number, number, number]>(() => {
    if (object.type === 'plane') return [-Math.PI / 2, 0, 0];
    return object.rotation;
  }, [object.rotation, object.type]);

  const scale = useMemo<[number, number, number]>(() => {
    switch (object.type) {
      case 'plane':
        return [object.scale[0], object.scale[2], 1];
      case 'sphere':
        return [object.scale[0], object.scale[0], object.scale[0]];
      case 'cylinder':
        return [object.scale[0], object.scale[1], object.scale[0]];
      case 'ring':
        return [object.scale[0], object.scale[0], object.scale[0]];
      default:
        return object.scale;
    }
  }, [object.scale, object.type]);

  // Get shadow settings
  const castShadow = visual?.castShadow ?? (object.type !== 'plane' && object.type !== 'light');
  const receiveShadow = visual?.receiveShadow ?? (object.type === 'plane' || object.type === 'platform');
  
  // Check if object has a 3D model to replace placeholder
  const hasCustomModel = !!object.animationSettings?.modelUrl;
  const modelUrl = object.animationSettings?.modelUrl;
  const entitySettings = object.entitySettings;

  const renderVisual = () => {
    // If object has a custom 3D model, use it instead of placeholder geometry
    // This allows swapping placeholders with final assets while keeping all mechanics
    if (hasCustomModel && modelUrl) {
      const fallbackGeometry = (
        <mesh
          {...pointerSelectHandlers}
          receiveShadow={receiveShadow}
          castShadow={castShadow}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={object.color} wireframe opacity={0.5} transparent />
          {isSelected && <Outlines thickness={3} color="#ff8c00" />}
        </mesh>
      );
      
      return (
        <GLTFModelWithFallback
          url={modelUrl}
          nodeName={object.animationSettings?.nodeName}
          nodeIndex={object.animationSettings?.nodeIndex}
          entitySettings={entitySettings}
          fallbackGeometry={fallbackGeometry}
          color={object.color}
          onPointerDown={useScreenSpacePicking ? undefined : tapSelect.onPointerDown as any}
          onPointerMove={useScreenSpacePicking ? undefined : tapSelect.onPointerMove as any}
          onPointerUp={useScreenSpacePicking ? undefined : tapSelect.onPointerUp as any}
          isSelected={isSelected}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        />
      );
    }
    
    switch (object.type) {
      case 'player':
        return (
          <group
            {...pointerSelectHandlers}
          >
            {/* Selection indicator */}
            {isSelected && (
              <mesh position={[0, 1, 0]}>
                <boxGeometry args={[1.2, 2.4, 1.2]} />
                <meshBasicMaterial color="#ff8c00" transparent opacity={0.2} wireframe />
              </mesh>
            )}
            {/* Minecraft-style player */}
            <MinecraftCharacter 
              skinColors={{
                skin: '#c4a574',
                hair: '#3d2314',
                shirt: '#00aaaa',
                pants: '#1a1a7a',
                shoes: '#4a4a4a',
              }}
              animate={true}
              animationSpeed={0.5}
            />
            {/* Ground indicator ring */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
              <ringGeometry args={[0.6, 0.8, 32]} />
              <meshStandardMaterial 
                color="#6366f1" 
                emissive="#6366f1" 
                emissiveIntensity={0.5}
                side={THREE.DoubleSide}
                transparent
                opacity={0.7}
              />
            </mesh>
          </group>
        );

      case 'camera':
        return (
          <group>
            <mesh
              {...pointerSelectHandlers}
            >
              <boxGeometry args={[0.8, 0.5, 0.5]} />
              <meshStandardMaterial color={object.color} emissive={object.color} emissiveIntensity={0.3} />
              {isSelected && <Outlines thickness={3} color="#ff8c00" />}
            </mesh>
            <mesh position={[0, 0, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.15, 0.2, 0.2, 16]} />
              <meshStandardMaterial color="#1a1a2e" />
            </mesh>
            {isEditMode && (
              <group>
                <lineSegments>
                  <bufferGeometry>
                    <bufferAttribute
                      attach="attributes-position"
                      count={8}
                      array={new Float32Array([
                        0, 0, 0.3, -2, -1.5, 5,
                        0, 0, 0.3, 2, -1.5, 5,
                        0, 0, 0.3, -2, 1.5, 5,
                        0, 0, 0.3, 2, 1.5, 5,
                      ])}
                      itemSize={3}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial color={object.color} opacity={0.5} transparent />
                </lineSegments>
              </group>
            )}
          </group>
        );

      case 'plane':
        return (
          <mesh
            {...pointerSelectHandlers}
            receiveShadow={receiveShadow}
          >
            <planeGeometry args={[1, 1]} />
            <ObjectMaterial
              object={object}
              isSelected={isSelected}
              hasEmissive={hasEmissive}
              isLight={isLight}
              scale={scale as any}
              extraProps={{
                side: THREE.DoubleSide,
                // Reduce z-fighting with the editor grid (grid sits on the same plane)
                polygonOffset: true,
                polygonOffsetFactor: 2,
                polygonOffsetUnits: 2,
              }}
            />
            {isSelected && <Outlines thickness={3} color="#ff8c00" />}
          </mesh>
        );

      case 'platform':
        return (
          <group>
            <mesh
              onPointerDown={tapSelect.onPointerDown as any}
              onPointerMove={tapSelect.onPointerMove as any}
              onPointerUp={tapSelect.onPointerUp as any}
              receiveShadow={receiveShadow}
              castShadow={castShadow}
            >
              <boxGeometry args={[1, 1, 1]} />
              <ObjectMaterial
                object={object}
                isSelected={isSelected}
                hasEmissive={hasEmissive}
                isLight={isLight}
                scale={object.scale as any}
              />
              {isSelected && <Outlines thickness={3} color="#ff8c00" />}
            </mesh>
            <mesh
              raycast={NO_RAYCAST}
              position={[0, 0.5 + 0.01, 0]}
              scale={[1.05, 0.02, 1.05] as any}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.5} />
            </mesh>
          </group>
        );

      case 'sphere':
        return (
          <mesh
            onPointerDown={tapSelect.onPointerDown as any}
            onPointerMove={tapSelect.onPointerMove as any}
            onPointerUp={tapSelect.onPointerUp as any}
            receiveShadow={receiveShadow}
            castShadow={castShadow}
          >
            <sphereGeometry args={[0.5, 32, 32]} />
            <ObjectMaterial
              object={object}
              isSelected={isSelected}
              hasEmissive={hasEmissive}
              isLight={isLight}
              scale={object.scale as any}
            />
            {isSelected && <Outlines thickness={3} color="#ff8c00" />}
          </mesh>
        );

      case 'box':
        return (
          <mesh
            onPointerDown={tapSelect.onPointerDown as any}
            onPointerMove={tapSelect.onPointerMove as any}
            onPointerUp={tapSelect.onPointerUp as any}
            receiveShadow={receiveShadow}
            castShadow={castShadow}
          >
            <boxGeometry args={[1, 1, 1]} />
            <ObjectMaterial
              object={object}
              isSelected={isSelected}
              hasEmissive={hasEmissive}
              isLight={isLight}
              scale={object.scale as any}
            />
            {isSelected && <Outlines thickness={3} color="#ff8c00" />}
          </mesh>
        );

      case 'cylinder':
        return (
          <mesh
            onPointerDown={tapSelect.onPointerDown as any}
            onPointerMove={tapSelect.onPointerMove as any}
            onPointerUp={tapSelect.onPointerUp as any}
            receiveShadow={receiveShadow}
            castShadow={castShadow}
          >
            <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
            <ObjectMaterial
              object={object}
              isSelected={isSelected}
              hasEmissive={hasEmissive}
              isLight={isLight}
              scale={object.scale as any}
            />
            {isSelected && <Outlines thickness={3} color="#ff8c00" />}
          </mesh>
        );

      case 'light':
        const pointLightSettings = object.lightSettings;
        return (
          <group>
            {/* Visual representation - only in edit mode */}
            {isEditMode && (
              <>
                <mesh
                  onPointerDown={tapSelect.onPointerDown as any}
                  onPointerMove={tapSelect.onPointerMove as any}
                  onPointerUp={tapSelect.onPointerUp as any}
                >
                  <sphereGeometry args={[0.3, 16, 16]} />
                  <meshStandardMaterial 
                    color={object.color} 
                    emissive={object.color} 
                    emissiveIntensity={2} 
                    transparent
                    opacity={0.9}
                  />
                  {isSelected && <Outlines thickness={3} color="#ff8c00" />}
                </mesh>
                {/* Light rays visualization */}
                <group>
                  {[0, 1, 2, 3, 4, 5].map((i) => {
                    const angle = (i / 6) * Math.PI * 2;
                    return (
                      <mesh key={i} position={[Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5]} rotation={[0, 0, Math.PI / 2 + angle]}>
                        <coneGeometry args={[0.08, 0.3, 4]} />
                        <meshBasicMaterial color={object.color} transparent opacity={0.5} />
                      </mesh>
                    );
                  })}
                </group>
              </>
            )}
            {/* Actual point light */}
            <pointLight 
              color={object.color} 
              intensity={pointLightSettings?.intensity ?? 1}
              distance={pointLightSettings?.distance ?? 25}
              decay={pointLightSettings?.decay ?? 2}
              castShadow={pointLightSettings?.castShadow ?? true}
              shadow-mapSize-width={pointLightSettings?.shadowMapSize ?? 1024}
              shadow-mapSize-height={pointLightSettings?.shadowMapSize ?? 1024}
              shadow-bias={pointLightSettings?.shadowBias ?? -0.0001}
              shadow-normalBias={pointLightSettings?.shadowNormalBias ?? 0.02}
              shadow-radius={pointLightSettings?.shadowRadius ?? 1}
            />
          </group>
        );

      case 'sunlight':
        const sunSettings = object.lightSettings;
        // Calculate sun direction from elevation and azimuth
        const elevation = ((sunSettings?.sunElevation ?? 45) * Math.PI) / 180;
        const azimuth = ((sunSettings?.sunAzimuth ?? 180) * Math.PI) / 180;
        const sunDistance = 50;
        const sunX = Math.cos(azimuth) * Math.cos(elevation) * sunDistance;
        const sunY = Math.sin(elevation) * sunDistance;
        const sunZ = Math.sin(azimuth) * Math.cos(elevation) * sunDistance;
        
        return (
          <group>
            {/* Visual sun representation - only in edit mode */}
            {isEditMode && (
              <>
                <mesh
                  onPointerDown={tapSelect.onPointerDown as any}
                  onPointerMove={tapSelect.onPointerMove as any}
                  onPointerUp={tapSelect.onPointerUp as any}
                >
                  <sphereGeometry args={[0.5, 32, 32]} />
                  <meshBasicMaterial color={object.color} />
                  {isSelected && <Outlines thickness={3} color="#ff8c00" />}
                </mesh>
                {/* Sun corona effect */}
                <sprite scale={[3, 3, 1]}>
                  <spriteMaterial 
                    color={object.color} 
                    transparent 
                    opacity={0.3}
                    depthWrite={false}
                  />
                </sprite>
                {/* Direction indicator */}
                <arrowHelper 
                args={[
                  new THREE.Vector3(-sunX, -sunY, -sunZ).normalize(),
                  new THREE.Vector3(0, 0, 0),
                  2,
                  new THREE.Color(object.color).getHex(),
                  0.5,
                  0.2
                ]}
              />
              </>
            )}
            {/* Directional light (sun) */}
            <directionalLight
              color={object.color}
              intensity={sunSettings?.intensity ?? 0.5}
              position={[sunX, sunY, sunZ]}
              castShadow={sunSettings?.castShadow ?? true}
              shadow-mapSize-width={sunSettings?.shadowMapSize ?? 2048}
              shadow-mapSize-height={sunSettings?.shadowMapSize ?? 2048}
              shadow-camera-near={0.5}
              shadow-camera-far={500}
              shadow-camera-left={-(sunSettings?.shadowCameraSize ?? 50)}
              shadow-camera-right={sunSettings?.shadowCameraSize ?? 50}
              shadow-camera-top={sunSettings?.shadowCameraSize ?? 50}
              shadow-camera-bottom={-(sunSettings?.shadowCameraSize ?? 50)}
              shadow-bias={sunSettings?.shadowBias ?? -0.001}
              shadow-normalBias={sunSettings?.shadowNormalBias ?? 0.02}
              shadow-radius={sunSettings?.shadowRadius ?? 1}
            />
          </group>
        );

      case 'spotlight':
        const spotSettings = object.lightSettings;
        return (
          <SpotLightObject 
            object={object}
            isEditMode={isEditMode}
            isSelected={isSelected}
            tapSelect={tapSelect}
            spotSettings={spotSettings}
          />
        );

      case 'npc':
        // Render Minecraft-style prefabs based on customData.prefab
        const prefab = object.logicSettings?.customData?.prefab || 'MinecraftCharacter';
        const npcSkinColors = {
          skin: object.color || '#c4a574',
          hair: '#3d2314',
          shirt: '#00aaaa',
          pants: '#1a1a7a',
          shoes: '#4a4a4a',
        };
        
        return (
          <group
            onPointerDown={tapSelect.onPointerDown as any}
            onPointerMove={tapSelect.onPointerMove as any}
            onPointerUp={tapSelect.onPointerUp as any}
          >
            {/* Selection outline wrapper */}
            {isSelected && (
              <mesh position={[0, 1, 0]}>
                <boxGeometry args={[1.2, 2.2, 1.2]} />
                <meshBasicMaterial color="#ff8c00" transparent opacity={0.2} wireframe />
              </mesh>
            )}
            {/* Render appropriate prefab */}
            {prefab === 'MinecraftTree' && <MinecraftTree position={[0, 0, 0]} />}
            {prefab === 'MinecraftHouse' && <MinecraftHouse position={[0, 0, 0]} />}
            {prefab === 'MinecraftLampPost' && <MinecraftLampPost position={[0, 0, 0]} />}
            {prefab === 'MinecraftFence' && <MinecraftFence position={[0, 0, 0]} length={5} />}
            {prefab === 'MinecraftVillager' && <StaticMinecraftNPC position={[0, 0, 0]} skinColors={{ skin: '#c4a574', hair: '#5c4033', shirt: '#8B4513', pants: '#654321', shoes: '#2a2a2a' }} />}
            {prefab === 'MinecraftGuard' && <StaticMinecraftNPC position={[0, 0, 0]} skinColors={{ skin: '#c4a574', hair: '#3d2314', shirt: '#808080', pants: '#606060', shoes: '#4a4a4a' }} />}
            {prefab === 'MinecraftMerchant' && <StaticMinecraftNPC position={[0, 0, 0]} skinColors={{ skin: '#deb887', hair: '#8b4513', shirt: '#daa520', pants: '#8b4513', shoes: '#654321' }} />}
            {prefab === 'MinecraftZombie' && <StaticMinecraftNPC position={[0, 0, 0]} skinColors={{ skin: '#4a7c4e', hair: '#2d4f30', shirt: '#3d5c40', pants: '#2d4f30', shoes: '#1a2e1c' }} />}
            {prefab === 'MinecraftSkeleton' && <StaticMinecraftNPC position={[0, 0, 0]} skinColors={{ skin: '#e8e8d0', hair: '#e8e8d0', shirt: '#d8d8c0', pants: '#d0d0b8', shoes: '#c8c8b0' }} />}
            {prefab === 'MinecraftCharacter' && <MinecraftCharacter skinColors={npcSkinColors} animate={true} animationSpeed={0.5} />}
            {!['MinecraftTree', 'MinecraftHouse', 'MinecraftLampPost', 'MinecraftFence', 'MinecraftVillager', 'MinecraftGuard', 'MinecraftMerchant', 'MinecraftZombie', 'MinecraftSkeleton', 'MinecraftCharacter'].includes(prefab) && (
              <MinecraftCharacter skinColors={npcSkinColors} animate={true} animationSpeed={0.5} />
            )}
          </group>
        );

      case 'ring':
        return (
          <mesh
            onPointerDown={tapSelect.onPointerDown as any}
            onPointerMove={tapSelect.onPointerMove as any}
            onPointerUp={tapSelect.onPointerUp as any}
            castShadow={castShadow}
          >
            <torusGeometry args={[1, 0.08, 16, 32]} />
            <ObjectMaterial
              object={object}
              isSelected={isSelected}
              hasEmissive={hasEmissive}
              isLight={isLight}
              scale={object.scale as any}
              extraProps={{ emissive: object.color, emissiveIntensity: visual?.emissiveIntensity ?? 0.5 }}
            />
            {isSelected && <Outlines thickness={3} color="#ff8c00" />}
          </mesh>
        );

      default:
        return (
          <mesh
            onPointerDown={tapSelect.onPointerDown as any}
            onPointerMove={tapSelect.onPointerMove as any}
            onPointerUp={tapSelect.onPointerUp as any}
            receiveShadow={receiveShadow}
            castShadow={castShadow}
          >
            <boxGeometry args={[1, 1, 1]} />
            <ObjectMaterial
              object={object}
              isSelected={isSelected}
              hasEmissive={hasEmissive}
              isLight={isLight}
              scale={object.scale as any}
            />
            {isSelected && <Outlines thickness={3} color="#ff8c00" />}
          </mesh>
        );
    }
  };

  // Force re-render when ref is ready for TransformControls
  useEffect(() => {
    if (groupRef.current && !refReady) {
      setRefReady(true);
    }
  }, [refReady]);

  // Set userData on group for object identification in raycasting
  // This needs to run on every render to catch newly created meshes
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    
    const updateUserData = () => {
      g.userData = {
        ...g.userData,
        objectId: object.id,
        objectType: object.type,
        objectSelectionRole: getObjectSelectionRole(object),
        isEditable: true,
      };
      
      // Also set on all children for better detection
      g.traverse((child) => {
        child.userData = {
          ...child.userData,
          objectId: object.id,
          objectType: object.type,
          objectSelectionRole: getObjectSelectionRole(object),
          isEditable: true,
        };
      });
    };
    
    // Update immediately
    updateUserData();
    
    // Also update after a short delay to catch lazy-loaded meshes
    const timeout = setTimeout(updateUserData, 100);
    
    return () => clearTimeout(timeout);
  }, [object.id, object.type, isSelected]); // Also re-run when selection changes

  // Register group ref for ScriptExecutor
  useEffect(() => {
    if (!groups?.current) return;
    const g = groupRef.current;
    if (!g) return;

    groups.current.set(object.id, g);
    return () => {
      groups.current.delete(object.id);
    };
  }, [groups, object.id]);

  // Register rigid body ref for ScriptExecutor (play mode only)
  useEffect(() => {
    if (!rigidBodies?.current) return;
    if (isEditMode) {
      rigidBodies.current.delete(object.id);
      return;
    }

    const rb = rigidBodyRef.current;
    if (!rb) return;
    
    // Check if rigid body is still valid before registering
    try {
      rb.translation(); // Test if the rigid body is accessible
      rigidBodies.current.set(object.id, rb);
    } catch (e) {
      // Rigid body is in an invalid state, don't register it
      console.warn(`[EditableObject] Rigid body for ${object.id} is not accessible, skipping registration`);
      return;
    }
    
    return () => {
      rigidBodies.current.delete(object.id);
    };
  }, [rigidBodies, object.id, isEditMode]);

  // Hide object if not visible (default to true if undefined)
  if (object.visible === false) return null;

  // EDIT MODE: no Rapier wrappers + behaviors active for preview
  if (isEditMode) {
    return (
      <>
        <group ref={groupRef} position={object.position as any} rotation={rotation as any} scale={scale as any}>
          {renderVisual()}
          {/* Audio source for preview in edit mode */}
          {object.audioSettings?.url && (
            <AudioSource
              id={object.id}
              name={object.name}
              url={object.audioSettings.url}
              position={[0, 0, 0]}
              volume={object.audioSettings.volume ?? 0.8}
              loop={object.audioSettings.loop ?? false}
              autoplay={object.audioSettings.autoplay ?? false}
              distance={object.audioSettings.distance ?? 50}
              refDistance={object.audioSettings.refDistance ?? 1}
              rolloffFactor={object.audioSettings.rolloffFactor ?? 1}
              enabled={true}
            />
          )}
          {/* Particle emitter for preview in edit mode */}
          {object.particleSettings?.enabled && (
            <ParticleEmitter settings={object.particleSettings} />
          )}
        </group>
        {/* Run behaviors in edit mode for preview */}
        {hasBehavior && <ObjectBehavior object={object} groupRef={groupRef} />}
        {/* Professional Transform Gizmo - Unity/Unreal style */}
        {/* Only show gizmo in transform modes (not in 'select' mode, where camera has priority) */}
        {isSelected && refReady && groupRef.current && transformMode !== 'select' && (
          <TransformGizmo 
            targetRef={groupRef}
            mode={transformMode as 'translate' | 'rotate' | 'scale'}
            space={transformSpace}
            onTransformStart={handleTransformStart}
            onTransformEnd={handleTransformEnd}
            onChange={handleTransformChange}
          />
        )}
      </>
    );
  }

  // PLAY MODE
  // Camera and Player objects are not rendered in play mode (handled separately)
  if (object.type === 'camera' || object.type === 'player') return null;

  if (renderOnly) {
    return (
      <group ref={groupRef} position={object.position as any} rotation={rotation as any} scale={scale as any}>
        {renderVisual()}
        {object.audioSettings?.url && (
          <AudioSource
            id={object.id}
            name={object.name}
            url={object.audioSettings.url}
            position={[0, 0, 0]}
            volume={object.audioSettings.volume ?? 0.8}
            loop={object.audioSettings.loop ?? false}
            autoplay={object.audioSettings.autoplay ?? false}
            distance={object.audioSettings.distance ?? 50}
            refDistance={object.audioSettings.refDistance ?? 1}
            rolloffFactor={object.audioSettings.rolloffFactor ?? 1}
            enabled={true}
          />
        )}
        {object.particleSettings?.enabled && (
          <ParticleEmitter settings={object.particleSettings} />
        )}
        {hasBehavior && <ObjectBehavior object={object} groupRef={groupRef} />}
      </group>
    );
  }

  // Lights and rings don't need rigid bodies
  if (isLight || isRing) {
    return (
      <group ref={groupRef} position={object.position as any} rotation={rotation as any} scale={scale as any}>
        {renderVisual()}
        {/* Audio source for lights/rings */}
        {object.audioSettings?.url && (
          <AudioSource
            id={object.id}
            name={object.name}
            url={object.audioSettings.url}
            position={[0, 0, 0]}
            volume={object.audioSettings.volume ?? 0.8}
            loop={object.audioSettings.loop ?? false}
            autoplay={object.audioSettings.autoplay ?? false}
            distance={object.audioSettings.distance ?? 50}
            refDistance={object.audioSettings.refDistance ?? 1}
            rolloffFactor={object.audioSettings.rolloffFactor ?? 1}
            enabled={true}
          />
        )}
        {/* Particle emitter */}
        {object.particleSettings?.enabled && (
          <ParticleEmitter settings={object.particleSettings} />
        )}
        {hasBehavior && <ObjectBehavior object={object} groupRef={groupRef} />}
      </group>
    );
  }

  // Get physics settings from object (or use defaults)
  const physicsSettings = physics || {
    bodyType: isStatic ? 'fixed' : 'dynamic',
    colliderShape: 'auto',
    mass: 1,
    restitution: object.type === 'sphere' ? 0.8 : 0.3,
    friction: 0.5,
    linearDamping: 0,
    angularDamping: 0.1,
    isSensor: false,
  };

  // Determine collider based on settings or auto-detect
  const getCollider = () => {
    // Live preview must not feed arbitrary GLB meshes into Rapier trimesh/hull generation.
    // Complex model colliders need an explicit cooked collider asset; until then, box
    // approximation keeps Play Mode stable and prevents WASM memory traps.
    if (hasExternalModel && ['trimesh', 'hull', 'capsule'].includes(physicsSettings.colliderShape)) {
      return 'cuboid' as const;
    }

    if (physicsSettings.colliderShape !== 'auto') {
      switch (physicsSettings.colliderShape) {
        case 'ball': return 'ball' as const;
        case 'hull': return 'hull' as const;
        case 'trimesh': return 'trimesh' as const;
        case 'capsule': return 'hull' as const;
        default: return 'cuboid' as const;
      }
    }
    switch (object.type) {
      case 'sphere': return 'ball' as const;
      case 'cylinder': return 'hull' as const;
      default: return 'cuboid' as const;
    }
  };

  // For kinematic bodies with behaviors/scripts, we need special handling
  const hasEntityAI = object.entitySettings?.aiEnabled && object.entitySettings?.aiType !== 'none';
  const hasScripts = (object.scriptInstances || []).some(s => s.enabled);
  const hasMovementScript = (object.scriptInstances || []).some(inst => {
    if (!inst.enabled) return false;
    const s = scriptRegistry.get(inst.scriptId);
    return s?.category === 'movement';
  });

  // Map bodyType to RigidBody type
  // AI-controlled entities need to be kinematic for smooth movement
  const effectiveBodyType: PhysicsBodyType = ((hasBehavior || hasMovementScript || hasEntityAI) && physicsSettings.bodyType === 'dynamic')
    ? 'kinematic'
    : physicsSettings.bodyType;

  const rigidBodyType = effectiveBodyType === 'kinematic' ? 'kinematicPosition' : effectiveBodyType;

  return (
    <RigidBody
      ref={rigidBodyRef}
      type={rigidBodyType as any}
      position={object.position as any}
      rotation={rotation as any}
      colliders={getCollider()}
      restitution={physicsSettings.restitution}
      friction={physicsSettings.friction}
      mass={physicsSettings.mass}
      linearDamping={physicsSettings.linearDamping}
      angularDamping={physicsSettings.angularDamping}
      sensor={physicsSettings.isSensor}
      userData={{ 
        objectId: object.id, 
        name: object.name,
        type: object.type,
        tags: object.logicSettings?.tags || [],
        team: object.entitySettings?.team || 'neutral',
        entityType: object.entitySettings?.entityType || 'static',
      }}
    >
      <group ref={groupRef} scale={scale as any} userData={{ objectId: object.id }}>
        {/* If object is instanced, keep geometry for colliders but hide to avoid double draw calls */}
        <group visible={!hideVisualInPlay}>
          {renderVisual()}
        </group>
        {/* Audio source in play mode */}
        {object.audioSettings?.url && (
          <AudioSource
            id={object.id}
            name={object.name}
            url={object.audioSettings.url}
            position={[0, 0, 0]}
            volume={object.audioSettings.volume ?? 0.8}
            loop={object.audioSettings.loop ?? false}
            autoplay={object.audioSettings.autoplay ?? false}
            distance={object.audioSettings.distance ?? 50}
            refDistance={object.audioSettings.refDistance ?? 1}
            rolloffFactor={object.audioSettings.rolloffFactor ?? 1}
            enabled={true}
          />
        )}
        {/* Particle emitter in play mode */}
        {object.particleSettings?.enabled && (
          <ParticleEmitter settings={object.particleSettings} />
        )}
      </group>
      {/* Behaviors in play mode (apply via rigid body when present) */}
      {hasBehavior && (
        <ObjectBehavior object={object} groupRef={groupRef} rigidBodyRef={rigidBodyRef} bodyType={effectiveBodyType} />
      )}
      {/* Entity AI behaviors (chase, flee, guard, follow, patrol) */}
      {hasEntityAI && (
        <EntityAIBehavior object={object} groupRef={groupRef} rigidBodyRef={rigidBodyRef} bodyType={effectiveBodyType} />
      )}
    </RigidBody>
  );
};
