import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { 
  MinecraftCharacter, 
  MinecraftTree, 
  MinecraftHouse,
  MinecraftGround,
  MinecraftLampPost,
  MinecraftFence
} from '../primitives/MinecraftCharacter';
import { MinecraftPlayer } from '../primitives/MinecraftPlayer';

// NPC that wanders and animates while walking
const WanderingNPC = ({ 
  position, 
  skinColors,
  wanderRadius = 3
}: { 
  position: [number, number, number];
  skinColors?: any;
  wanderRadius?: number;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const startPos = useRef(position);
  const targetPos = useRef<[number, number, number]>([...position]);
  const waitTime = useRef(0);
  const isWalking = useRef(false);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    waitTime.current -= delta;
    
    if (waitTime.current <= 0) {
      // Pick new random target
      targetPos.current = [
        startPos.current[0] + (Math.random() - 0.5) * wanderRadius * 2,
        startPos.current[1],
        startPos.current[2] + (Math.random() - 0.5) * wanderRadius * 2,
      ];
      waitTime.current = 2 + Math.random() * 3;
    }

    // Move towards target
    const speed = 1.5 * delta;
    const dx = targetPos.current[0] - groupRef.current.position.x;
    const dz = targetPos.current[2] - groupRef.current.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.1) {
      groupRef.current.position.x += (dx / dist) * speed;
      groupRef.current.position.z += (dz / dist) * speed;
      
      // Face movement direction
      groupRef.current.rotation.y = Math.atan2(dx, dz);
      isWalking.current = true;
    } else {
      isWalking.current = false;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <MinecraftCharacter 
        skinColors={skinColors}
        animate={true}
        animationSpeed={4}
      />
    </group>
  );
};

