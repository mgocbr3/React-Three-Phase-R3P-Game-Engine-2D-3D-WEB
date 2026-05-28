import { render, screen } from '@testing-library/react';

import { HubLegalFooter } from './HubLegalFooter';

describe('HubLegalFooter', () => {
  it('shows legal attribution and both brand marks', () => {
    render(<HubLegalFooter />);

    expect(screen.getByText('Criado por Pixlland Entertainment')).toBeInTheDocument();
    expect(screen.getByAltText('Pixlland')).toHaveAttribute('src', '/branding/pixlland-logo.png');
    expect(screen.getByAltText('React 3 Phase')).toHaveAttribute('src', '/branding/react-3-phase-logo.png');
  });
});
