import { Ground } from '../primitives/Ground';
import { Platform } from '../primitives/Platform';
import { PhysicsBox } from '../primitives/PhysicsBox';
import { PhysicsSphere } from '../primitives/PhysicsSphere';
import { MinecraftPlayer } from '../primitives/MinecraftPlayer';
import { WanderingNPC } from '../primitives/MinecraftNPCs';
import { MinecraftTree } from '../primitives/MinecraftCharacter';

export const AdventureTemplate = () => {
  return (
    <>
      {/* Minecraft Player with attack animations */}
      <MinecraftPlayer 
        position={[0, 3, 0]} 
        skinColors={{
          skin: '#c4a574',
          hair: '#3d2314',
          shirt: '#a855f7',
          pants: '#4a4a8a',
          shoes: '#2a2a2a'
        }}
      />
      
      {/* Ground */}
      <Ground size={[100, 100]} color="#1a1a2e" />
      
      {/* NPCs */}
      <WanderingNPC 
        position={[8, 0, -8]}
        skinColors={{ skin: '#deb887', hair: '#8b4513', shirt: '#22c55e', pants: '#3d3d3d' }}
        wanderRadius={4}
      />
      <WanderingNPC 
        position={[-10, 0, 5]}
        skinColors={{ skin: '#c4a574', hair: '#ffd700', shirt: '#3498db', pants: '#1a1a1a' }}
        wanderRadius={3}
      />
      
      {/* Trees */}
      <MinecraftTree position={[15, 0, 15]} />
      <MinecraftTree position={[-15, 0, -15]} />
      <MinecraftTree position={[20, 0, -10]} />
      
      {/* Floating Platforms */}
      <Platform position={[5, 2, -5]} size={[4, 0.5, 4]} color="#2d2d44" />
      <Platform position={[-6, 4, -8]} size={[3, 0.5, 3]} color="#2d2d44" />
      <Platform position={[0, 6, -15]} size={[5, 0.5, 5]} color="#2d2d44" />
      <Platform position={[8, 3, 5]} size={[4, 0.5, 4]} color="#2d2d44" />
      <Platform position={[-10, 5, 0]} size={[3, 0.5, 6]} color="#2d2d44" />
      
      {/* Interactive Boxes */}
      <PhysicsBox position={[3, 2, 3]} size={[1, 1, 1]} color="#a855f7" />
      <PhysicsBox position={[-3, 2, -3]} size={[1.5, 1.5, 1.5]} color="#ec4899" />
      <PhysicsBox position={[6, 4, -5]} size={[0.8, 0.8, 0.8]} color="#22d3ee" />
      
      {/* Bouncy Balls */}
      <PhysicsSphere position={[0, 5, 5]} radius={0.5} color="#22d3ee" />
      <PhysicsSphere position={[-5, 3, 2]} radius={0.7} color="#f97316" />
      <PhysicsSphere position={[7, 6, -3]} radius={0.4} color="#22c55e" />
      
      {/* Decorative Structures */}
      <group position={[15, 0, -10]}>
        <Platform position={[0, 1, 0]} size={[6, 2, 6]} color="#1f1f3a" />
        <Platform position={[0, 3, 0]} size={[4, 2, 4]} color="#252550" />
        <Platform position={[0, 5, 0]} size={[2, 2, 2]} color="#2d2d66" />
      </group>
      
      {/* Ring Gate */}
      <group position={[0, 0, -25]}>
        <mesh position={[0, 5, 0]} castShadow>
          <torusGeometry args={[4, 0.3, 16, 32]} />
          <meshStandardMaterial 
            color="#a855f7" 
            emissive="#a855f7" 
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>
    </>
  );
};