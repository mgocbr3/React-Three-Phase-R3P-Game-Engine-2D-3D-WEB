import { useEffect, useCallback, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { EditorCanvas } from '@/components/canvas/EditorCanvas';
import { EditorHeader } from '@/components/editor/EditorHeader';
import { EditorStatusBar } from '@/components/editor/EditorStatusBar';
import { SceneGraphPanel } from '@/components/editor/SceneGraphPanel';
import { InspectorPanel } from '@/components/editor/InspectorPanel';
import { BottomPanel } from '@/components/editor/BottomPanel';
import { CameraSpeedIndicator } from '@/components/editor/CameraSpeedIndicator';
import { MobileEditorLayout } from '@/components/editor/mobile';
import { MotionControlOverlay } from '@/components/canvas/MotionControlOverlay';
import { ConflictResolutionDialog } from '@/components/editor/ConflictResolutionDialog';
import { useEditorStore } from '@/stores/editorStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { useProjectAutoSave } from '@/hooks/useProjectAutoSave';
import { TemplateId, GAME_TEMPLATES } from '@/stores/gameStore';
import { usePixllandBridge } from '@/hooks/usePixllandBridge';
import { usePixllandProjectStore } from '@/stores/pixllandProjectStore';
import { useAuthStore } from '@/stores/authStore';
import { useEditorLayoutStore } from '@/stores/editorLayoutStore';
import { fetchProject } from '@/services/projectService';
import { hasSampleProject, openSampleProject } from '@/services/sampleProjects';
import { toast } from 'sonner';

const EditorPage = () => {
  const isMobile = useIsMobile();
  const { templateId } = useParams<{ templateId: string }>();
  const { loadTemplate, currentTemplateId, saveProject, loadSavedProject, hasSavedProject, objects } = useEditorStore();
  const { user } = useAuthStore();
  const panels = useEditorLayoutStore((s) => s.panels);

  //  Ativar auto-save híbrido (local + nuvem quando logado)
  const { setCloudProjectId, pendingConflict, isResolvingConflict, resolveConflict } = useProjectAutoSave();

  const searchParams = new URLSearchParams(window.location.search);
  const isEmbedded = searchParams.get('embedded') === 'true';
  const rawProjectParam = searchParams.get('project');
  const sampleProjectSlug = searchParams.get('sampleProject') || (rawProjectParam && hasSampleProject(rawProjectParam) ? rawProjectParam : null);
  const urlProjectId = searchParams.get('projectId') || (sampleProjectSlug ? null : rawProjectParam);
  const autoCreate = searchParams.get('autocreate') === 'true';
  const autoCreateTitle = searchParams.get('title') || undefined;

  const { openProject, saveToPixlland, requestProjects } = usePixllandBridge();
  const currentProjectId = usePixllandProjectStore((s) => s.currentProjectId);
  const setCurrentProjectId = usePixllandProjectStore((s) => s.setCurrentProjectId);

  const lastSaveRef = useRef<number>(Date.now());
  const hasLoadedSavedRef = useRef<boolean>(false);
  const hasRequestedRemoteProjectRef = useRef<boolean>(false);
  const hasAutoCreatedRef = useRef<boolean>(false);
  const hasLoadedFromCloudRef = useRef<boolean>(false);
  const hasLoadedSampleProjectRef = useRef<boolean>(false);
  
  // Validate and load template
  const isValidTemplate = !templateId || GAME_TEMPLATES.some(t => t.id === templateId);
  
  // Manual save function with toast notification
  const handleSave = useCallback(() => {
    if (isEmbedded) {
      const pid = urlProjectId || currentProjectId;
      if (!pid) {
        toast.error('Abra ou crie um projeto antes de salvar.');
        return;
      }
      saveToPixlland({ projectId: pid, title: autoCreateTitle || 'Meu Projeto' });
      requestProjects();
      lastSaveRef.current = Date.now();
      toast.success('Projeto salvo e sincronizado!', { duration: 2000 });
      return;
    }

    saveProject();
    lastSaveRef.current = Date.now();
    toast.success('Projeto salvo!', { duration: 2000 });
  }, [isEmbedded, urlProjectId, currentProjectId, saveToPixlland, requestProjects, autoCreateTitle, saveProject]);
  
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

  // Load real local/sample Pixlland games directly into the editor for dogfooding.
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
      });
  }, [sampleProjectSlug]);
  
  // Try to load project from cloud if user is logged in and has projectId in URL
  useEffect(() => {
    const loadCloudProject = async () => {
      if (hasLoadedFromCloudRef.current) return;
      if (sampleProjectSlug) return;
      if (!user || !urlProjectId || isEmbedded) return;
      
      hasLoadedFromCloudRef.current = true;
      
      try {
        console.log('[EditorPage] Carregando projeto da nuvem:', urlProjectId);
        const project = await fetchProject(urlProjectId);
        
        if (project && project.game_data) {
          const gameData = project.game_data as any;
          
          useEditorStore.setState({
            objects: gameData.objects || [],
            currentTemplateId: gameData.currentTemplateId || null,
            gameScript: gameData.gameScript || '// Game Script\n',
          });
          
          setCloudProjectId(urlProjectId);
          toast.success('Projeto carregado da nuvem!');
          console.log('[EditorPage]  Projeto carregado:', project.name);
          return;
        }
      } catch (error) {
        console.error('[EditorPage] Erro ao carregar projeto:', error);
      }
    };
    
    loadCloudProject();
  }, [user, urlProjectId, isEmbedded, setCloudProjectId, sampleProjectSlug]);
  
  // Try to load saved project on first mount (automatic restore) - only if no cloud project
  useEffect(() => {
    if (sampleProjectSlug) return;
    if (hasLoadedFromCloudRef.current) return;
    if (urlProjectId && user) return; // Espera carregar da nuvem
    
    // Always try to restore last local save first
    if (!hasLoadedSavedRef.current && hasSavedProject()) {
      const restored = loadSavedProject();
      hasLoadedSavedRef.current = true;
      if (restored) {
        toast.success('Projeto restaurado do último auto-save');
        return;
      }
    }

    // If nothing restored, load template flow
    if (templateId && isValidTemplate && templateId !== currentTemplateId) {
      loadTemplate(templateId as TemplateId);
    } else if (!templateId && !currentTemplateId) {
      // Projeto em branco - carrega template 'blank' que só tem o chão
      loadTemplate('blank' as TemplateId);
    }
  }, [templateId, isValidTemplate, currentTemplateId, loadTemplate, hasSavedProject, loadSavedProject, urlProjectId, user, sampleProjectSlug]);

  // Embedded: if URL has projectId, ask platform to load it.
  useEffect(() => {
    if (!isEmbedded) return;
    if (!urlProjectId) return;
    if (hasRequestedRemoteProjectRef.current) return;
    hasRequestedRemoteProjectRef.current = true;

    setCurrentProjectId(urlProjectId);
    openProject(urlProjectId);
  }, [isEmbedded, urlProjectId, openProject, setCurrentProjectId]);

  // Embedded: create a platform project automatically when coming from dashboard.
  useEffect(() => {
    if (!isEmbedded) return;
    if (!autoCreate) return;
    if (hasAutoCreatedRef.current) return;
    if (urlProjectId) return; // already created

    // Wait a moment so template loading applies objects before saving.
    hasAutoCreatedRef.current = true;
    const timer = setTimeout(async () => {
      try {
        const resp: any = await saveToPixlland({ projectId: null, title: autoCreateTitle || 'Novo Projeto' });
        const newId = resp?.projectId || resp?.id || resp?.gameId;

        if (newId) {
          setCurrentProjectId(newId);

          const url = new URL(window.location.href);
          url.searchParams.set('embedded', 'true');
          url.searchParams.set('projectId', newId);
          url.searchParams.delete('autocreate');
          url.searchParams.delete('title');
          window.history.replaceState({}, '', url.toString());

          requestProjects();
          toast.success('Projeto criado e sincronizado!', { duration: 2000 });
        } else {
          toast.error('Projeto criado, mas sem ID retornado pela plataforma.');
        }
      } catch (e) {
        toast.error('Falha ao criar projeto na plataforma.');
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [isEmbedded, autoCreate, urlProjectId, saveToPixlland, autoCreateTitle, requestProjects, setCurrentProjectId]);
  
  if (!isValidTemplate) {
    return <Navigate to="/" replace />;
  }

  // Mobile Layout
  if (isMobile) {
    return <MobileEditorLayout />;
  }

  return (
    <div className="editor-shell fixed inset-0 flex flex-col">
      {/* Top Header */}
      <EditorHeader />
      
      {/* Main Content with Resizable Panels */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left + Center Section (Hierarchy, Canvas, Bottom) */}
          <ResizablePanel defaultSize={panels.inspector ? 82 : 100} minSize={55}>
            <ResizablePanelGroup direction="vertical" className="h-full">
              {/* Top Section: Hierarchy + Canvas */}
              <ResizablePanel defaultSize={panels.bottom ? 70 : 100} minSize={40}>
                <ResizablePanelGroup direction="horizontal" className="h-full">
                  {/* Left Panel - Scene Graph / Hierarchy */}
                  {panels.scene && (
                    <>
                      <ResizablePanel defaultSize={18} minSize={10} maxSize={28}>
                        <SceneGraphPanel />
                      </ResizablePanel>
                      
                      <ResizableHandle withHandle />
                    </>
                  )}
                  
                  {/* Center - Canvas */}
                  <ResizablePanel defaultSize={panels.scene ? 82 : 100} minSize={50}>
                    <div className="relative h-full border-x border-[#111] bg-[#111]">
                      <EditorCanvas />
                      <CameraSpeedIndicator />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
              
              {/* Bottom Section: Assets Browser / Console / Store */}
              {panels.bottom && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
                    <BottomPanel />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>
          
          {/* Right Panel - Inspector (full height) */}
          {panels.inspector && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
                <InspectorPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
      
      {/* Bottom Status Bar */}
      <EditorStatusBar />
      
      {/* Motion Control Overlay - renders on top of everything when enabled */}
      <MotionControlOverlay />
      
      {/* Conflict Resolution Dialog */}
      <ConflictResolutionDialog
        conflict={pendingConflict}
        onResolve={resolveConflict}
        onCancel={() => {
          // User canceled - could show warning about unsaved changes
          toast.warning('Conflito não resolvido. Suas mudanças não foram salvas na nuvem.');
        }}
        isResolving={isResolvingConflict}
      />
    </div>
  );
};

export default EditorPage;
