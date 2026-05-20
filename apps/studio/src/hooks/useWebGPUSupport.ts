import { useState, useEffect } from 'react';

interface WebGPUStatus {
  isSupported: boolean;
  isLoading: boolean;
  adapter: GPUAdapter | null;
  device: GPUDevice | null;
  error: string | null;
}

/**
 * Hook para detectar suporte a WebGPU
 * 
 * WebGPU oferece performance superior para:
 * - Gaussian Splatting (ordenação de milhões de partículas)
 * - Compute shaders
 * - Renderização de alta densidade
 * 
 * Suporte atual (2026):
 * - Chrome 113+ 
 * - Edge 113+ 
 * - Safari 18+  (parcial)
 * - Firefox  (experimental)
 */
export function useWebGPUSupport(): WebGPUStatus {
  const [status, setStatus] = useState<WebGPUStatus>({
    isSupported: false,
    isLoading: true,
    adapter: null,
    device: null,
    error: null,
  });

  useEffect(() => {
    async function checkWebGPU() {
      // Verificar se a API existe
      if (!navigator.gpu) {
        setStatus({
          isSupported: false,
          isLoading: false,
          adapter: null,
          device: null,
          error: 'WebGPU não disponível neste navegador',
        });
        return;
      }

      try {
        // Tentar obter adapter (representa a GPU física)
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: 'high-performance',
        });

        if (!adapter) {
          setStatus({
            isSupported: false,
            isLoading: false,
            adapter: null,
            device: null,
            error: 'Nenhum adaptador GPU compatível encontrado',
          });
          return;
        }

        // Tentar obter device (conexão lógica com a GPU)
        const device = await adapter.requestDevice({
          requiredFeatures: [],
          requiredLimits: {},
        });

        setStatus({
          isSupported: true,
          isLoading: false,
          adapter,
          device,
          error: null,
        });

        // Listener para perda de contexto
        device.lost.then((info) => {
          console.warn('[WebGPU] Device lost:', info.message);
          setStatus(prev => ({
            ...prev,
            device: null,
            error: `GPU device lost: ${info.message}`,
          }));
        });

      } catch (err) {
        setStatus({
          isSupported: false,
          isLoading: false,
          adapter: null,
          device: null,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    checkWebGPU();
  }, []);

  return status;
}

/**
 * Retorna informações do adapter WebGPU (se disponível)
 */
export function useWebGPUInfo() {
  const { adapter, isSupported } = useWebGPUSupport();
  const [info, setInfo] = useState<{
    vendor: string;
    architecture: string;
    description: string;
    limits: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    if (adapter && isSupported) {
      // Usar info disponível diretamente do adapter
      // A API requestAdapterInfo pode não existir em todas as implementações
      const adapterInfo = (adapter as any).info;
      
      setInfo({
        vendor: adapterInfo?.vendor || 'Unknown',
        architecture: adapterInfo?.architecture || 'Unknown',
        description: adapterInfo?.description || 'Unknown',
        limits: {
          maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
          maxBufferSize: Number(adapter.limits.maxBufferSize),
          maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
        },
      });
    }
  }, [adapter, isSupported]);

  return info;
}

/**
 * Componente de badge que mostra o status do renderer
 */
export function getRendererBadge(isWebGPU: boolean): {
  label: string;
  color: string;
  description: string;
} {
  if (isWebGPU) {
    return {
      label: 'WebGPU',
      color: '#22c55e',
      description: 'Renderização de alta performance ativa',
    };
  }
  return {
    label: 'WebGL 2.0',
    color: '#3b82f6',
    description: 'Renderização padrão (compatibilidade máxima)',
  };
}
