import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useInputMapStore } from '@/stores/inputMapStore';
import { InputMapPanel } from './InputMapPanel';

describe('InputMapPanel desktop-only controls', () => {
  beforeEach(() => {
    useInputMapStore.getState().resetToDefaults();
  });

  it('does not expose mobile touch bindings in the editor UI', () => {
    render(<InputMapPanel />);

    expect(screen.queryByText(/gestos touch/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Joystick ↑')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Mover Frente'));

    expect(screen.getByRole('button', { name: 'Teclado' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Controle' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Touch' })).not.toBeInTheDocument();
  });
});
