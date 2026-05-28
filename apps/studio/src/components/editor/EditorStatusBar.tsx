import { Activity, Box, Layers, Triangle } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { getRuntimeAdapterLabel } from '@/engine/runtime/runtimePreview';
import { useEffect, useState, useRef } from 'react';
// Hook to track real FPS
const useFPS = (enabled: boolean) => {
  const [fps, setFps] = useState(60);
  const [avgFps, setAvgFps] = useState(60);
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());
  
  useEffect(() => {
    if (!enabled) return;
    
    let frameId: number;
    
    const updateFPS = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      
      const currentFps = Math.round(1000 / delta);
      frameTimesRef.current.push(currentFps);
      
      // Keep last 60 frames for average
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }
      
      // Update FPS every 10 frames for stability
      if (frameTimesRef.current.length % 10 === 0) {
        setFps(currentFps);
        const avg = Math.round(
          frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
        );
        setAvgFps(avg);
      }
      
      frameId = requestAnimationFrame(updateFPS);
    };
    
    frameId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(frameId);
  }, [enabled]);
  
  return { fps, avgFps };
};

// Get FPS color based on performance
const getFpsColor = (fps: number) => {
  if (fps >= 55) return 'text-neon-green';
  if (fps >= 30) return 'text-muted-foreground';
  return 'text-muted-foreground';
};

export const EditorStatusBar = () => {
  const { activeSceneKind, objects } = useEditorStore();
  const previewSession = useRuntimeGameStore((s) => s.previewSession);
  const { showStats } = useEngineSettings();
  const { fps, avgFps } = useFPS(showStats);
  const fpsColor = getFpsColor(fps);
  const is2DScene = activeSceneKind === '2d';
  const runtimeLabel = previewSession?.launchTarget.kind === 'web-runtime'
    ? 'Runtime real'
    : previewSession
      ? getRuntimeAdapterLabel(previewSession.runtime)
      : null;
  
  // Estimate triangle count (rough estimate based on primitive types)
  const estimatedTris = objects.reduce((total, obj) => {
    switch (obj.type) {
      case 'box': return total + 12; // 6 faces * 2 tris
      case 'sphere': return total + 960; // 32 segments * 16 rings * ~2
      case 'cylinder': return total + 192;
      case 'plane': return total + 2;
      default: return total + 100;
    }
  }, 0);
  
  const formatTris = (tris: number) => {
    if (tris >= 1000000) return `${(tris / 1000000).toFixed(1)}M`;
    if (tris >= 1000) return `${(tris / 1000).toFixed(1)}K`;
    return tris.toString();
  };

  const twoDItems = objects.filter((obj) => ['image', 'sprite', 'rectangle', 'circle', 'text'].includes(obj.type)).length;
  
  return (
    <footer
      className="h-6 flex flex-shrink-0 items-center justify-between border-t border-border bg-[var(--editor-panel-sunken)] px-3"
      style={{ boxShadow: 'inset 0 1px 0 var(--editor-border-light)' }}
    >
      {/* Left - Performance Stats */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        {/* FPS Counter - only shown if showStats is enabled */}
        {showStats && (
          <span className="flex items-center gap-1.5">
            <Activity className={`w-3 h-3 ${fpsColor}`} />
            <span className={`font-mono font-semibold ${fpsColor}`}>
              {fps} FPS
            </span>
            <span className="text-muted-foreground/60 text-[9px]">
              ({avgFps} avg)
            </span>
          </span>
        )}
        
        <span className="flex items-center gap-1.5">
          <Box className="w-3 h-3" />
          <span className="font-mono">{objects.length}</span>
          <span className="text-muted-foreground/70">{is2DScene ? 'objects' : 'meshes'}</span>
        </span>
        
        <span className="flex items-center gap-1.5">
          {is2DScene ? <Layers className="w-3 h-3" /> : <Triangle className="w-3 h-3" />}
          <span className="font-mono">{is2DScene ? twoDItems : formatTris(estimatedTris)}</span>
          <span className="text-muted-foreground/70">{is2DScene ? '2D items' : 'tris'}</span>
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {previewSession && (
          <span className="font-semibold text-primary">
            Play Mode · {runtimeLabel}
          </span>
        )}
      </div>
    </footer>
  );
};
