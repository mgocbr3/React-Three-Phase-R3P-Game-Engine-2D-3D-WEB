import { Github, HelpCircle, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import logoSilver from '@/assets/r3p-logo-light.png';

export const Header = () => {
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
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Github className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </header>
  );
};
