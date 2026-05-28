import { Github, HelpCircle, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAppPreferencesStore, type AppLanguage } from '@/stores/appPreferencesStore';
import { useEngineSettings, type UITheme } from '@/stores/engineSettingsStore';

export const ENGINE_REPO_URL = 'https://github.com/mgocbr3/React-Three-Phaser';

interface HeaderSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HeaderSettingsDialog = ({ open, onOpenChange }: HeaderSettingsDialogProps) => {
  const language = useAppPreferencesStore((state) => state.language);
  const updatePreferences = useAppPreferencesStore((state) => state.updatePreferences);
  const uiTheme = useEngineSettings((state) => state.uiTheme);
  const showStats = useEngineSettings((state) => state.showStats);
  const autoQuality = useEngineSettings((state) => state.autoQuality);
  const updateEngineSettings = useEngineSettings((state) => state.updateSettings);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card shadow-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Configurações
          </DialogTitle>
          <DialogDescription>
            Preferências globais do Studio, disponíveis antes de abrir um projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="app-language">Idioma</Label>
            <select
              id="app-language"
              data-testid="app-language-select"
              value={language}
              onChange={(event) => updatePreferences({ language: event.target.value as AppLanguage })}
              className="h-8 w-full rounded-sm border border-[var(--editor-border-dark)] bg-[var(--editor-panel-sunken)] px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English</option>
              <option value="es-ES">Español</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-theme">Tema</Label>
            <select
              id="app-theme"
              data-testid="app-theme-select"
              value={uiTheme}
              onChange={(event) => updateEngineSettings({ uiTheme: event.target.value as UITheme })}
              className="h-8 w-full rounded-sm border border-[var(--editor-border-dark)] bg-[var(--editor-panel-sunken)] px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="black">Escuro</option>
              <option value="light">Claro</option>
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="show-stats">Mostrar FPS</Label>
                <p className="mt-1 text-xs text-muted-foreground">Exibe estatísticas de performance no editor.</p>
              </div>
              <Switch
                id="show-stats"
                data-testid="show-stats-switch"
                checked={showStats}
                onCheckedChange={(checked) => updateEngineSettings({ showStats: checked })}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="auto-quality">Qualidade automática</Label>
                <p className="mt-1 text-xs text-muted-foreground">Ajusta efeitos conforme a performance.</p>
              </div>
              <Switch
                id="auto-quality"
                data-testid="auto-quality-switch"
                checked={autoQuality}
                onCheckedChange={(checked) => updateEngineSettings({ autoQuality: checked })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="text-xs font-medium text-foreground">Repositório da engine</p>
              <p className="mt-1 text-xs text-muted-foreground">React Three Phaser</p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
              <a href={ENGINE_REPO_URL} target="_blank" rel="noreferrer">
                <Github className="h-3.5 w-3.5" />
                GitHub
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface HeaderHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HeaderHelpDialog = ({ open, onOpenChange }: HeaderHelpDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="border-border bg-card shadow-none sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
          Ajuda
        </DialogTitle>
        <DialogDescription>
          Crie um projeto 2D com Phaser ou 3D com Three.js. Os templates aparecem depois da escolha da engine.
        </DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog>
);
