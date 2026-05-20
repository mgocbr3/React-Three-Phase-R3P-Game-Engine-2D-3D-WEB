/**
 * EditorTemplateScene - Renders the visual scene for templates in the editor.
 * This ensures the editor shows the SAME visual scene as the game (Play mode).
 * 
 * The difference from GameCanvas templates:
 * - No player controller (editor has its own player object)
 * - Objects are for visual reference only (editor uses editable objects from store)
 */

import { TemplateId } from '@/stores/gameStore';
import { Ground } from '../primitives/Ground';
import { Platform } from '../primitives/Platform';
import { 
  MinecraftCharacter,
  MinecraftTree, 
  MinecraftHouse, 
  MinecraftGround, 
  MinecraftLampPost, 
  MinecraftFence 
} from '../primitives/MinecraftCharacter';
// WanderingNPC removed - NPCs are now managed by editorStore objects

interface EditorTemplateSceneProps {
  templateId: TemplateId | null;
}

// Adventure Template Scene (Voxel Style)
// NPCs are NOT rendered here - they come from editorStore.objects as EditableObjects
// This prevents duplication and allows proper edit mode behavior
const AdventureScene = () => (
  <>
    {/* Ground */}
    <Ground size={[100, 100]} color="#1a1a2e" />
    
    {/* Trees - static decorations */}
    <MinecraftTree position={[15, 0, 15]} />
    <MinecraftTree position={[-15, 0, -15]} />
    <MinecraftTree position={[20, 0, -10]} />
    
    {/* Floating Platforms */}
    <Platform position={[5, 2, -5]} size={[4, 0.5, 4]} color="#2d2d44" />
    <Platform position={[-6, 4, -8]} size={[3, 0.5, 3]} color="#2d2d44" />
    <Platform position={[0, 6, -15]} size={[5, 0.5, 5]} color="#2d2d44" />
    <Platform position={[8, 3, 5]} size={[4, 0.5, 4]} color="#2d2d44" />
    <Platform position={[-10, 5, 0]} size={[3, 0.5, 6]} color="#2d2d44" />
    
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

// Social Hub Template Scene (Voxel Village)
const SocialHubScene = () => (
  <>
    {/* Minecraft Ground */}
    <MinecraftGround size={[80, 1, 80]} />
    
    {/* Central Plaza - Cobblestone pattern */}
    <mesh receiveShadow position={[0, 0.01, 0]}>
      <boxGeometry args={[20, 0.1, 20]} />
      <meshStandardMaterial color="#707070" />
    </mesh>
    
    {/* Fountain/Well in center */}
    <group position={[0, 0, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[4, 1, 4]} />
        <meshStandardMaterial color="#505050" />
      </mesh>
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
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[3, 0.3, 3]} />
        <meshStandardMaterial color="#3498db" transparent opacity={0.8} />
      </mesh>
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

    {/* NPCs are managed by editorStore.objects - not hardcoded here */}
    
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

    {/* Trees */}
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

    {/* Lamp Posts */}
    <MinecraftLampPost position={[10, 0, 10]} />
    <MinecraftLampPost position={[-10, 0, 10]} />
    <MinecraftLampPost position={[10, 0, -10]} />
    <MinecraftLampPost position={[-10, 0, -10]} />

    {/* Fences */}
    <MinecraftFence position={[-20, 0, 20]} length={8} />
    <group rotation={[0, Math.PI / 2, 0]}>
      <MinecraftFence position={[-20, 0, 20]} length={8} />
    </group>

    {/* Paths */}
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

    {/* Decorative Flowers */}
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
  </>
);

// FPS Horror Scene
const FPSHorrorScene = () => (
  <>
    <Ground size={[100, 100]} color="#0a0a0a" />
    
    {/* Corridor walls */}
    <mesh castShadow receiveShadow position={[-5, 3, 0]}>
      <boxGeometry args={[0.5, 6, 30]} />
      <meshStandardMaterial color="#1a1a1a" />
    </mesh>
    <mesh castShadow receiveShadow position={[5, 3, 0]}>
      <boxGeometry args={[0.5, 6, 30]} />
      <meshStandardMaterial color="#1a1a1a" />
    </mesh>
    
    {/* Crates */}
    <mesh castShadow position={[-3, 0.75, -8]} rotation={[0, 0.3, 0]}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#2d2d2d" />
    </mesh>
    <mesh castShadow position={[3, 0.5, 3]} rotation={[0, -0.5, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#2d2d2d" />
    </mesh>
    
    {/* Flickering lights (visual only) */}
    <pointLight position={[0, 4, -5]} color="#ff6600" intensity={8} distance={25} />
    <pointLight position={[0, 4, 5]} color="#ff6600" intensity={8} distance={25} />
  </>
);

// Racing Scene
const RacingScene = () => (
  <>
    <Ground size={[200, 200]} color="#1a3a1a" />
    
    {/* Main track pieces */}
    <mesh receiveShadow position={[0, 0.15, 0]}>
      <boxGeometry args={[10, 0.3, 40]} />
      <meshStandardMaterial color="#3a3a4a" />
    </mesh>
    <mesh receiveShadow position={[0, 0.15, -50]}>
      <boxGeometry args={[10, 0.3, 40]} />
      <meshStandardMaterial color="#3a3a4a" />
    </mesh>
    <mesh receiveShadow position={[0, 0.15, 50]}>
      <boxGeometry args={[10, 0.3, 40]} />
      <meshStandardMaterial color="#3a3a4a" />
    </mesh>
    
    {/* Barriers */}
    <mesh castShadow position={[-6, 0.5, 0]}>
      <boxGeometry args={[0.5, 1, 40]} />
      <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.2} />
    </mesh>
    <mesh castShadow position={[6, 0.5, 0]}>
      <boxGeometry args={[0.5, 1, 40]} />
      <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.2} />
    </mesh>
    
    {/* Checkpoints */}
    <group position={[0, 0, -30]}>
      <mesh castShadow position={[-4, 3, 0]}>
        <boxGeometry args={[0.5, 6, 0.5]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
      </mesh>
      <mesh castShadow position={[4, 3, 0]}>
        <boxGeometry args={[0.5, 6, 0.5]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
      </mesh>
      <mesh castShadow position={[0, 6, 0]}>
        <boxGeometry args={[8.5, 0.3, 0.3]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
      </mesh>
    </group>
  </>
);

// RPG Top-Down Scene
const RPGScene = () => (
  <>
    <Ground size={[100, 100]} color="#2d4a2d" />
    
    {/* Buildings */}
    <group position={[-8, 0, -8]}>
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color="#deb887" />
      </mesh>
      <mesh castShadow position={[0, 4.8, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[3.2, 1.5, 4]} />
        <meshStandardMaterial color="#8b0000" />
      </mesh>
    </group>
    
    <group position={[8, 0, -8]}>
      <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
        <boxGeometry args={[5, 3, 4]} />
        <meshStandardMaterial color="#a0522d" />
      </mesh>
      <mesh castShadow position={[0, 3.8, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[4, 1.5, 4]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>
    </group>
    
    {/* Tower */}
    <mesh castShadow receiveShadow position={[0, 4, -12]}>
      <cylinderGeometry args={[2, 2, 8, 16]} />
      <meshStandardMaterial color="#696969" />
    </mesh>
    
    {/* Trees */}
    <mesh castShadow position={[-12, 2, 5]}>
      <sphereGeometry args={[2, 16, 16]} />
      <meshStandardMaterial color="#228b22" />
    </mesh>
    <mesh castShadow position={[12, 2.5, 3]}>
      <sphereGeometry args={[2.5, 16, 16]} />
      <meshStandardMaterial color="#2e8b2e" />
    </mesh>
    
    {/* Treasure chests */}
    <mesh castShadow position={[5, 0.4, 5]} rotation={[0, 0.2, 0]}>
      <boxGeometry args={[1, 0.8, 0.6]} />
      <meshStandardMaterial color="#daa520" metalness={0.5} />
    </mesh>
    <mesh castShadow position={[-6, 0.4, 8]} rotation={[0, -0.4, 0]}>
      <boxGeometry args={[1, 0.8, 0.6]} />
      <meshStandardMaterial color="#daa520" metalness={0.5} />
    </mesh>
  </>
);

// Platformer 2D Scene
const PlatformerScene = () => (
  <>
    <Ground size={[50, 10]} color="#1a1a2e" />
    
    {/* Platforms */}
    <mesh castShadow receiveShadow position={[-10, 2, 0]}>
      <boxGeometry args={[6, 0.5, 3]} />
      <meshStandardMaterial color="#374151" />
    </mesh>
    <mesh castShadow receiveShadow position={[-2, 4, 0]}>
      <boxGeometry args={[4, 0.5, 3]} />
      <meshStandardMaterial color="#374151" />
    </mesh>
    <mesh castShadow receiveShadow position={[6, 6, 0]}>
      <boxGeometry args={[5, 0.5, 3]} />
      <meshStandardMaterial color="#374151" />
    </mesh>
    <mesh castShadow receiveShadow position={[14, 3, 0]}>
      <boxGeometry args={[4, 0.5, 3]} />
      <meshStandardMaterial color="#374151" />
    </mesh>
    
    {/* Collectible orbs */}
    <mesh position={[-10, 4, 0]}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
    </mesh>
    <mesh position={[-2, 6, 0]}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
    </mesh>
    <mesh position={[6, 8, 0]}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
    </mesh>
    
    {/* Spikes */}
    <group position={[2, 0, 0]}>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[(i - 3) * 0.5, 0.3, 0]} castShadow>
          <coneGeometry args={[0.15, 0.6, 4]} />
          <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[3, 0.1, 0.5]} />
        <meshStandardMaterial color="#7f1d1d" />
      </mesh>
    </group>
  </>
);

export const EditorTemplateScene = ({ templateId }: EditorTemplateSceneProps) => {
  if (!templateId) return null;
  
  switch (templateId) {
    case 'adventure':
      return <AdventureScene />;
    case 'social-hub':
      return <SocialHubScene />;
    case 'fps-horror':
      return <FPSHorrorScene />;
    case 'racing':
      return <RacingScene />;
    case 'rpg-topdown':
      return <RPGScene />;
    case 'platformer-2d':
      return <PlatformerScene />;
    default:
      return null;
  }
};
