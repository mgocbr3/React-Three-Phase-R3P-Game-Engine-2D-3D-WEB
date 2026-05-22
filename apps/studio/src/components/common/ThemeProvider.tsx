import { useEffect } from 'react';
import { normalizeUITheme, useEngineSettings } from '@/stores/engineSettingsStore';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { uiTheme } = useEngineSettings();

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', normalizeUITheme(uiTheme));
    document.documentElement.removeAttribute('data-menu-transparency');
  }, [uiTheme]);

  return <>{children}</>;
};
