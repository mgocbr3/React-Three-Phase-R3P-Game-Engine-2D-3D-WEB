import { useEffect, useState } from 'react';
import { useAutoSaveStore } from '@/stores/autoSaveStore';
import { useAuthStore } from '@/legacy/cloud/stores/authStore';
import { Check, AlertCircle, Loader2, Clock, Cloud, CloudOff } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ENGINE_CLOUD_ENABLED } from '@/config/engineMode';

export const SaveStatusIndicator = () => {
  const { lastSaveStatus, lastSaveTime, saveMessage, getAllVersions } = useAutoSaveStore();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const versions = getAllVersions();

  const isCloudMode = ENGINE_CLOUD_ENABLED && !!user;

  const getIcon = () => {
    switch (lastSaveStatus) {
      case 'saving':
        return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
      case 'saved':
        return isCloudMode 
          ? <Cloud className="w-4 h-4 text-muted-foreground" />
          : <Check className="w-4 h-4 text-muted-foreground" />;
      case 'unsaved':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
      default:
        return isCloudMode 
          ? <Cloud className="w-4 h-4 text-muted-foreground" />
          : <CloudOff className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getBackgroundColor = () => {
    switch (lastSaveStatus) {
      case 'saving':
        return 'bg-secondary/30';
      case 'saved':
        return isCloudMode ? 'bg-secondary/30' : 'bg-secondary/30';
      case 'unsaved':
        return 'bg-secondary/30';
      case 'error':
        return 'bg-secondary/30';
      default:
        return 'bg-gray-500/10';
    }
  };

  const getModeLabel = () => {
    if (isCloudMode) {
      return saveMessage || ' Nuvem';
    }
    return saveMessage || ' Local';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-2 font-medium',
            getBackgroundColor(),
            lastSaveStatus === 'saving' && 'animate-pulse'
          )}
        >
          {getIcon()}
          <span className="text-xs hidden sm:inline">{getModeLabel()}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          {/* Current Status */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Status de Salvamento</h3>
            <div className="flex items-center gap-2 p-2 rounded bg-secondary/50">
              {getIcon()}
              <div>
                <p className="text-sm font-medium">{getModeLabel()}</p>
                {lastSaveTime && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(lastSaveTime).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
            
            {/* Mode explanation */}
            <div className={cn(
              'mt-2 p-2 rounded text-xs',
              isCloudMode ? 'bg-secondary/30 text-emerald-700 dark:text-muted-foreground' : 'bg-secondary/30 text-amber-700 dark:text-muted-foreground'
            )}>
              {isCloudMode ? (
                <>
                  <Cloud className="w-3.5 h-3.5 inline mr-1" />
                  Seus projetos estão sincronizados na nuvem
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 inline mr-1" />
                  Projetos salvos apenas neste navegador. Faça login para sincronizar.
                </>
              )}
            </div>
          </div>

          {/* Version History */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Histórico de Versões ({versions.length})</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {versions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhuma versão salva ainda
                </p>
              ) : (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-secondary/50 transition-colors text-xs"
                  >
                    <div>
                      <p className="font-medium">{version.name}</p>
                      <p className="text-muted-foreground">
                        {new Date(version.timestamp).toLocaleString('pt-BR')}
                        {version.autoSaved && ' (auto)'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        // Aqui você implementaria a restauração
                        console.log('Restaurar versão:', version.id);
                      }}
                    >
                      Restaurar
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tip */}
          <div className="bg-secondary/30 p-2 rounded border border-border">
            <p className="text-xs text-muted-foreground">
               Auto-save ativo a cada 30 segundos. Manual: Ctrl+S / Cmd+S
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
