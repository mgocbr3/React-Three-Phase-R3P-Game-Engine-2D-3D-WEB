import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Label } from '@/components/ui/label';
import { useProjectStore } from '@/stores/projectStore';
import { createEmptyLocalProject } from '@/services/localProjectFiles';
import type { PixlSceneKind } from '@/engine/project/schema';
import { Sparkles, FolderPlus, Loader2, Box, Square } from 'lucide-react';
import { toast } from 'sonner';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string | null;
  templateName?: string;
}

export const CreateProjectDialog = ({
  open,
  onOpenChange,
  templateId = null,
  templateName,
}: CreateProjectDialogProps) => {
  const [projectName, setProjectName] = useState('');
  const [projectKind, setProjectKind] = useState<PixlSceneKind>('3d');
  const navigate = useNavigate();
  const createLocalProject = useProjectStore((state) => state.createProject);

  const handleCreate = () => {
    const name = projectName.trim() || (templateName ? `${templateName} - Meu Projeto` : 'Novo Projeto');

    const project = createLocalProject(name, templateId);

    // Forking a template lets the template viewport seed the editor.
    // For a from-scratch project, seed an EMPTY PixlProjectDocument matching
    // the chosen kind so the editor opens to a blank scene (instead of
    // inheriting the previous project's objects from the singleton doc).
    if (!templateId) {
      try {
        createEmptyLocalProject({
          id: project.id,
          name,
          kind: projectKind,
          templateId: null,
        });
      } catch (err) {
        console.warn('[CreateProjectDialog] Failed to seed empty document:', err);
      }
    }

    toast.success(`Projeto ${projectKind === '2d' ? '2D' : '3D'} criado.`);
    onOpenChange(false);
    setProjectName('');
    setProjectKind('3d');

    if (templateId) {
      navigate(`/editor/${templateId}?localProject=${project.id}`);
    } else {
      const kindParam = projectKind === '2d' ? '&kind=2d' : '';
      navigate(`/editor?localProject=${project.id}${kindParam}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  const isForking = !!templateId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isForking ? (
              <>
                <Sparkles className="w-5 h-5 text-primary" />
                Fork Template
              </>
            ) : (
              <>
                <FolderPlus className="w-5 h-5 text-primary" />
                Novo Projeto
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isForking
              ? `Crie uma cópia do template "${templateName}" para personalizar.`
              : 'Comece um projeto em branco do zero.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Nome do Projeto</Label>
            <Input
              id="project-name"
              placeholder={templateName ? `${templateName} - Meu Projeto` : 'Meu Novo Jogo'}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="bg-background/50"
            />
          </div>

          {!isForking && (
            <div className="space-y-2">
              <Label>Tipo de Projeto</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="project-kind-3d"
                  onClick={() => setProjectKind('3d')}
                  className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition ${
                    projectKind === '3d'
                      ? 'border-primary bg-primary/10'
                      : 'border-border/50 hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Box className="h-4 w-4" />
                    <span className="font-semibold text-sm">3D</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Three.js + R3F + Rapier
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="project-kind-2d"
                  onClick={() => setProjectKind('2d')}
                  className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition ${
                    projectKind === '2d'
                      ? 'border-primary bg-primary/10'
                      : 'border-border/50 hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Square className="h-4 w-4" />
                    <span className="font-semibold text-sm">2D</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Phaser 4 + Rapier 2D
                  </span>
                </button>
              </div>
            </div>
          )}

          {isForking && (
            <p className="text-xs text-muted-foreground">
              O template original não será alterado. Você terá sua própria cópia para editar livremente.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            {isForking ? (
              <>
                <Sparkles className="w-4 h-4" />
                Criar Fork
              </>
            ) : (
              <>
                <FolderPlus className="w-4 h-4" />
                Criar Projeto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
