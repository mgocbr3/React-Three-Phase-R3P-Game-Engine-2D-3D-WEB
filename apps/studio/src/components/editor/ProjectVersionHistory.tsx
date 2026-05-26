/**
 * Project Version History Dialog
 * 
 * Shows version history of a project and allows restoring previous versions
 * Part of Phase 1: Critical Stabilization (Implementation Roadmap)
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useEditorStore } from '@/stores/editorStore';
import {
  getProjectVersions,
  restoreProjectVersion,
  type ProjectVersion,
} from '@/legacy/cloud/services/projectVersioning';
import { History, RotateCcw, Clock, Package } from 'lucide-react';

interface ProjectVersionHistoryProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectVersionHistory({
  projectId,
  open,
  onOpenChange,
}: ProjectVersionHistoryProps) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && projectId) {
      loadVersions();
    }
  }, [open, projectId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await getProjectVersions(projectId);
      setVersions(data);
    } catch (error) {
      console.error('Failed to load versions:', error);
      toast({
        title: 'Erro ao carregar versões',
        description: 'Não foi possível carregar o histórico de versões.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    setRestoring(versionNumber);
    
    try {
      const gameData = await restoreProjectVersion(projectId, versionNumber);
      
      if (!gameData) {
        throw new Error('Failed to restore version');
      }

      // Restore to editor store
      useEditorStore.setState({
        objects: gameData.objects || [],
        gameScript: gameData.gameScript || '',
      });

      toast({
        title: ' Versão restaurada',
        description: `Versão ${versionNumber} restaurada com sucesso!`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to restore version:', error);
      toast({
        title: 'Erro ao restaurar versão',
        description: 'Não foi possível restaurar esta versão.',
        variant: 'destructive',
      });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico de Versões
          </DialogTitle>
          <DialogDescription>
            Restaure versões anteriores do seu projeto
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mb-2 opacity-50" />
            <p>Nenhuma versão salva ainda</p>
            <p className="text-sm">Versões são criadas automaticamente ao salvar</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        v{version.version_number}
                      </Badge>
                      {version.version_number === versions[0].version_number && (
                        <Badge variant="default" className="text-xs">
                          Atual
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm font-medium">
                      {version.description || 'Sem descrição'}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(version.created_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                      <span>
                        {version.game_data?.objects?.length || 0} objetos
                      </span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(version.version_number)}
                    disabled={
                      restoring !== null ||
                      version.version_number === versions[0].version_number
                    }
                    className="ml-4"
                  >
                    {restoring === version.version_number ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restaurar
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {versions.length} {versions.length === 1 ? 'versão' : 'versões'} salvas
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
