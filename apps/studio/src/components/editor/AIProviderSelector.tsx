// AI Provider Selector - Organized into FREE (Local), PREMIUM (Lovable), and BYOK (Bring Your Own Key)
import { useState, useRef, useEffect } from 'react';
import { 
  Cpu, 
  Check, 
  Loader2, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Wifi,
  WifiOff,
  Key,
  Crown,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIStore } from '@/stores/aiStore';
import { LOCAL_MODELS, CLOUD_PROVIDERS, LOVABLE_AI_MODELS, type AIProviderType } from '@/services/ai/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

export const AIProviderSelector = () => {
  const { 
    currentProviderId, 
    status, 
    selectedLocalModel,
    setProvider, 
    initializeProvider,
    setLocalModel,
    setCloudApiKey,
    setCloudModel,
    cloudApiKeys,
    cloudModels,
  } = useAIStore();

  const [isOpen, setIsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setExpandedSection(null);
        setExpandedProvider(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLocalModel = async (modelId: string) => {
    setLocalModel(modelId);
    setIsOpen(false);
    setExpandedSection(null);
    await setProvider('webllm');
    await initializeProvider();
  };

  const handleSelectLovableModel = async (modelId: string) => {
    setCloudModel('lovable', modelId);
    setIsOpen(false);
    setExpandedSection(null);
    await setProvider('lovable');
    await initializeProvider();
  };

  const handleSelectCloudProvider = async (providerId: string) => {
    const hasKey = cloudApiKeys[providerId];
    
    if (!hasKey) {
      setPendingProvider(providerId);
      setShowApiKeyDialog(true);
      return;
    }

    // Show models submenu
    setExpandedProvider(expandedProvider === providerId ? null : providerId);
  };

  const handleSelectCloudModel = async (providerId: string, modelId: string) => {
    setCloudModel(providerId, modelId);
    setIsOpen(false);
    setExpandedSection(null);
    setExpandedProvider(null);
    await setProvider(providerId as AIProviderType);
    await initializeProvider();
  };

  const handleApiKeySubmit = async () => {
    if (!pendingProvider || !apiKeyInput.trim()) return;
    
    setCloudApiKey(pendingProvider, apiKeyInput.trim());
    setShowApiKeyDialog(false);
    setApiKeyInput('');
    
    // After saving key, expand the provider to show models
    setExpandedProvider(pendingProvider);
    setPendingProvider(null);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
    setExpandedProvider(null);
  };

  const StatusIcon = () => {
    if (status.isLoading) {
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />;
    }
    if (status.isReady) {
      return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
    }
    if (status.error) {
      return <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />;
    }
    return <WifiOff className="w-3.5 h-3.5 text-[#6a6a7a]" />;
  };

  const getDisplayText = () => {
    if (status.isLoading) return 'Carregando...';
    if (status.isReady && status.modelName) {
      const shortName = status.modelName.split('/').pop()?.split('-')[0] || status.modelName;
      return shortName.length > 10 ? shortName.slice(0, 10) + '…' : shortName;
    }
    return 'Selecionar IA';
  };

  const pendingProviderInfo = CLOUD_PROVIDERS.find(p => p.id === pendingProvider);

  return (
    <>
      <div ref={menuRef} className="relative">
        {/* Trigger Button */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-[13px] transition-colors",
            isOpen 
              ? "bg-secondary text-foreground" 
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            status.isLoading && "animate-pulse"
          )}
        >
          <StatusIcon />
          <span>{getDisplayText()}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full right-0 mt-1.5 w-72 bg-[#1e1e2e] border border-[#3a3a4a] rounded-xl shadow-2xl shadow-black/50 py-1.5 z-50 max-h-[70vh] overflow-y-auto">
            {/* Header */}
            <div className="px-3 py-1.5 text-[11px] font-medium text-[#6a6a7a]">
              Provedor de IA
            </div>

            {/* Loading Progress */}
            {status.isLoading && (
              <div className="px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[#a0a0b0]">Carregando modelo...</span>
                  <span className="text-[#e0e0e8]">{Math.round(status.progress * 100)}%</span>
                </div>
                <Progress value={status.progress * 100} className="h-1" />
              </div>
            )}

            {/* Error */}
            {status.error && (
              <div className="mx-3 my-1.5 px-2 py-1.5 text-[11px] text-muted-foreground bg-secondary/30 rounded-lg">
                {status.error}
              </div>
            )}

            <div className="h-px bg-[#3a3a4a] my-1.5 mx-3" />

            {/* ========== FREE SECTION ========== */}
            <button
              onClick={() => toggleSection('free')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2a2a3a] transition-colors"
            >
              <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="flex-1 text-[11px] font-medium text-muted-foreground">
                Grátis (Offline)
              </span>
              <ChevronRight className={cn("w-3.5 h-3.5 text-[#6a6a7a] transition-transform", expandedSection === 'free' && "rotate-90")} />
            </button>

            {expandedSection === 'free' && (
              <div className="bg-[#16161e] mx-2 mb-1 rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] text-[#6a6a7a] bg-[#1a1a24] flex items-center gap-1.5">
                  <Cpu className="w-3 h-3" />
                  Roda no seu navegador • Sem custo
                </div>
                
                {LOCAL_MODELS.map(model => {
                  const isSelected = selectedLocalModel === model.id;
                  const isActiveAndReady = isSelected && currentProviderId === 'webllm' && status.isReady;
                  const isDownloading = isSelected && currentProviderId === 'webllm' && status.isLoading;
                  
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleSelectLocalModel(model.id)}
                      disabled={isDownloading}
                      className={cn(
                        "w-full flex flex-col gap-0.5 px-3 py-2 text-left transition-colors",
                        isDownloading 
                          ? "text-[#6a6a7a] cursor-not-allowed" 
                          : "text-[#e0e0e8] hover:bg-[#2a2a3a]"
                      )}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {isDownloading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        ) : isActiveAndReady ? (
                          <Check className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-[#6a6a7a]" />
                        )}
                        <span className="flex-1 text-[12px]">{model.name}</span>
                        {isActiveAndReady && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/30 text-muted-foreground">Ativo</span>
                        )}
                        {isDownloading && (
                          <span className="text-[10px] text-muted-foreground">{Math.round(status.progress * 100)}%</span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#6a6a7a] pl-5">
                        ~{model.size} • {model.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="h-px bg-[#3a3a4a] my-1.5 mx-3" />

            {/* ========== PREMIUM SECTION ========== */}
            <button
              onClick={() => toggleSection('premium')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2a2a3a] transition-colors"
            >
              <Crown className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="flex-1 text-[11px] font-medium text-muted-foreground">
                Premium (Assinantes)
              </span>
              <ChevronRight className={cn("w-3.5 h-3.5 text-[#6a6a7a] transition-transform", expandedSection === 'premium' && "rotate-90")} />
            </button>

            {expandedSection === 'premium' && (
              <div className="bg-[#16161e] mx-2 mb-1 rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] text-[#6a6a7a] bg-[#1a1a24] flex items-center gap-1.5">
                  <Wifi className="w-3 h-3" />
                  Lovable AI • Gemini & GPT
                </div>
                
                {LOVABLE_AI_MODELS.map(model => {
                  const isActive = currentProviderId === 'lovable' && cloudModels['lovable'] === model.id && status.isReady;
                  
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleSelectLovableModel(model.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-[#e0e0e8] hover:bg-[#2a2a3a] transition-colors"
                    >
                      {isActive ? (
                        <Check className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <div className="w-3.5 h-3.5" />
                      )}
                      <span className="flex-1 text-[12px]">{model.name}</span>
                      {isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/30 text-muted-foreground">Ativo</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="h-px bg-[#3a3a4a] my-1.5 mx-3" />

            {/* ========== BRING YOUR OWN KEY SECTION ========== */}
            <button
              onClick={() => toggleSection('byok')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2a2a3a] transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="flex-1 text-[11px] font-medium text-muted-foreground">
                Sua API Key
              </span>
              <ChevronRight className={cn("w-3.5 h-3.5 text-[#6a6a7a] transition-transform", expandedSection === 'byok' && "rotate-90")} />
            </button>

            {expandedSection === 'byok' && (
              <div className="bg-[#16161e] mx-2 mb-1 rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] text-[#6a6a7a] bg-[#1a1a24]">
                  Use sua própria API key
                </div>
                
                {CLOUD_PROVIDERS.map(provider => {
                  const hasKey = !!cloudApiKeys[provider.id];
                  const isActive = currentProviderId === provider.id && status.isReady;
                  const isExpanded = expandedProvider === provider.id;
                  
                  return (
                    <div key={provider.id}>
                      <button
                        onClick={() => handleSelectCloudProvider(provider.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[#e0e0e8] hover:bg-[#2a2a3a] transition-colors"
                      >
                        {hasKey ? (
                          <Check className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <Key className="w-3.5 h-3.5 text-[#6a6a7a]" />
                        )}
                        <span className="flex-1 text-[12px]">{provider.name}</span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/30 text-muted-foreground">Ativo</span>
                        )}
                        {hasKey && (
                          <ChevronRight className={cn("w-3 h-3 text-[#6a6a7a] transition-transform", isExpanded && "rotate-90")} />
                        )}
                      </button>

                      {/* Models submenu */}
                      {isExpanded && hasKey && (
                        <div className="bg-[#1a1a24] border-l-2 border-border ml-4 mr-2 mb-1 rounded-r-lg">
                          {provider.models.map(model => {
                            const isModelActive = isActive && cloudModels[provider.id] === model.id;
                            
                            return (
                              <button
                                key={model.id}
                                onClick={() => handleSelectCloudModel(provider.id, model.id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[#c0c0d0] hover:bg-[#2a2a3a] transition-colors"
                              >
                                {isModelActive ? (
                                  <Check className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                  <div className="w-3 h-3" />
                                )}
                                <span className="flex-1 text-[11px]">{model.name}</span>
                                <span className="text-[9px] text-[#6a6a7a]">{model.description}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Current Status Footer */}
            {status.isReady && (
              <>
                <div className="h-px bg-[#3a3a4a] my-1.5 mx-3" />
                <div className="px-3 py-1.5 text-[10px] text-[#6a6a7a]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span>Ativo:</span>
                    <span className="text-[#e0e0e8] truncate">{status.modelName}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent className="bg-[#1e1e2e] border-[#3a3a4a]">
          <DialogHeader>
            <DialogTitle className="text-[#e0e0e8] flex items-center gap-2">
              <Key className="w-5 h-5 text-muted-foreground" />
              Configurar {pendingProviderInfo?.name}
            </DialogTitle>
            <DialogDescription className="text-[#a0a0b0]">
              Insira sua API key para usar {pendingProviderInfo?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Input
              type="password"
              placeholder={pendingProviderInfo?.keyPlaceholder || 'sua-api-key'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApiKeySubmit()}
              className="bg-[#2a2a3a] border-[#3a3a4a] text-[#e0e0e8]"
            />
            <div className="flex items-center gap-2 text-[11px] text-[#6a6a7a]">
              <span>Obter API key:</span>
              <a 
                href={pendingProviderInfo?.docsUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-muted-foreground hover:underline"
              >
                {pendingProviderInfo?.docsUrl?.replace('https://', '').split('/')[0]}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[10px] text-[#6a6a7a]">
               Sua API key é salva apenas localmente no seu navegador.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowApiKeyDialog(false)} 
              className="border-[#3a3a4a] text-[#a0a0b0] hover:bg-[#2a2a3a]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleApiKeySubmit} 
              disabled={!apiKeyInput.trim()} 
              className="bg-sky-600 hover:bg-sky-700"
            >
              Salvar API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
