/**
 * Conflict Resolution Dialog
 * 
 * Shows conflict details and allows user to choose resolution strategy
 * Part of Phase 1: Critical Stabilization (Implementation Roadmap)
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  Clock,
  Monitor,
  Cloud,
  GitMerge,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  ConflictInfo,
  ConflictResolutionStrategy,
} from '@/services/conflictResolution';
import { getConflictSummary } from '@/services/conflictResolution';

interface ConflictResolutionDialogProps {
  conflict: ConflictInfo | null;
  onResolve: (strategy: ConflictResolutionStrategy) => void;
  onCancel?: () => void;
  isResolving?: boolean;
}

export function ConflictResolutionDialog({
  conflict,
  onResolve,
  onCancel,
  isResolving = false,
}: ConflictResolutionDialogProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<ConflictResolutionStrategy | null>(null);

  if (!conflict) return null;

  const handleResolve = () => {
    if (selectedStrategy) {
      onResolve(selectedStrategy);
    }
  };

  const summary = getConflictSummary(conflict);

  return (
    <Dialog open={!!conflict} onOpenChange={() => !isResolving && onCancel?.()}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="w-5 h-5" />
             Conflito Detectado
          </DialogTitle>
          <DialogDescription>
            Seu projeto foi modificado em outro dispositivo. Escolha como resolver o conflito.
          </DialogDescription>
        </DialogHeader>

        {/* Alert with summary */}
        <Alert className="border-border bg-secondary/30">
          <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          <AlertDescription className="text-sm">
            {summary}
          </AlertDescription>
        </Alert>

        {/* Version comparison */}
        <div className="grid grid-cols-2 gap-4">
          {/* Local version */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-bold">Versão Local</h3>
            </div>
            
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                {conflict.local.objects?.length || 0} objetos
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {format(new Date(conflict.timestamp_local), "dd/MM 'às' HH:mm", {
                  locale: ptBR,
                })}
              </div>
            </div>
          </div>

          {/* Remote version */}
          <div className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-bold">Versão Remota</h3>
            </div>
            
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                {conflict.remote.objects?.length || 0} objetos
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {format(new Date(conflict.timestamp_remote), "dd/MM 'às' HH:mm", {
                  locale: ptBR,
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Differences list */}
        {conflict.differences.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Diferenças Detectadas:</h4>
            <ScrollArea className="h-[150px] border rounded-lg p-3">
              <div className="space-y-2">
                {conflict.differences.slice(0, 10).map((diff, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs">
                    <Badge
                      variant={
                        diff.type === 'added'
                          ? 'default'
                          : diff.type === 'removed'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {diff.type === 'added' && '+ Adicionado'}
                      {diff.type === 'removed' && '- Removido'}
                      {diff.type === 'modified' && '~ Modificado'}
                    </Badge>
                    <span className="text-muted-foreground">
                      {diff.objectName || diff.property || 'Unknown'}
                      {diff.property && ` (${diff.property})`}
                    </span>
                  </div>
                ))}
                {conflict.differences.length > 10 && (
                  <p className="text-xs text-muted-foreground italic">
                    ... e mais {conflict.differences.length - 10} diferenças
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Resolution strategies */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Escolha uma estratégia de resolução:</h4>
          
          <div className="space-y-2">
            {/* Strategy 1: Use Remote */}
            <button
              onClick={() => setSelectedStrategy('remote')}
              disabled={isResolving}
              className={`w-full text-left border rounded-lg p-4 transition-all hover:border-border ${
                selectedStrategy === 'remote'
                  ? 'border-purple-500 bg-secondary/30'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Usar Versão Remota</span>
                    <Badge variant="secondary" className="text-xs">
                      Recomendado
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Substitui suas mudanças locais pela versão salva na nuvem.
                    Use se editou em outro dispositivo recentemente.
                  </p>
                </div>
                {selectedStrategy === 'remote' && (
                  <Check className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Strategy 2: Use Local */}
            <button
              onClick={() => setSelectedStrategy('local')}
              disabled={isResolving}
              className={`w-full text-left border rounded-lg p-4 transition-all hover:border-border ${
                selectedStrategy === 'local'
                  ? 'border-blue-500 bg-secondary/30'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Manter Versão Local</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mantém suas mudanças locais e sobrescreve a versão remota.
                    Use se tem certeza que suas mudanças são as corretas.
                  </p>
                </div>
                {selectedStrategy === 'local' && (
                  <Check className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Strategy 3: Merge */}
            <button
              onClick={() => setSelectedStrategy('merge')}
              disabled={isResolving}
              className={`w-full text-left border rounded-lg p-4 transition-all hover:border-border ${
                selectedStrategy === 'merge'
                  ? 'border-emerald-500 bg-secondary/30'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <GitMerge className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Mesclar Automaticamente</span>
                    <Badge variant="secondary" className="text-xs">
                      Avançado
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Combina ambas as versões automaticamente. Objetos novos de
                    ambos os lados são mantidos. Conflitos são resolvidos usando a
                    versão mais recente.
                  </p>
                </div>
                {selectedStrategy === 'merge' && (
                  <Check className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isResolving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleResolve}
            disabled={!selectedStrategy || isResolving}
            className="min-w-[120px]"
          >
            {isResolving ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Resolvendo...
              </div>
            ) : (
              <>
                <ArrowLeftRight className="w-4 h-4 mr-2" />
                Resolver Conflito
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
