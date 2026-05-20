// AI Provider Types for Vibe Code
// Supports local (WebLLM) and cloud providers (OpenAI, Anthropic, Google, etc.)

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface AICompletionOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onToken?: (token: string) => void;
  tools?: AITool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface AICompletionResult {
  content: string;
  toolCalls?: AIToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProviderStatus {
  isReady: boolean;
  isLoading: boolean;
  progress: number;
  error: string | null;
  modelName: string | null;
}

export interface AIProvider {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  description: string;
  icon: string;
  
  // Lifecycle
  initialize(): Promise<void>;
  dispose(): void;
  
  // Status
  getStatus(): AIProviderStatus;
  
  // Chat
  chat(options: AICompletionOptions): Promise<AICompletionResult>;
  streamChat(options: AICompletionOptions): AsyncGenerator<string, void, unknown>;
  
  // Abort
  abort(): void;
}

export type AIProviderType = 
  | 'webllm'      // Local - WebLLM (browser)
  | 'lovable'     // Cloud - Lovable AI Gateway (Premium)
  | 'openai'      // Cloud - OpenAI API
  | 'anthropic'   // Cloud - Anthropic API
  | 'google'      // Cloud - Google Gemini API
  | 'mistral'     // Cloud - Mistral API
  | 'groq'        // Cloud - Groq API
  | 'cohere'      // Cloud - Cohere API
  | 'together'    // Cloud - Together AI API
  | 'perplexity'  // Cloud - Perplexity API
  | 'deepseek'    // Cloud - DeepSeek API
  | 'xai'         // Cloud - xAI (Grok) API
  | 'ollama';     // Local - Ollama (localhost)

export interface AIProviderConfig {
  type: AIProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

// Available local models for WebLLM (FREE)
export const LOCAL_MODELS = [
  {
    id: 'Qwen3-4B-q4f16_1-MLC',
    name: 'Qwen 3 (4B)',
    size: '2.5 GB',
    description: 'Alibaba\'s newest model, excellent for code',
    recommended: true,
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    name: 'Phi 3.5 Mini (3.8B)',
    size: '2.3 GB',
    description: 'Fast, lightweight model ideal for code assistance',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 (3B)',
    size: '1.8 GB',
    description: 'Meta\'s efficient instruction-tuned model',
  },
  {
    id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 (1.7B)',
    size: '1.1 GB',
    description: 'Fast option for most devices',
  },
  {
    id: 'Qwen3-0.6B-q4f16_1-MLC',
    name: 'Qwen 3 (0.6B)',
    size: '0.4 GB',
    description: 'Ultra-leve! Roda em PCs fracos',
    lightweight: true,
  },
  {
    id: 'SmolLM2-360M-Instruct-q4f32_1-MLC',
    name: 'SmolLM2 (360M) ',
    size: '0.2 GB',
    description: 'Mais leve! Ideal para PCs fracos',
    lightweight: true,
  },
] as const;

export const DEFAULT_LOCAL_MODEL = 'Qwen3-4B-q4f16_1-MLC';

// Cloud providers with their models (Bring Your Own Key)
export interface CloudProviderInfo {
  id: AIProviderType;
  name: string;
  description: string;
  baseUrl: string;
  models: { id: string; name: string; description: string; default?: boolean }[];
  keyPlaceholder: string;
  docsUrl: string;
}

export const CLOUD_PROVIDERS: CloudProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4 Turbo, o1',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    keyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Mais capaz e rápido', default: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Rápido e econômico' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Alta capacidade' },
      { id: 'o1-preview', name: 'o1 Preview', description: 'Raciocínio avançado' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Opus, Haiku',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Melhor para código', default: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Mais inteligente' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Mais rápido' },
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini 2.0, 1.5 Pro/Flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyPlaceholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Rápido e capaz', default: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Mais inteligente' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Balanceado' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'Mistral Large, Medium, Small',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    keyPlaceholder: 'your-api-key',
    docsUrl: 'https://console.mistral.ai/api-keys',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Mais capaz', default: true },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Balanceado' },
      { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Rápido' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Llama 3.1, Mixtral (ultra rápido)',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    keyPlaceholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', description: 'Mais capaz', default: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Ultra rápido' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Bom custo-benefício' },
    ],
  },
  {
    id: 'cohere',
    name: 'Cohere',
    description: 'Command R+, Command R',
    baseUrl: 'https://api.cohere.ai/v1/chat',
    keyPlaceholder: 'your-api-key',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
    models: [
      { id: 'command-r-plus', name: 'Command R+', description: 'Mais capaz', default: true },
      { id: 'command-r', name: 'Command R', description: 'Balanceado' },
    ],
  },
  {
    id: 'together',
    name: 'Together AI',
    description: 'Llama, Mixtral, CodeLlama',
    baseUrl: 'https://api.together.xyz/v1/chat/completions',
    keyPlaceholder: 'your-api-key',
    docsUrl: 'https://api.together.xyz/settings/api-keys',
    models: [
      { id: 'meta-llama/Llama-3-70b-chat-hf', name: 'Llama 3 70B', description: 'Mais capaz', default: true },
      { id: 'codellama/CodeLlama-34b-Instruct-hf', name: 'CodeLlama 34B', description: 'Especialista em código' },
      { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B', description: 'Balanceado' },
    ],
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    description: 'Sonar (com busca na web)',
    baseUrl: 'https://api.perplexity.ai/chat/completions',
    keyPlaceholder: 'pplx-...',
    docsUrl: 'https://www.perplexity.ai/settings/api',
    models: [
      { id: 'sonar-pro', name: 'Sonar Pro', description: 'Com busca na web', default: true },
      { id: 'sonar', name: 'Sonar', description: 'Busca rápida' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek V3, Coder',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    keyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', description: 'Mais capaz', default: true },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', description: 'Especialista em código' },
    ],
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    description: 'Grok 2, Grok 2 Mini',
    baseUrl: 'https://api.x.ai/v1/chat/completions',
    keyPlaceholder: 'xai-...',
    docsUrl: 'https://console.x.ai/',
    models: [
      { id: 'grok-2-latest', name: 'Grok 2', description: 'Mais capaz', default: true },
      { id: 'grok-2-mini', name: 'Grok 2 Mini', description: 'Rápido' },
    ],
  },
];

// Lovable AI (Premium)
export const LOVABLE_AI_MODELS = [
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Rápido e capaz', default: true },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Balanceado' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', description: 'OpenAI eficiente' },
];