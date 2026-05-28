import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Header } from '@/components/dashboard/Header';
import { CreateProjectDialog } from '@/components/dashboard/CreateProjectDialog';
import { HubLegalFooter } from '@/components/dashboard/HubLegalFooter';
import { MyProjectsSection } from '@/components/dashboard/MyProjectsSection';
import { NewProjectSection } from '@/components/dashboard/NewProjectSection';
import { SectionErrorBoundary } from '@/components/dashboard/SectionErrorBoundary';
import { openProjectDocumentFromDirectory } from '@/services/localProjectFiles';
import { useViewportStore } from '@/stores/viewportStore';
import type { PixlSceneKind } from '@/engine/project/schema';

const Index = () => {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createKind, setCreateKind] = useState<PixlSceneKind | null>(null);

  // Returning to the Hub means "no project active" — clear the viewport
  // lock so a future project (or a direct `/editor?kind=` URL) can pick
  // its own kind freely.
  useEffect(() => {
    useViewportStore.getState().setLockedKind(null);
  }, []);

  const handleCreateKind = (kind: PixlSceneKind | null) => {
    setCreateKind(kind);
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
              <p className="mt-1 text-sm text-muted-foreground">Projetos e templates.</p>
            </div>
          </div>

          <NewProjectSection
            onCreateKind={handleCreateKind}
            onOpenProjectFolder={handleOpenProjectFolder}
          />

          <SectionErrorBoundary sectionName="Projetos recentes">
            <MyProjectsSection
              onCreateNew={() => handleCreateKind(null)}
              onOpenProjectFolder={handleOpenProjectFolder}
            />
          </SectionErrorBoundary>

          <HubLegalFooter />
        </div>
      </main>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setCreateKind(null);
        }}
        initialKind={createKind}
      />
    </div>
  );
};

export default Index;
