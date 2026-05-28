import { useEffect } from 'react';
import { useAppPreferencesStore } from '@/stores/appPreferencesStore';
import { normalizeUITheme, useEngineSettings } from '@/stores/engineSettingsStore';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { uiTheme } = useEngineSettings();
  const language = useAppPreferencesStore((state) => state.language);

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', normalizeUITheme(uiTheme));
    document.documentElement.removeAttribute('data-menu-transparency');
  }, [uiTheme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <>{children}</>;
};
