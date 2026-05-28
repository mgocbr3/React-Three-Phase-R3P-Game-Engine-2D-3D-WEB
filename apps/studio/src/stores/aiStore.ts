// AI Store - Manages AI providers for Vibe Code
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProvider, AIProviderStatus, AIProviderType, AIMessage } from '@/services/ai/types';
import { DEFAULT_LOCAL_MODEL, CLOUD_PROVIDERS } from '@/services/ai/types';

interface AIStore {
  // Current provider
  currentProviderId: AIProviderType;
  currentModel: string | null;
  provider: AIProvider | null;
  status: AIProviderStatus;
  
  // Configuration
  selectedLocalModel: string;
  cloudApiKeys: Record<string, string>;
  cloudModels: Record<string, string>; // Selected model per provider
  
  // Actions
  setProvider: (type: AIProviderType, model?: string) => Promise<void>;
  initializeProvider: () => Promise<void>;
  setLocalModel: (modelId: string) => void;
  setCloudApiKey: (provider: string, apiKey: string) => void;
  setCloudModel: (provider: string, modelId: string) => void;
  
  // Chat
  sendMessage: (messages: AIMessage[], onToken?: (token: string) => void) => Promise<string>;
  abortGeneration: () => void;
  
  // Status helpers
  isReady: () => boolean;
  isLoading: () => boolean;
}

export const useAIStore = create<AIStore>()(
  persist(
    (set, get) => ({
      currentProviderId: 'webllm',
      currentModel: null,
      provider: null,
      status: {
        isReady: false,
        isLoading: false,
        progress: 0,
        error: null,
        modelName: null,
      },
      selectedLocalModel: DEFAULT_LOCAL_MODEL,
      cloudApiKeys: {},
      cloudModels: {},

      setProvider: async (type: AIProviderType, model?: string) => {
        const { provider } = get();
        
        // Dispose current provider first and wait a bit for GPU cleanup
        if (provider) {
          try {
            provider.dispose();
            // Give WebGPU time to release resources
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (e) {
            console.warn('[AIStore] Error disposing provider:', e);
          }
        }

        set({ 
          currentProviderId: type,
          currentModel: model || null,
          provider: null,
          status: {
            isReady: false,
            isLoading: false,
            progress: 0,
            error: null,
            modelName: null,
          },
        });
      },

      initializeProvider: async () => {
        const { currentProviderId, selectedLocalModel, cloudApiKeys, cloudModels, provider: existingProvider } = get();

        // Safety fallback for users hydrated from old persisted states.
        if (currentProviderId !== 'webllm' && !CLOUD_PROVIDERS.some((p) => p.id === currentProviderId)) {
          set({ currentProviderId: 'webllm' });
          await get().initializeProvider();
          return;
        }
        
        // Dispose existing provider first
        if (existingProvider) {
          try {
            existingProvider.dispose();
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (e) {
            console.warn('[AIStore] Error disposing existing provider:', e);
          }
        }
        
        set(state => ({
          provider: null,
          status: { ...state.status, isLoading: true, error: null },
        }));

        try {
          let newProvider: AIProvider;

          if (currentProviderId === 'webllm') {
            const { WebLLMProvider } = await import('@/services/ai/providers/WebLLMProvider');
            newProvider = new WebLLMProvider(selectedLocalModel);
          } else {
            const { CloudProvider } = await import('@/services/ai/providers/CloudProvider');
            const apiKey = cloudApiKeys[currentProviderId];
            const model = cloudModels[currentProviderId];
            
            // Use generic factory for all cloud providers
            newProvider = CloudProvider.create(currentProviderId, apiKey, model);
          }

          // Watch for status updates during initialization
          const updateStatus = () => {
            const providerStatus = newProvider.getStatus();
            set({ status: providerStatus });
          };

          // Poll status during loading (for WebLLM progress)
          const statusInterval = setInterval(updateStatus, 100);

          await newProvider.initialize();
          
          clearInterval(statusInterval);

          set({
            provider: newProvider,
            status: newProvider.getStatus(),
          });

          console.log(`[AIStore] Provider initialized: ${newProvider.name}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to initialize AI';
          
          // Check for WebGPU specific errors
          const isWebGPUError = errorMessage.includes('Instance') || 
                               errorMessage.includes('GPUBuffer') ||
                               errorMessage.includes('WebGPU');
          
          set({
            provider: null,
            status: {
              isReady: false,
              isLoading: false,
              progress: 0,
              error: isWebGPUError 
                ? 'Erro de GPU. Recarregue a página e tente novamente.'
                : errorMessage,
              modelName: null,
            },
          });
          console.error('[AIStore] Initialization error:', error);
          throw error;
        }
      },

      setLocalModel: (modelId: string) => {
        set({ selectedLocalModel: modelId });
      },

      setCloudApiKey: (provider: string, apiKey: string) => {
        set(state => ({
          cloudApiKeys: { ...state.cloudApiKeys, [provider]: apiKey },
        }));
      },

      setCloudModel: (provider: string, modelId: string) => {
        set(state => ({
          cloudModels: { ...state.cloudModels, [provider]: modelId },
        }));
      },

      sendMessage: async (messages: AIMessage[], onToken?: (token: string) => void) => {
        const { provider, status } = get();
        
        if (!provider || !status.isReady) {
          throw new Error('AI provider not ready');
        }

        if (onToken) {
          // Streaming mode
          let fullContent = '';
          for await (const token of provider.streamChat({ messages })) {
            fullContent += token;
            onToken(token);
          }
          return fullContent;
        } else {
          // Non-streaming mode
          const result = await provider.chat({ messages });
          return result.content;
        }
      },

      abortGeneration: () => {
        const { provider } = get();
        provider?.abort();
      },

      isReady: () => get().status.isReady,
      isLoading: () => get().status.isLoading,
    }),
    {
      name: 'vibe-code-ai-store',
      partialize: (state) => ({
        currentProviderId: state.currentProviderId,
        selectedLocalModel: state.selectedLocalModel,
        cloudApiKeys: state.cloudApiKeys,
        cloudModels: state.cloudModels,
      }),
    }
  )
);