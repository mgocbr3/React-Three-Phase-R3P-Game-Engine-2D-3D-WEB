import { useState } from 'react';
import { Github, HelpCircle, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import logoSilver from '@/assets/r3p-logo-light.png';
import { ENGINE_REPO_URL, HeaderHelpDialog, HeaderSettingsDialog } from './HeaderSettingsDialog';

export const Header = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 h-11 border-b border-border bg-background">
      <div className="flex h-full items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <img src={logoSilver} alt="React 3 Phase" className="h-6 w-6 shrink-0 object-contain" />
            <span className="truncate text-sm font-semibold text-foreground">React 3 Phase</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            aria-label="Abrir ajuda"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button
            type="button"
            aria-label="Abrir configuracoes"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <a href={ENGINE_REPO_URL} target="_blank" rel="noreferrer" aria-label="Abrir repositorio da engine">
              <Github className="h-4 w-4 text-muted-foreground" />
            </a>
          </Button>
        </div>
      </div>

      <HeaderHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <HeaderSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
};
