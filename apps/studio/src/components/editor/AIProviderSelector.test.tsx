import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_LOCAL_MODEL } from '@/services/ai/types';
import { useAIStore } from '@/stores/aiStore';
import { AIProviderSelector } from './AIProviderSelector';

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  toJSON: () => ({}),
} as DOMRect);

describe('AIProviderSelector menu', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    useAIStore.setState({
      currentProviderId: 'webllm',
      currentModel: null,
      provider: null,
      status: { isReady: false, isLoading: false, progress: 0, error: null, modelName: null },
      selectedLocalModel: DEFAULT_LOCAL_MODEL,
      cloudApiKeys: {},
      cloudModels: {},
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('portals the model menu above dock clipping containers', async () => {
    const { container } = render(<AIProviderSelector />);
    const trigger = screen.getByRole('button', { name: 'Selecionar IA' });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(400, 100, 120, 28));

    fireEvent.click(trigger);

    await waitFor(() => expect(document.body.querySelector('.ai-service-card')).toBeInTheDocument());
    const card = document.body.querySelector('.ai-service-card') as HTMLElement;
    expect(card.parentElement).toBe(document.body);
    expect(container.querySelector('.ai-service-card')).toBeNull();
    expect(card.className).toContain('fixed');

    const free = screen.getByRole('button', { name: 'Grátis (Offline)' });
    fireEvent.mouseDown(free);
    fireEvent.click(free);

    expect(screen.getByText('Roda no seu navegador • Sem custo')).toBeVisible();
  });
});
