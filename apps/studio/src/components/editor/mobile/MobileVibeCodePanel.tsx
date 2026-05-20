import { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Sparkles,
  Send,
  Lightbulb,
  Zap,
  Bot,
  User,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { useAIStore } from '@/stores/aiStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AIProviderSelector } from '@/components/editor/AIProviderSelector';
import { VIBE_CODE_SYSTEM_PROMPT, generateSceneContext } from '@/services/ai/prompts';
import { parseAgentActions, executeAllActions, cleanResponseContent, cleanThinkingBlocks } from '@/services/ai/agentActions';

interface MobileVibeCodePanelProps {
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: {
    executed: number;
    failed: number;
    messages: string[];
  };
}

const suggestions = [
  'Adicione um cubo vermelho que gira',
  'Faça o player pular mais alto',
  'Crie 3 plataformas flutuantes',
  'Mude a câmera para primeira pessoa',
];

export const MobileVibeCodePanel = ({ onClose }: MobileVibeCodePanelProps) => {
  const { objects, selectedObjectId } = useEditorStore();
  const { sendMessage, status: aiStatus, initializeProvider, currentProviderId } = useAIStore();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: ' Sou o **Vibe Code AI**, seu agente de jogos 3D!\n\nDescreva o que você quer e eu executo na cena! '
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentMode, setAgentMode] = useState(true);
  const streamingContentRef = useRef<string>('');
  
  const selectedObject = objects.find(obj => obj.id === selectedObjectId);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
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

    if (!aiStatus.isReady) {
      // If we have a provider selected but it's not ready, try to reinitialize
      if (currentProviderId && !aiStatus.isLoading && !aiStatus.error) {
        try {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: ' Reconectando ao modelo de IA...'
          }]);
          await initializeProvider();
          // If initialization succeeded, continue with the message
          if (useAIStore.getState().status.isReady) {
            // Remove the reconnecting message and continue
            setMessages(prev => prev.slice(0, -1));
          } else {
            setIsLoading(false);
            return;
          }
        } catch {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: ' Falha ao reconectar. Tente selecionar outro modelo no seletor de IA.'
          };
          setMessages(prev => [...prev.slice(0, -1), assistantMessage]);
          setIsLoading(false);
          return;
        }
      } else {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiStatus.error 
            ? ` ${aiStatus.error}\n\nTente um modelo menor ou recarregue a página.`
            : ' Carregue um modelo de IA primeiro!\n\nToque no seletor de IA e escolha Local AI ou Cloud.'
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }
    }

    try {
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

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

      // Parse and execute agent actions
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
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: ` Erro ao gerar resposta. Tente carregar um modelo local.`
      }]);
    } finally {
      setIsLoading(false);
      streamingContentRef.current = '';
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const glassStyle = {
    background: 'linear-gradient(135deg, hsl(225 15% 12% / 0.98) 0%, hsl(225 15% 10% / 0.98) 100%)',
    fontFamily: 'Roboto, Noto Sans, sans-serif',
  };

  return (
    <div className="h-full flex flex-col" style={glassStyle}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-muted to-purple-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-white/90">Vibe Code</h2>
            <p className="text-[10px] text-white/40">Agente IA R3F</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Agent Mode Toggle */}
          <button
            onClick={() => setAgentMode(!agentMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all border ${
              agentMode 
                ? "bg-secondary/30 text-muted-foreground border-border" 
                : "bg-white/5 text-white/50 border-white/10"
            }`}
          >
            <Zap className="w-3 h-3" />
            {agentMode ? 'Agente' : 'Chat'}
          </button>
          <AIProviderSelector />
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-all"
          >
            <X className="w-4 h-4 text-white/80" />
          </button>
        </div>
      </div>

      {/* Context Banner */}
      {selectedObject && (
        <div className="px-3 py-2 bg-primary/10 border-b border-primary/20">
          <div className="flex items-center gap-2 text-[11px] text-primary font-medium">
            <Zap className="w-3 h-3" />
            <span>Contexto: <strong>{selectedObject.name}</strong> ({selectedObject.type})</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-white/5 text-white/90 rounded-bl-md border border-white/10'
                }`}
              >
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                
                {/* Show action results */}
                {message.actions && (
                  <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                    {message.actions.executed > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="text-[10px] font-medium">{message.actions.executed} ação(ões)</span>
                      </div>
                    )}
                    {message.actions.failed > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <XCircle className="w-3 h-3" />
                        <span className="text-[10px] font-medium">{message.actions.failed} falha(s)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && streamingContentRef.current === '' && (
            <div className="flex justify-start">
              <div className="bg-white/5 rounded-2xl rounded-bl-md px-3 py-2 border border-white/10">
                <Loader2 className="w-4 h-4 animate-spin text-white/50" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggestions */}
      <div className="px-3 py-2 border-t border-white/10">
        <div className="flex items-center gap-1.5 mb-2">
          <Lightbulb className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-white/40 font-medium">Sugestões</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(suggestion)}
              className="shrink-0 px-2.5 py-1.5 text-[11px] font-medium bg-white/5 hover:bg-white/10 rounded-full text-white/70 transition-all border border-white/10"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Descreva o que você quer criar..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[13px] font-medium text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(210 100% 50%) 100%)',
              boxShadow: '0 4px 12px -2px hsl(var(--primary) / 0.4)',
            }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-primary-foreground" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
