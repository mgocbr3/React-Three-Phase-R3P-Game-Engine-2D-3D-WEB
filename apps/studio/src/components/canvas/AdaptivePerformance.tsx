import { useRef, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useEngineSettings, QUALITY_PRESETS, QualityPreset } from '@/stores/engineSettingsStore';

interface PerformanceMetrics {
  fps: number;
  avgFps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

interface AdaptivePerformanceProps {
  enabled?: boolean;
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
  onQualityChange?: (preset: QualityPreset, reason: string) => void;
}

// Quality levels in order from lowest to highest
const QUALITY_ORDER: QualityPreset[] = ['ultra-low', 'low', 'medium', 'high', 'ultra'];

/**
 * AdaptivePerformance - Monitors FPS and auto-adjusts quality settings
 * 
 * This component runs inside the Canvas and:
 * 1. Tracks real-time FPS
 * 2. Auto-downgrades quality when FPS drops below minFps
 * 3. Auto-upgrades quality when FPS is stable above targetFps
 */
export const AdaptivePerformance = ({
  enabled = true,
  onMetricsUpdate,
  onQualityChange,
}: AdaptivePerformanceProps) => {
  const { gl } = useThree();
  const { 
    autoQuality, 
    targetFps, 
    minFps, 
    currentQualityPreset,
    updateSettings,
    applyQualityPreset,
  } = useEngineSettings();
  
  const metricsRef = useRef<PerformanceMetrics>({
    fps: 60,
    avgFps: 60,
    frameTime: 16.67,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  });
  
  const fpsHistoryRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);
  const stableFramesRef = useRef(0);
  const unstableFramesRef = useRef(0);
  
  const getCurrentQualityIndex = useCallback(() => {
    return QUALITY_ORDER.indexOf(currentQualityPreset as QualityPreset);
  }, [currentQualityPreset]);
  
  const changeQuality = useCallback((direction: 'up' | 'down', reason: string) => {
    const currentIndex = getCurrentQualityIndex();
    if (currentIndex === -1) return; // Custom preset, don't auto-adjust
    
    const newIndex = direction === 'up' 
      ? Math.min(currentIndex + 1, QUALITY_ORDER.length - 1)
      : Math.max(currentIndex - 1, 0);
    
    if (newIndex !== currentIndex) {
      const newPreset = QUALITY_ORDER[newIndex];
      applyQualityPreset(newPreset);
      onQualityChange?.(newPreset, reason);
    }
  }, [getCurrentQualityIndex, applyQualityPreset, onQualityChange]);
  
  useFrame(() => {
    if (!enabled) return;
    
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    frameCountRef.current++;
    
    // Update every 500ms
    if (delta >= 500) {
      const fps = (frameCountRef.current / delta) * 1000;
      
      // Update FPS history (keep last 20 samples = 10 seconds)
      fpsHistoryRef.current.push(fps);
      if (fpsHistoryRef.current.length > 20) {
        fpsHistoryRef.current.shift();
      }
      
      // Calculate average FPS
      const avgFps = fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length;
      
      // Get renderer info
      const info = gl.info;
      
      metricsRef.current = {
        fps: Math.round(fps),
        avgFps: Math.round(avgFps),
        frameTime: 1000 / fps,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      };
      
      onMetricsUpdate?.(metricsRef.current);
      
      // Auto-quality adjustment
      if (autoQuality && currentQualityPreset !== 'custom') {
        if (avgFps < minFps) {
          unstableFramesRef.current++;
          stableFramesRef.current = 0;
          
          // Downgrade after 3 consecutive low FPS samples (1.5 seconds)
          if (unstableFramesRef.current >= 3) {
            changeQuality('down', `FPS dropped to ${Math.round(avgFps)}`);
            unstableFramesRef.current = 0;
          }
        } else if (avgFps > targetFps * 0.95) {
          stableFramesRef.current++;
          unstableFramesRef.current = 0;
          
          // Upgrade after 20 consecutive high FPS samples (10 seconds)
          if (stableFramesRef.current >= 20) {
            changeQuality('up', `FPS stable at ${Math.round(avgFps)}`);
            stableFramesRef.current = 0;
          }
        } else {
          // FPS is acceptable, reset counters
          stableFramesRef.current = 0;
          unstableFramesRef.current = 0;
        }
      }
      
      lastTimeRef.current = now;
      frameCountRef.current = 0;
    }
  });
  
  return null; // Logic-only component
};

// Export metrics hook for external use
export const usePerformanceStore = () => {
  const metricsRef = useRef<PerformanceMetrics>({
    fps: 60,
    avgFps: 60,
    frameTime: 16.67,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  });
  
  const handleMetricsUpdate = useCallback((metrics: PerformanceMetrics) => {
    metricsRef.current = metrics;
  }, []);
  
  return { 
    getMetrics: () => metricsRef.current,
    onMetricsUpdate: handleMetricsUpdate,
  };
};
