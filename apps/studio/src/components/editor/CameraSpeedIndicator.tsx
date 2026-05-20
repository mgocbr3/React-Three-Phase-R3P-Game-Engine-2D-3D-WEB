import { useEffect, useState, useCallback, useRef } from 'react';

interface CameraSpeedEvent {
  speed: number;
  minSpeed: number;
  maxSpeed: number;
}

export const CameraSpeedIndicator = () => {
  const [speed, setSpeed] = useState(15);
  const [minSpeed, setMinSpeed] = useState(2);
  const [maxSpeed, setMaxSpeed] = useState(100);
  const [visible, setVisible] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSpeedChange = useCallback((e: CustomEvent<CameraSpeedEvent>) => {
    setSpeed(e.detail.speed);
    setMinSpeed(e.detail.minSpeed);
    setMaxSpeed(e.detail.maxSpeed);
    setVisible(true);

    // Clear existing timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Hide after 1.5 seconds
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, 1500);
  }, []);

  useEffect(() => {
    window.addEventListener('camera-speed-change', handleSpeedChange as EventListener);
    return () => {
      window.removeEventListener('camera-speed-change', handleSpeedChange as EventListener);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [handleSpeedChange]);

  // Calculate percentage for the bar
  const percentage = ((speed - minSpeed) / (maxSpeed - minSpeed)) * 100;

  if (!visible) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <div className="flex flex-col items-center gap-2 bg-card/90 backdrop-blur-md border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
        <div className="flex items-center justify-between w-full text-xs">
          <span className="text-muted-foreground">Camera Speed</span>
          <span className="text-foreground font-mono font-medium">{speed.toFixed(0)}</span>
        </div>
        
        {/* Speed bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-muted to-cyan-400 rounded-full transition-all duration-100"
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {/* Min/Max labels */}
        <div className="flex items-center justify-between w-full text-[10px] text-muted-foreground">
          <span>{minSpeed}</span>
          <span className="text-muted-foreground/60">Scroll to adjust</span>
          <span>{maxSpeed}</span>
        </div>
      </div>
    </div>
  );
};
