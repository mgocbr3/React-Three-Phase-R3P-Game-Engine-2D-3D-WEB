// WebLLM Provider - Local AI inference in the browser
import type { AIProvider, AIProviderStatus, AICompletionOptions, AICompletionResult, AIMessage } from '../types';
import { DEFAULT_LOCAL_MODEL } from '../types';

// Dynamic import to avoid bundle issues
let webllm: typeof import('@mlc-ai/web-llm') | null = null;
let engineInstance: any = null;

export class WebLLMProvider implements AIProvider {
  id = 'webllm';
  name = 'Local AI (WebLLM)';
  type: 'local' = 'local';
  description = 'AI running locally in your browser - works offline!';
  icon = '';

  private status: AIProviderStatus = {
    isReady: false,
    isLoading: false,
    progress: 0,
    error: null,
    modelName: null,
  };

  private abortController: AbortController | null = null;
  private modelId: string;

  constructor(modelId: string = DEFAULT_LOCAL_MODEL) {
    this.modelId = modelId;
  }

  async initialize(): Promise<void> {
    if (this.status.isReady || this.status.isLoading) return;

    this.status = {
      ...this.status,
      isLoading: true,
      progress: 0,
      error: null,
    };

    try {
      // Check for WebGPU support
      if (!(navigator as any).gpu) {
        throw new Error('WebGPU não é suportado neste navegador. Tente Chrome 113+ ou Edge 113+.');
      }

      // Request GPU adapter to check availability
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (!adapter) {
        throw new Error('Nenhum adaptador GPU disponível. Feche outras abas ou apps que usam GPU.');
      }

      // Dynamic import
      if (!webllm) {
        webllm = await import('@mlc-ai/web-llm');
      }

      // Create engine with progress callback
      engineInstance = await webllm.CreateMLCEngine(this.modelId, {
        initProgressCallback: (report) => {
          this.status = {
            ...this.status,
            progress: report.progress,
          };
          console.log(`[WebLLM] Loading: ${Math.round(report.progress * 100)}% - ${report.text}`);
        },
      });

      // Listen for GPU device lost events
      if (engineInstance?.device) {
        engineInstance.device.lost.then((info: GPUDeviceLostInfo) => {
          console.error('[WebLLM] GPU Device Lost:', info.message);
          this.status = {
            isReady: false,
            isLoading: false,
            progress: 0,
            error: 'GPU perdida. Recarregue a página e tente um modelo menor.',
            modelName: null,
          };
        });
      }

      this.status = {
        isReady: true,
        isLoading: false,
        progress: 1,
        error: null,
        modelName: this.modelId,
      };

      console.log('[WebLLM] Model loaded successfully:', this.modelId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load model';
      
      // Check for GPU-specific errors
      const isGPUError = errorMessage.includes('Device') || 
                         errorMessage.includes('GPU') || 
                         errorMessage.includes('lost') ||
                         errorMessage.includes('memory');
      
      this.status = {
        isReady: false,
        isLoading: false,
        progress: 0,
        error: isGPUError 
          ? 'Erro de GPU/Memória. Tente um modelo menor ou recarregue a página.'
          : errorMessage,
        modelName: null,
      };
      console.error('[WebLLM] Initialization error:', error);
      throw error;
    }
  }

  dispose(): void {
    if (engineInstance) {
      engineInstance.unload?.();
      engineInstance = null;
    }
    this.status = {
      isReady: false,
      isLoading: false,
      progress: 0,
      error: null,
      modelName: null,
    };
  }

  getStatus(): AIProviderStatus {
    return { ...this.status };
  }

  async chat(options: AICompletionOptions): Promise<AICompletionResult> {
    if (!engineInstance || !this.status.isReady) {
      throw new Error('WebLLM engine not initialized');
    }

    const { messages, temperature = 0.7, maxTokens = 1024 } = options;

    const formattedMessages = this.formatMessages(messages);

    const response = await engineInstance.chat.completions.create({
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
      top_p: 0.8, // Recommended for non-thinking mode
    });

    return {
      content: response.choices[0]?.message?.content || '',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }

  async *streamChat(options: AICompletionOptions): AsyncGenerator<string, void, unknown> {
    if (!engineInstance || !this.status.isReady) {
      throw new Error('WebLLM engine not initialized');
    }

    const { messages, temperature = 0.7, maxTokens = 1024 } = options;
    this.abortController = new AbortController();

    const formattedMessages = this.formatMessages(messages);

    const chunks = await engineInstance.chat.completions.create({
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
      top_p: 0.8, // Recommended for non-thinking mode
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of chunks) {
      if (this.abortController?.signal.aborted) {
        break;
      }
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }

    this.abortController = null;
  }

  abort(): void {
    this.abortController?.abort();
    engineInstance?.interruptGenerate?.();
  }

  private formatMessages(messages: AIMessage[]): Array<{ role: string; content: string }> {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }
}
