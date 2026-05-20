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
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { useEditorStore } from '@/stores/editorStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { GAME_TEMPLATES } from '@/stores/gameStore';
import { EngineSettingsModal } from './EngineSettingsModal';
import { EmbeddedActions } from './EmbeddedActions';
import { defaultTerrainSettings, useTerrainStore, TerrainSettings } from '@/stores/terrainStore';
import { TerrainSettingsModal } from '@/components/terrain/TerrainSettingsModal';
import { usePixllandStore, usePixllandBridge } from '@/hooks/usePixllandBridge';
import { toast } from 'sonner';
import { useInterfaceStore } from '@/stores/interfaceStore';
import { useEditorLayoutStore } from '@/stores/editorLayoutStore';
import { useProjectStore } from '@/stores/projectStore';
import { cn } from '@/lib/utils';
import { ProjectVersionHistory } from './ProjectVersionHistory';
import { ENGINE_LOCAL_ONLY } from '@/config/engineMode';
import {
  createProjectDocumentFromEditor,
  openProjectDocumentFromDirectory,
  saveProjectDocumentToDirectory,
} from '@/services/localProjectFiles';
import { EditorToolbar } from './EditorToolbar';

const PIXLLAND_PLATFORM_ORIGIN = import.meta.env.VITE_PIXLLAND_PLATFORM_ORIGIN || 'http://localhost:3000';

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
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isEmbedded = usePixllandStore((s) => s.isEmbedded);
  const { publishToPixlland } = usePixllandBridge();
  const cloudProjectId = new URLSearchParams(window.location.search).get('project') || new URLSearchParams(window.location.search).get('projectId');

  const {
    currentTemplateId,
    isEditMode,
    setEditMode,
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
  const panels = useEditorLayoutStore((s) => s.panels);
  const togglePanel = useEditorLayoutStore((s) => s.togglePanel);
  const resetLayout = useEditorLayoutStore((s) => s.resetLayout);
  const applyLayoutPreset = useEditorLayoutStore((s) => s.applyPreset);

  const currentTemplate = GAME_TEMPLATES.find((template) => template.id === currentTemplateId);
  const projectName = localProject?.name || (currentTemplate ? currentTemplate.name : 'Untitled Project');

  const toggleGrid = () => updateSettings({ showGrid: !showGrid });
  const toggleStats = () => updateSettings({ showStats: !showStats });

  const handlePublish = async () => {
    try {
      saveProject();
      toast.success('Projeto salvo localmente...', { duration: 1000 });

      const { objects, currentTemplateId: templateId, gameScript } = useEditorStore.getState();
      const bridgePayload = {
        title: projectName,
        description: `Projeto criado com template ${templateId}`,
      };

      if (isEmbedded) {
        publishToPixlland(bridgePayload);
        toast.success('Publicando no Pixlland...', { duration: 2000 });
      } else {
        const projectData = {
          name: projectName,
          templateId,
          gameScript,
          objects: JSON.parse(JSON.stringify(objects)),
          timestamp: Date.now(),
        };
        const params = new URLSearchParams({
          from: 'pixlplayground',
          projectName: projectData.name,
        });
        window.open(`${PIXLLAND_PLATFORM_ORIGIN}/developers/submit?${params.toString()}`, '_blank');
        toast.success('Abrindo pagina de publicacao da Pixlland...', { duration: 2000 });
      }
    } catch (error) {
      console.error('Erro ao publicar:', error);
      toast.error('Erro ao publicar projeto', { duration: 2000 });
    }
  };

  const handleSaveToDisk = async () => {
    try {
      saveProject();
      await saveProjectDocumentToDirectory(createProjectDocumentFromEditor(projectName));
      toast.success('Projeto salvo no disco.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel salvar no disco.';
      toast.error(message);
    }
  };

  const handleOpenProjectFolder = async () => {
    try {
      const { document } = await openProjectDocumentFromDirectory();
      toast.success(`Projeto aberto: ${document.name}`);

      const url = new URL(window.location.href);
      url.pathname = '/editor';
      url.search = `?localProject=${encodeURIComponent(document.id)}`;
      window.history.replaceState({}, '', url.toString());
    } catch (error) {
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
      { label: 'Load Local Autosave', icon: History, action: loadLocalAutosave, disabled: !hasSavedProject() },
      { label: '', divider: true },
      { label: 'Save', shortcut: 'Ctrl+S', icon: Save, action: saveProject },
      { label: 'Save to Disk', icon: Save, action: handleSaveToDisk },
      { label: 'Version History', icon: History, action: () => setShowVersionHistory(true), disabled: ENGINE_LOCAL_ONLY || !cloudProjectId },
      { label: '', divider: true },
      { label: 'Export Project', icon: Download },
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
      { label: isEditMode ? 'Play' : 'Stop', shortcut: 'Ctrl+P', icon: isEditMode ? Play : Pause, action: () => setEditMode(!isEditMode) },
      { label: 'Publish to Pixlland', icon: Upload, action: handlePublish },
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
                      ? 'bg-[#2b2b2b] text-foreground'
                      : 'text-muted-foreground hover:bg-[#252525] hover:text-foreground'
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
            <button
              onClick={() => setEditMode(!isEditMode)}
              className={cn(
                'editor-command-chip flex h-7 items-center gap-1.5 px-2 text-xs font-semibold transition-colors',
                isEditMode ? 'text-foreground' : 'text-primary'
              )}
            >
              {isEditMode ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {isEditMode ? 'Play' : 'Stop'}
            </button>

            {isEmbedded ? (
              <EmbeddedActions variant="header" />
            ) : (
              <button
                onClick={handlePublish}
                className="editor-command-chip flex h-7 items-center gap-1.5 px-2 text-xs font-semibold text-muted-foreground"
                title="Publicar na Pixlland"
              >
                <Upload className="h-3.5 w-3.5" />
                Publish
                <ExternalLink className="h-3 w-3 opacity-70" />
              </button>
            )}
            <IconButton icon={Settings} label="Settings" onClick={() => setIsSettingsOpen(true)} />
            <IconButton
              icon={isFullscreen ? Minimize2 : Maximize2}
              label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              onClick={toggleFullscreen}
            />
            <IconButton icon={User} label="User" />
          </div>
        </div>

        <div className="editor-toolbar-row flex h-[34px] items-center gap-2 px-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/')}
              className="mr-1 flex h-[33px] max-w-[220px] items-center gap-1.5 border border-[#111] border-b-transparent bg-[#2b2b2b] px-3 text-xs font-semibold text-foreground shadow-[inset_0_1px_0_#3a3a3a]"
              title={projectName}
            >
              <span className="truncate">{projectName}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
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

      {cloudProjectId && (
        <ProjectVersionHistory
          projectId={cloudProjectId}
          open={showVersionHistory}
          onOpenChange={setShowVersionHistory}
        />
      )}
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

const HeaderSeparator = () => <div className="mx-1 h-6 w-px bg-[#151515] shadow-[1px_0_0_#333]" />;
