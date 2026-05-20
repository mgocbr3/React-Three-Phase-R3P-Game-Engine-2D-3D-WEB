import { useRef, useCallback, useEffect } from 'react';
import { MobileJoystick, MobileActionButtons } from './MobileJoystick';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsTouchDevice } from '@/hooks/use-touch-device';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { cn } from '@/lib/utils';

// Global touch input state that can be read by game controllers
export const touchInput = {
  movement: { x: 0, y: 0 },
  jump: false,
  action1: false,
  action2: false,
  lookDelta: { x: 0, y: 0 },
};

// Reset jump after reading (like a button press)
export const consumeJump = () => {
  const wasJump = touchInput.jump;
  touchInput.jump = false;
  return wasJump;
};

export const consumeAction1 = () => {
  const was = touchInput.action1;
  touchInput.action1 = false;
  return was;
};

export const consumeAction2 = () => {
  const was = touchInput.action2;
  touchInput.action2 = false;
  return was;
};

interface MobileGameControlsProps {
  showJump?: boolean;
  showActions?: boolean;
  showLookArea?: boolean;
  action1Label?: string;
  action2Label?: string;
  className?: string;
}

export const MobileGameControls = ({
  showJump = true,
  showActions = false,
  showLookArea = false,
  action1Label = 'A',
  action2Label = 'B',
  className,
}: MobileGameControlsProps) => {
  const isMobile = useIsMobile();
  const isTouchDevice = useIsTouchDevice();
  const { showTouchControls } = useEngineSettings();
  const lookAreaRef = useRef<HTMLDivElement>(null);
  const lastTouch = useRef({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);
  
  const handleMove = useCallback((x: number, y: number) => {
    touchInput.movement.x = x;
    touchInput.movement.y = y;
  }, []);
  
  const handleJump = useCallback(() => {
    touchInput.jump = true;
  }, []);
  
  const handleAction1 = useCallback(() => {
    touchInput.action1 = true;
  }, []);
  
  const handleAction2 = useCallback(() => {
    touchInput.action2 = true;
  }, []);
  
  // Look area touch handling for FPS-style camera
  const handleLookTouchStart = useCallback((e: React.TouchEvent) => {
    if (touchIdRef.current !== null) return;
    const touch = e.touches[0];
    touchIdRef.current = touch.identifier;
    lastTouch.current = { x: touch.clientX, y: touch.clientY };
  }, []);
  
  const handleLookTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchIdRef.current === null) return;
    
    const touch = Array.from(e.touches).find(t => t.identifier === touchIdRef.current);
    if (!touch) return;
    
    const deltaX = touch.clientX - lastTouch.current.x;
    const deltaY = touch.clientY - lastTouch.current.y;
    
    touchInput.lookDelta.x = deltaX * 0.01;
    touchInput.lookDelta.y = deltaY * 0.01;
    
    lastTouch.current = { x: touch.clientX, y: touch.clientY };
  }, []);
  
  const handleLookTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
    if (!touch) return;
    
    touchIdRef.current = null;
    touchInput.lookDelta.x = 0;
    touchInput.lookDelta.y = 0;
  }, []);
  
  // Clear inputs when component unmounts
  useEffect(() => {
    return () => {
      touchInput.movement.x = 0;
      touchInput.movement.y = 0;
      touchInput.jump = false;
      touchInput.action1 = false;
      touchInput.action2 = false;
      touchInput.lookDelta.x = 0;
      touchInput.lookDelta.y = 0;
    };
  }, []);
  
  // Importante: tablets (ex. iPad) podem estar em “desktop mode” e não cair no breakpoint.
  // Ainda assim, se for um dispositivo touch, precisamos renderizar os controles.
  if ((!isMobile && !isTouchDevice) || !showTouchControls) return null;
  
  return (
    <div className={cn("fixed inset-0 pointer-events-none z-50", className)}>
      {/* Look area (right side of screen for FPS) */}
      {showLookArea && (
        <div
          ref={lookAreaRef}
          className="absolute right-0 top-0 w-1/2 h-full pointer-events-auto"
          onTouchStart={handleLookTouchStart}
          onTouchMove={handleLookTouchMove}
          onTouchEnd={handleLookTouchEnd}
          onTouchCancel={handleLookTouchEnd}
        />
      )}
      
      {/* Joystick (bottom left) */}
      <div className="absolute bottom-8 left-6 pointer-events-auto">
        <MobileJoystick 
          onMove={handleMove} 
          onJump={showJump ? handleJump : undefined}
        />
      </div>
      
      {/* Action buttons (bottom right) */}
      {showActions && (
        <div className="absolute bottom-8 right-6 pointer-events-auto">
          <MobileActionButtons
            onAction1={handleAction1}
            onAction2={handleAction2}
            action1Label={action1Label}
            action2Label={action2Label}
          />
        </div>
      )}
    </div>
  );
};
