import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User, Loader2, Wand2, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editorStore';
import { useAIStore } from '@/stores/aiStore';
import { AIProviderSelector } from './AIProviderSelector';
import { VIBE_CODE_SYSTEM_PROMPT, generateSceneContext } from '@/services/ai/prompts';
import { parseAgentActions, executeAllActions, cleanResponseContent, cleanThinkingBlocks } from '@/services/ai/agentActions';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: {
    executed: number;
    failed: number;
    messages: string[];
  };
}

const SUGGESTIONS = [
  "Adicione um cubo vermelho que gira",
  "Faça o player pular mais alto",
  "Crie 3 plataformas flutuantes",
  "Mude a câmera para primeira pessoa",
  "Adicione uma esfera que quica",
];

export const VibeCodePanel = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Olá! Sou o Vibe Code AI. Posso te ajudar com jogos 2D (Phaser) e 3D (Three.js/R3F). Me diga o que você quer construir.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentMode, setAgentMode] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingContentRef = useRef<string>('');
  
  const { sendMessage, status: aiStatus } = useAIStore();
  const { objects } = useEditorStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    streamingContentRef.current = '';

    // Build context-aware messages
    const sceneContext = generateSceneContext(objects);
    const systemPrompt = `${VIBE_CODE_SYSTEM_PROMPT}\n\n---\n\n${sceneContext}`;
    
    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.filter(m => m.id !== '1').map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage.content },
    ];

    // Check if AI is ready
    if (!aiStatus.isReady) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: ' Nenhum modelo de IA carregado!\n\nPara usar o modo agente:\n1. Clique no seletor de IA acima\n2. Escolha **Local AI** e selecione um modelo\n3. Aguarde o download (~1-2 GB)\n\nOu conecte um provedor **Cloud** para resposta imediata!',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
      return;
    }

    try {
      // Create placeholder message for streaming
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }]);

      // Stream response
      await sendMessage(aiMessages, (token) => {
        streamingContentRef.current += token;
        // Clean thinking blocks during streaming for cleaner display
        const displayContent = cleanThinkingBlocks(streamingContentRef.current);
        setMessages(prev => prev.map(msg => 
          msg.id === assistantId 
            ? { ...msg, content: displayContent }
            : msg
        ));
      });

      // After streaming completes, parse and execute agent actions
      const fullContent = streamingContentRef.current;
      
      if (agentMode) {
        const actions = parseAgentActions(fullContent);
        
        if (actions.length > 0) {
          const results = executeAllActions(actions);
          const cleanContent = cleanResponseContent(fullContent);
          
          setMessages(prev => prev.map(msg => 
            msg.id === assistantId 
              ? { 
                  ...msg, 
                  content: cleanContent || fullContent,
                  actions: results,
                }
              : msg
          ));
        }
      }
    } catch (error) {
      console.error('AI Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar resposta';
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: ` ${errorMessage}\n\nTente carregar um modelo local ou conectar um provedor cloud.`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      streamingContentRef.current = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - Clean like other panels */}
      <div className="p-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">Vibe Code AI</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Agent Mode Toggle */}
          <button
            onClick={() => setAgentMode(!agentMode)}
            className={cn(
              "flex items-center gap-1 rounded-sm border px-2 py-1 text-[10px] transition-colors",
              agentMode 
                ? "border-[var(--editor-border-light)] bg-[var(--editor-command-active)] text-foreground"
                : "border-border bg-[var(--editor-command)] text-muted-foreground"
            )}
            title={agentMode ? "Modo Agente: Executa ações automaticamente" : "Modo Chat: Apenas responde"}
          >
            <Zap className="w-3 h-3" />
            {agentMode ? 'Agente' : 'Chat'}
          </button>
          <AIProviderSelector />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-2',
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            <div className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center border border-[var(--editor-command-border)]',
              message.role === 'user' 
                ? 'bg-[var(--editor-command-active)] text-foreground'
                : 'bg-[var(--editor-command)] text-muted-foreground'
            )}>
              {message.role === 'user' ? (
                <User className="w-3 h-3" />
              ) : (
                <Bot className="w-3 h-3" />
              )}
            </div>
            <div className={cn(
              'max-w-[85%] border px-3 py-2 text-xs',
              message.role === 'user'
                ? 'border-[var(--editor-border-light)] bg-[var(--editor-command-active)] text-foreground'
                : 'border-[var(--editor-border-dark)] bg-[var(--editor-panel-sunken)] text-foreground'
            )}>
              <p className="whitespace-pre-wrap">{message.content}</p>
              
              {/* Show action results */}
              {message.actions && (
                <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                  {message.actions.executed > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="text-[10px]">{message.actions.executed} ação(ões) executada(s)</span>
                    </div>
                  )}
                  {message.actions.failed > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <XCircle className="w-3 h-3" />
                      <span className="text-[10px]">{message.actions.failed} falha(s)</span>
                    </div>
                  )}
                </div>
              )}
              
              <span className="text-[9px] opacity-50 mt-1 block">
                {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        
        {isLoading && streamingContentRef.current === '' && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 items-center justify-center border border-[var(--editor-command-border)] bg-[var(--editor-command)]">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            </div>
            <div className="border border-[var(--editor-border-dark)] bg-[var(--editor-panel-sunken)] px-3 py-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce bg-muted-foreground" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce bg-muted-foreground" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce bg-muted-foreground" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
            <Wand2 className="w-3 h-3" /> Sugestões rápidas
          </p>
          <div className="flex flex-wrap gap-1">
            {SUGGESTIONS.slice(0, 3).map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSuggestion(suggestion)}
                className="max-w-full truncate border border-[var(--editor-command-border)] bg-[var(--editor-command)] px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-[var(--editor-row-hover)] hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-[var(--editor-panel-header)] p-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            placeholder="Descreva o que quer fazer..."
            rows={1}
            className="min-h-[36px] max-h-[100px] flex-1 resize-none border border-[var(--editor-border-dark)] bg-[var(--editor-panel-sunken)] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 100) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              'border p-2 transition-colors',
              input.trim() && !isLoading
                ? 'border-[var(--editor-command-border)] bg-[var(--editor-command)] text-foreground hover:bg-[var(--editor-command-hover)]'
                : 'cursor-not-allowed border-[var(--editor-command-border)] bg-muted text-muted-foreground'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5 text-center">
          Enter para enviar • Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
};
