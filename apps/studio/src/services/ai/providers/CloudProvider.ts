// Cloud AI Provider - Supports multiple cloud APIs
// Ready for: OpenAI, Anthropic, Google, Mistral, Groq, Cohere, Together, Perplexity, DeepSeek, xAI

import type { AIProvider, AIProviderStatus, AICompletionOptions, AICompletionResult, AIMessage, AIProviderType, CLOUD_PROVIDERS } from '../types';

interface CloudProviderConfig {
  type: AIProviderType;
  name: string;
  description: string;
  icon: string;
  baseUrl: string;
  apiKey?: string;
  model?: string;
}

// Provider configurations with their API endpoints
const PROVIDER_CONFIGS: Record<string, Omit<CloudProviderConfig, 'apiKey' | 'model'>> = {
  openai: {
    type: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5 and other OpenAI models',
    icon: '',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
  },
  anthropic: {
    type: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3 and other Anthropic models',
    icon: '',
    baseUrl: 'https://api.anthropic.com/v1/messages',
  },
  google: {
    type: 'google',
    name: 'Google Gemini',
    description: 'Gemini 2.0 Flash, 1.5 Pro and other models',
    icon: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  },
  mistral: {
    type: 'mistral',
    name: 'Mistral AI',
    description: 'Mistral Large, Medium, Small',
    icon: '',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
  },
  groq: {
    type: 'groq',
    name: 'Groq',
    description: 'Llama 3.1, Mixtral (ultra fast)',
    icon: '',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
  },
  cohere: {
    type: 'cohere',
    name: 'Cohere',
    description: 'Command R+, Command R',
    icon: '',
    baseUrl: 'https://api.cohere.ai/v1/chat',
  },
  together: {
    type: 'together',
    name: 'Together AI',
    description: 'Llama, Mixtral, CodeLlama',
    icon: '',
    baseUrl: 'https://api.together.xyz/v1/chat/completions',
  },
  perplexity: {
    type: 'perplexity',
    name: 'Perplexity',
    description: 'Sonar (with web search)',
    icon: '',
    baseUrl: 'https://api.perplexity.ai/chat/completions',
  },
  deepseek: {
    type: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek V3, Coder',
    icon: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
  },
  xai: {
    type: 'xai',
    name: 'xAI (Grok)',
    description: 'Grok 2, Grok 2 Mini',
    icon: '',
    baseUrl: 'https://api.x.ai/v1/chat/completions',
  },
};

export class CloudProvider implements AIProvider {
  id: string;
  name: string;
  type: 'cloud' = 'cloud';
  description: string;
  icon: string;

  private config: CloudProviderConfig;
  private status: AIProviderStatus = {
    isReady: false,
    isLoading: false,
    progress: 0,
    error: null,
    modelName: null,
  };
  private abortController: AbortController | null = null;

  constructor(
    providerType: string,
    apiKey?: string,
    model?: string
  ) {
    const baseConfig = PROVIDER_CONFIGS[providerType];
    if (!baseConfig) {
      throw new Error(`Unknown provider type: ${providerType}`);
    }

    this.config = {
      ...baseConfig,
      apiKey,
      model: model || this.getDefaultModel(providerType),
    };

    this.id = providerType;
    this.name = baseConfig.name;
    this.description = baseConfig.description;
    this.icon = baseConfig.icon;
  }

  private getDefaultModel(type: string): string {
    switch (type) {
      case 'openai':
        return 'gpt-4o';
      case 'anthropic':
        return 'claude-3-5-sonnet-20241022';
      case 'google':
        return 'gemini-2.0-flash';
      case 'mistral':
        return 'mistral-large-latest';
      case 'groq':
        return 'llama-3.1-70b-versatile';
      case 'cohere':
        return 'command-r-plus';
      case 'together':
        return 'meta-llama/Llama-3-70b-chat-hf';
      case 'perplexity':
        return 'sonar-pro';
      case 'deepseek':
        return 'deepseek-chat';
      case 'xai':
        return 'grok-2-latest';
      default:
        return 'gpt-4o';
    }
  }

  async initialize(): Promise<void> {
    // Cloud providers just validate API key exists
    if (!this.config.apiKey) {
      this.status = {
        isReady: false,
        isLoading: false,
        progress: 0,
        error: 'API key not configured',
        modelName: null,
      };
      throw new Error('API key required for cloud provider');
    }

    this.status = {
      isReady: true,
      isLoading: false,
      progress: 1,
      error: null,
      modelName: this.config.model || null,
    };
  }

