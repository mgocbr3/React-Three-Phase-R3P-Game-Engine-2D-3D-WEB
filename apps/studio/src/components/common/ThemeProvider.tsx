import { useEffect } from 'react';
import { useEngineSettings } from '@/stores/engineSettingsStore';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { uiTheme, menuTransparency } = useEngineSettings();

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-ui-theme', uiTheme);
    
    // Apply menu transparency
    document.documentElement.setAttribute('data-menu-transparency', menuTransparency ? 'on' : 'off');
  }, [uiTheme, menuTransparency]);

  return <>{children}</>;
};
