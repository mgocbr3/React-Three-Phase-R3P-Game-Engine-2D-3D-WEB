import { Fragment, type ReactNode, useEffect, useCallback, useRef, useState } from 'react';
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
import { toast } from 'sonner';

const isPanelId = (id: string): id is EditorPanelId => (
  (defaultDockOrder as string[]).includes(id)
);

const panelSize = (id: EditorPanelId) => ({
  defaultSize: id === 'viewport' ? 46 : 18,
  minSize: id === 'viewport' ? 30 : 12,
  maxSize: id === 'viewport' ? 80 : 45,
});

const DockFrame = ({
  id,
  label,
  children,
  onClose,
  onMoveBefore,
}: {
  id: EditorPanelId;
  label: string;
  children: ReactNode;
  onClose: () => void;
  onMoveBefore: (panel: EditorPanelId, target: EditorPanelId) => void;
}) => (
  <div data-testid={`dock-panel-${id}`} className="editor-dock editor-dock-outline flex h-full min-w-0 flex-col overflow-hidden">
    <div
      data-testid={`dock-tab-${id}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-pixl-dock', id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const source = event.dataTransfer.getData('application/x-pixl-dock');
        if (isPanelId(source)) onMoveBefore(source, id);
      }}
      className="panel-header h-8 cursor-grab select-none justify-between px-2 active:cursor-grabbing"
      title="Arraste para reorganizar"
    >
      <span className="truncate text-xs font-medium text-foreground">{label}</span>
      <button className="p-1 text-muted-foreground hover:text-foreground" onClick={onClose} title="Fechar painel">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </div>
);

const DockEndDrop = ({ onMoveToEnd }: { onMoveToEnd: (panel: EditorPanelId) => void }) => (
  <div
    data-testid="dock-end-drop"
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => {
      const source = event.dataTransfer.getData('application/x-pixl-dock');
      if (isPanelId(source)) onMoveToEnd(source);
    }}
    className="h-full w-3 shrink-0 border-l border-[var(--editor-border-dark)] bg-[var(--editor-border-dark)]/70"
    title="Solte aqui para mover o painel ao fim"
  />
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
                const size = panelSize(id);
                return (
                  <Fragment key={id}>
                    {index > 0 && <ResizableHandle withHandle />}
                    <ResizablePanel {...size}>
                      <DockFrame
                        id={id}
                        label={dockContent[id].label}
                        onClose={() => setPanelVisible(id, false)}
                        onMoveBefore={movePanelBefore}
                      >
                        {dockContent[id].content}
                      </DockFrame>
                    </ResizablePanel>
                  </Fragment>
                );
              })}
              <DockEndDrop onMoveToEnd={movePanelToEnd} />
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
