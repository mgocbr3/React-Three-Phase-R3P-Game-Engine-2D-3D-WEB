import { Fragment, type PointerEvent, type ReactNode, useEffect, useCallback, useMemo, useRef, useState } from 'react';
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
import { getDockPanelSize, resolveDockTargetFromRects, type DockPanelRect } from '@/components/editor/editorDockLayout';
import { MotionControlOverlay } from '@/components/canvas/MotionControlOverlay';
import { useEditorStore } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { useEditorAutosave } from '@/hooks/useEditorAutosave';
import { useEditorArrowNudge } from '@/hooks/useEditorArrowNudge';
import { defaultDockOrder, previewDockMove, useEditorLayoutStore, type EditorDockTarget, type EditorDockZone, type EditorPanelId } from '@/stores/editorLayoutStore';
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

const isPanelId = (id: string): id is EditorPanelId => (
  (defaultDockOrder as string[]).includes(id)
);

const DockFrame = ({
  id,
  zone,
  label,
  children,
  onClose,
  dragging,
  draggingAny,
  dropActive,
  onPointerDown,
}: {
  id: EditorPanelId;
  zone: EditorDockZone;
  label: string;
  children: ReactNode;
  onClose: () => void;
  dragging: boolean;
  draggingAny: boolean;
  dropActive: boolean;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
}) => (
  <div
    data-testid={`dock-panel-${id}`}
    data-dock-drop-target={id}
    data-dock-panel-id={id}
    data-dock-zone={zone}
    className={cn(
      'editor-dock editor-dock-outline relative flex h-full min-w-0 flex-col overflow-hidden transition-[border-color,box-shadow,opacity,transform] duration-150',
      dragging && 'scale-[0.995] opacity-60',
      draggingAny && !dragging && 'shadow-[inset_0_0_0_1px_rgba(80,155,255,0.18)]',
      dropActive && 'border-primary/80 bg-primary/[0.03] shadow-[inset_0_0_0_2px_hsl(var(--primary)),0_0_24px_rgba(75,160,255,0.28)]'
    )}
  >
    {dropActive && (
      <div
        data-testid={`dock-drop-before-${id}`}
        className="pointer-events-none absolute inset-1 z-30 border-2 border-primary/80 bg-primary/10 shadow-[0_0_18px_rgba(75,160,255,0.75)]"
      />
    )}
    <div
      data-testid={`dock-tab-${id}`}
      draggable={false}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        onPointerDown(event);
      }}
      className={cn(
        'panel-header h-8 cursor-grab touch-none select-none justify-between px-2 active:cursor-grabbing',
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
  target,
  label,
  dragging,
  active,
}: {
  target: 'main-end' | 'bottom-end';
  label: string;
  dragging: boolean;
  active: boolean;
}) => (
  <div
    data-testid={`dock-end-drop-${target}`}
    data-dock-drop-target={target}
    className={cn(
      'relative flex h-full shrink-0 items-center justify-center overflow-hidden border-l transition-[width,background,opacity] duration-150',
      dragging ? 'w-14 border-primary/50 bg-primary/10 opacity-100' : 'w-2 border-[var(--editor-border-dark)] bg-[var(--editor-border-dark)]/70 opacity-40',
      active && 'bg-primary/25 shadow-[inset_0_0_0_2px_hsl(var(--primary)),0_0_24px_rgba(75,160,255,0.32)]'
    )}
    title={label}
  >
    {dragging && <span className="rotate-90 whitespace-nowrap text-[10px] font-semibold text-primary/90">{label}</span>}
  </div>
);

const DockBottomMagnet = ({
  active,
}: {
  active: boolean;
}) => (
  <div
    data-testid="dock-bottom-magnet"
    data-dock-drop-target="bottom-end"
    className={cn(
      'pointer-events-none absolute bottom-3 left-3 right-3 z-50 flex h-[34%] min-h-36 items-center justify-center border-2 border-dashed border-primary/55 bg-[#121212]/88 text-xs font-semibold text-primary shadow-[0_0_28px_rgba(75,160,255,0.22)] backdrop-blur-sm transition-all duration-150',
      active && 'h-[38%] border-solid border-primary bg-primary/15 shadow-[0_0_34px_rgba(75,160,255,0.45)]'
    )}
  >
    Solte aqui para encaixar embaixo
  </div>
);

const EditorPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const { activeSceneKind, loadTemplate, saveProject, loadSavedProject, hasSavedProject } = useEditorStore();
  const hasLoadedTemplateRef = useRef<boolean>(false);
  const previewSession = useRuntimeGameStore((s) => s.previewSession);
  const previewDisplayMode = useRuntimeGameStore((s) => s.previewDisplayMode);
  const panels = useEditorLayoutStore((s) => s.panels);
  const panelZones = useEditorLayoutStore((s) => s.panelZones);
  const dockOrder = useEditorLayoutStore((s) => s.dockOrder);
  const setPanelVisible = useEditorLayoutStore((s) => s.setPanelVisible);
  const movePanelBefore = useEditorLayoutStore((s) => s.movePanelBefore);
  const movePanelToZone = useEditorLayoutStore((s) => s.movePanelToZone);
  const isRuntimeFullscreen = Boolean(previewSession) && previewDisplayMode === 'fullscreen';
  const [draggedDock, setDraggedDock] = useState<EditorPanelId | null>(null);
  const [dockDropTarget, setDockDropTarget] = useState<EditorDockTarget | null>(null);
  const pointerDockRef = useRef<{
    source: EditorPanelId;
    startX: number;
    startY: number;
    target: EditorDockTarget | null;
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

  const clearDockDrag = useCallback(() => {
    setDraggedDock(null);
    setDockDropTarget(null);
  }, []);
  const moveDockToTarget = useCallback((source: EditorPanelId, target: EditorDockTarget) => {
    if (source === target) return;
    if (target === 'main-end') movePanelToZone(source, 'main');
    else if (target === 'bottom-end') movePanelToZone(source, 'bottom');
    else movePanelBefore(source, target);
  }, [movePanelBefore, movePanelToZone]);

  useEffect(() => {
    const resolveTarget = (x: number, y: number): EditorDockTarget | null => {
      const panelRects = [...document.querySelectorAll<HTMLElement>('[data-dock-panel-id]')].flatMap((el): DockPanelRect[] => {
        const id = el.dataset.dockPanelId;
        const zone = el.dataset.dockZone;
        if (!id || !zone || !isPanelId(id) || (zone !== 'main' && zone !== 'bottom')) return [];
        const rect = el.getBoundingClientRect();
        return [{ id, zone, left: rect.left, top: rect.top, width: rect.width, height: rect.height }];
      });
      const geometric = resolveDockTargetFromRects({ x, y, viewportHeight: window.innerHeight, panels: panelRects });
      if (geometric) return geometric;
      const raw = document.elementFromPoint(x, y)
        ?.closest<HTMLElement>('[data-dock-drop-target]')
        ?.dataset.dockDropTarget;
      return raw === 'main-end' || raw === 'bottom-end' || isPanelId(raw ?? '') ? raw as EditorDockTarget : null;
    };
    const finish = (event: globalThis.PointerEvent) => {
      const drag = pointerDockRef.current;
      if (!drag) return;
      const target = drag.target ?? resolveTarget(event.clientX, event.clientY);
      pointerDockRef.current = null;
      if (drag.dragging && target && target !== drag.source) {
        moveDockToTarget(drag.source, target);
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
  }, [clearDockDrag, moveDockToTarget]);

  const previewDock = useMemo(() => (
    draggedDock && dockDropTarget
      ? previewDockMove(dockOrder, panelZones, draggedDock, dockDropTarget)
      : { dockOrder, panelZones }
  ), [dockDropTarget, dockOrder, draggedDock, panelZones]);

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
  const visibleDockIds = previewDock.dockOrder.filter((id) => panels[id]);
  const idsInZone = (zone: EditorDockZone) => visibleDockIds.filter((id) => (
    (previewDock.panelZones[id] ?? (id === 'bottom' ? 'bottom' : 'main')) === zone
  ));
  const mainDockIds = idsInZone('main');
  const bottomDockIds = idsInZone('bottom');
  const dockContent: Record<EditorPanelId, { label: string; content: ReactNode }> = {
    scene: { label: 'Hierarchy', content: <SceneGraphPanel /> },
    viewport: {
      label: activeSceneKind === '2d' ? 'Preview 2D' : 'Scene 3D',
      content: <div className="relative h-full border-x border-[var(--editor-border-dark)] bg-[var(--editor-border-dark)]">{editorRuntimeSurface}</div>,
    },
    inspector: { label: 'Inspector', content: <InspectorPanel /> },
    bottom: { label: 'Project', content: <BottomPanel /> },
  };
  const renderDockRow = (ids: EditorPanelId[], zone: EditorDockZone) => (
    ids.length ? (
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {ids.map((id, index) => {
          const size = getDockPanelSize(id, ids);
          return (
            <Fragment key={id}>
              {index > 0 && <ResizableHandle withHandle />}
              <ResizablePanel id={`${zone}-${id}`} order={index} {...size}>
                <DockFrame
                  id={id}
                  zone={zone}
                  label={dockContent[id].label}
                  onClose={() => setPanelVisible(id, false)}
                  dragging={draggedDock === id}
                  draggingAny={Boolean(draggedDock)}
                  dropActive={dockDropTarget === id && draggedDock !== id}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
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
          target={zone === 'bottom' ? 'bottom-end' : 'main-end'}
          label={zone === 'bottom' ? 'Fim embaixo' : 'Fim da linha'}
          dragging={Boolean(draggedDock)}
          active={dockDropTarget === (zone === 'bottom' ? 'bottom-end' : 'main-end')}
        />
      </ResizablePanelGroup>
    ) : (
      <div className="flex h-full items-center justify-center bg-[var(--editor-bg)] text-xs text-muted-foreground">
        Reabra painéis em Window.
      </div>
    )
  );

  return (
    <div className="editor-shell fixed inset-0 flex flex-col">
      {/* Top Header */}
      <EditorHeader />

      {/* Main Content with Resizable Panels */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {isRuntimeFullscreen ? (
          <div className="relative h-full bg-[#080808]">
            {editorRuntimeSurface}
          </div>
        ) : (
          visibleDockIds.length ? (
            <>
              <ResizablePanelGroup direction="vertical" className="flex-1">
                <ResizablePanel id="dock-main-zone" order={0} defaultSize={bottomDockIds.length ? 72 : 100} minSize={35}>
                  {renderDockRow(mainDockIds, 'main')}
                </ResizablePanel>
                {bottomDockIds.length > 0 && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel id="dock-bottom-zone" order={1} defaultSize={28} minSize={16} maxSize={55}>
                      {renderDockRow(bottomDockIds, 'bottom')}
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
              {draggedDock && (
                <DockBottomMagnet
                  active={dockDropTarget === 'bottom-end'}
                />
              )}
            </>
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
