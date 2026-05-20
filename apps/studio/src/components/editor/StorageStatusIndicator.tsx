/**
 * Storage Status Indicator
 * 
 * Shows localStorage usage and warns when approaching limits
 * Part of Phase 1: Critical Stabilization (Implementation Roadmap)
 */

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';
import { storageManager } from '@/services/storageManager';

export function StorageStatusIndicator() {
  const [stats, setStats] = useState<{
    used: number;
    available: number;
    percentUsed: number;
    keys: string[];
  } | null>(null);

  useEffect(() => {
    // Update stats every 5 seconds
    const updateStats = () => {
      try {
        const currentStats = storageManager.getStorageStats();
        setStats(currentStats);
      } catch (error) {
        console.error('[StorageStatus] Error getting stats:', error);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const usedMB = stats.used / 1024 / 1024;
  const totalMB = 4.5; // MAX_LOCALSTORAGE_SIZE
  const percentUsed = stats.percentUsed;

  // Determine status
  const getStatus = () => {
    if (percentUsed < 50) return { icon: CheckCircle, color: 'text-muted-foreground', label: 'Normal' };
    if (percentUsed < 80) return { icon: HardDrive, color: 'text-muted-foreground', label: 'Moderado' };
    return { icon: AlertTriangle, color: 'text-muted-foreground', label: 'Cheio' };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent/50 transition-colors cursor-pointer">
          <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
          <span className="text-xs text-muted-foreground">
            {usedMB.toFixed(1)}MB
          </span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="top">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              <h4 className="text-sm font-semibold">Armazenamento Local</h4>
            </div>
            <Badge variant={percentUsed > 80 ? 'destructive' : 'secondary'}>
              {status.label}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Usado</span>
              <span className="font-mono">
                {usedMB.toFixed(2)} MB / {totalMB.toFixed(2)} MB
              </span>
            </div>
            <Progress value={percentUsed} className="h-2" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Disponível</span>
              <span className="font-mono text-muted-foreground">
                {(stats.available / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          </div>

          <div className="pt-2 border-t space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Chaves armazenadas</span>
              <span className="font-mono">{stats.keys.length}</span>
            </div>
            {stats.keys.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <details className="cursor-pointer">
                  <summary className="hover:text-foreground">Ver chaves</summary>
                  <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {stats.keys.slice(0, 10).map((key) => (
                      <div key={key} className="font-mono text-xs truncate">
                        {key}
                      </div>
                    ))}
                    {stats.keys.length > 10 && (
                      <div className="italic">... e mais {stats.keys.length - 10}</div>
                    )}
                  </div>
                </details>
              </div>
            )}
          </div>

          {percentUsed > 80 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Armazenamento quase cheio. Projetos grandes serão salvos apenas na nuvem.
              </p>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
