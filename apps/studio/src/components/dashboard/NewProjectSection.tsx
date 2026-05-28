import { Box, FolderOpen, Square } from 'lucide-react';
import type { PixlSceneKind } from '@/engine/project/schema';

interface NewProjectSectionProps {
  onCreateKind: (kind: PixlSceneKind) => void;
  onOpenProjectFolder: () => void;
}

export const NewProjectSection = ({ onCreateKind, onOpenProjectFolder }: NewProjectSectionProps) => {
  return (
    <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
      <button
        type="button"
        data-testid="new-project-kind-2d"
        onClick={() => onCreateKind('2d')}
        className="flex h-20 items-center justify-between rounded-lg border border-border bg-card px-4 text-left transition-colors hover:border-primary/50 hover:bg-secondary/60"
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">2D</span>
          <span className="mt-1 block text-xs text-muted-foreground">Phaser</span>
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Square className="h-4 w-4" />
        </span>
      </button>

      <button
        type="button"
        data-testid="new-project-kind-3d"
        onClick={() => onCreateKind('3d')}
        className="flex h-20 items-center justify-between rounded-lg border border-border bg-card px-4 text-left transition-colors hover:border-primary/50 hover:bg-secondary/60"
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">3D</span>
          <span className="mt-1 block text-xs text-muted-foreground">Three.js</span>
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Box className="h-4 w-4" />
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenProjectFolder}
        className="flex h-20 items-center justify-between rounded-lg border border-border bg-card px-4 text-left transition-colors hover:border-primary/50 hover:bg-secondary/60"
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">Abrir Projeto</span>
          <span className="mt-1 block text-xs text-muted-foreground">Pasta existente</span>
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <FolderOpen className="h-4 w-4" />
        </span>
      </button>
    </section>
  );
};
