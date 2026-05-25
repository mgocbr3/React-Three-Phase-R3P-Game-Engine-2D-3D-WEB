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
import { useCreateProject } from '@/hooks/useProjects';
import { useAuthStore } from '@/legacy/cloud/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { createEmptyLocalProject } from '@/services/localProjectFiles';
import type { PixlSceneKind } from '@/engine/project/schema';
import { isPixllandConfigured } from '@/legacy/cloud/integrations/pixlland/client';
import { ENGINE_CLOUD_ENABLED, ENGINE_LOCAL_ONLY } from '@/config/engineMode';
import { AuthModal } from '@/components/auth/AuthModal';
import { Sparkles, FolderPlus, Loader2, LogIn, Box, Square } from 'lucide-react';
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
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const createLocalProject = useProjectStore((state) => state.createProject);
  const createProjectMutation = useCreateProject();

  const isEmbedded = ENGINE_CLOUD_ENABLED && new URLSearchParams(window.location.search).get('embedded') === 'true';
  const canCreateLocalProject = !ENGINE_CLOUD_ENABLED || ENGINE_LOCAL_ONLY || !isPixllandConfigured || user?.id === 'pixlland-dev-user';

  const handleCreate = async () => {
    const name = projectName.trim() || (templateName ? `${templateName} - Meu Projeto` : 'Novo Projeto');

    // Embedded mode: project source-of-truth is the platform.
    // We create by opening the editor with an auto-create flag that saves via PixllandBridge.
    if (isEmbedded) {
      onOpenChange(false);
      setProjectName('');

      const encodedTitle = encodeURIComponent(name);
      if (templateId) {
        navigate(`/editor/${templateId}?embedded=true&autocreate=true&title=${encodedTitle}`);
      } else {
        navigate(`/editor?embedded=true&autocreate=true&title=${encodedTitle}`);
      }
      return;
    }

    if (canCreateLocalProject) {
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
      return;
    }

    if (ENGINE_CLOUD_ENABLED && !user) {
      setAuthModalOpen(true);
      return;
    }

    try {
      const project = await createProjectMutation.mutateAsync({
        name,
        template_id: templateId || undefined,
      });
      
      toast.success('Projeto criado!');
      onOpenChange(false);
      setProjectName('');
      
      // Navigate to editor with project ID and optional template
      if (templateId) {
        navigate(`/editor/${templateId}?project=${project.id}`);
      } else {
        navigate(`/editor?project=${project.id}`);
      }
    } catch (error) {
      toast.error('Erro ao criar projeto');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !createProjectMutation.isPending) {
      handleCreate();
    }
  };

  const isForking = !!templateId;

  return (
    <>
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

          {ENGINE_CLOUD_ENABLED && !user && !isEmbedded && !canCreateLocalProject ? (
            <div className="py-6 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <LogIn className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Entre para criar projetos na plataforma.
              </p>
              <Button onClick={() => setAuthModalOpen(true)} className="gap-2">
                <LogIn className="w-4 h-4" />
                Entrar
              </Button>
            </div>
          ) : (
            <>
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
                    disabled={createProjectMutation.isPending}
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
                <Button 
                  onClick={handleCreate} 
                  className="gap-2"
                  disabled={createProjectMutation.isPending}
                >
                  {createProjectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : isForking ? (
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
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {ENGINE_CLOUD_ENABLED && <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />}
    </>
  );
};
