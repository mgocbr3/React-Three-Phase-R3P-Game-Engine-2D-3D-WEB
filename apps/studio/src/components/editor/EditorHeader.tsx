import {
  Box,
  Camera,
  ChevronDown,
  Circle,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FolderOpen,
  Gamepad2,
  Github,
  Grid3X3,
  HelpCircle,
  History,
  Keyboard,
  Layers,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Monitor,
  MonitorSmartphone,
  Mountain,
  PanelBottom,
  PanelLeft,
  Pause,
  Play,
  Plus,
  Redo,
  Save,
  Settings,
  Smartphone,
  Sun,
  Trash2,
  Undo,
  Upload,
  User,
  Wrench,
  MessageSquare,
  Book,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { useEditorStore } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { EngineSettingsModal } from './EngineSettingsModal';
import { defaultTerrainSettings, useTerrainStore, TerrainSettings } from '@/stores/terrainStore';
import { TerrainSettingsModal } from '@/components/terrain/TerrainSettingsModal';
import { toast } from 'sonner';
import { useInterfaceStore } from '@/stores/interfaceStore';
import { useEditorLayoutStore } from '@/stores/editorLayoutStore';
import { useProjectStore } from '@/stores/projectStore';
import { cn } from '@/lib/utils';
import {
  getCurrentProjectWorkspace,
  openProjectDocumentFromDirectory,
  saveActiveProjectDocumentToDirectory,
} from '@/services/localProjectFiles';
import {
  announcePixlOpen,
  announcePixlSave,
  openPixlPackageFromDisk,
  saveCurrentProjectAsPixl,
} from '@/services/pixlPackageIO';
import { FilePickerBusyError } from '@/services/filePickerLock';
import { EditorToolbar } from './EditorToolbar';
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

export const EditorHeader = () => {
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [localWorkspace, setLocalWorkspace] = useState(() => getCurrentProjectWorkspace());
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    isEditMode,
    undo,
    redo,
    canUndo,
    canRedo,
    addObject,
    deleteObject,
    duplicateObject,
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
  const { interfaceMode, setInterfaceMode } = useInterfaceStore();
  const localProjectId = useProjectStore((s) => s.currentProjectId);
  const localProject = useProjectStore((s) => s.projects.find((project) => project.id === localProjectId));
  const previewSession = useRuntimeGameStore((s) => s.previewSession);
  const previewDisplayMode = useRuntimeGameStore((s) => s.previewDisplayMode);
  const togglePreviewFullscreen = useRuntimeGameStore((s) => s.togglePreviewFullscreen);
  const panels = useEditorLayoutStore((s) => s.panels);
  const togglePanel = useEditorLayoutStore((s) => s.togglePanel);
  const resetLayout = useEditorLayoutStore((s) => s.resetLayout);
  const applyLayoutPreset = useEditorLayoutStore((s) => s.applyPreset);

  const projectName = localProject?.name || 'Untitled Project';
  const isRuntimePreviewActive = Boolean(previewSession) || !isEditMode;
  const isRuntimeFullscreen = previewDisplayMode === 'fullscreen';
  const runtimeLabel = previewSession?.launchTarget.kind === 'web-runtime'
    ? 'Runtime real'
    : previewSession
      ? getRuntimeAdapterLabel(previewSession.runtime)
      : null;

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
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
  }, [handleRuntimeToggle]);

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
      { label: 'Cut', shortcut: 'Ctrl+X', icon: Copy, disabled: !selectedObjectId },
      { label: 'Copy', shortcut: 'Ctrl+C', icon: Copy, disabled: !selectedObjectId },
      { label: 'Paste', shortcut: 'Ctrl+V', icon: Clipboard },
      { label: 'Duplicate', shortcut: 'Ctrl+D', icon: Copy, action: () => selectedObjectId && duplicateObject(selectedObjectId), disabled: !selectedObjectId },
      { label: '', divider: true },
      { label: 'Delete', shortcut: 'Del', icon: Trash2, action: () => selectedObjectId && deleteObject(selectedObjectId), disabled: !selectedObjectId },
    ],
    Scene: [
      { label: 'Pixlland Terrain', icon: Mountain, action: () => setTerrainModalOpen(true) },
      { label: '', divider: true },
      { label: 'Cube', icon: Box, action: () => addObject('box') },
      { label: 'Sphere', icon: Circle, action: () => addObject('sphere') },
      { label: 'Cylinder', icon: Box, action: () => addObject('cylinder') },
      { label: 'Plane', icon: Layers, action: () => addObject('plane') },
      { label: '', divider: true },
      { label: 'Point Light', icon: Sun, action: () => addObject('light') },
      { label: 'Camera', icon: Camera },
      { label: 'Player', icon: Gamepad2 },
    ],
    Tools: [
      { label: showGrid ? 'Hide Grid' : 'Show Grid', shortcut: 'G', icon: Grid3X3, action: toggleGrid },
      { label: showStats ? 'Hide Stats' : 'Show Stats', icon: Eye, action: toggleStats },
      { label: '', divider: true },
      { label: interfaceMode === 'auto' ? 'Auto Layout' : 'Set Auto Layout', icon: MonitorSmartphone, action: () => setInterfaceMode('auto') },
      { label: interfaceMode === 'mobile' ? 'Mobile Layout' : 'Set Mobile Layout', icon: Smartphone, action: () => setInterfaceMode('mobile') },
      { label: interfaceMode === 'desktop' ? 'Desktop Layout' : 'Set Desktop Layout', icon: Monitor, action: () => setInterfaceMode('desktop') },
      { label: '', divider: true },
      { label: 'Engine Settings', icon: Wrench, action: () => setIsSettingsOpen(true) },
    ],
    Build: [
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
      { label: panels.scene ? 'Hide Scene Dock' : 'Show Scene Dock', icon: PanelLeft, action: () => togglePanel('scene') },
      { label: panels.inspector ? 'Hide Inspector Dock' : 'Show Inspector Dock', icon: PanelLeft, action: () => togglePanel('inspector') },
      { label: panels.bottom ? 'Hide Bottom Dock' : 'Show Bottom Dock', icon: PanelBottom, action: () => togglePanel('bottom') },
      { label: '', divider: true },
      { label: 'Default Layout', icon: LayoutGrid, action: resetLayout },
      { label: 'Viewport Focus', icon: Maximize2, action: () => applyLayoutPreset('viewport-focus') },
      { label: 'Inspect Layout', icon: PanelLeft, action: () => applyLayoutPreset('inspect') },
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
              <img src={logo} alt="PixlPlayground" className="h-4 w-4" />
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
                    {menuConfig[menu].map((item, index) => (
                      item.divider ? (
                        <div key={index} className="my-1 h-px bg-border" />
                      ) : (
                        <button
                          key={index}
                          onClick={() => {
                            item.action?.();
                            setActiveMenu(null);
                          }}
                          disabled={item.disabled}
                          className={cn(
                            'editor-menu-item flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors',
                            item.disabled
                              ? 'cursor-not-allowed text-muted-foreground/45'
                              : 'text-foreground'
                          )}
                        >
                          {item.icon && <item.icon className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.shortcut && (
                            <span className="font-mono text-[10px] text-muted-foreground">{item.shortcut}</span>
                          )}
                        </button>
                      )
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
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
