import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FolderOpen,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle,
  Gamepad2,
} from "lucide-react";

import { usePixllandBridge } from "@/hooks/usePixllandBridge";
import { usePixllandProjectStore, type PixllandProject } from "@/stores/pixllandProjectStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface EmbeddedProjectsSectionProps {
  onCreateNew: () => void;
}

export const EmbeddedProjectsSection = ({ onCreateNew }: EmbeddedProjectsSectionProps) => {
  const navigate = useNavigate();
  const { isEmbedded, requestProjects, openProject } = usePixllandBridge();
  const projects = usePixllandProjectStore((s) => s.projects);
  const isLoadingProjects = usePixllandProjectStore((s) => s.isLoadingProjects);

  useEffect(() => {
    if (!isEmbedded) return;
    requestProjects();
  }, [isEmbedded, requestProjects]);

  const handleOpenProject = (project: PixllandProject) => {
    openProject(project.id);
    navigate(`/editor?embedded=true&projectId=${project.id}`);
  };

  if (isLoadingProjects) {
    return (
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              Meus Projetos
              <Gamepad2 className="w-4 h-4 text-primary" />
            </h2>
            <p className="text-sm text-muted-foreground">Sincronizando com a plataforma...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video" />
              <div className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              Meus Projetos
              <Gamepad2 className="w-4 h-4 text-primary" />
            </h2>
            <p className="text-sm text-muted-foreground">Projetos da sua conta na plataforma</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => requestProjects()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        <Card className="p-8 bg-card/50 backdrop-blur-sm border-dashed border-2 border-border/50 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">Nenhum projeto ainda</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Crie seu primeiro projeto em branco ou comece a partir de um template.
          </p>
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Criar Primeiro Projeto
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            Meus Projetos
            <Gamepad2 className="w-4 h-4 text-primary" />
          </h2>
          <p className="text-sm text-muted-foreground">
            {projects.length} projeto{projects.length !== 1 ? "s" : ""} na plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => requestProjects()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
          <Button onClick={onCreateNew} variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Projeto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="group relative overflow-hidden bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all cursor-pointer"
            onClick={() => handleOpenProject(project)}
          >
            <div className="aspect-video bg-gradient-to-br from-primary/20 via-background to-neon-purple/20 flex items-center justify-center relative overflow-hidden">
              {project.thumbnailUrl ? (
                <img
                  src={project.thumbnailUrl}
                  alt={project.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Gamepad2 className="w-12 h-12 text-muted-foreground/50" />
              )}

              <div className="absolute top-2 right-2">
                <Badge
                  variant={project.status === "published" ? "default" : "secondary"}
                  className="text-xs gap-1"
                >
                  {project.status === "published" ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Publicado
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3" />
                      Rascunho
                    </>
                  )}
                </Badge>
              </div>
            </div>

            <div className="p-4">
              <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(project.updatedAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
