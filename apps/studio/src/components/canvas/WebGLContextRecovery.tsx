import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';

interface WebGLContextRecoveryProps {
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

/**
 * Component that monitors WebGL context loss and attempts recovery.
 * 
 * WebGL context can be lost due to:
 * - GPU driver crashes
 * - Too many WebGL contexts
 * - System resource pressure
 * - Browser tab backgrounding
 * - Render loop exceptions causing cascade failures
 * 
 * This component:
 * 1. Listens for webglcontextlost/restored events
 * 2. Prevents default behavior (which would permanently kill the canvas)
 * 3. Logs detailed diagnostics
 * 4. Notifies parent components for recovery actions
 */
export const WebGLContextRecovery = ({ 
  onContextLost, 
  onContextRestored 
}: WebGLContextRecoveryProps) => {
  const { gl } = useThree();
  const contextLostCount = useRef(0);
  const lastContextLostTime = useRef<number>(0);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleContextLost = (event: WebGLContextEvent) => {
      // Prevent default to allow potential recovery
      event.preventDefault();
      
      contextLostCount.current++;
      lastContextLostTime.current = Date.now();

      console.error('[WebGLContextRecovery]  WebGL context lost!', {
        lostCount: contextLostCount.current,
        timestamp: new Date().toISOString(),
        rendererInfo: {
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
        }
      });

      onContextLost?.();
    };

    const handleContextRestored = () => {
      const recoveryTime = Date.now() - lastContextLostTime.current;
      
      console.info('[WebGLContextRecovery]  WebGL context restored!', {
        recoveryTimeMs: recoveryTime,
        totalLostCount: contextLostCount.current,
      });

      onContextRestored?.();
    };

    canvas.addEventListener('webglcontextlost', handleContextLost as EventListener);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    // Log initial context state
    console.info('[WebGLContextRecovery] Monitoring WebGL context', {
      contextType: gl.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1',
      maxTextureSize: gl.capabilities.maxTextureSize,
      maxVertexUniforms: gl.capabilities.maxVertexUniforms,
      precision: gl.capabilities.precision,
    });

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl, onContextLost, onContextRestored]);

  return null;
};
