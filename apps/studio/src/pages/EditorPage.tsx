import { Fragment, type ReactNode, useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { EditorCanvas } from '@/components/canvas/EditorCanvas';
import { Viewport } from '@/components/canvas/Viewport';
import { EditorHeader } from '@/components/editor/EditorHeader';
import { EditorStatusBar } from '@/components/editor/EditorStatusBar';
import { SceneGraphPanel } from '@/components/editor/SceneGraphPanel';
import { InspectorPanel } from '@/components/editor/InspectorPanel';
import { BottomPanel } from '@/components/editor/BottomPanel';
import { DockFrame } from '@/components/editor/DockFrame';
import { CameraSpeedIndicator } from '@/components/editor/CameraSpeedIndicator';
import { RuntimeGameFrame } from '@/components/editor/RuntimeGameFrame';
import { getDockDragGhostPosition, getDockDropPreviewRect, getDockPanelLabels, getDockPanelSize, getDockRowKey, getDockZoneLayout, getVisibleDockPanelIds, resolveDockTargetFromRects, shouldShowEditorOverlays, shouldUseNativeRuntimeViewport, type DockPanelRect } from '@/components/editor/editorDockLayout';
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
      dragging ? 'w-14 border-[var(--editor-border-light)] bg-[var(--editor-command)] opacity-100' : 'w-2 border-[var(--editor-border-dark)] bg-[var(--editor-border-dark)]/70 opacity-40',
      active && 'bg-[var(--editor-command-active)] shadow-[inset_0_0_0_2px_var(--editor-command-highlight),0_10px_24px_rgba(0,0,0,0.32)]'
    )}
    title={label}
  >
    {dragging && <span className="rotate-90 whitespace-nowrap text-[10px] font-semibold text-foreground">{label}</span>}
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
      'pointer-events-none absolute bottom-3 left-3 right-3 z-50 flex h-[34%] min-h-36 items-center justify-center border-2 border-dashed border-[var(--editor-border-light)] bg-[#121212]/92 text-xs font-semibold text-foreground shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-all duration-150',
      active && 'h-[38%] border-solid bg-[rgba(61,61,61,0.45)] shadow-[0_16px_36px_rgba(0,0,0,0.55)]'
    )}
  >
    Solte aqui para encaixar embaixo
  </div>
);

const DockDragGhost = ({
  label,
  targetLabel,
  position,
}: {
  label: string;
  targetLabel: string;
  position: { left: number; top: number };
}) => (
  <div
    data-testid="dock-drag-ghost"
    className="pointer-events-none fixed z-[70] h-[76px] w-56 overflow-hidden border border-[var(--editor-border-light)] bg-[#1f1f1f]/95 text-foreground shadow-[0_12px_34px_rgba(0,0,0,0.52)] transition-[left,top,opacity,transform] duration-100 ease-out"
    style={{ left: position.left, top: position.top }}
  >
    <div className="panel-header h-7 px-2 text-xs font-semibold">{label}</div>
    <div className="flex h-[48px] items-center px-2.5 text-[11px] text-muted-foreground">
      <span className="border border-[var(--editor-border-light)] bg-[var(--editor-command)] px-2 py-1 text-foreground">{targetLabel}</span>
    </div>
  </div>
);

const DockDropPreview = ({ rect }: { rect: { left: number; top: number; width: number; height: number } }) => (
  <div
    data-testid="dock-drop-preview"
    className="pointer-events-none fixed z-[68] border-2 border-[var(--editor-command-highlight)] bg-[rgba(61,61,61,0.18)] shadow-[0_12px_28px_rgba(0,0,0,0.46)] transition-[left,top,width,height,opacity] duration-100 ease-out"
    style={rect}
  />
);

