import { fireEvent, render, screen } from '@testing-library/react';

import { Header } from './Header';
import { ENGINE_REPO_URL } from './HeaderSettingsDialog';
import { useAppPreferencesStore } from '@/stores/appPreferencesStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';

describe('Header', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppPreferencesStore.setState({ language: 'pt-BR' });
    useEngineSettings.setState({ uiTheme: 'black', showStats: true, autoQuality: false });
  });

  it('opens global settings before a project is loaded', () => {
    render(<Header />);

    fireEvent.click(screen.getByLabelText('Abrir configuracoes'));

    expect(screen.getByText('Configurações')).toBeInTheDocument();
    expect(screen.getByText('Idioma')).toBeInTheDocument();
    expect(screen.getByText('Mostrar FPS')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('app-language-select'), { target: { value: 'en-US' } });
    expect(useAppPreferencesStore.getState().language).toBe('en-US');

    fireEvent.change(screen.getByTestId('app-theme-select'), { target: { value: 'light' } });
    expect(useEngineSettings.getState().uiTheme).toBe('light');

    fireEvent.click(screen.getByTestId('show-stats-switch'));
    fireEvent.click(screen.getByTestId('auto-quality-switch'));
    expect(useEngineSettings.getState().showStats).toBe(false);
    expect(useEngineSettings.getState().autoQuality).toBe(true);
  });

  it('links the GitHub icon to the engine repository', () => {
    render(<Header />);

    expect(screen.getByLabelText('Abrir repositorio da engine')).toHaveAttribute('href', ENGINE_REPO_URL);
  });
});
