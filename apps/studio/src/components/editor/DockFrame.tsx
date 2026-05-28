import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { MoreVertical, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { EditorDockZone, EditorPanelId } from '@/stores/editorLayoutStore';

interface DockFrameProps {
  id: EditorPanelId;
  zone: EditorDockZone;
  label: string;
  children: ReactNode;
  onClose: () => void;
  onDockMain: () => void;
  onDockBottom: () => void;
  onResetDock: () => void;
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
  onDockMain,
  onDockBottom,
  onResetDock,
  dragging,
  draggingAny,
  dropActive,
  onPointerDown,
  chromeHidden = false,
}: DockFrameProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const runMenuAction = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  return (
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
          'panel-header h-7 cursor-grab touch-none select-none justify-between px-1 active:cursor-grabbing',
          dragging && 'bg-[var(--editor-row-selected)]',
        )}
        title="Arraste para reorganizar"
      >
        <span className="editor-panel-tab active flex min-w-0 max-w-[136px] items-center truncate px-2 text-[11px] font-medium">{label}</span>
        <div ref={menuRef} className="relative flex items-center gap-0.5">
          <button
            aria-label={`Menu ${label}`}
            className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:bg-[var(--editor-row-hover)] hover:text-foreground"
            onClick={() => setMenuOpen((open) => !open)}
            onPointerDown={(event) => event.stopPropagation()}
            title={`Menu ${label}`}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
          <button
            aria-label={`Close ${label}`}
            className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:bg-[var(--editor-row-hover)] hover:text-foreground"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            title={`Close ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="editor-menu-dropdown absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden py-1">
              <DockMenuButton label="Dock Main" onClick={() => runMenuAction(onDockMain)} />
              <DockMenuButton label="Dock Below" onClick={() => runMenuAction(onDockBottom)} />
              <DockMenuButton label="Reset Dock" onClick={() => runMenuAction(onResetDock)} />
              <DockMenuButton label="Close Tab" onClick={() => runMenuAction(onClose)} />
            </div>
          )}
        </div>
      </div>
    )}
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>
  );
};

const DockMenuButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    className="editor-menu-item flex h-7 w-full items-center px-3 text-left text-[11px]"
    onClick={onClick}
    onPointerDown={(event) => event.stopPropagation()}
  >
    {label}
  </button>
);
