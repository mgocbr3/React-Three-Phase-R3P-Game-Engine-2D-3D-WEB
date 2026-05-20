import { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text3D, Center } from '@react-three/drei';
import { useEditorStore } from '@/stores/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { GameCanvas } from '@/components/canvas/GameCanvas';
import { MenuScenePreview } from '@/components/game/MenuScenePreview';
import { TemplateId } from '@/stores/gameStore';

interface MainMenuProps {
  onStart?: () => void;
  onOptions?: () => void;
  onExit?: () => void;
}

// Animated background components
const ParticlesBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="particles-container">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 50%;
          animation: float linear infinite;
        }
        @keyframes float {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(50px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const StarsBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {Array.from({ length: 100 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${1 + Math.random() * 3}px`,
            height: `${1 + Math.random() * 3}px`,
            animation: `twinkle ${1 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const WavesBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg className="absolute w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#667eea', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: '#764ba2', stopOpacity: 0.1 }} />
          </linearGradient>
        </defs>
        <path
          fill="url(#wave-gradient)"
          d="M0,50 Q250,0 500,50 T1000,50 T1500,50 T2000,50 V200 H0 Z"
          className="animate-wave"
        >
          <animate
            attributeName="d"
            dur="10s"
            repeatCount="indefinite"
            values="
              M0,50 Q250,0 500,50 T1000,50 T1500,50 T2000,50 V200 H0 Z;
              M0,50 Q250,100 500,50 T1000,50 T1500,50 T2000,50 V200 H0 Z;
              M0,50 Q250,0 500,50 T1000,50 T1500,50 T2000,50 V200 H0 Z
            "
          />
        </path>
      </svg>
    </div>
  );
};

// 3D Title Component
const Title3D = ({ text, color, depth, size, font, metalness, roughness }: { text: string; color: string; depth: number; size: number; font: string; metalness: number; roughness: number }) => {
  return (
    <Center>
      <Text3D
        font={font}
        size={size}
        height={depth}
        curveSegments={12}
        bevelEnabled
        bevelThickness={0.1}
        bevelSize={0.05}
        bevelOffset={0}
        bevelSegments={5}
      >
        {text}
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
      </Text3D>
    </Center>
  );
};

export const MainMenu = ({ onStart, onOptions, onExit }: MainMenuProps) => {
  const config = useUIStore((state) => state.config);
  const { editorTemplateId, objectCount, hasSavedProject } = useEditorStore(
    useShallow((s) => ({
      editorTemplateId: s.currentTemplateId,
      objectCount: s.objects.length,
      hasSavedProject: s.hasSavedProject,
    }))
  );
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const cameraOverride = useMemo(() => {
    if (!config.menuCameraEnabled) return null;
    return {
      position: [config.menuCameraPosition.x, config.menuCameraPosition.y, config.menuCameraPosition.z] as [number, number, number],
      target: [config.menuCameraTarget.x, config.menuCameraTarget.y, config.menuCameraTarget.z] as [number, number, number],
      fov: config.menuCameraFov,
    };
  }, [config.menuCameraEnabled, config.menuCameraPosition, config.menuCameraTarget, config.menuCameraFov]);

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${config.fontFamily.replace(' ', '+')}:wght@400;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, [config.fontFamily]);

  const handleButtonClick = (action: string, customAction?: string) => {
    switch (action) {
      case 'start':
        onStart?.();
        break;
      case 'options':
        onOptions?.();
        break;
      case 'exit':
        onExit?.();
        break;
      case 'custom':
        if (customAction) {
          console.log('Custom action:', customAction);
        }
        break;
    }
  };

  const renderBackground = () => {
    switch (config.backgroundType) {
      case 'color':
        return <div className="absolute inset-0" style={{ backgroundColor: config.backgroundColor }} />;
      
      case 'gradient':
        return (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${config.gradientStart}, ${config.gradientEnd})`,
            }}
          />
        );
      
      case 'image':
        return config.backgroundImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${config.backgroundImage})` }}
          />
        ) : null;
      
      case 'animated':
        switch (config.animatedBackground) {
          case 'particles':
            return <ParticlesBackground />;
          case 'stars':
            return <StarsBackground />;
          case 'waves':
            return <WavesBackground />;
          default:
            return null;
        }
      
      case '3d-scene': {
        const templateIdToUse = (config.menuUseProjectTemplate && editorTemplateId)
          ? (editorTemplateId as TemplateId)
          : (config.menuTemplateId as TemplateId) || 'adventure';
        const projectAvailable = objectCount > 0 || hasSavedProject();
        const useProjectScene = config.menuUseProjectTemplate && projectAvailable;

        return config.use3DScene ? (
          <div className="absolute inset-0" style={{ opacity: config.sceneOpacity }}>
            {useProjectScene ? (
              <MenuScenePreview cameraOverride={cameraOverride || undefined} />
            ) : (
              <GameCanvas 
                templateId={templateIdToUse}
                cameraOverride={cameraOverride || undefined}
              />
            )}
          </div>
        ) : null;
      }
      
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Background */}
      {renderBackground()}
      
      {/* 3D Title (if enabled and using 3D scene) */}
      {config.use3DScene && config.show3DTitle && (
        <div className="absolute top-20 left-0 right-0 h-64 pointer-events-none">
          <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <Title3D 
              text={config.title} 
              color={config.title3DColor}
              depth={config.title3DDepth}
              size={config.title3DSize}
              font={config.title3DFont}
              metalness={config.title3DMetalness}
              roughness={config.title3DRoughness}
            />
            <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={2} />
          </Canvas>
        </div>
      )}
      
      {/* Menu Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        {/* Title (2D) */}
        {(!config.use3DScene || !config.show3DTitle) && (
          <div className="text-center mb-12">
            <h1
              className="font-bold mb-2 drop-shadow-2xl"
              style={{
                fontFamily: config.fontFamily,
                fontSize: `${config.titleSize}px`,
                color: config.textColor,
                textShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            >
              {config.title}
            </h1>
            {config.subtitle && (
              <p
                className="opacity-80"
                style={{
                  fontFamily: config.fontFamily,
                  fontSize: `${config.buttonSize}px`,
                  color: config.textColor,
                }}
              >
                {config.subtitle}
              </p>
            )}
          </div>
        )}
        
        {/* Menu Buttons */}
        <div className="flex flex-col gap-4 min-w-[300px]">
          {config.buttons
            .filter((btn) => btn.enabled)
            .map((button) => (
              <button
                key={button.id}
                onMouseEnter={() => setHoveredButton(button.id)}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={() => handleButtonClick(button.action, button.customAction)}
                className="px-8 py-4 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-2xl"
                style={{
                  fontFamily: config.fontFamily,
                  fontSize: `${config.buttonSize}px`,
                  backgroundColor: hoveredButton === button.id ? config.buttonHoverColor : config.buttonColor,
                  color: config.buttonTextColor,
                  border: `2px solid ${config.primaryColor}`,
                  boxShadow: hoveredButton === button.id 
                    ? `0 8px 32px ${config.primaryColor}80`
                    : '0 4px 16px rgba(0,0,0,0.3)',
                }}
              >
                {button.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};
