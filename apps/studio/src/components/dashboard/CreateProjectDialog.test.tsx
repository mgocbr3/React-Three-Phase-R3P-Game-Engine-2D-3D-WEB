import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { CreateProjectDialog } from './CreateProjectDialog';

describe('CreateProjectDialog', () => {
  it('asks for 2D or 3D before showing templates', () => {
    render(
      <MemoryRouter>
        <CreateProjectDialog open onOpenChange={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('project-kind-2d')).toHaveTextContent('2D');
    expect(screen.getByTestId('project-kind-2d')).toHaveTextContent('Phaser');
    expect(screen.getByTestId('project-kind-3d')).toHaveTextContent('3D');
    expect(screen.getByTestId('project-kind-3d')).toHaveTextContent('Three.js');
    expect(screen.queryByTestId('template-first-person')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('project-kind-3d'));
    expect(screen.getByTestId('template-blank')).toBeInTheDocument();
    expect(screen.getByTestId('template-first-person')).toBeInTheDocument();
    expect(screen.getByTestId('template-third-person')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trocar' }));
    fireEvent.click(screen.getByTestId('project-kind-2d'));
    expect(screen.getByTestId('template-blank')).toBeInTheDocument();
    expect(screen.queryByTestId('template-first-person')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-third-person')).not.toBeInTheDocument();
  });
});
