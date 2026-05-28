import {
  AlertTriangle,
  Box,
  ChevronDown,
  CheckCircle2,
  Circle,
  Clipboard,
  Copy,
  Cone,
  Eye,
  FileArchive,
  FolderOpen,
  Gamepad2,
  Github,
  Grid3X3,
  HelpCircle,
  History,
  Info,
  Keyboard,
  Layers,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Monitor,
  Mountain,
  PanelBottom,
  PanelLeft,
  Pause,
  Play,
  Plus,
  Redo,
  Save,
  Settings,
  Square,
  Sun,
  Terminal,
  Trash2,
  Type,
  Undo,
  Wrench,
  MessageSquare,
  Book,
  Image as ImageIcon,
  Lightbulb,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import logoSilver from '@/assets/r3p-logo-light.png';
import { useEditorStore, type ObjectType } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { EngineSettingsModal } from './EngineSettingsModal';
import { BuildSettingsModal } from './BuildSettingsModal';
import { defaultTerrainSettings, useTerrainStore, TerrainSettings } from '@/stores/terrainStore';
import { TerrainSettingsModal } from '@/components/terrain/TerrainSettingsModal';
import { toast } from 'sonner';
import { useEditorLayoutStore } from '@/stores/editorLayoutStore';
import { useBottomPanelTabsStore, type BottomTabId } from '@/stores/bottomPanelTabsStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAssetStore } from '@/stores/assetStore';
import { cn } from '@/lib/utils';
import {
  getCurrentProjectWorkspace,
  openProjectDocumentFromDirectory,
  saveActiveProjectDocumentToDirectory,
} from '@/services/localProjectFiles';
import type { PixlProjectDocument } from '@/engine/project/schema';
import {
  createActiveProjectDiagnosticsSnapshot,
  type ProjectDiagnosticsSummary,
  type ProjectDiagnosticStatus,
} from '@/services/projectDiagnostics';
import { handleEditorObjectShortcut } from '@/services/editorObjectShortcuts';
import {
  announcePixlOpen,
  announcePixlSave,
  openPixlPackageFromDisk,
  saveCurrentProjectAsPixl,
} from '@/services/pixlPackageIO';
import { FilePickerBusyError } from '@/services/filePickerLock';
import { EditorToolbar } from './EditorToolbar';
import { getEditorAddMenuSections } from './editorAddMenu';
import { toggleRuntimePreviewFromEditor } from '@/engine/runtime/runtimePreviewControls';
import { getRuntimeAdapterLabel } from '@/engine/runtime/runtimePreview';

interface MenuItem {
  label: string;
  shortcut?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
}

interface MenuConfig {
  [key: string]: MenuItem[];
}

const sceneAddIcons: Partial<Record<ObjectType | 'terrain', React.ComponentType<{ className?: string }>>> = {
  box: Box,
  sphere: Circle,
  cylinder: Layers,
  plane: Layers,
  rectangle: Square,
  circle: Circle,
  text: Type,
  sprite: ImageIcon,
  light: Lightbulb,
  sunlight: Sun,
  spotlight: Cone,
  terrain: Mountain,
};

export const EditorHeader = () => {
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBuildSettingsOpen, setIsBuildSettingsOpen] = useState(false);
  const [buildProject, setBuildProject] = useState<PixlProjectDocument | null>(null);
  const [localWorkspace, setLocalWorkspace] = useState(() => getCurrentProjectWorkspace());
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  const {
    activeSceneKind,
    objects,
    isEditMode,
    gameScript,
    transformSpace,
    snapEnabled,
    snapTranslate,
    snapRotate,
    snapScale,
    undo,
    redo,
    canUndo,
    canRedo,
    addObject,
    deleteObject,
    duplicateObject,
    copyObject,
    cutObject,
    pasteObject,
    hasObjectClipboard,
    selectedObjectId,
    saveProject,
    loadSavedProject,
    hasSavedProject,
    clearSavedProject,
  } = useEditorStore();

  const {
    terrainSettings,
    isModalOpen,
    setModalOpen: setTerrainModalOpen,
    createTerrain,
    updateTerrainSettings,
  } = useTerrainStore();

  const modalSettings = terrainSettings ?? defaultTerrainSettings;
  const { showGrid, showStats, updateSettings } = useEngineSettings();
  const localProjectId = useProjectStore((s) => s.currentProjectId);
  const localProject = useProjectStore((s) => s.projects.find((project) => project.id === localProjectId));
  const projectAssets = useAssetStore((s) => s.projectAssets);
  const previewSession = useRuntimeGameStore((s) => s.previewSession);
  const previewDisplayMode = useRuntimeGameStore((s) => s.previewDisplayMode);
  const togglePreviewFullscreen = useRuntimeGameStore((s) => s.togglePreviewFullscreen);
  const panels = useEditorLayoutStore((s) => s.panels);
  const togglePanel = useEditorLayoutStore((s) => s.togglePanel);
  const restorePanel = useEditorLayoutStore((s) => s.restorePanel);
  const saveCurrentLayout = useEditorLayoutStore((s) => s.saveCurrentLayout);
  const loadSavedLayout = useEditorLayoutStore((s) => s.loadSavedLayout);
  const hasSavedLayout = useEditorLayoutStore((s) => Boolean(s.savedLayout));
  const showAllPanels = useEditorLayoutStore((s) => s.showAllPanels);
  const resetLayout = useEditorLayoutStore((s) => s.resetLayout);
  const applyLayoutPreset = useEditorLayoutStore((s) => s.applyPreset);
  const restoreBottomTab = useBottomPanelTabsStore((s) => s.restoreTab);
  const restoreAllBottomTabs = useBottomPanelTabsStore((s) => s.restoreAllTabs);

  const projectName = localProject?.name || 'Untitled Project';
  const isRuntimePreviewActive = Boolean(previewSession) || !isEditMode;
  const isRuntimeFullscreen = previewDisplayMode === 'fullscreen';
  const runtimeLabel = previewSession?.launchTarget.kind === 'web-runtime'
    ? 'Runtime real'
    : previewSession
      ? getRuntimeAdapterLabel(previewSession.runtime)
      : null;
  const diagnosticsSnapshot = useMemo(() => {
    try {
      return createActiveProjectDiagnosticsSnapshot(projectName);
    } catch {
      return null;
    }
  }, [
    activeSceneKind,
    gameScript,
    objects,
    projectAssets,
    projectName,
    snapEnabled,
    snapRotate,
    snapScale,
    snapTranslate,
    transformSpace,
  ]);
  const diagnostics = diagnosticsSnapshot?.diagnostics ?? null;
  const canPasteObject = hasObjectClipboard();

  const handleRuntimeToggle = useCallback(() => {
    try {
      const result = toggleRuntimePreviewFromEditor(projectName);

      if (result.action === 'started') {
        const runtimeLabel = result.session.launchTarget.kind === 'web-runtime'
          ? 'Runtime real'
          : getRuntimeAdapterLabel(result.session.runtime);
        toast.success(`Play Mode: ${runtimeLabel}`, { duration: 1600 });
      } else {
        toast.success('Play Mode encerrado.', { duration: 1200 });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel iniciar o runtime.';
      toast.error(message);
    }
  }, [projectName]);

  const openBottomTab = useCallback((tab: BottomTabId) => {
    restorePanel('bottom');
    restoreBottomTab(tab);
  }, [restoreBottomTab, restorePanel]);

  const saveWindowLayout = useCallback(() => {
    saveCurrentLayout();
    toast.success('Layout salvo.', { duration: 1200 });
  }, [saveCurrentLayout]);

  const loadWindowLayout = useCallback(() => {
    loadSavedLayout();
    toast.success('Layout carregado.', { duration: 1200 });
  }, [loadSavedLayout]);

  const openBuildSettings = useCallback(() => {
    try {
      const snapshot = createActiveProjectDiagnosticsSnapshot(projectName);
      setBuildProject(snapshot.document);
      setLocalWorkspace(snapshot.workspace);
      setIsBuildSettingsOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel abrir Build Settings.';
      toast.error(message);
    }
  }, [projectName]);

  const toggleGrid = () => updateSettings({ showGrid: !showGrid });
  const toggleStats = () => updateSettings({ showStats: !showStats });

  const handleSaveToDisk = async () => {
    try {
      const workspace = await saveActiveProjectDocumentToDirectory(projectName);
      setLocalWorkspace(workspace);
      toast.success('Projeto salvo no disco.');
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;
      if (error instanceof FilePickerBusyError) {
        toast.warning('Aguarde o diálogo de arquivo atual fechar.', { duration: 1800 });
        return;
      }
      const message = error instanceof Error ? error.message : 'Nao foi possivel salvar no disco.';
      toast.error(message);
    }
  };

  const handleSaveAsPixl = async () => {
    try {
      const manifest = await saveCurrentProjectAsPixl(projectName);
      announcePixlSave(manifest);
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;
      if (error instanceof FilePickerBusyError) {
        toast.warning('Aguarde o diálogo de arquivo atual fechar.', { duration: 1800 });
        return;
      }
      const message = error instanceof Error ? error.message : 'Nao foi possivel salvar o .pixl.';
      toast.error(message);
    }
  };

  const handleOpenPixl = async () => {
    try {
      const opened = await openPixlPackageFromDisk();
      announcePixlOpen(opened.manifest);
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;
      if (error instanceof FilePickerBusyError) {
        toast.warning('Aguarde o diálogo de arquivo atual fechar.', { duration: 1800 });
        return;
      }
      const message = error instanceof Error ? error.message : 'Nao foi possivel abrir o .pixl.';
      toast.error(message);
    }
  };

  const handleOpenProjectFolder = async () => {
    try {
      const { document, workspace } = await openProjectDocumentFromDirectory();
      setLocalWorkspace(workspace);
      toast.success(`Projeto aberto: ${document.name}`);

      const url = new URL(window.location.href);
      url.pathname = '/editor';
      url.search = `?localProject=${encodeURIComponent(document.id)}`;
      window.history.replaceState({}, '', url.toString());
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;
      if (error instanceof FilePickerBusyError) {
        toast.warning('Aguarde o diálogo de arquivo atual fechar.', { duration: 1800 });
        return;
      }
      const message = error instanceof Error ? error.message : 'Nao foi possivel abrir o projeto.';
      toast.error(message);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setActiveMenu(null);
      }
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(target)) setIsLayoutMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (handleEditorObjectShortcut(event, {
        selectedObjectId,
        copyObject,
        cutObject,
        pasteObject,
        duplicateObject,
        deleteObject,
        hasObjectClipboard,
      })) {
        return;
      }

      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'p') {
        event.preventDefault();
        handleRuntimeToggle();
        return;
      }
      // Save As .pixl Package — Ctrl+Shift+S. (Plain Ctrl+S is handled by
      // EditorPage.tsx, which saves into the active project folder.)
      if (event.shiftKey && key === 's') {
        event.preventDefault();
        handleSaveAsPixl();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    copyObject,
    cutObject,
    deleteObject,
    duplicateObject,
    handleRuntimeToggle,
    hasObjectClipboard,
    pasteObject,
    selectedObjectId,
  ]);

  const handleTerrainSettingsChange = (settings: TerrainSettings) => {
    updateTerrainSettings(settings);
  };

  const handleTerrainGenerate = (settings: TerrainSettings) => {
    updateTerrainSettings(settings);
    createTerrain(settings);
  };

  const newProject = () => {
    if (confirm('Criar novo projeto? Mudancas nao salvas serao perdidas.')) {
      clearSavedProject();
      navigate('/');
    }
  };

  const loadLocalAutosave = () => {
    if (hasSavedProject()) {
      if (confirm('Carregar projeto salvo? Mudancas atuais serao perdidas.')) {
        loadSavedProject();
      }
      return;
    }
    alert('Nenhum projeto salvo encontrado.');
  };

  const layoutMenuItems: MenuItem[] = [
    { label: 'Default Layout', icon: LayoutGrid, action: resetLayout },
    { label: 'Viewport Focus', icon: Maximize2, action: () => applyLayoutPreset('viewport-focus') },
    { label: 'Inspect Layout', icon: PanelLeft, action: () => applyLayoutPreset('inspect') },
    { label: 'Show All Panels', icon: LayoutGrid, action: showAllPanels },
    { label: '', divider: true },
    { label: 'Save Current Layout', icon: Save, action: saveWindowLayout },
    { label: 'Load Saved Layout', icon: LayoutGrid, action: loadWindowLayout, disabled: !hasSavedLayout },
  ];
  const sceneCreateMenuItems: MenuItem[] = getEditorAddMenuSections(activeSceneKind).flatMap((section, sectionIndex) => [
    ...(sectionIndex ? [{ label: '', divider: true }] : []),
    ...section.items.map((item): MenuItem => {
      const action = item.kind === 'terrain' ? 'terrain' : item.objectType;
      return {
        label: item.label,
        icon: sceneAddIcons[action],
        action: () => {
          if (item.kind === 'terrain') setTerrainModalOpen(true);
          else addObject(item.objectType, activeSceneKind === '2d' ? [400, 300, 0] : undefined);
        },
      };
    }),
  ]);

  const menuConfig: MenuConfig = {
    File: [
      { label: 'New Project', shortcut: 'Ctrl+N', icon: Plus, action: newProject },
      { label: 'Open Project Folder', shortcut: 'Ctrl+O', icon: FolderOpen, action: handleOpenProjectFolder },
      { label: 'Open .pixl Package', icon: FileArchive, action: handleOpenPixl },
      { label: 'Load Local Autosave', icon: History, action: loadLocalAutosave, disabled: !hasSavedProject() },
      { label: '', divider: true },
      { label: 'Save', shortcut: 'Ctrl+S', icon: Save, action: handleSaveToDisk },
      { label: 'Save as .pixl Package', shortcut: 'Ctrl+Shift+S', icon: FileArchive, action: handleSaveAsPixl },
      { label: '', divider: true },
      { label: 'Exit to Hub', action: () => navigate('/') },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', icon: Undo, action: undo, disabled: !canUndo() },
      { label: 'Redo', shortcut: 'Ctrl+Y', icon: Redo, action: redo, disabled: !canRedo() },
      { label: '', divider: true },
      { label: 'Cut', shortcut: 'Ctrl+X', icon: Copy, action: () => selectedObjectId && cutObject(selectedObjectId), disabled: !selectedObjectId },
      { label: 'Copy', shortcut: 'Ctrl+C', icon: Copy, action: () => selectedObjectId && copyObject(selectedObjectId), disabled: !selectedObjectId },
      { label: 'Paste', shortcut: 'Ctrl+V', icon: Clipboard, action: () => pasteObject(), disabled: !canPasteObject },
      { label: 'Duplicate', shortcut: 'Ctrl+D', icon: Copy, action: () => selectedObjectId && duplicateObject(selectedObjectId), disabled: !selectedObjectId },
      { label: '', divider: true },
      { label: 'Delete', shortcut: 'Del', icon: Trash2, action: () => selectedObjectId && deleteObject(selectedObjectId), disabled: !selectedObjectId },
    ],
    Scene: sceneCreateMenuItems,
    Tools: [
      { label: showGrid ? 'Hide Grid' : 'Show Grid', shortcut: 'G', icon: Grid3X3, action: toggleGrid },
      { label: showStats ? 'Hide Stats' : 'Show Stats', icon: Eye, action: toggleStats },
      { label: '', divider: true },
      { label: 'Desktop Layout Only', icon: Monitor, disabled: true },
      { label: 'Engine Settings', icon: Wrench, action: () => setIsSettingsOpen(true) },
    ],
    Build: [
      {
        label: 'Build Settings',
        icon: FileArchive,
        action: openBuildSettings,
      },
      { label: '', divider: true },
      {
        label: isRuntimePreviewActive ? 'Stop Runtime' : 'Play Runtime',
        shortcut: 'Ctrl+P',
        icon: isRuntimePreviewActive ? Pause : Play,
        action: handleRuntimeToggle,
      },
      {
        label: isRuntimeFullscreen ? 'Play In Frame' : 'Play Fullscreen',
        icon: isRuntimeFullscreen ? Minimize2 : Maximize2,
        action: togglePreviewFullscreen,
        disabled: !previewSession,
      },
    ],
    Window: [
      { label: panels.scene ? 'Hide Hierarchy' : 'Show Hierarchy', icon: PanelLeft, action: () => togglePanel('scene') },
      { label: panels.viewport ? 'Hide Scene View' : 'Show Scene View', icon: Monitor, action: () => togglePanel('viewport') },
      { label: panels.inspector ? 'Hide Inspector' : 'Show Inspector', icon: PanelLeft, action: () => togglePanel('inspector') },
      { label: panels.bottom ? 'Hide Project' : 'Show Project', icon: PanelBottom, action: () => togglePanel('bottom') },
      { label: '', divider: true },
      { label: 'Dock Hierarchy Left', icon: PanelLeft, action: () => restorePanel('scene') },
      { label: 'Dock Scene View Center', icon: Monitor, action: () => restorePanel('viewport') },
      { label: 'Dock Inspector Right', icon: PanelLeft, action: () => restorePanel('inspector') },
      { label: 'Dock Project Below', icon: PanelBottom, action: () => restorePanel('bottom') },
      { label: '', divider: true },
      { label: 'Open Content Browser', icon: FolderOpen, action: () => openBottomTab('assets') },
      { label: 'Open UI Editor', icon: LayoutGrid, action: () => openBottomTab('ui') },
      { label: 'Open Timeline', icon: History, action: () => openBottomTab('timeline') },
      { label: 'Open Console', icon: Terminal, action: () => openBottomTab('console') },
      { label: 'Restore Project Tabs', icon: LayoutGrid, action: () => { restorePanel('bottom'); restoreAllBottomTabs(); } },
      { label: '', divider: true },
      ...layoutMenuItems,
    ],
    Help: [
      { label: 'Documentation', icon: Book },
      { label: 'Tutorials', icon: HelpCircle },
      { label: 'Keyboard Shortcuts', shortcut: 'Ctrl+K', icon: Keyboard },
      { label: '', divider: true },
      { label: 'Discord', icon: MessageSquare },
      { label: 'GitHub', icon: Github },
    ],
  };

  return (
    <>
      <header className="editor-header h-[64px] flex-shrink-0 text-foreground z-30">
        <div className="editor-menubar relative flex h-[30px] items-center px-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="editor-command-chip flex h-7 items-center gap-1.5 px-1.5 text-xs font-semibold text-foreground"
              title="Voltar ao Hub"
            >
              <img src={logoSilver} alt="React 3 Phase" className="h-4 w-4 object-contain" />
              <span>Pixl</span>
            </button>
          </div>

          <nav ref={menuRef} className="ml-2 flex h-full items-center">
            {Object.keys(menuConfig).map((menu) => (
              <div key={menu} className="relative h-full">
                <button
                  onClick={() => setActiveMenu(activeMenu === menu ? null : menu)}
                  onMouseEnter={() => activeMenu && setActiveMenu(menu)}
                  className={cn(
                    'flex h-full items-center px-2.5 text-xs font-semibold transition-colors',
                    activeMenu === menu
                      ? 'bg-[var(--editor-tab-active)] text-foreground'
                      : 'text-muted-foreground hover:bg-[var(--editor-row-hover)] hover:text-foreground'
                  )}
                >
                  {menu}
                </button>

                {activeMenu === menu && (
                  <div className="editor-menu-dropdown absolute left-0 top-full z-50 mt-0.5 w-60 overflow-hidden py-1">
                    <MenuItems items={menuConfig[menu]} onSelect={() => setActiveMenu(null)} showShortcut />
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            {diagnostics && (
              <ProjectDiagnosticsButton diagnostics={diagnostics} onClick={openBuildSettings} />
            )}

            <div ref={layoutMenuRef} className="relative">
              <button
                onClick={() => {
                  setActiveMenu(null);
                  setIsLayoutMenuOpen((open) => !open);
                }}
                className="editor-command-chip flex h-7 items-center gap-1.5 px-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                aria-expanded={isLayoutMenuOpen}
                aria-haspopup="menu"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Layout</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>

              {isLayoutMenuOpen && (
                <div className="editor-menu-dropdown absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden py-1">
                  <MenuItems items={layoutMenuItems} onSelect={() => setIsLayoutMenuOpen(false)} />
                </div>
              )}
            </div>

            {previewSession && (
              <div
                className="editor-command-chip hidden h-7 items-center gap-1.5 px-2 text-xs font-semibold text-primary md:flex"
                title={`Play Mode: ${runtimeLabel}`}
              >
                <Gamepad2 className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate">{runtimeLabel}</span>
              </div>
            )}

            <button
              onClick={handleRuntimeToggle}
              className={cn(
                'editor-command-chip flex h-7 items-center gap-1.5 px-2 text-xs font-semibold transition-colors',
                isRuntimePreviewActive ? 'text-primary' : 'text-foreground'
              )}
            >
              {isRuntimePreviewActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isRuntimePreviewActive ? 'Stop' : 'Play'}
            </button>

            {previewSession && (
              <IconButton
                icon={isRuntimeFullscreen ? Minimize2 : Maximize2}
                label={isRuntimeFullscreen ? 'Play In Frame' : 'Play Fullscreen'}
                onClick={togglePreviewFullscreen}
              />
            )}

            <IconButton icon={Settings} label="Settings" onClick={() => setIsSettingsOpen(true)} />
            <IconButton
              icon={isFullscreen ? Minimize2 : Maximize2}
              label={isFullscreen ? 'Exit Editor Fullscreen' : 'Editor Fullscreen'}
              onClick={toggleFullscreen}
            />
          </div>
        </div>

        <div className="editor-toolbar-row flex h-[34px] items-center gap-2 px-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/')}
              className="mr-1 flex h-[33px] max-w-[220px] items-center gap-1.5 border border-[var(--editor-border-dark)] border-b-transparent bg-[var(--editor-tab-active)] px-3 text-xs font-semibold text-foreground"
              style={{ boxShadow: 'inset 0 1px 0 var(--editor-border-light)' }}
              title={projectName}
            >
              <span className="truncate">{projectName}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {localWorkspace.directoryName && (
              <div
                className="hidden min-w-0 max-w-[300px] items-center gap-1.5 rounded-sm border border-border bg-[var(--editor-panel-sunken)] px-2 py-1 text-[11px] text-muted-foreground md:flex"
                title={`${localWorkspace.directoryName}/${localWorkspace.projectFilePath}`}
              >
                <FolderOpen className="h-3 w-3 flex-shrink-0 text-primary" />
                <span className="truncate text-foreground">{localWorkspace.directoryName}</span>
                <span className="text-muted-foreground/50">/</span>
                <span className="truncate">{localWorkspace.projectFilePath}</span>
              </div>
            )}
            <CommandButton icon={FolderOpen} label="Open" onClick={handleOpenProjectFolder} />
            <CommandButton icon={Save} label="Save" onClick={handleSaveToDisk} />
            <HeaderSeparator />
            <EditorToolbar variant="inline" />
          </div>
        </div>
      </header>

      <EngineSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <BuildSettingsModal
        isOpen={isBuildSettingsOpen}
        onClose={() => setIsBuildSettingsOpen(false)}
        project={buildProject}
        workspace={localWorkspace}
      />
      <TerrainSettingsModal
        isOpen={isModalOpen}
        onClose={() => setTerrainModalOpen(false)}
        settings={modalSettings}
        onSettingsChange={handleTerrainSettingsChange}
        onGenerate={handleTerrainGenerate}
      />
    </>
  );
};

interface CommandButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
}

const CommandButton = ({ icon: Icon, label, onClick }: CommandButtonProps) => (
  <button
    onClick={onClick}
    className="editor-command-chip flex h-7 items-center gap-1.5 px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
  >
    <Icon className="h-3.5 w-3.5" />
    <span>{label}</span>
  </button>
);

interface IconButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

const IconButton = ({ icon: Icon, label, onClick, disabled }: IconButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    className={cn(
      'editor-command-chip flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors',
      disabled ? 'cursor-not-allowed opacity-35' : 'hover:text-foreground'
    )}
  >
    <Icon className="h-3.5 w-3.5" />
  </button>
);

const HeaderSeparator = () => <div className="mx-1 h-6 w-px bg-border" />;

interface MenuItemsProps {
  items: MenuItem[];
  onSelect: () => void;
  showShortcut?: boolean;
}

const MenuItems = ({ items, onSelect, showShortcut }: MenuItemsProps) => (
  <>
    {items.map((item, index) => (
      item.divider ? (
        <div key={index} className="my-1 h-px bg-border" />
      ) : (
        <button
          key={index}
          onClick={() => {
            item.action?.();
            onSelect();
          }}
          disabled={item.disabled}
          className={cn(
            'editor-menu-item flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors',
            item.disabled ? 'cursor-not-allowed text-muted-foreground/45' : 'text-foreground',
          )}
        >
          {item.icon && <item.icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="flex-1 truncate">{item.label}</span>
          {showShortcut && item.shortcut && (
            <span className="font-mono text-[10px] text-muted-foreground">{item.shortcut}</span>
          )}
        </button>
      )
    ))}
  </>
);

const diagnosticsIcon: Record<ProjectDiagnosticStatus, typeof CheckCircle2> = {
  blocked: AlertTriangle,
  warning: Info,
  ready: CheckCircle2,
};

const diagnosticsTone: Record<ProjectDiagnosticStatus, string> = {
  blocked: 'border-destructive/30 bg-destructive/10 text-destructive hover:text-destructive',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100 hover:text-amber-100',
  ready: 'border-primary/25 bg-primary/10 text-primary hover:text-primary',
};

const getDiagnosticsLabel = (diagnostics: ProjectDiagnosticsSummary): string => {
  if (diagnostics.errors > 0) return `${diagnostics.errors} error${diagnostics.errors === 1 ? '' : 's'}`;
  if (diagnostics.warnings > 0) return `${diagnostics.warnings} warning${diagnostics.warnings === 1 ? '' : 's'}`;
  return 'Ready';
};

const getDiagnosticsTitle = (diagnostics: ProjectDiagnosticsSummary): string => {
  const firstIssue = diagnostics.issues[0];
  if (!firstIssue) {
    return `Engine diagnostics ready: ${diagnostics.runtimePrimary} / ${diagnostics.sceneKind ?? 'no scene'}`;
  }
  return `Engine diagnostics: ${getDiagnosticsLabel(diagnostics)}. ${firstIssue.message}`;
};

interface ProjectDiagnosticsButtonProps {
  diagnostics: ProjectDiagnosticsSummary;
  onClick: () => void;
}

const ProjectDiagnosticsButton = ({ diagnostics, onClick }: ProjectDiagnosticsButtonProps) => {
  const Icon = diagnosticsIcon[diagnostics.status];

  return (
    <button
      onClick={onClick}
      title={getDiagnosticsTitle(diagnostics)}
      className={cn(
        'editor-command-chip hidden h-7 items-center gap-1.5 border px-2 text-xs font-semibold transition-colors md:flex',
        diagnosticsTone[diagnostics.status],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{getDiagnosticsLabel(diagnostics)}</span>
    </button>
  );
};
