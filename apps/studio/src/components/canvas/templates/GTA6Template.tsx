import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { MinecraftPlayer } from '../primitives/MinecraftPlayer';

// Palmeira estilizada
const PalmTree = ({ position }: { position: [number, number, number] }) => {
  const trunkRef = useRef<THREE.Group>(null);
  
  return (
    <group position={position}>
      {/* Tronco curvo */}
      <mesh position={[0, 3, 0]} rotation={[0, 0, 0.1]} castShadow>
        <cylinderGeometry args={[0.3, 0.5, 6, 8]} />
        <meshStandardMaterial color="#5d4037" roughness={0.9} />
      </mesh>
      <mesh position={[0.3, 5.5, 0]} rotation={[0, 0, 0.15]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 3, 8]} />
        <meshStandardMaterial color="#6d4c41" roughness={0.9} />
      </mesh>
      
      {/* Folhas */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.sin((angle * Math.PI) / 180) * 0.5 + 0.4,
            7,
            Math.cos((angle * Math.PI) / 180) * 0.5
          ]}
          rotation={[
            0.5 - Math.random() * 0.3,
            (angle * Math.PI) / 180,
            0.3
          ]}
          castShadow
        >
          <boxGeometry args={[0.1, 3, 0.8]} />
          <meshStandardMaterial color="#2e7d32" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};

