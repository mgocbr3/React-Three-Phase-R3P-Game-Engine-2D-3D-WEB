import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface MobileJoystickProps {
  onMove: (x: number, y: number) => void;
  onJump?: () => void;
  size?: number;
  className?: string;
}

export const MobileJoystick = ({ 
  onMove, 
  onJump,
  size = 120,
  className 
}: MobileJoystickProps) => {
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);
  
  const maxDistance = size / 2 - 20;
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (touchIdRef.current !== null) return;
    
    const touch = e.touches[0];
    touchIdRef.current = touch.identifier;
    setIsActive(true);
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const deltaX = touch.clientX - centerX;
      const deltaY = touch.clientY - centerY;
      
      updatePosition(deltaX, deltaY);
    }
  }, []);
  
  const updatePosition = useCallback((deltaX: number, deltaY: number) => {
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const clampedDistance = Math.min(distance, maxDistance);
    
    let normalizedX = 0;
    let normalizedY = 0;
    
    if (distance > 0) {
      normalizedX = (deltaX / distance) * clampedDistance;
      normalizedY = (deltaY / distance) * clampedDistance;
    }
    
    setPosition({ x: normalizedX, y: normalizedY });
    
    // Convert to -1 to 1 range for game input
    const inputX = normalizedX / maxDistance;
    const inputY = -normalizedY / maxDistance; // Invert Y for game coordinates
    onMove(inputX, inputY);
  }, [maxDistance, onMove]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchIdRef.current === null) return;
    
    const touch = Array.from(e.touches).find(t => t.identifier === touchIdRef.current);
    if (!touch || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = touch.clientX - centerX;
    const deltaY = touch.clientY - centerY;
    
    updatePosition(deltaX, deltaY);
  }, [updatePosition]);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
    if (!touch) return;
    
    touchIdRef.current = null;
    setIsActive(false);
    setPosition({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);
  
  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Joystick */}
      <div
        ref={containerRef}
        className="relative rounded-full backdrop-blur-xl border border-white/20"
        style={{
          width: size,
          height: size,
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Direction indicators */}
        <div className="absolute inset-4 rounded-full border border-white/10" />
        
        {/* Thumb */}
        <div
          className="absolute rounded-full transition-transform duration-75"
          style={{
            width: 40,
            height: 40,
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
            background: isActive 
              ? 'radial-gradient(circle, rgba(168,85,247,0.9) 0%, rgba(139,92,246,0.7) 100%)'
              : 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.2) 100%)',
            boxShadow: isActive 
              ? '0 0 20px rgba(168,85,247,0.5), inset 0 2px 4px rgba(255,255,255,0.3)'
              : 'inset 0 2px 4px rgba(255,255,255,0.2)',
          }}
        />
      </div>
      
      {/* Jump button */}
      {onJump && (
        <button
          className="rounded-full backdrop-blur-xl border border-white/20 active:scale-95 transition-transform"
          style={{
            width: 64,
            height: 64,
            background: 'radial-gradient(circle, rgba(34,211,238,0.3) 0%, rgba(34,211,238,0.1) 100%)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)',
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            onJump();
          }}
        >
          <span className="text-white/80 text-xs font-bold">JUMP</span>
        </button>
      )}
    </div>
  );
};

// Action buttons component for mobile gameplay
interface MobileActionButtonsProps {
  onAction1?: () => void;
  onAction2?: () => void;
  action1Label?: string;
  action2Label?: string;
  className?: string;
}

export const MobileActionButtons = ({
  onAction1,
  onAction2,
  action1Label = 'A',
  action2Label = 'B',
  className,
}: MobileActionButtonsProps) => {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {onAction1 && (
        <button
          className="w-14 h-14 rounded-full backdrop-blur-xl border border-white/20 active:scale-95 transition-transform flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, rgba(168,85,247,0.1) 100%)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)',
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            onAction1();
          }}
        >
          <span className="text-white/90 text-sm font-bold">{action1Label}</span>
        </button>
      )}
      
      {onAction2 && (
        <button
          className="w-14 h-14 rounded-full backdrop-blur-xl border border-white/20 active:scale-95 transition-transform flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(34,211,238,0.3) 0%, rgba(34,211,238,0.1) 100%)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)',
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            onAction2();
          }}
        >
          <span className="text-white/90 text-sm font-bold">{action2Label}</span>
        </button>
      )}
    </div>
  );
};
