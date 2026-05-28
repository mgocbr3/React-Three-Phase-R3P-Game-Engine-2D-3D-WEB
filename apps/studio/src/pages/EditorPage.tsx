import { Fragment, type DragEvent, type PointerEvent, type ReactNode, useEffect, useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { X } from 'lucide-react';
import { EditorCanvas } from '@/components/canvas/EditorCanvas';
import { Viewport } from '@/components/canvas/Viewport';
import { EditorHeader } from '@/components/editor/EditorHeader';
import { EditorStatusBar } from '@/components/editor/EditorStatusBar';
import { SceneGraphPanel } from '@/components/editor/SceneGraphPanel';
import { InspectorPanel } from '@/components/editor/InspectorPanel';
import { BottomPanel } from '@/components/editor/BottomPanel';
import { CameraSpeedIndicator } from '@/components/editor/CameraSpeedIndicator';
import { RuntimeGameFrame } from '@/components/editor/RuntimeGameFrame';
import { getDockPanelSize } from '@/components/editor/editorDockLayout';
import { MotionControlOverlay } from '@/components/canvas/MotionControlOverlay';
import { useEditorStore } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { useEditorAutosave } from '@/hooks/useEditorAutosave';
import { useEditorArrowNudge } from '@/hooks/useEditorArrowNudge';
import { defaultDockOrder, useEditorLayoutStore, type EditorPanelId } from '@/stores/editorLayoutStore';
import { useViewportStore } from '@/stores/viewportStore';
import { hasSampleProject, openSampleProject } from '@/services/sampleProjects';
import {
  hasActiveProjectWorkspace,
  openStoredProjectWorkspace,
  saveActiveProjectDocumentToDirectory,
} from '@/services/localProjectFiles';
import { FilePickerBusyError } from '@/services/filePickerLock';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DOCK_MIME = 'application/x-pixl-dock';

const isPanelId = (id: string): id is EditorPanelId => (
  (defaultDockOrder as string[]).includes(id)
);

const DockFrame = ({
  id,
  label,
  children,
  onClose,
  dragging,
  dropActive,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onPointerDown,
}: {
  id: EditorPanelId;
  label: string;
  children: ReactNode;
  onClose: () => void;
  dragging: boolean;
  dropActive: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
}) => (
  <div
    data-testid={`dock-panel-${id}`}
    data-dock-drop-target={id}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
    className={cn(
      'editor-dock editor-dock-outline relative flex h-full min-w-0 flex-col overflow-hidden transition-[border-color,box-shadow,opacity,transform] duration-150',
      dragging && 'scale-[0.995] opacity-60',
      dropActive && 'border-primary/70 shadow-[inset_4px_0_0_hsl(var(--primary))]'
    )}
  >
    {dropActive && (
      <div
        data-testid={`dock-drop-before-${id}`}
        className="pointer-events-none absolute inset-y-0 left-0 z-30 w-1 bg-primary shadow-[0_0_16px_rgba(75,160,255,0.75)]"
      />
    )}
    <div
      data-testid={`dock-tab-${id}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DOCK_MIME, id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
      className={cn(
        'panel-header h-8 cursor-grab select-none justify-between px-2 active:cursor-grabbing',
        dragging && 'bg-[var(--editor-row-selected)]'
      )}
      title="Arraste para reorganizar"
    >
      <span className="truncate text-xs font-medium text-foreground">{label}</span>
      <button
        className="p-1 text-muted-foreground hover:text-foreground"
        onClick={onClose}
        onPointerDown={(event) => event.stopPropagation()}
        title="Fechar painel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>
);

const DockEndDrop = ({
  dragging,
  active,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  dragging: boolean;
  active: boolean;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) => (
  <div
    data-testid="dock-end-drop"
    data-dock-drop-target="end"
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
    className={cn(
      'relative h-full shrink-0 border-l transition-[width,background,opacity] duration-150',
      dragging ? 'w-8 border-primary/50 bg-primary/10 opacity-100' : 'w-2 border-[var(--editor-border-dark)] bg-[var(--editor-border-dark)]/70 opacity-40',
      active && 'bg-primary/25'
    )}
    title="Solte aqui para mover o painel ao fim"
  >
    {active && <div className="absolute inset-y-0 right-0 w-1 bg-primary shadow-[0_0_16px_rgba(75,160,255,0.75)]" />}
  </div>
);

const EditorPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const { activeSceneKind, loadTemplate, saveProject, loadSavedProject, hasSavedProject } = useEditorStore();
  const hasLoadedTemplateRef = useRef<boolean>(false);
  const previewSession = useRuntimeGameStore((s) => s.previewSession);
  const previewDisplayMode = useRuntimeGameStore((s) => s.previewDisplayMode);
  const panels = useEditorLayoutStore((s) => s.panels);
  const dockOrder = useEditorLayoutStore((s) => s.dockOrder);
  const setPanelVisible = useEditorLayoutStore((s) => s.setPanelVisible);
  const movePanelBefore = useEditorLayoutStore((s) => s.movePanelBefore);
  const movePanelToEnd = useEditorLayoutStore((s) => s.movePanelToEnd);
  const isRuntimeFullscreen = Boolean(previewSession) && previewDisplayMode === 'fullscreen';
  const [draggedDock, setDraggedDock] = useState<EditorPanelId | null>(null);
  const [dockDropTarget, setDockDropTarget] = useState<EditorPanelId | 'end' | null>(null);
  const pointerDockRef = useRef<{
    source: EditorPanelId;
    startX: number;
    startY: number;
    target: EditorPanelId | 'end' | null;
    dragging: boolean;
  } | null>(null);

  // Local autosave — writes `pixl-project-document` + per-id snapshot after
  // any editor mutation. Without this, Inspector edits / drags / gizmo moves
  // are lost on reload because the singleton doc only gets written by
  // `applyProjectDocumentToEditor` (at load time) and `saveActiveProjectDocumentToDirectory`
  // (manual File→Save). The 500 ms debounce coalesces drag streams.
  useEditorAutosave();

  // Arrow-key nudge for the selected object in edit mode (Shift = 10×,
  // Alt = 0.1× step). Pair with PhaserRuntimeMount's keyboard-plugin
  // toggle: in edit mode Phaser keys go silent so the runtime script
  // can't steal arrows; this hook claims them for the editor instead.
  useEditorArrowNudge();

  const searchParams = new URLSearchParams(window.location.search);
  // GDD §6.6 — Phase 6A. New native mount toggled via ?engine=native.
  // Phase 6B will remove the flag and make Viewport the only path
  // (which is when the §5.3 R3F deletion happens). For now both paths
  // coexist so the studio keeps working while the new runtime is proven
  // against the real Harvest Rush data.
  const useNativeViewport = searchParams.get('engine') === 'native';
  const rawProjectParam = searchParams.get('project');
  const sampleProjectSlug = searchParams.get('sampleProject') || (rawProjectParam && hasSampleProject(rawProjectParam) ? rawProjectParam : null);
  const localProjectId = searchParams.get('localProject');

  // Lock the viewport kind based on the URL `?kind=2d|3d`. This
  // captures projects created via "Novo Projeto" (CreateProjectDialog
  // navigates with `&kind=...`) — sample/disk projects continue to
  // get the lock from `applyProjectDocumentToEditor` when the
  // .pixlproject.json loads. Without this, freshly-created projects
  // landed in the editor with the lock still null and the toolbar
  // showed both 2D and 3D buttons (instead of the locked badge).
  useEffect(() => {
    const k = searchParams.get('kind');
    if (k === '2d' || k === '3d') {
      useViewportStore.getState().setLockedKind(k);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastSaveRef = useRef<number>(Date.now());
  const hasLoadedSavedRef = useRef<boolean>(false);
  const hasLoadedSampleProjectRef = useRef<boolean>(false);
  const hasLoadedLocalProjectRef = useRef<boolean>(false);
  const [isOpeningDiskProject, setIsOpeningDiskProject] = useState(Boolean(sampleProjectSlug || localProjectId));


  // Manual save function with toast notification
  const handleSave = useCallback(() => {
    if (hasActiveProjectWorkspace()) {
      saveActiveProjectDocumentToDirectory()
        .then(() => {
          lastSaveRef.current = Date.now();
          toast.success('Projeto salvo no disco!', { duration: 2000 });
        })
        .catch((error) => {
          if ((error as DOMException)?.name === 'AbortError') return;
          if (error instanceof FilePickerBusyError) {
            // Save is racing another picker (e.g. user mid-click on "Save as .pixl").
            // Silent — the other picker's flow will finish.
            return;
          }
          const message = error instanceof Error ? error.message : 'Nao foi possivel salvar no disco.';
          toast.error(message);
        });
      return;
    }

    saveProject();
    lastSaveRef.current = Date.now();
    toast.success('Projeto salvo!', { duration: 2000 });
  }, [saveProject]);

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Load sample projects directly into the editor for dogfooding.
  useEffect(() => {
    if (!sampleProjectSlug) return;
    if (hasLoadedSampleProjectRef.current) return;

    hasLoadedSampleProjectRef.current = true;

    openSampleProject(sampleProjectSlug)
      .then((document) => {
        toast.success(`Projeto aberto: ${document.name}`);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Nao foi possivel abrir o projeto local.';
        toast.error(message);
      })
      .finally(() => {
        setIsOpeningDiskProject(false);
      });
  }, [sampleProjectSlug]);

  // Reopen a previously granted local project folder when returning to the editor.
  useEffect(() => {
    if (!localProjectId) return;
    if (hasLoadedLocalProjectRef.current) return;

    hasLoadedLocalProjectRef.current = true;

    openStoredProjectWorkspace(localProjectId)
      .then(({ document }) => {
        toast.success(`Projeto local reaberto: ${document.name}`);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Abra a pasta do projeto novamente.';
        toast.error(message);
      })
      .finally(() => {
        setIsOpeningDiskProject(false);
      });
  }, [localProjectId]);

  // Try to load saved project on first mount (automatic restore)
  useEffect(() => {
    if (sampleProjectSlug) return;
    if (localProjectId) return;

    // Always try to restore last local save first
    if (!hasLoadedSavedRef.current && hasSavedProject()) {
      const restored = loadSavedProject();
      hasLoadedSavedRef.current = true;
      if (restored) {
        toast.success('Projeto restaurado do último auto-save');
        return;
      }
    }

    // If nothing restored, seed the default scene once per editor mount.
    // `loadTemplate` no longer branches on templateId — it always loads the
    // empty default — so all we need to gate is "did we already seed?".
    if (!hasLoadedTemplateRef.current) {
      hasLoadedTemplateRef.current = true;
      loadTemplate(templateId ?? 'blank');
    }
  }, [templateId, loadTemplate, hasSavedProject, loadSavedProject, sampleProjectSlug, localProjectId]);

  const clearDockDrag = () => {
    setDraggedDock(null);
    setDockDropTarget(null);
  };
  const readDockSource = (event: DragEvent<HTMLDivElement>) => {
    const source = event.dataTransfer.getData(DOCK_MIME) || draggedDock || '';
    return isPanelId(source) ? source : null;
  };
  const markDockDrop = (event: DragEvent<HTMLDivElement>, target: EditorPanelId | 'end') => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (draggedDock) setDockDropTarget(target);
  };
  const dropDockBefore = (event: DragEvent<HTMLDivElement>, target: EditorPanelId) => {
    event.preventDefault();
    const source = readDockSource(event);
    if (source && source !== target) movePanelBefore(source, target);
    clearDockDrag();
  };
  const dropDockToEnd = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const source = readDockSource(event);
    if (source) movePanelToEnd(source);
    clearDockDrag();
  };

  useEffect(() => {
    const resolveTarget = (x: number, y: number) => {
      const raw = document.elementFromPoint(x, y)
        ?.closest<HTMLElement>('[data-dock-drop-target]')
        ?.dataset.dockDropTarget;
      return raw === 'end' || isPanelId(raw ?? '') ? raw as EditorPanelId | 'end' : null;
    };
    const finish = (event: globalThis.PointerEvent) => {
      const drag = pointerDockRef.current;
      if (!drag) return;
      const target = drag.target ?? resolveTarget(event.clientX, event.clientY);
      pointerDockRef.current = null;
      if (drag.dragging && target && target !== drag.source) {
        target === 'end' ? movePanelToEnd(drag.source) : movePanelBefore(drag.source, target);
      }
      clearDockDrag();
    };
    const move = (event: globalThis.PointerEvent) => {
      const drag = pointerDockRef.current;
      if (!drag) return;
      if (!drag.dragging && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
      drag.dragging = true;
      drag.target = resolveTarget(event.clientX, event.clientY);
      setDraggedDock(drag.source);
      setDockDropTarget(drag.target && drag.target !== drag.source ? drag.target : null);
      event.preventDefault();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [movePanelBefore, movePanelToEnd]);

  if (isOpeningDiskProject) {
    return (
      <div className="editor-shell fixed inset-0 flex items-center justify-center bg-[var(--editor-bg)] text-[var(--editor-text)]">
        Carregando projeto...
      </div>
    );
  }

  const shouldRenderEditorViewport = previewSession?.launchTarget.kind !== 'web-runtime';
  const editorRuntimeSurface = (
    <>
      {shouldRenderEditorViewport && (useNativeViewport ? <Viewport /> : <EditorCanvas />)}
      {shouldRenderEditorViewport && <CameraSpeedIndicator />}
      {previewSession && <RuntimeGameFrame session={previewSession} />}
    </>
  );
  const visibleDockIds = dockOrder.filter((id) => panels[id]);
  const dockContent: Record<EditorPanelId, { label: string; content: ReactNode }> = {
    scene: { label: 'Hierarchy', content: <SceneGraphPanel /> },
    viewport: {
      label: activeSceneKind === '2d' ? 'Preview 2D' : 'Scene 3D',
      content: <div className="relative h-full border-x border-[var(--editor-border-dark)] bg-[var(--editor-border-dark)]">{editorRuntimeSurface}</div>,
    },
    inspector: { label: 'Inspector', content: <InspectorPanel /> },
    bottom: { label: 'Project', content: <BottomPanel /> },
  };

  return (
    <div className="editor-shell fixed inset-0 flex flex-col">
      {/* Top Header */}
      <EditorHeader />

      {/* Main Content with Resizable Panels */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isRuntimeFullscreen ? (
          <div className="relative h-full bg-[#080808]">
            {editorRuntimeSurface}
          </div>
        ) : (
          visibleDockIds.length ? (
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              {visibleDockIds.map((id, index) => {
                const size = getDockPanelSize(id, visibleDockIds);
                return (
                  <Fragment key={id}>
                    {index > 0 && <ResizableHandle withHandle />}
                    <ResizablePanel id={id} order={index} {...size}>
                      <DockFrame
                        id={id}
                        label={dockContent[id].label}
                        onClose={() => setPanelVisible(id, false)}
                        dragging={draggedDock === id}
                        dropActive={dockDropTarget === id && draggedDock !== id}
                        onDragStart={() => setDraggedDock(id)}
                        onDragEnd={clearDockDrag}
                        onDragOver={(event) => markDockDrop(event, id)}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDockDropTarget(null);
                        }}
                        onDrop={(event) => dropDockBefore(event, id)}
                        onPointerDown={(event) => {
                          pointerDockRef.current = {
                            source: id,
                            startX: event.clientX,
                            startY: event.clientY,
                            target: null,
                            dragging: false,
                          };
                        }}
                      >
                        {dockContent[id].content}
                      </DockFrame>
                    </ResizablePanel>
                  </Fragment>
                );
              })}
              <DockEndDrop
                dragging={Boolean(draggedDock)}
                active={dockDropTarget === 'end'}
                onDragOver={(event) => markDockDrop(event, 'end')}
                onDragLeave={() => setDockDropTarget(null)}
                onDrop={dropDockToEnd}
              />
            </ResizablePanelGroup>
          ) : (
            <div className="flex h-full items-center justify-center bg-[var(--editor-bg)] text-xs text-muted-foreground">
              Reabra painéis em Window.
            </div>
          )
        )}
      </div>

      {/* Bottom Status Bar */}
      <EditorStatusBar />

      {/* Motion Control Overlay - renders on top of everything when enabled */}
      <MotionControlOverlay />
    </div>
  );
};

export default EditorPage;