// Prédio Art Deco estilo Miami
const ArtDecoBuilding = ({ 
  position, 
  height = 20, 
  width = 10,
  color = '#e8d5b7',
  accentColor = '#00bcd4'
}: { 
  position: [number, number, number];
  height?: number;
  width?: number;
  color?: string;
  accentColor?: string;
}) => {
  return (
    <group position={position}>
      {/* Corpo principal */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[width/2, height/2, width/3]} position={[0, height/2, 0]} />
      </RigidBody>
      
      <mesh position={[0, height/2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, width * 0.6]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      
      {/* Detalhes Art Deco - linhas horizontais */}
      {Array.from({ length: Math.floor(height / 3) }).map((_, i) => (
        <mesh key={i} position={[0, (i + 1) * 3, width * 0.31]} castShadow>
          <boxGeometry args={[width * 1.02, 0.2, 0.1]} />
          <meshStandardMaterial 
            color={accentColor} 
            emissive={accentColor}
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
      
      {/* Topo decorativo */}
      <mesh position={[0, height + 1, 0]} castShadow>
        <boxGeometry args={[width * 0.6, 2, width * 0.4]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      
      {/* Neon no topo */}
      <mesh position={[0, height + 2.5, width * 0.21]}>
        <boxGeometry args={[width * 0.5, 0.3, 0.1]} />
        <meshStandardMaterial 
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      
      {/* Janelas */}
      {Array.from({ length: Math.floor(height / 4) }).map((_, row) => (
        Array.from({ length: 3 }).map((_, col) => (
          <mesh 
            key={`${row}-${col}`}
            position={[
              (col - 1) * (width * 0.3),
              row * 4 + 3,
              width * 0.31
            ]}
          >
            <planeGeometry args={[width * 0.2, 2]} />
            <meshStandardMaterial 
              color="#1a237e"
              emissive="#ffd54f"
              emissiveIntensity={0.5}
            />
          </mesh>
        ))
      ))}
    </group>
  );
};

// Carro esportivo estilizado
const SportsCar = ({ 
  position, 
  rotation = 0,
  color = '#e91e63'
}: { 
  position: [number, number, number];
  rotation?: number;
  color?: string;
}) => {
  return (
    <RigidBody type="fixed" position={position} rotation={[0, rotation, 0]}>
      <group>
        {/* Corpo do carro */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[2, 0.6, 4.5]} />
          <meshStandardMaterial 
            color={color} 
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
        
        {/* Teto/Cabine */}
        <mesh position={[0, 0.9, -0.3]} castShadow>
          <boxGeometry args={[1.8, 0.5, 2]} />
          <meshStandardMaterial 
            color={color}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
        
        {/* Vidros */}
        <mesh position={[0, 0.9, -0.3]}>
          <boxGeometry args={[1.75, 0.45, 1.95]} />
          <meshStandardMaterial 
            color="#1a237e"
            metalness={0.3}
            roughness={0}
            opacity={0.7}
            transparent
          />
        </mesh>
        
        {/* Rodas */}
        {[[-0.9, 0.3, 1.5], [0.9, 0.3, 1.5], [-0.9, 0.3, -1.5], [0.9, 0.3, -1.5]].map((pos, i) => (
          <mesh key={i} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.35, 0.35, 0.3, 16]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
        ))}
        
        {/* Faróis traseiros */}
        <mesh position={[0.7, 0.4, -2.26]}>
          <boxGeometry args={[0.4, 0.2, 0.05]} />
          <meshStandardMaterial 
            color="#ff1744"
            emissive="#ff1744"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[-0.7, 0.4, -2.26]}>
          <boxGeometry args={[0.4, 0.2, 0.05]} />
          <meshStandardMaterial 
            color="#ff1744"
            emissive="#ff1744"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
        
        {/* Faróis dianteiros */}
        <mesh position={[0.7, 0.4, 2.26]}>
          <boxGeometry args={[0.3, 0.15, 0.05]} />
          <meshStandardMaterial 
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={1}
          />
        </mesh>
        <mesh position={[-0.7, 0.4, 2.26]}>
          <boxGeometry args={[0.3, 0.15, 0.05]} />
          <meshStandardMaterial 
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={1}
          />
        </mesh>
      </group>
    </RigidBody>
  );
};

// Placa de neon
const NeonSign = ({ 
  position, 
  text, 
  color = '#ff1493',
  rotation = 0
}: { 
  position: [number, number, number];
  text: string;
  color?: string;
  rotation?: number;
}) => {
  const intensity = useRef(2);
  
  useFrame((state) => {
    // Efeito de flickering sutil
    intensity.current = 2 + Math.sin(state.clock.elapsedTime * 10) * 0.3;
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Fundo da placa */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[text.length * 0.8 + 1, 2, 0.2]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
      </mesh>
      
      {/* Texto neon simulado */}
      <mesh>
        <boxGeometry args={[text.length * 0.6, 0.8, 0.1]} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      
      {/* Point light para glow */}
      <pointLight 
        color={color} 
        intensity={3} 
        distance={15}
        position={[0, 0, 2]}
      />
    </group>
  );
};

// Rua com marcações
const Road = ({ 
  position, 
  length = 100, 
  width = 12 
}: { 
  position: [number, number, number];
  length?: number;
  width?: number;
}) => {
  return (
    <group position={position}>
      {/* Asfalto */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#2c2c2c" roughness={0.9} />
      </mesh>
      
      {/* Linha central amarela */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[0.2, length]} />
        <meshStandardMaterial 
          color="#ffc107"
          emissive="#ffc107"
          emissiveIntensity={0.3}
        />
      </mesh>
      
      {/* Linhas laterais brancas tracejadas */}
      {Array.from({ length: Math.floor(length / 4) }).map((_, i) => (
        <mesh 
          key={i}
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[width / 2 - 1, 0.01, -length / 2 + i * 4 + 1]}
        >
          <planeGeometry args={[0.15, 2]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
      
      {Array.from({ length: Math.floor(length / 4) }).map((_, i) => (
        <mesh 
          key={i}
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[-width / 2 + 1, 0.01, -length / 2 + i * 4 + 1]}
        >
          <planeGeometry args={[0.15, 2]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
};

// Calçada
const Sidewalk = ({ 
  position, 
  size 
}: { 
  position: [number, number, number];
  size: [number, number];
}) => {
  return (
    <RigidBody type="fixed" position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} receiveShadow>
        <planeGeometry args={size} />
        <meshStandardMaterial color="#9e9e9e" roughness={0.95} />
      </mesh>
      {/* Meio-fio */}
      <mesh position={[size[0] / 2, 0.1, 0]}>
        <boxGeometry args={[0.2, 0.2, size[1]]} />
        <meshStandardMaterial color="#757575" />
      </mesh>
    </RigidBody>
  );
};

// Oceano animado
const Ocean = () => {
  const oceanRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (oceanRef.current) {
      oceanRef.current.position.y = -0.5 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <mesh 
      ref={oceanRef}
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, -0.5, 80]}
      receiveShadow
    >
      <planeGeometry args={[200, 100]} />
      <meshStandardMaterial 
        color="#006994"
        metalness={0.3}
        roughness={0.2}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
};

// Praia
const Beach = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 40]} receiveShadow>
      <planeGeometry args={[200, 40]} />
      <meshStandardMaterial color="#f5deb3" roughness={1} />
    </mesh>
  );
};

// Poste de luz
const StreetLight = ({ position }: { position: [number, number, number] }) => {
  return (
    <group position={position}>
      {/* Poste */}
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 6, 8]} />
        <meshStandardMaterial color="#424242" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Braço */}
      <mesh position={[0.8, 5.8, 0]} rotation={[0, 0, Math.PI / 6]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
        <meshStandardMaterial color="#424242" metalness={0.8} />
      </mesh>
      
      {/* Luminária */}
      <mesh position={[1.5, 5.5, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial 
          color="#fff8e1"
          emissive="#ffd54f"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      
      {/* Luz */}
      <pointLight 
        position={[1.5, 5.5, 0]}
        color="#ffd54f"
        intensity={5}
        distance={20}
        castShadow
      />
    </group>
  );
};

// Colisores invisíveis para limites do mapa
const MapBoundaries = () => {
  return (
    <>
      {/* Chão principal */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[150, 0.5, 150]} position={[0, -0.5, 0]} />
      </RigidBody>
      
      {/* Paredes invisíveis */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[150, 30, 1]} position={[0, 15, -80]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[150, 30, 1]} position={[0, 15, 130]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1, 30, 150]} position={[-100, 15, 0]} />
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1, 30, 150]} position={[100, 15, 0]} />
      </RigidBody>
    </>
  );
};

export const GTA6Template = () => {
  const playerSettings = {
    speed: 6,
    jumpForce: 8,
    movementMode: 'free' as const,
    canSprint: true,
    sprintSpeed: 12,
    canDoubleJump: false,
    gravity: 20,
  };

  const cameraSettings = {
    mode: 'third-person' as const,
    distance: 10,
    height: 5,
    fov: 70,
    smoothing: 0.08,
  };

  return (
    <>
      {/* JOGADOR */}
      <MinecraftPlayer 
        position={[0, 2, 0]} 
        skinColors={{
          skin: '#c4a574',
          hair: '#1a1a1a',
          shirt: '#e91e63',
          pants: '#1a237e',
          shoes: '#ffffff'
        }}
        playerSettings={playerSettings}
        cameraSettings={cameraSettings}
      />

      {/* LIMITES DO MAPA */}
      <MapBoundaries />

      {/* OCEANO E PRAIA */}
      <Ocean />
      <Beach />

      {/* CHÃO DA CIDADE */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -20]} receiveShadow>
        <planeGeometry args={[200, 80]} />
        <meshStandardMaterial color="#37474f" roughness={0.9} />
      </mesh>

      {/* RUAS */}
      <Road position={[0, 0.02, -20]} length={80} width={14} />
      <group rotation={[0, Math.PI / 2, 0]}>
        <Road position={[-20, 0.02, 0]} length={60} width={12} />
      </group>

      {/* CALÇADAS */}
      <Sidewalk position={[10, 0, -20]} size={[6, 80]} />
      <Sidewalk position={[-10, 0, -20]} size={[6, 80]} />

      {/* PRÉDIOS ART DECO */}
      <ArtDecoBuilding position={[-25, 0, -40]} height={30} width={12} color="#e8d5b7" accentColor="#00bcd4" />
      <ArtDecoBuilding position={[-40, 0, -35]} height={25} width={10} color="#fff3e0" accentColor="#ff4081" />
      <ArtDecoBuilding position={[-25, 0, -15]} height={20} width={10} color="#fce4ec" accentColor="#7c4dff" />
      <ArtDecoBuilding position={[25, 0, -40]} height={35} width={14} color="#e0f2f1" accentColor="#00e676" />
      <ArtDecoBuilding position={[40, 0, -30]} height={22} width={11} color="#fff8e1" accentColor="#ff6d00" />
      <ArtDecoBuilding position={[25, 0, -10]} height={18} width={9} color="#f3e5f5" accentColor="#e040fb" />
      <ArtDecoBuilding position={[-45, 0, -55]} height={40} width={15} color="#e8eaf6" accentColor="#536dfe" />
      <ArtDecoBuilding position={[50, 0, -50]} height={45} width={16} color="#efebe9" accentColor="#ff5722" />

      {/* CARROS */}
      <SportsCar position={[-5, 0, 5]} rotation={0} color="#e91e63" />
      <SportsCar position={[6, 0, -15]} rotation={Math.PI} color="#00bcd4" />
      <SportsCar position={[-4, 0, -30]} rotation={0.2} color="#ffc107" />
      <SportsCar position={[20, 0, -25]} rotation={Math.PI / 2} color="#9c27b0" />
      <SportsCar position={[-20, 0, 0]} rotation={-Math.PI / 4} color="#4caf50" />

      {/* PALMEIRAS - PRAIA */}
      <PalmTree position={[-15, 0, 35]} />
      <PalmTree position={[-5, 0, 38]} />
      <PalmTree position={[8, 0, 36]} />
      <PalmTree position={[20, 0, 34]} />
      <PalmTree position={[35, 0, 37]} />
      <PalmTree position={[-30, 0, 33]} />
      <PalmTree position={[50, 0, 35]} />

      {/* PALMEIRAS - CIDADE */}
      <PalmTree position={[15, 0, -5]} />
      <PalmTree position={[-15, 0, -10]} />
      <PalmTree position={[18, 0, -25]} />

      {/* POSTES DE LUZ */}
      <StreetLight position={[8, 0, 0]} />
      <StreetLight position={[8, 0, -20]} />
      <StreetLight position={[8, 0, -40]} />
      <StreetLight position={[-8, 0, -10]} />
      <StreetLight position={[-8, 0, -30]} />

      {/* NEON SIGNS */}
      <NeonSign position={[-25, 15, -39.5]} text="VICE" color="#ff1493" />
      <NeonSign position={[25, 18, -39.5]} text="MALIBU" color="#00ffff" />
      <NeonSign position={[-40, 12, -34.5]} text="CLUB" color="#ff4081" />
      <NeonSign position={[40, 11, -29.5]} text="BEACH" color="#76ff03" />
      <NeonSign position={[-45, 20, -54.5]} text="HOTEL" color="#ffeb3b" />
      <NeonSign position={[50, 22, -49.5]} text="CASINO" color="#e040fb" />

      {/* ILUMINAÇÃO ATMOSFÉRICA */}
      {/* Luz ambiente quente (sunset) */}
      <ambientLight intensity={0.4} color="#ffccbc" />
      
      {/* Sol poente */}
      <directionalLight
        position={[50, 30, 80]}
        intensity={1.5}
        color="#ff7043"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-far={150}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      
      {/* Luz de preenchimento (céu) */}
      <directionalLight
        position={[-30, 40, -20]}
        intensity={0.4}
        color="#90caf9"
      />
      
      {/* Hemisphere light para ambiente */}
      <hemisphereLight
        color="#87ceeb"
        groundColor="#ff7043"
        intensity={0.3}
      />

      {/* FOG para profundidade */}
      <fog attach="fog" args={['#1a1a2e', 50, 200]} />

      {/* Skybox gradient */}
      <mesh position={[0, 50, 0]}>
        <sphereGeometry args={[300, 32, 32]} />
        <meshBasicMaterial 
          color="#1a1a3e"
          side={THREE.BackSide}
        />
      </mesh>
    </>
  );
};
