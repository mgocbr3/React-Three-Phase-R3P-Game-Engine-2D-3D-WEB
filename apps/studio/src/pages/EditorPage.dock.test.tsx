import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DockFrame } from '@/components/editor/DockFrame';

describe('DockFrame', () => {
  it('keeps close in the ellipsis menu without exposing a duplicate x button', () => {
    const onClose = vi.fn();
    const onDockMain = vi.fn();
    const onDockBottom = vi.fn();
    const onResetDock = vi.fn();
    const onPointerDown = vi.fn();

    render(
      <DockFrame
        id="viewport"
        zone="main"
        label="Scene"
        onClose={onClose}
        onDockMain={onDockMain}
        onDockBottom={onDockBottom}
        onResetDock={onResetDock}
        dragging={false}
        draggingAny={false}
        dropActive={false}
        onPointerDown={onPointerDown}
      >
        <div>Viewport body</div>
      </DockFrame>,
    );

    expect(screen.queryByRole('button', { name: 'Close Scene' })).toBeNull();

    const menu = screen.getByRole('button', { name: 'Menu Scene' });
    fireEvent.pointerDown(menu);
    fireEvent.click(menu);
    fireEvent.click(screen.getByRole('button', { name: 'Close Tab' }));

    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens compact dock actions from the ellipsis menu', () => {
    const onDockBottom = vi.fn();

    render(
      <DockFrame
        id="scene"
        zone="main"
        label="Hierarchy"
        onClose={vi.fn()}
        onDockMain={vi.fn()}
        onDockBottom={onDockBottom}
        onResetDock={vi.fn()}
        dragging={false}
        draggingAny={false}
        dropActive={false}
        onPointerDown={vi.fn()}
      >
        <div>Scene body</div>
      </DockFrame>,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Menu Hierarchy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Menu Hierarchy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dock Below' }));

    expect(onDockBottom).toHaveBeenCalledTimes(1);
  });

  it('can render a chromeless runtime frame so the game owns the full dock body', () => {
    render(
      <DockFrame
        id="viewport"
        zone="main"
        label="Game 2D"
        onClose={vi.fn()}
        onDockMain={vi.fn()}
        onDockBottom={vi.fn()}
        onResetDock={vi.fn()}
        dragging={false}
        draggingAny={false}
        dropActive={false}
        onPointerDown={vi.fn()}
        chromeHidden
      >
        <div>Game canvas</div>
      </DockFrame>,
    );

    expect(screen.queryByTestId('dock-tab-viewport')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close Game 2D' })).toBeNull();
    expect(screen.getByText('Game canvas')).toBeInTheDocument();
  });
});