const getDockTargetLabel = (target: EditorDockTarget | null, labels: Record<EditorPanelId, string>) => {
  if (target === 'bottom-end') return 'Encaixar embaixo';
  if (target === 'main-end') return 'Fim da linha';
  if (target) return `Antes de ${labels[target]}`;
  return 'Escolha um encaixe';
};

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
  const restorePanel = useEditorLayoutStore((s) => s.restorePanel);
  const isRuntimeFullscreen = Boolean(previewSession) && previewDisplayMode === 'fullscreen';
  const [draggedDock, setDraggedDock] = useState<EditorPanelId | null>(null);
  const [dockDropTarget, setDockDropTarget] = useState<EditorDockTarget | null>(null);
  const [dockDragPoint, setDockDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [dockPanelRects, setDockPanelRects] = useState<DockPanelRect[]>([]);
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
    setDockDragPoint(null);
    setDockPanelRects([]);
  }, []);
  const moveDockToTarget = useCallback((source: EditorPanelId, target: EditorDockTarget) => {
    if (source === target) return;
    if (target === 'main-end') movePanelToZone(source, 'main');
    else if (target === 'bottom-end') movePanelToZone(source, 'bottom');
    else movePanelBefore(source, target);
  }, [movePanelBefore, movePanelToZone]);

  useEffect(() => {
    const getPanelRects = (): DockPanelRect[] => [...document.querySelectorAll<HTMLElement>('[data-dock-panel-id]')].flatMap((el): DockPanelRect[] => {
      const id = el.dataset.dockPanelId;
      const zone = el.dataset.dockZone;
      if (!id || !zone || !isPanelId(id) || (zone !== 'main' && zone !== 'bottom')) return [];
      const rect = el.getBoundingClientRect();
      return [{ id, zone, left: rect.left, top: rect.top, width: rect.width, height: rect.height }];
    });
    const resolveTarget = (x: number, y: number, panelRects = getPanelRects(), source?: EditorPanelId): EditorDockTarget | null => {
      const geometric = resolveDockTargetFromRects({ x, y, viewportHeight: window.innerHeight, panels: panelRects, source });
      if (geometric) return geometric;
      const raw = document.elementFromPoint(x, y)
        ?.closest<HTMLElement>('[data-dock-drop-target]')
        ?.dataset.dockDropTarget;
      return (raw !== source && (raw === 'main-end' || raw === 'bottom-end' || isPanelId(raw ?? ''))) ? raw as EditorDockTarget : null;
    };
    const finish = (event: globalThis.PointerEvent) => {
      const drag = pointerDockRef.current;
      if (!drag) return;
      const target = drag.target ?? resolveTarget(event.clientX, event.clientY, undefined, drag.source);
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
      const panelRects = getPanelRects();
      drag.dragging = true;
      drag.target = resolveTarget(event.clientX, event.clientY, panelRects, drag.source);
      setDraggedDock(drag.source);
      setDockDropTarget(drag.target && drag.target !== drag.source ? drag.target : null);
      setDockDragPoint({ x: event.clientX, y: event.clientY });
      setDockPanelRects(panelRects);
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
      <div className="editor-shell fixed inset-0 flex min-w-[1180px] items-center justify-center bg-[var(--editor-bg)] text-[var(--editor-text)]">
        Carregando projeto...
      </div>
    );
  }

  const isRuntimePreview = Boolean(previewSession);
  const shouldRenderEditorViewport = previewSession?.launchTarget.kind !== 'web-runtime';
  const useRuntimeViewport = shouldUseNativeRuntimeViewport(useNativeViewport, isRuntimePreview);
  const showEditorOverlays = shouldShowEditorOverlays(isRuntimePreview);
  const editorRuntimeSurface = (
    <>
      {shouldRenderEditorViewport && (useRuntimeViewport ? <Viewport /> : <EditorCanvas />)}
      {shouldRenderEditorViewport && showEditorOverlays && <CameraSpeedIndicator />}
      {previewSession && <RuntimeGameFrame session={previewSession} />}
    </>
  );
  const visibleDockIds = getVisibleDockPanelIds(previewDock.dockOrder, panels, isRuntimeFullscreen);
  const idsInZone = (zone: EditorDockZone) => visibleDockIds.filter((id) => (
    (previewDock.panelZones[id] ?? (id === 'bottom' ? 'bottom' : 'main')) === zone
  ));
  const mainDockIds = idsInZone('main');
  const bottomDockIds = idsInZone('bottom');
  const dockZoneLayout = getDockZoneLayout(mainDockIds, bottomDockIds);
  const dockPanelLabels = getDockPanelLabels(activeSceneKind, isRuntimePreview);
  const dockContent: Record<EditorPanelId, { label: string; content: ReactNode }> = {
    scene: { label: dockPanelLabels.scene, content: <SceneGraphPanel /> },
    viewport: {
      label: dockPanelLabels.viewport,
      content: (
        <div className={cn(
          'relative h-full',
          isRuntimePreview ? 'bg-[#080808]' : 'border-x border-[var(--editor-border-dark)] bg-[var(--editor-border-dark)]',
        )}>
          {editorRuntimeSurface}
        </div>
      ),
    },
    inspector: { label: dockPanelLabels.inspector, content: <InspectorPanel /> },
    bottom: { label: dockPanelLabels.bottom, content: <BottomPanel /> },
  };
  const dockGhostPosition = dockDragPoint
    ? getDockDragGhostPosition({
      x: dockDragPoint.x,
      y: dockDragPoint.y,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      target: dockDropTarget,
      panels: dockPanelRects,
    })
    : null;
  const dockDropPreviewRect = draggedDock
    ? getDockDropPreviewRect({
      target: dockDropTarget,
      panels: dockPanelRects,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    })
    : null;
  const renderDockRow = (ids: EditorPanelId[], zone: EditorDockZone) => (
    ids.length ? (
      <ResizablePanelGroup key={getDockRowKey(zone, ids)} direction="horizontal" className="h-full">
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
                  onDockMain={() => movePanelToZone(id, 'main')}
                  onDockBottom={() => movePanelToZone(id, 'bottom')}
                  onResetDock={() => restorePanel(id)}
                  dragging={draggedDock === id}
                  draggingAny={Boolean(draggedDock)}
                  dropActive={dockDropTarget === id && draggedDock !== id}
                  customChrome={id === 'scene' || id === 'inspector' || id === 'bottom'}
                  chromeHidden={isRuntimePreview && id === 'viewport'}
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
    <div className="editor-shell fixed inset-0 flex min-w-[1180px] flex-col">
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
                {dockZoneLayout.showMain && (
                  <ResizablePanel id="dock-main-zone" order={0} defaultSize={dockZoneLayout.mainDefaultSize} minSize={35}>
                    {renderDockRow(mainDockIds, 'main')}
                  </ResizablePanel>
                )}
                {dockZoneLayout.showMain && dockZoneLayout.showBottom && <ResizableHandle withHandle />}
                {dockZoneLayout.showBottom && (
                  <>
                    <ResizablePanel
                      id="dock-bottom-zone"
                      order={1}
                      defaultSize={dockZoneLayout.bottomDefaultSize}
                      minSize={dockZoneLayout.showMain ? 16 : 100}
                      maxSize={dockZoneLayout.showMain ? 55 : 100}
                    >
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
              {dockDropPreviewRect && <DockDropPreview rect={dockDropPreviewRect} />}
              {draggedDock && dockGhostPosition && (
                <DockDragGhost
                  label={dockPanelLabels[draggedDock]}
                  targetLabel={getDockTargetLabel(dockDropTarget, dockPanelLabels)}
                  position={dockGhostPosition}
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
      {showEditorOverlays && <MotionControlOverlay />}
    </div>
  );
};

export default EditorPage;
