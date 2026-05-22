import { useState } from 'react';
import { AlertTriangle, Cloud, X, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/legacy/cloud/stores/authStore';
import { AuthModal } from '@/components/auth/AuthModal';
import { cn } from '@/lib/utils';
import { ENGINE_CLOUD_ENABLED } from '@/config/engineMode';

interface LocalModeWarningProps {
  className?: string;
}

/**
 * Aviso visual quando o usuário está usando o editor sem login.
 * Projetos são salvos apenas localmente (perdem ao trocar navegador/dispositivo).
 */
export const LocalModeWarning = ({ className }: LocalModeWarningProps) => {
  const { user } = useAuthStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Não mostra se logado ou se o usuário dispensou
  if (!ENGINE_CLOUD_ENABLED || user || isDismissed) return null;

  return (
    <>
      <div
        className={cn(
          'fixed bottom-20 left-1/2 -translate-x-1/2 z-50',
          'flex items-center gap-3 px-4 py-3 rounded-xl',
          'bg-secondary/30 border border-border backdrop-blur-md',
          'shadow-lg shadow-amber-500/10',
          'animate-in slide-in-from-bottom-4 duration-300',
          className
        )}
      >
        <AlertTriangle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            Modo Local
          </span>
          <span className="text-xs text-muted-foreground">
            Projetos salvos apenas neste navegador
          </span>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => setAuthModalOpen(true)}
            className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salvar na Nuvem</span>
            <span className="sm:hidden">Entrar</span>
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsDismissed(true)}
            className="w-7 h-7 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </>
  );
};
