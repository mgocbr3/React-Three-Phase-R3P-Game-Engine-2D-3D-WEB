/**
 * RTXDemoScene - Cena de demonstração com todos os efeitos RTX-like
 * 
 * Mostra:
 * - Água com reflexões
 * - Iluminação noturna com tochas e fogueira
 * - Aurora boreal
 * - Lua com glow
 * - Portal do Nether
 */

import { Suspense } from 'react';
import { 
  RTXWater,
  MinecraftCampfire, 
  MinecraftTorch, 
  MinecraftLantern,
  GlowBlock,
  NetherPortal,
  AuroraEffect,
  MoonGlow,
  GodRays,
} from './index';
import { MinecraftHouse, MinecraftTree } from '../primitives/MinecraftCharacter';
import { WanderingNPC } from '../primitives/MinecraftNPCs';

interface RTXDemoSceneProps {
  timeOfDay?: 'day' | 'sunset' | 'night';
  showWater?: boolean;
  showPortal?: boolean;
  showAurora?: boolean;
}

export const RTXDemoScene = ({
  timeOfDay = 'night',
  showWater = true,
  showPortal = true,
  showAurora = true,
}: RTXDemoSceneProps) => {
  const isNight = timeOfDay === 'night';
  const isSunset = timeOfDay === 'sunset';
  
  // Ground color based on time
  const groundColor = isNight ? '#1a2a1a' : isSunset ? '#3a4a2a' : '#4a7c59';
  
  return (
    <Suspense fallback={null}>
      {/* Ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color={groundColor} />
      </mesh>
      
      {/* Water lake */}
      {showWater && (
        <RTXWater
          position={[-15, 0, 10]}
          size={[25, 25]}
          color={isNight ? '#1a3a5a' : '#20d9d2'}
          opacity={0.8}
          reflectivity={0.6}
          waveSpeed={0.3}
          waveHeight={0.08}
        />
      )}
      
      {/* Central campfire */}
      <MinecraftCampfire
        position={[0, 0, 0]}
        size={1.2}
        intensity={isNight ? 8 : 3}
        particleCount={40}
      />
      
      {/* Torches around campfire */}
      <MinecraftTorch position={[3, 0, 3]} intensity={isNight ? 4 : 2} />
      <MinecraftTorch position={[-3, 0, 3]} intensity={isNight ? 4 : 2} />
      <MinecraftTorch position={[3, 0, -3]} intensity={isNight ? 4 : 2} />
      <MinecraftTorch position={[-3, 0, -3]} intensity={isNight ? 4 : 2} />
      
      {/* Houses with lanterns */}
      <group position={[12, 0, -8]}>
        <MinecraftHouse position={[0, 0, 0]} size={[6, 4, 5]} />
        <MinecraftLantern position={[3.5, 3, 0]} hanging />
        <MinecraftLantern position={[-3.5, 3, 0]} hanging />
      </group>
      
      <group position={[-12, 0, -10]}>
        <MinecraftHouse position={[0, 0, 0]} size={[5, 3.5, 4]} wallColor="#a08060" roofColor="#2d5a27" />
        <MinecraftTorch position={[3, 1.5, 0]} />
        <MinecraftTorch position={[-3, 1.5, 0]} />
      </group>
      
      {/* Glow blocks as decoration */}
      <GlowBlock position={[8, 0.5, 5]} type="glowstone" intensity={isNight ? 3 : 1} />
      <GlowBlock position={[-8, 0.5, 6]} type="sea_lantern" intensity={isNight ? 3 : 1} />
      
      {/* Trees around the scene */}
      <MinecraftTree position={[20, 0, 15]} />
      <MinecraftTree position={[-20, 0, 12]} />
      <MinecraftTree position={[18, 0, -15]} />
      <MinecraftTree position={[-18, 0, -18]} />
      <MinecraftTree position={[25, 0, 0]} />
      <MinecraftTree position={[-25, 0, 5]} />
      
      {/* Nether Portal */}
      {showPortal && (
        <NetherPortal position={[0, 0, -20]} size={[3, 4]} />
      )}
      
      {/* NPCs around campfire */}
      <WanderingNPC
        position={[2, 0, 1]}
        skinColors={{ skin: '#c4a574', hair: '#3d2314', shirt: '#8b4513', pants: '#2c2c2c' }}
        wanderRadius={2}
      />
      <WanderingNPC
        position={[-2, 0, 1]}
        skinColors={{ skin: '#deb887', hair: '#ffd700', shirt: '#1e90ff', pants: '#1a1a1a' }}
        wanderRadius={2}
      />
      
      {/* God rays from torches at night */}
      {isNight && (
        <>
          <GodRays
            position={[3, 5, 3]}
            target={[3, 0, 3]}
            color="#ff6600"
            intensity={0.5}
            angle={0.4}
            distance={6}
            volumetric={true}
            particleCount={50}
          />
        </>
      )}
      
      {/* Night sky effects */}
      {isNight && (
        <>
          {/* Moon */}
          <MoonGlow
            position={[60, 80, -80]}
            size={8}
            glowIntensity={1.5}
          />
          
          {/* Aurora Borealis */}
          {showAurora && (
            <AuroraEffect
              position={[0, 60, -120]}
              width={250}
              height={50}
              colors={['#00ff88', '#00aaff', '#aa00ff']}
              speed={0.4}
              intensity={0.8}
            />
          )}
        </>
      )}
      
      {/* Sunset effects */}
      {isSunset && (
        <MoonGlow
          position={[-80, 20, -60]}
          size={15}
          color="#ff6644"
          glowIntensity={2}
        />
      )}
      
      {/* Ambient lighting based on time */}
      <ambientLight 
        color={isNight ? '#1a1a3a' : isSunset ? '#ff9966' : '#ffffff'} 
        intensity={isNight ? 0.1 : isSunset ? 0.4 : 0.6} 
      />
      
      {/* Hemisphere light for sky/ground color */}
      <hemisphereLight
        args={[
          isNight ? '#1a2a4a' : isSunset ? '#ff7744' : '#87ceeb',
          isNight ? '#0a0a1a' : '#3a2a1a',
          isNight ? 0.2 : 0.5
        ]}
      />
      
      {/* Directional sun/moon light */}
      <directionalLight
        position={isNight ? [60, 80, -80] : isSunset ? [-80, 20, -60] : [50, 100, 50]}
        intensity={isNight ? 0.3 : isSunset ? 0.8 : 1.5}
        color={isNight ? '#aaccff' : isSunset ? '#ff8844' : '#fffae6'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={150}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.0001}
      />
    </Suspense>
  );
};
