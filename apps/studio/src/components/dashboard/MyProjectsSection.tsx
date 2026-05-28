import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, FolderOpen, Gamepad2, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useEditorStore } from '@/stores/editorStore';
import { SavedProject, useProjectStore } from '@/stores/projectStore';

const HIDDEN_PLACEHOLDER_PROJECTS = new Set(['Primitive Demo (3D)', 'Sample 2D']);

interface MyProjectsSectionProps {
  onCreateNew: () => void;
  onOpenProjectFolder?: () => void;
}

export const MyProjectsSection = ({ onCreateNew, onOpenProjectFolder }: MyProjectsSectionProps) => {
  const navigate = useNavigate();
  const localProjects = useProjectStore((s) => s.projects);
  const visibleLocalProjects = localProjects.filter((project) => !HIDDEN_PLACEHOLDER_PROJECTS.has(project.name));
  const deleteLocalProject = useProjectStore((s) => s.deleteProject);
  const renameLocalProject = useProjectStore((s) => s.renameProject);
  const hasSavedProject = useEditorStore((s) => s.hasSavedProject);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SavedProject | null>(null);
  const [newName, setNewName] = useState('');

  const handleOpenLocalProject = (project: SavedProject) => {
    if (project.templateId) {
      navigate(`/editor/${project.templateId}?localProject=${project.id}`);
    } else {
      navigate(`/editor?localProject=${project.id}`);
    }
  };

  const handleRename = () => {
    if (!selectedProject || !newName.trim()) return;

    renameLocalProject(selectedProject.id, newName.trim());
    toast.success('Projeto renomeado.');
    setRenameDialogOpen(false);
    setSelectedProject(null);
    setNewName('');
  };

  const handleDelete = () => {
    if (!selectedProject) return;

    deleteLocalProject(selectedProject.id);
    toast.success('Projeto excluido.');
    setDeleteDialogOpen(false);
    setSelectedProject(null);
  };

  const openRenameDialog = (project: SavedProject) => {
    setSelectedProject(project);
    setNewName(project.name);
    setRenameDialogOpen(true);
  };

  const openDeleteDialog = (project: SavedProject) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  const hasLocalWork = hasSavedProject() || visibleLocalProjects.length > 0;

  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Projetos recentes</h2>
        <div className="flex items-center gap-2">
          {onOpenProjectFolder && (
            <Button onClick={onOpenProjectFolder} variant="outline" size="sm" className="h-8 gap-1.5 shadow-none">
              <FolderOpen className="h-3.5 w-3.5" />
              Abrir
            </Button>
          )}
          <Button onClick={onCreateNew} size="sm" className="h-8 gap-1.5 shadow-none">
            <Plus className="h-3.5 w-3.5" />
            Novo
          </Button>
        </div>
      </div>

      {hasLocalWork ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {hasSavedProject() && (
            <Card
              className="flex h-20 cursor-pointer items-center gap-3 rounded-lg border-border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-secondary/50"
              onClick={() => navigate('/editor')}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary">
                <Gamepad2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-foreground">Projeto Atual</h3>
                <p className="truncate text-xs text-muted-foreground">Ultima sessao</p>
              </div>
            </Card>
          )}

          {visibleLocalProjects.map((project) => (
            <Card
              key={project.id}
              className="group flex h-20 cursor-pointer items-center gap-3 rounded-lg border-border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-secondary/50"
              onClick={() => handleOpenLocalProject(project)}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary">
                <Gamepad2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground">{project.name}</h3>
                <p className="truncate text-xs text-muted-foreground">Projeto em branco</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {(() => {
                    // Defensive: pre-existing local projects may have a
                    // missing / non-finite updatedAt (e.g. older save format
                    // or zustand persist corruption). Without this guard
                    // formatDistanceToNow throws RangeError and unmounts the
                    // whole section. Keep the date display optional.
                    const ts = Number(project.updatedAt);
                    if (!Number.isFinite(ts) || ts <= 0) return 'data indisponivel';
                    try {
                      return formatDistanceToNow(new Date(ts), {
                        addSuffix: true,
                        locale: ptBR,
                      });
                    } catch {
                      return 'data invalida';
                    }
                  })()}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-70 transition-opacity group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-border bg-popover">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenLocalProject(project);
                    }}
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Abrir
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openRenameDialog(project);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Renomear
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog(project);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex min-h-24 items-center justify-between rounded-lg border-dashed border-border bg-card p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Nenhum projeto recente</h3>
            <p className="mt-1 text-xs text-muted-foreground">Crie ou abra uma pasta de projeto.</p>
          </div>
          <Button onClick={onCreateNew} size="sm" className="h-8 gap-1.5 shadow-none">
            <Plus className="h-3.5 w-3.5" />
            Criar
          </Button>
        </Card>
      )}

      <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Renomear Projeto</AlertDialogTitle>
            <AlertDialogDescription>Digite um novo nome para "{selectedProject?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            placeholder="Nome do projeto"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRename}>Renomear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedProject?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