  dispose(): void {
    this.abort();
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
    if (!this.status.isReady) {
      throw new Error('Provider not initialized');
    }

    const response = await this.makeRequest(options, false);
    return response;
  }

  async *streamChat(options: AICompletionOptions): AsyncGenerator<string, void, unknown> {
    if (!this.status.isReady) {
      throw new Error('Provider not initialized');
    }

    this.abortController = new AbortController();

    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(this.buildRequestBody(options, true)),
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = this.extractContentFromChunk(parsed);
            if (content) {
              yield content;
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }

    this.abortController = null;
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      if (this.config.type === 'anthropic') {
        headers['x-api-key'] = this.config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (this.config.type === 'cohere') {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      } else {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
    }

    return headers;
  }

  private buildRequestBody(options: AICompletionOptions, stream: boolean): any {
    const { messages, temperature = 0.7, maxTokens = 1024 } = options;

    if (this.config.type === 'anthropic') {
      // Anthropic has different format
      const systemMsg = messages.find(m => m.role === 'system');
      const otherMsgs = messages.filter(m => m.role !== 'system');

      return {
        model: this.config.model,
        max_tokens: maxTokens,
        temperature,
        stream,
        system: systemMsg?.content,
        messages: otherMsgs.map(m => ({
          role: m.role,
          content: m.content,
        })),
      };
    }

    if (this.config.type === 'cohere') {
      // Cohere has a different format
      const systemMsg = messages.find(m => m.role === 'system');
      const otherMsgs = messages.filter(m => m.role !== 'system');
      const lastUserMsg = otherMsgs.pop();

      return {
        model: this.config.model,
        message: lastUserMsg?.content || '',
        preamble: systemMsg?.content,
        chat_history: otherMsgs.map(m => ({
          role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
          message: m.content,
        })),
        temperature,
        stream,
      };
    }

    // OpenAI-compatible format (works for most providers)
    return {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature,
      max_tokens: maxTokens,
      stream,
    };
  }

  private extractContentFromChunk(parsed: any): string {
    if (this.config.type === 'anthropic') {
      return parsed.delta?.text || '';
    }
    if (this.config.type === 'cohere') {
      return parsed.text || '';
    }
    return parsed.choices?.[0]?.delta?.content || '';
  }

  private async makeRequest(options: AICompletionOptions, stream: boolean): Promise<AICompletionResult> {
    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(this.buildRequestBody(options, stream)),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (this.config.type === 'anthropic') {
      return {
        content: data.content?.[0]?.text || '',
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        } : undefined,
      };
    }

    if (this.config.type === 'cohere') {
      return {
        content: data.text || '',
        usage: data.meta?.tokens ? {
          promptTokens: data.meta.tokens.input_tokens,
          completionTokens: data.meta.tokens.output_tokens,
          totalTokens: data.meta.tokens.input_tokens + data.meta.tokens.output_tokens,
        } : undefined,
      };
    }

    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  // Static factory methods
  static openai(apiKey: string, model?: string): CloudProvider {
    return new CloudProvider('openai', apiKey, model);
  }

  static anthropic(apiKey: string, model?: string): CloudProvider {
    return new CloudProvider('anthropic', apiKey, model);
  }

  static google(apiKey: string, model?: string): CloudProvider {
    return new CloudProvider('google', apiKey, model);
  }

  static mistral(apiKey: string, model?: string): CloudProvider {
    return new CloudProvider('mistral', apiKey, model);
  }

  static groq(apiKey: string, model?: string): CloudProvider {
    return new CloudProvider('groq', apiKey, model);
  }

  static cohere(apiKey: string, model?: string): CloudProvider {
    return new CloudProvider('cohere', apiKey, model);
  }

  static together(apiKey: string, model?: string): CloudProvider {
    return new CloudProvider('together', apiKey, model);
  }

  static perplexity(apiKey: string, model?: string): CloudProvider {
    return new CloudProvider('perplexity', apiKey, model);
  }

  static deepseek(apiKey: string, model?: string): CloudProvider {
    return new CloudProvider('deepseek', apiKey, model);
  }

  static xai(apiKey: string, model?: string): CloudProvider {
    return new CloudProvider('xai', apiKey, model);
  }

  // Generic factory for any provider
  static create(providerId: string, apiKey?: string, model?: string): CloudProvider {
    return new CloudProvider(providerId, apiKey, model);
  }
}