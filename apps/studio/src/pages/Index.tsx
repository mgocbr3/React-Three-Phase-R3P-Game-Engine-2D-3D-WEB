import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Header } from '@/components/dashboard/Header';
import { CreateProjectDialog } from '@/components/dashboard/CreateProjectDialog';
import { EmbeddedProjectsSection } from '@/components/dashboard/EmbeddedProjectsSection';
import { MyProjectsSection } from '@/components/dashboard/MyProjectsSection';
import { NewProjectSection } from '@/components/dashboard/NewProjectSection';
import { TemplateCard } from '@/components/dashboard/TemplateCard';
import { ENGINE_CLOUD_ENABLED } from '@/config/engineMode';
import { openProjectDocumentFromDirectory } from '@/services/localProjectFiles';
import { GAME_TEMPLATES, GameTemplate } from '@/stores/gameStore';

const Index = () => {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<GameTemplate | null>(null);

  const isEmbedded = ENGINE_CLOUD_ENABLED && new URLSearchParams(window.location.search).get('embedded') === 'true';

  const handleCreateBlank = () => {
    setSelectedTemplate(null);
    setCreateDialogOpen(true);
  };

  const handleOpenProjectFolder = async () => {
    try {
      const { document } = await openProjectDocumentFromDirectory();
      toast.success(`Projeto aberto: ${document.name}`);
      navigate(`/editor?localProject=${encodeURIComponent(document.id)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel abrir o projeto.';
      toast.error(message);
    }
  };

  const handleEditTemplate = (template: GameTemplate) => {
    setSelectedTemplate(template);
    setCreateDialogOpen(true);
  };

  const handlePlayTemplate = (template: GameTemplate) => {
    navigate(`/play/${template.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-11">
        <div className="mx-auto max-w-[1180px] px-4 py-5 md:px-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Hub</h1>
              <p className="mt-1 text-sm text-muted-foreground">Projetos e templates.</p>
            </div>
          </div>

          <NewProjectSection
            onCreateBlank={handleCreateBlank}
            onOpenProjectFolder={handleOpenProjectFolder}
          />

          {isEmbedded ? (
            <EmbeddedProjectsSection onCreateNew={handleCreateBlank} />
          ) : (
            <MyProjectsSection
              onCreateNew={handleCreateBlank}
              onOpenProjectFolder={handleOpenProjectFolder}
            />
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Templates</h2>
              <span className="text-xs text-muted-foreground">{GAME_TEMPLATES.length}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {GAME_TEMPLATES.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={handleEditTemplate}
                  onPlay={handlePlayTemplate}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        templateId={selectedTemplate?.id}
        templateName={selectedTemplate?.name}
      />
    </div>
  );
};

export default Index;
