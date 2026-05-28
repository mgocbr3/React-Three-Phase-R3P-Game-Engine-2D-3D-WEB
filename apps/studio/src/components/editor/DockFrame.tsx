import { type PointerEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { EditorDockZone, EditorPanelId } from '@/stores/editorLayoutStore';

interface DockFrameProps {
  id: EditorPanelId;
  zone: EditorDockZone;
  label: string;
  children: ReactNode;
  onClose: () => void;
  dragging: boolean;
  draggingAny: boolean;
  dropActive: boolean;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  chromeHidden?: boolean;
}

export const DockFrame = ({
  id,
  zone,
  label,
  children,
  onClose,
  dragging,
  draggingAny,
  dropActive,
  onPointerDown,
  chromeHidden = false,
}: DockFrameProps) => (
  <div
    data-testid={`dock-panel-${id}`}
    data-dock-drop-target={id}
    data-dock-panel-id={id}
    data-dock-zone={zone}
    className={cn(
      'editor-dock relative flex h-full min-w-0 flex-col overflow-hidden transition-[border-color,box-shadow,opacity,transform] duration-150',
      !chromeHidden && 'editor-dock-outline',
      dragging && 'scale-[0.995] opacity-60',
      draggingAny && !dragging && 'shadow-[inset_0_0_0_1px_rgba(80,155,255,0.18)]',
      dropActive && 'border-primary/80 bg-primary/[0.03] shadow-[inset_0_0_0_2px_hsl(var(--primary)),0_0_24px_rgba(75,160,255,0.28)]',
    )}
  >
    {dropActive && (
      <div
        data-testid={`dock-drop-before-${id}`}
        className="pointer-events-none absolute inset-1 z-30 border-2 border-primary/80 bg-primary/10 shadow-[0_0_18px_rgba(75,160,255,0.75)]"
      />
    )}
    {!chromeHidden && (
      <div
        data-testid={`dock-tab-${id}`}
        draggable={false}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          onPointerDown(event);
        }}
        className={cn(
          'panel-header h-8 cursor-grab touch-none select-none justify-between px-2 active:cursor-grabbing',
          dragging && 'bg-[var(--editor-row-selected)]',
        )}
        title="Arraste para reorganizar"
      >
        <span className="truncate text-xs font-medium text-foreground">{label}</span>
        <button
          aria-label={`Close ${label}`}
          className="p-1 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
          title={`Close ${label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )}
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>
);
