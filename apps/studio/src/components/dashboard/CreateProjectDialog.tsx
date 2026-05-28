import { useEffect, useMemo, useState } from 'react';
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
import { Box, Eye, FolderPlus, Orbit, Square } from 'lucide-react';
import { listStarterTemplates, type StarterTemplateId } from '@/lib/starterTemplates';
import { toast } from 'sonner';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind?: PixlSceneKind | null;
}

export const CreateProjectDialog = ({
  open,
  onOpenChange,
  initialKind = null,
}: CreateProjectDialogProps) => {
  const [projectName, setProjectName] = useState('');
  const [projectKind, setProjectKind] = useState<PixlSceneKind | null>(initialKind);
  const [templateId, setTemplateId] = useState<StarterTemplateId | null>(null);
  const navigate = useNavigate();
  const createLocalProject = useProjectStore((state) => state.createProject);
  const starterTemplates = useMemo(() => listStarterTemplates(), []);
  const selectedTemplate = starterTemplates.find((template) => template.id === templateId);

  useEffect(() => {
    if (!open) return;
    setProjectKind(initialKind);
    setTemplateId(null);
  }, [initialKind, open]);

  const handleCreate = () => {
    if (!projectKind) return;
    const name = projectName.trim() || (selectedTemplate ? `${selectedTemplate.name} - Meu Projeto` : 'Novo Projeto');

    const project = createLocalProject(name, templateId);

    try {
      createEmptyLocalProject({
        id: project.id,
        name,
        kind: projectKind,
        templateId: templateId ?? null,
      });
    } catch (err) {
      console.warn('[CreateProjectDialog] Failed to seed project document:', err);
    }

    toast.success(`Projeto ${projectKind === '2d' ? '2D' : '3D'} criado.`);
    onOpenChange(false);
    setProjectName('');
    setProjectKind(initialKind);
    setTemplateId(null);

    if (templateId) {
      navigate(`/editor/${templateId}?localProject=${project.id}&kind=3d`);
    } else {
      navigate(`/editor?localProject=${project.id}&kind=${projectKind}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  const chooseKind = (kind: PixlSceneKind) => {
    setProjectKind(kind);
    setTemplateId(null);
  };

  const templateButtonClass = (active: boolean) => `flex min-h-[74px] items-center gap-3 rounded-md border p-3 text-left transition ${
    active ? 'border-primary bg-secondary' : 'border-border hover:border-muted-foreground/60 hover:bg-secondary/50'
  }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card shadow-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-muted-foreground" />
            Novo Projeto
          </DialogTitle>
          <DialogDescription>
            Primeiro escolha a engine, depois o template inicial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!projectKind ? (
            <div className="space-y-2">
              <Label>Engine</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="project-kind-2d"
                  onClick={() => chooseKind('2d')}
                  className={templateButtonClass(false)}
                >
                  <Square className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <span className="block text-sm font-semibold">2D</span>
                    <span className="text-xs text-muted-foreground">Phaser</span>
                  </div>
                </button>
                <button
                  type="button"
                  data-testid="project-kind-3d"
                  onClick={() => chooseKind('3d')}
                  className={templateButtonClass(false)}
                >
                  <Box className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <span className="block text-sm font-semibold">3D</span>
                    <span className="text-xs text-muted-foreground">Three.js</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <Label>Engine: {projectKind === '2d' ? '2D' : '3D'}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setProjectKind(null)}>
                  Trocar
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Template</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="template-blank"
                    onClick={() => setTemplateId(null)}
                    className={templateButtonClass(templateId === null)}
                  >
                    {projectKind === '2d' ? (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Box className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <span className="block text-sm font-semibold">Em branco</span>
                      <span className="text-xs text-muted-foreground">Cena limpa da engine escolhida</span>
                    </div>
                  </button>

                  {projectKind === '3d' && starterTemplates.map((template) => {
                    const Icon = template.id === 'first-person' ? Eye : Orbit;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        data-testid={`template-${template.id}`}
                        onClick={() => setTemplateId(template.id)}
                        className={templateButtonClass(templateId === template.id)}
                      >
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <span className="block text-sm font-semibold">{template.name}</span>
                          <span className="text-xs text-muted-foreground">{template.description}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-name">Nome do Projeto</Label>
                <Input
                  id="project-name"
                  placeholder={selectedTemplate ? `${selectedTemplate.name} - Meu Projeto` : 'Meu Novo Jogo'}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="bg-background"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {projectKind && (
            <Button onClick={handleCreate} className="gap-2">
              <FolderPlus className="h-4 w-4" />
              Criar Projeto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
