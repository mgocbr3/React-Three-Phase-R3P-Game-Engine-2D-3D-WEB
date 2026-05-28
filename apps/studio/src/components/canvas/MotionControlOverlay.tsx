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

    ctx.beginPath();
    ctx.arc(cursorX, cursorY, 22, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(230, 230, 230, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, primaryHand.isPinching ? 15 : 10, 0, Math.PI * 2);
    ctx.fillStyle = primaryHand.isPinching ? '#f5f5f5' : '#bdbdbd';
    ctx.fill();

    // Gesture indicator
    let gestureText = '';
    if (primaryHand.isPinching) gestureText = ' PINCH';
    else if (primaryHand.isFist) gestureText = ' FIST';
    else if (primaryHand.isPointing) gestureText = ' POINT';
    else if (primaryHand.isOpen) gestureText = ' OPEN';

    if (gestureText) {
      ctx.font = 'bold 14px Roboto, Noto Sans, sans-serif';
      ctx.fillStyle = '#e5e5e5';
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
          'flex items-center gap-2 border px-3 py-2',
          isActive 
            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
            : error 
              ? 'border-red-500/50 bg-red-500/15 text-red-300'
              : 'border-[var(--editor-command-border)] bg-[var(--editor-panel)] text-foreground'
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
          className="flex h-8 w-8 items-center justify-center border border-red-500/50 bg-red-500/15 text-red-300 transition-colors hover:bg-red-500/25"
          title="Desativar Motion Control"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Debug overlay */}
      {showDebugOverlay && primaryHand && (
        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <div className="border border-[var(--editor-command-border)] bg-[var(--editor-panel)] p-4 font-mono text-xs text-foreground">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Position X:</span>
              <span>{smoothedPosition.x.toFixed(3)}</span>
              <span>Position Y:</span>
              <span>{smoothedPosition.y.toFixed(3)}</span>
              <span>Pinching:</span>
              <span className={primaryHand.isPinching ? 'text-emerald-300' : ''}>{String(primaryHand.isPinching)}</span>
              <span>Pointing:</span>
              <span className={primaryHand.isPointing ? 'text-emerald-300' : ''}>{String(primaryHand.isPointing)}</span>
              <span>Fist:</span>
              <span className={primaryHand.isFist ? 'text-emerald-300' : ''}>{String(primaryHand.isFist)}</span>
              <span>Open:</span>
              <span className={primaryHand.isOpen ? 'text-emerald-300' : ''}>{String(primaryHand.isOpen)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
