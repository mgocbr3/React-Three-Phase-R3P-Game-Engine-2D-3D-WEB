import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { MyProjectsSection } from './MyProjectsSection';
import { useProjectStore } from '@/stores/projectStore';

describe('MyProjectsSection', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({
      projects: [
        { id: 'placeholder-3d', name: 'Primitive Demo (3D)', templateId: null, createdAt: 1, updatedAt: 1 },
        { id: 'placeholder-2d', name: 'Sample 2D', templateId: null, createdAt: 1, updatedAt: 1 },
        { id: 'real-project', name: 'Meu Jogo', templateId: 'third-person', createdAt: 1, updatedAt: 1 },
      ],
      currentProjectId: null,
    });
  });

  it('keeps internal placeholder projects out of recents', () => {
    render(
      <MemoryRouter>
        <MyProjectsSection onCreateNew={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Primitive Demo (3D)')).not.toBeInTheDocument();
    expect(screen.queryByText('Sample 2D')).not.toBeInTheDocument();
    expect(screen.getByText('Meu Jogo')).toBeInTheDocument();
  });
});
