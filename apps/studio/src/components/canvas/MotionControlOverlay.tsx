import React, { useEffect, useRef } from 'react';
import { Hand, Camera, Zap, AlertCircle, Loader2, X } from 'lucide-react';
import { useHandTracking } from '@/hooks/useHandTracking';
import { useMotionControlStore } from '@/stores/motionControlStore';
import { useMotionControlInput } from '@/hooks/useMotionControlInput';
import { cn } from '@/lib/utils';

interface MotionControlOverlayProps {
  className?: string;
}

export const MotionControlOverlay: React.FC<MotionControlOverlayProps> = ({ className }) => {
  const { 
    isActive, 
    isLoading, 
    error, 
    primaryHand, 
    startTracking, 
    stopTracking 
  } = useHandTracking();
  
  const { 
    enabled, 
    mode,
    showPreview, 
    showDebugOverlay,
    updateSmoothedPosition,
    smoothedPosition,
    mapping,
  } = useMotionControlStore();

  // Bridge motion control to game input (movement, actions)
  useMotionControlInput();

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Start/stop tracking based on enabled state
  useEffect(() => {
    if (enabled && !isActive && !isLoading) {
      startTracking();
    } else if (!enabled && isActive) {
      stopTracking();
    }
  }, [enabled, isActive, isLoading, startTracking, stopTracking]);

  // Update smoothed position
  useEffect(() => {
    if (primaryHand) {
      updateSmoothedPosition(primaryHand.position.x, primaryHand.position.y);
    }
  }, [primaryHand, updateSmoothedPosition]);

  // Draw hand visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showPreview || !primaryHand) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw cursor position
    const cursorX = ((smoothedPosition.x + 1) / 2) * width;
    const cursorY = ((1 - smoothedPosition.y) / 2) * height;

    // Outer glow
    const gradient = ctx.createRadialGradient(cursorX, cursorY, 0, cursorX, cursorY, 40);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.6)');
    gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, 40, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Inner circle
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, primaryHand.isPinching ? 15 : 10, 0, Math.PI * 2);
    ctx.fillStyle = primaryHand.isPinching ? '#ff00ff' : '#00ffff';
    ctx.fill();

    // Gesture indicator
    let gestureText = '';
    if (primaryHand.isPinching) gestureText = ' PINCH';
    else if (primaryHand.isFist) gestureText = ' FIST';
    else if (primaryHand.isPointing) gestureText = ' POINT';
    else if (primaryHand.isOpen) gestureText = ' OPEN';

    if (gestureText) {
      ctx.font = 'bold 14px Roboto, Noto Sans, sans-serif';
      ctx.fillStyle = '#00ffff';
      ctx.textAlign = 'center';
      ctx.fillText(gestureText, cursorX, cursorY - 25);
    }
  }, [primaryHand, smoothedPosition, showPreview]);

  if (!enabled) return null;

  return (
    <div className={cn('fixed inset-0 pointer-events-none z-50', className)}>
      {/* Hand tracking canvas overlay */}
      {showPreview && (
        <canvas
          ref={canvasRef}
          width={window.innerWidth}
          height={window.innerHeight}
          className="absolute inset-0"
        />
      )}

      {/* Status indicator with close button */}
      <div className="absolute top-4 right-4 pointer-events-auto flex items-center gap-2">
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-xl border',
          isActive 
            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
            : error 
              ? 'bg-red-500/20 border-red-500/50 text-red-400'
              : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
        )}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Iniciando câmera...</span>
            </>
          ) : isActive ? (
            <>
              <Hand className="w-4 h-4" />
              <span className="text-sm font-medium">Motion Control Ativo</span>
              <Zap className="w-3 h-3 animate-pulse" />
            </>
          ) : error ? (
            <>
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{error}</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span className="text-sm font-medium">Aguardando...</span>
            </>
          )}
        </div>
        
        {/* Close/Disable button */}
        <button
          onClick={() => {
            stopTracking();
            useMotionControlStore.getState().setEnabled(false);
          }}
          className="flex items-center justify-center w-8 h-8 rounded-lg backdrop-blur-xl border border-red-500/50 bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
          title="Desativar Motion Control"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Debug overlay */}
      {showDebugOverlay && primaryHand && (
        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-xl rounded-lg p-4 border border-cyan-500/30 font-mono text-xs text-cyan-400">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Position X:</span>
              <span>{smoothedPosition.x.toFixed(3)}</span>
              <span>Position Y:</span>
              <span>{smoothedPosition.y.toFixed(3)}</span>
              <span>Pinching:</span>
              <span className={primaryHand.isPinching ? 'text-emerald-400' : ''}>{String(primaryHand.isPinching)}</span>
              <span>Pointing:</span>
              <span className={primaryHand.isPointing ? 'text-emerald-400' : ''}>{String(primaryHand.isPointing)}</span>
              <span>Fist:</span>
              <span className={primaryHand.isFist ? 'text-emerald-400' : ''}>{String(primaryHand.isFist)}</span>
              <span>Open:</span>
              <span className={primaryHand.isOpen ? 'text-emerald-400' : ''}>{String(primaryHand.isOpen)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