export const SocialHubTemplate = () => {
  return (
    <>
      {/* Player - Minecraft style with walk/jump animations */}
      <MinecraftPlayer 
        position={[0, 2, 10]} 
        skinColors={{
          skin: '#c4a574',
          hair: '#3d2314',
          shirt: '#00aaaa',
          pants: '#1a1a7a',
          shoes: '#4a4a4a'
        }}
      />
      
      {/* Minecraft Ground */}
      <MinecraftGround size={[80, 1, 80]} />
      
      {/* Central Plaza - Cobblestone pattern */}
      <mesh receiveShadow position={[0, 0.01, 0]}>
        <boxGeometry args={[20, 0.1, 20]} />
        <meshStandardMaterial color="#707070" />
      </mesh>
      
      {/* Fountain/Well in center */}
      <group position={[0, 0, 0]}>
        {/* Well base */}
        <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[4, 1, 4]} />
          <meshStandardMaterial color="#505050" />
        </mesh>
        {/* Well walls */}
        <mesh castShadow position={[0, 1.25, -1.75]}>
          <boxGeometry args={[4, 1.5, 0.5]} />
          <meshStandardMaterial color="#606060" />
        </mesh>
        <mesh castShadow position={[0, 1.25, 1.75]}>
          <boxGeometry args={[4, 1.5, 0.5]} />
          <meshStandardMaterial color="#606060" />
        </mesh>
        <mesh castShadow position={[-1.75, 1.25, 0]}>
          <boxGeometry args={[0.5, 1.5, 3]} />
          <meshStandardMaterial color="#606060" />
        </mesh>
        <mesh castShadow position={[1.75, 1.25, 0]}>
          <boxGeometry args={[0.5, 1.5, 3]} />
          <meshStandardMaterial color="#606060" />
        </mesh>
        {/* Water inside */}
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[3, 0.3, 3]} />
          <meshStandardMaterial color="#3498db" transparent opacity={0.8} />
        </mesh>
        {/* Roof posts */}
        <mesh castShadow position={[-1.5, 3, -1.5]}>
          <boxGeometry args={[0.3, 4, 0.3]} />
          <meshStandardMaterial color="#5c3d2e" />
        </mesh>
        <mesh castShadow position={[1.5, 3, -1.5]}>
          <boxGeometry args={[0.3, 4, 0.3]} />
          <meshStandardMaterial color="#5c3d2e" />
        </mesh>
        <mesh castShadow position={[-1.5, 3, 1.5]}>
          <boxGeometry args={[0.3, 4, 0.3]} />
          <meshStandardMaterial color="#5c3d2e" />
        </mesh>
        <mesh castShadow position={[1.5, 3, 1.5]}>
          <boxGeometry args={[0.3, 4, 0.3]} />
          <meshStandardMaterial color="#5c3d2e" />
        </mesh>
        {/* Roof */}
        <mesh castShadow position={[0, 5.2, 0]}>
          <boxGeometry args={[4.5, 0.5, 4.5]} />
          <meshStandardMaterial color="#8b4513" />
        </mesh>
      </group>

      {/* Houses around the plaza */}
      <MinecraftHouse position={[-15, 0, -15]} wallColor="#d4a574" roofColor="#8b0000" />
      <MinecraftHouse position={[15, 0, -15]} wallColor="#a08060" roofColor="#2d5a27" />
      <MinecraftHouse position={[-15, 0, 15]} wallColor="#c4a484" roofColor="#4a4a8a" />
      <MinecraftHouse position={[15, 0, 15]} size={[8, 5, 6]} wallColor="#8b8b8b" roofColor="#2a2a2a" />

      {/* Market Stalls */}
      <group position={[8, 0, 0]}>
        <mesh castShadow position={[0, 0.75, 0]}>
          <boxGeometry args={[3, 1.5, 2]} />
          <meshStandardMaterial color="#8b7355" />
        </mesh>
        <mesh castShadow position={[0, 2.5, -0.8]}>
          <boxGeometry args={[3.5, 2, 0.2]} />
          <meshStandardMaterial color="#c41e3a" />
        </mesh>
        {/* Goods on stall */}
        <mesh castShadow position={[-0.8, 1.6, 0.3]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial color="#ff6b35" />
        </mesh>
        <mesh castShadow position={[0, 1.6, 0.3]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial color="#ffd700" />
        </mesh>
        <mesh castShadow position={[0.8, 1.6, 0.3]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial color="#9b59b6" />
        </mesh>
      </group>

      <group position={[-8, 0, 0]}>
        <mesh castShadow position={[0, 0.75, 0]}>
          <boxGeometry args={[3, 1.5, 2]} />
          <meshStandardMaterial color="#8b7355" />
        </mesh>
        <mesh castShadow position={[0, 2.5, -0.8]}>
          <boxGeometry args={[3.5, 2, 0.2]} />
          <meshStandardMaterial color="#2980b9" />
        </mesh>
      </group>

      {/* NPCs - Various Minecraft-style characters */}
      <WanderingNPC 
        position={[5, 0, 5]}
        skinColors={{ skin: '#c4a574', hair: '#8b4513', shirt: '#e74c3c', pants: '#2c3e50', shoes: '#1a1a1a' }}
      />
      <WanderingNPC 
        position={[-6, 0, 3]}
        skinColors={{ skin: '#deb887', hair: '#ffd700', shirt: '#27ae60', pants: '#8b4513', shoes: '#2c2c2c' }}
      />
      <WanderingNPC 
        position={[3, 0, -6]}
        skinColors={{ skin: '#a0522d', hair: '#1a1a1a', shirt: '#9b59b6', pants: '#34495e', shoes: '#3a3a3a' }}
      />
      <WanderingNPC 
        position={[-4, 0, -4]}
        skinColors={{ skin: '#ffe4c4', hair: '#d35400', shirt: '#3498db', pants: '#2c3e50', shoes: '#1a1a1a' }}
      />
      
      {/* Stationary NPCs at stalls */}
      <group position={[8, 0, 1.5]} rotation={[0, Math.PI, 0]}>
        <MinecraftCharacter 
          skinColors={{ skin: '#c4a574', hair: '#3d2314', shirt: '#c41e3a', pants: '#1a1a1a', shoes: '#2a2a2a' }}
          animate={true}
          animationSpeed={0.5}
        />
      </group>
      <group position={[-8, 0, 1.5]} rotation={[0, Math.PI, 0]}>
        <MinecraftCharacter 
          skinColors={{ skin: '#deb887', hair: '#1a1a1a', shirt: '#2980b9', pants: '#2c3e50', shoes: '#1a1a1a' }}
          animate={true}
          animationSpeed={0.5}
        />
      </group>

      {/* Trees around the area */}
      <MinecraftTree position={[25, 0, 25]} />
      <MinecraftTree position={[-25, 0, 25]} />
      <MinecraftTree position={[25, 0, -25]} />
      <MinecraftTree position={[-25, 0, -25]} />
      <MinecraftTree position={[30, 0, 0]} />
      <MinecraftTree position={[-30, 0, 0]} />
      <MinecraftTree position={[0, 0, 30]} />
      <MinecraftTree position={[0, 0, -30]} />
      <MinecraftTree position={[20, 0, 10]} />
      <MinecraftTree position={[-20, 0, -10]} />

      {/* Lamp Posts for lighting */}
      <MinecraftLampPost position={[10, 0, 10]} />
      <MinecraftLampPost position={[-10, 0, 10]} />
      <MinecraftLampPost position={[10, 0, -10]} />
      <MinecraftLampPost position={[-10, 0, -10]} />

      {/* Fences */}
      <MinecraftFence position={[-20, 0, 20]} length={8} />
      <group rotation={[0, Math.PI / 2, 0]}>
        <MinecraftFence position={[-20, 0, 20]} length={8} />
      </group>

      {/* Paths - Gravel/Dirt paths */}
      <mesh receiveShadow position={[0, 0.02, 20]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 20]} />
        <meshStandardMaterial color="#9b8b7a" />
      </mesh>
      <mesh receiveShadow position={[0, 0.02, -20]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 20]} />
        <meshStandardMaterial color="#9b8b7a" />
      </mesh>
      <mesh receiveShadow position={[20, 0.02, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[4, 20]} />
        <meshStandardMaterial color="#9b8b7a" />
      </mesh>
      <mesh receiveShadow position={[-20, 0.02, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[4, 20]} />
        <meshStandardMaterial color="#9b8b7a" />
      </mesh>

      {/* Decorative blocks - Flowers */}
      {[
        [12, 0.3, 5], [-12, 0.3, 5], [12, 0.3, -5], [-12, 0.3, -5],
        [5, 0.3, 12], [-5, 0.3, 12], [5, 0.3, -12], [-5, 0.3, -12],
      ].map((pos, i) => (
        <mesh key={i} castShadow position={pos as [number, number, number]}>
          <boxGeometry args={[0.3, 0.6, 0.3]} />
          <meshStandardMaterial 
            color={['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'][i % 4]} 
            emissive={['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'][i % 4]}
            emissiveIntensity={0.2}
          />
        </mesh>
      ))}

      {/* Ambient sunlight */}
      <directionalLight
        position={[30, 50, 30]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <ambientLight intensity={0.4} />
      
      {/* Sky color hint */}
      <hemisphereLight args={['#87ceeb', '#4a8a43', 0.3]} />
    </>
  );
};
