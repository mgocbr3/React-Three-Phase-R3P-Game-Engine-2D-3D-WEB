import { useEffect, useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useEngineSettings } from '@/stores/engineSettingsStore';

interface PerformanceMetrics {
  fps: number;
  avgFps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

interface PerformanceMonitorProps {
  enabled?: boolean;
  targetFps?: number;
  minFps?: number;
  // Quality levels
  qualityLevels?: {
    dpr: number;
    shadowMapSize: number;
    bloom: boolean;
    ssao: boolean;
  }[];
  // Callbacks
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
  onQualityChange?: (level: number, reason: string) => void;
}

const DEFAULT_QUALITY_LEVELS = [
  { dpr: 0.5, shadowMapSize: 512, bloom: false, ssao: false },   // Ultra Low
  { dpr: 0.75, shadowMapSize: 1024, bloom: false, ssao: false }, // Low
  { dpr: 1, shadowMapSize: 1024, bloom: false, ssao: false },    // Medium
  { dpr: 1, shadowMapSize: 2048, bloom: true, ssao: false },     // High
  { dpr: 1.5, shadowMapSize: 2048, bloom: true, ssao: true },    // Ultra
];

export const PerformanceMonitor = ({
  enabled = true,
  targetFps = 60,
  minFps = 30,
  qualityLevels = DEFAULT_QUALITY_LEVELS,
  onMetricsUpdate,
  onQualityChange,
}: PerformanceMonitorProps) => {
  const { gl } = useThree();
  const { updateSettings, dpr, shadowMapSize, bloom, ssao } = useEngineSettings();
  
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
  const currentQualityRef = useRef(2); // Start at medium
  const stableFramesRef = useRef(0);
  const unstableFramesRef = useRef(0);
  
  // Find current quality level based on settings
  useEffect(() => {
    const currentLevel = qualityLevels.findIndex(
      level => level.dpr === dpr && level.shadowMapSize === shadowMapSize
    );
    if (currentLevel !== -1) {
      currentQualityRef.current = currentLevel;
    }
  }, [dpr, shadowMapSize, qualityLevels]);
  
  const updateQuality = useCallback((newLevel: number, reason: string) => {
    if (newLevel < 0 || newLevel >= qualityLevels.length) return;
    if (newLevel === currentQualityRef.current) return;
    
    const level = qualityLevels[newLevel];
    currentQualityRef.current = newLevel;
    
    updateSettings({
      dpr: level.dpr,
      shadowMapSize: level.shadowMapSize,
      bloom: level.bloom,
      ssao: level.ssao,
    });
    
    onQualityChange?.(newLevel, reason);
    console.log(`[Performance] Quality changed to level ${newLevel}: ${reason}`);
  }, [qualityLevels, updateSettings, onQualityChange]);
  
  useFrame(() => {
    if (!enabled) return;
    
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    frameCountRef.current++;
    
    // Update every 500ms
    if (delta >= 500) {
      const fps = (frameCountRef.current / delta) * 1000;
      
      // Update FPS history
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
      
      // Adaptive quality logic
      if (avgFps < minFps) {
        unstableFramesRef.current++;
        stableFramesRef.current = 0;
        
        // Downgrade after 3 consecutive low FPS samples
        if (unstableFramesRef.current >= 3) {
          updateQuality(currentQualityRef.current - 1, `FPS dropped to ${Math.round(avgFps)}`);
          unstableFramesRef.current = 0;
        }
      } else if (avgFps > targetFps * 0.9) {
        stableFramesRef.current++;
        unstableFramesRef.current = 0;
        
        // Upgrade after 10 consecutive high FPS samples
        if (stableFramesRef.current >= 10) {
          updateQuality(currentQualityRef.current + 1, `FPS stable at ${Math.round(avgFps)}`);
          stableFramesRef.current = 0;
        }
      }
      
      lastTimeRef.current = now;
      frameCountRef.current = 0;
    }
  });
  
  return null; // This is a logic-only component
};

// Hook for getting performance metrics
export const usePerformanceMetrics = () => {
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
  
  return { metrics: metricsRef, onMetricsUpdate: handleMetricsUpdate };
};
