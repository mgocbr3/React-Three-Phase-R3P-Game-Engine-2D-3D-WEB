import { FolderOpen, Plus } from 'lucide-react';

interface NewProjectSectionProps {
  onCreateBlank: () => void;
  onOpenProjectFolder: () => void;
}

export const NewProjectSection = ({ onCreateBlank, onOpenProjectFolder }: NewProjectSectionProps) => {
  return (
    <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={onCreateBlank}
        className="flex h-20 items-center justify-between rounded-lg border border-border bg-card px-4 text-left transition-colors hover:border-primary/50 hover:bg-secondary/60"
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">Novo Projeto</span>
          <span className="mt-1 block text-xs text-muted-foreground">Cena vazia</span>
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Plus className="h-4 w-4" />
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
