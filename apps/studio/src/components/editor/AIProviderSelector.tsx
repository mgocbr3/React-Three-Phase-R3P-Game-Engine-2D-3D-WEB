// AI Provider Selector - Organized into FREE (Local) and BYOK (Bring Your Own Key)
import { useCallback, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Cpu, 
  Check, 
  Loader2, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  WifiOff,
  Key,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIStore } from '@/stores/aiStore';
import { LOCAL_MODELS, CLOUD_PROVIDERS, type AIProviderType } from '@/services/ai/types';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setExpandedSection(null);
    setExpandedProvider(null);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const gap = 6;
    const width = Math.min(288, Math.max(240, window.innerWidth - margin * 2));
    const below = window.innerHeight - rect.bottom - margin - gap;
    const above = rect.top - margin - gap;
    const opensUp = below < 180 && above > below;
    const maxHeight = Math.max(180, Math.min(560, opensUp ? above : below));
    const top = opensUp
      ? Math.max(margin, rect.top - gap - maxHeight)
      : Math.min(rect.bottom + gap, window.innerHeight - margin - maxHeight);
    const left = Math.min(
      Math.max(margin, rect.right - width),
      Math.max(margin, window.innerWidth - margin - width)
    );
    setMenuPosition({ left, top, width, maxHeight });
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeMenu]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  useLayoutEffect(() => {
    if (isOpen) updateMenuPosition();
  }, [expandedSection, expandedProvider, isOpen, status.error, status.isLoading, updateMenuPosition]);

  const handleSelectLocalModel = async (modelId: string) => {
    setLocalModel(modelId);
    closeMenu();
    await setProvider('webllm');
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
    closeMenu();
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
    return <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />;
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
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "ai-service-trigger editor-command-chip flex h-7 items-center gap-1.5 px-2 text-xs font-semibold transition-colors",
            isOpen 
              ? "is-open text-foreground"
              : "text-muted-foreground hover:text-foreground",
            status.isLoading && "animate-pulse"
          )}
        >
          <StatusIcon />
          <span>{getDisplayText()}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && menuPosition && typeof document !== 'undefined' && createPortal(
          <div
            ref={dropdownRef}
            className="ai-service-card fixed z-[100]"
            style={{ left: menuPosition.left, top: menuPosition.top, width: menuPosition.width }}
          >
            <div
              className="ai-service-card-content editor-menu-dropdown overflow-y-auto py-1.5"
              style={{ maxHeight: menuPosition.maxHeight }}
            >
            {/* Header */}
            <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
              Provedor de IA
            </div>

            {/* Loading Progress */}
            {status.isLoading && (
              <div className="px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">Carregando modelo...</span>
                  <span className="text-foreground">{Math.round(status.progress * 100)}%</span>
                </div>
                <Progress value={status.progress * 100} className="h-1" />
              </div>
            )}

            {/* Error */}
            {status.error && (
              <div className="mx-3 my-1.5 border border-border bg-[var(--editor-panel-sunken)] px-2 py-1.5 text-[11px] text-muted-foreground">
                {status.error}
              </div>
            )}

            <div className="mx-3 my-1.5 h-px bg-[var(--editor-border-dark)]" />

            {/* ========== FREE SECTION ========== */}
            <button
              onClick={() => toggleSection('free')}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[var(--editor-row-hover)]"
            >
              <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="flex-1 text-[11px] font-medium text-muted-foreground">
                Grátis (Offline)
              </span>
              <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", expandedSection === 'free' && "rotate-90")} />
            </button>

            {expandedSection === 'free' && (
              <div className="mx-2 mb-1 overflow-hidden border border-[var(--editor-border-dark)] bg-[var(--editor-panel-sunken)]">
                <div className="flex items-center gap-1.5 bg-[var(--editor-panel-header)] px-3 py-1.5 text-[10px] text-muted-foreground">
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
                          ? "cursor-not-allowed text-muted-foreground"
                          : "text-foreground hover:bg-[var(--editor-row-hover)]"
                      )}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {isDownloading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        ) : isActiveAndReady ? (
                          <Check className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="flex-1 text-[12px]">{model.name}</span>
                        {isActiveAndReady && (
                          <span className="bg-[var(--editor-command)] px-1.5 py-0.5 text-[9px] text-muted-foreground">Ativo</span>
                        )}
                        {isDownloading && (
                          <span className="text-[10px] text-muted-foreground">{Math.round(status.progress * 100)}%</span>
                        )}
                      </div>
                      <div className="pl-5 text-[10px] text-muted-foreground">
                        ~{model.size} • {model.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mx-3 my-1.5 h-px bg-[var(--editor-border-dark)]" />

            {/* ========== BRING YOUR OWN KEY SECTION ========== */}
            <button
              onClick={() => toggleSection('byok')}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[var(--editor-row-hover)]"
            >
              <Key className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="flex-1 text-[11px] font-medium text-muted-foreground">
                Sua API Key
              </span>
              <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", expandedSection === 'byok' && "rotate-90")} />
            </button>

            {expandedSection === 'byok' && (
              <div className="mx-2 mb-1 overflow-hidden border border-[var(--editor-border-dark)] bg-[var(--editor-panel-sunken)]">
                <div className="bg-[var(--editor-panel-header)] px-3 py-1.5 text-[10px] text-muted-foreground">
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
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground transition-colors hover:bg-[var(--editor-row-hover)]"
                      >
                        {hasKey ? (
                          <Check className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <Key className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="flex-1 text-[12px]">{provider.name}</span>
                        {isActive && (
                          <span className="bg-[var(--editor-command)] px-1.5 py-0.5 text-[9px] text-muted-foreground">Ativo</span>
                        )}
                        {hasKey && (
                          <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                        )}
                      </button>

                      {/* Models submenu */}
                      {isExpanded && hasKey && (
                        <div className="ml-4 mr-2 mb-1 border-l-2 border-border bg-[var(--editor-panel-header)]">
                          {provider.models.map(model => {
                            const isModelActive = isActive && cloudModels[provider.id] === model.id;
                            
                            return (
                              <button
                                key={model.id}
                                onClick={() => handleSelectCloudModel(provider.id, model.id)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-foreground transition-colors hover:bg-[var(--editor-row-hover)]"
                              >
                                {isModelActive ? (
                                  <Check className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                  <div className="w-3 h-3" />
                                )}
                                <span className="flex-1 text-[11px]">{model.name}</span>
                                <span className="text-[9px] text-muted-foreground">{model.description}</span>
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
                <div className="mx-3 my-1.5 h-px bg-[var(--editor-border-dark)]" />
                <div className="px-3 py-1.5 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-[var(--editor-command-highlight)]" />
                    <span>Ativo:</span>
                    <span className="truncate text-foreground">{status.modelName}</span>
                  </div>
                </div>
              </>
            )}
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Key className="w-5 h-5 text-muted-foreground" />
              Configurar {pendingProviderInfo?.name}
            </DialogTitle>
            <DialogDescription>
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
              className="text-foreground"
            />
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
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
            <p className="text-[10px] text-muted-foreground">
               Sua API key é salva apenas localmente no seu navegador.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowApiKeyDialog(false)} 
              className="text-muted-foreground"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleApiKeySubmit} 
              disabled={!apiKeyInput.trim()} 
              className="text-foreground"
            >
              Salvar API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
