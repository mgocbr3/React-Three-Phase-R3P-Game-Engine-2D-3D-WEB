import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Header } from '@/components/dashboard/Header';
import { CreateProjectDialog } from '@/components/dashboard/CreateProjectDialog';
import { EmbeddedProjectsSection } from '@/components/dashboard/EmbeddedProjectsSection';
import { MyProjectsSection } from '@/components/dashboard/MyProjectsSection';
import { NewProjectSection } from '@/components/dashboard/NewProjectSection';
import { SamplesSection } from '@/components/dashboard/SamplesSection';
import { SectionErrorBoundary } from '@/components/dashboard/SectionErrorBoundary';
import { ENGINE_CLOUD_ENABLED } from '@/config/engineMode';
import { openProjectDocumentFromDirectory } from '@/services/localProjectFiles';

const Index = () => {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const isEmbedded = ENGINE_CLOUD_ENABLED && new URLSearchParams(window.location.search).get('embedded') === 'true';

  const handleCreateBlank = () => {
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-11">
        <div className="mx-auto max-w-[1180px] px-4 py-5 md:px-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Hub</h1>
              <p className="mt-1 text-sm text-muted-foreground">Projetos e samples.</p>
            </div>
          </div>

          <NewProjectSection
            onCreateBlank={handleCreateBlank}
            onOpenProjectFolder={handleOpenProjectFolder}
          />

          {isEmbedded ? (
            <SectionErrorBoundary sectionName="Projetos embarcados">
              <EmbeddedProjectsSection onCreateNew={handleCreateBlank} />
            </SectionErrorBoundary>
          ) : (
            <SectionErrorBoundary sectionName="Projetos recentes">
              <MyProjectsSection
                onCreateNew={handleCreateBlank}
                onOpenProjectFolder={handleOpenProjectFolder}
              />
            </SectionErrorBoundary>
          )}

          <SectionErrorBoundary sectionName="Samples">
            <SamplesSection />
          </SectionErrorBoundary>
        </div>
      </main>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
};

export default Index;
