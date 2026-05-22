import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/legacy/cloud/stores/authStore';
import { cn } from '@/lib/utils';
import { ENGINE_CLOUD_ENABLED } from '@/config/engineMode';

interface CloudSyncBadgeProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * Badge indicando status de sincronização com a nuvem.
 * Verde = logado e sincronizando
 * Amarelo = modo local (sem login)
 */
export const CloudSyncBadge = ({ className, showLabel = true }: CloudSyncBadgeProps) => {
  const { user, isLoading } = useAuthStore();

  if (ENGINE_CLOUD_ENABLED && isLoading) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
        {showLabel && <span className="text-xs text-muted-foreground">Conectando...</span>}
      </div>
    );
  }

  if (ENGINE_CLOUD_ENABLED && user) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Cloud className="w-4 h-4 text-emerald-500" />
        {showLabel && <span className="text-xs text-emerald-500">Nuvem</span>}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <CloudOff className="w-4 h-4 text-amber-500" />
      {showLabel && <span className="text-xs text-amber-500">Local</span>}
    </div>
  );
};
