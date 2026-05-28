import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  FolderOpen, Terminal, Package,
  Search, Filter, RefreshCw, Download, FolderPlus, Trash2,
  AlertCircle, AlertTriangle, Info, ChevronRight, Play, Grid, List,
  Upload, FileBox, Image, Music, Code, Clock, Layout,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssetStore, ProjectAsset } from '@/stores/assetStore';
import { useAssetDragStore } from '@/stores/assetDragStore';
import { useEditorStore } from '@/stores/editorStore';
import { useProjectStore } from '@/stores/projectStore';
import { TimelinePanel } from './TimelinePanel';
import { UIEditorPanel } from './UIEditorPanel';
import { DockFrameMenu, useDockChrome } from './DockFrame';
import { toast } from 'sonner';
import {
  ensureProjectAssetFolder,
  hasActiveProjectWorkspace,
  importProjectAssetFiles,
  moveProjectAssetToFolder,
} from '@/services/localProjectFiles';
import {
  createActiveProjectDiagnosticsSnapshot,
  createProjectDiagnosticConsoleMessages,
  type ProjectDiagnosticConsoleMessage,
} from '@/services/projectDiagnostics';
import {
  getBottomTabDropTarget,
  getVisibleBottomTabs,
  normalizeBottomTabOrder as normalizeBottomTabOrderState,
  previewBottomTabMove,
  useBottomPanelTabsStore,
  type BottomTabDropTarget,
  type BottomTabId,
} from '@/stores/bottomPanelTabsStore';

interface ConsoleMessage {
  id: string;
  type: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  source?: string;
  path?: string;
  targetObjectId?: string;
  targetObjectName?: string;
  targetSceneId?: string;
  targetSceneName?: string;
}

interface AssetFolder {
  id: string;
  name: string;
  icon: string | LucideIcon;
  children?: AssetFolder[];
}

const ASSET_FOLDERS: AssetFolder[] = [
  { id: 'project', name: 'Project', icon: '' },
  { 
    id: 'assets', 
    name: 'Assets', 
    icon: '',
    children: [
      { id: '3d_models', name: '3D_Models', icon: '' },
      { id: 'sprites', name: 'Sprites', icon: '' },
      { id: 'tilemaps', name: 'Tilemaps', icon: '' },
      { id: 'audio', name: 'Audio', icon: '' },
      { id: 'vfx', name: 'VFX', icon: '' },
    ]
  },
  { id: 'dev', name: 'Dev', icon: '' },
];

const getFolderIcon = (folder: AssetFolder): LucideIcon => {
  if (folder.id === 'assets') return Package;
  if (folder.id === 'dev') return Code;
  return FolderOpen;
};

const getSceneAssetChildren = (children: AssetFolder[], sceneKind: '2d' | '3d') => (
  sceneKind === '2d' ? children.filter((folder) => folder.id !== '3d_models') : children
);

const INITIAL_CONSOLE: ConsoleMessage[] = [
  { id: '1', type: 'info', message: 'React 3 Phase inicializado', timestamp: new Date().toLocaleTimeString() },
];

const CONTENT_BROWSER_SIDEBAR_WIDTH_KEY = 'pixlplayground.contentBrowserSidebarWidth';
const CONTENT_BROWSER_SIDEBAR_DEFAULT_WIDTH = 188;
const CONTENT_BROWSER_SIDEBAR_MIN_WIDTH = 132;
const CONTENT_BROWSER_SIDEBAR_MAX_WIDTH = 360;

type BottomTabDefinition = { id: BottomTabId; label: string; icon: LucideIcon };

const BOTTOM_TABS: BottomTabDefinition[] = [
  { id: 'assets', label: 'Project', icon: FolderOpen },
  { id: 'ui', label: 'UI Editor', icon: Layout },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'console', label: 'Console', icon: Terminal },
];

export const getAvailableBottomTabs = (_cloudEnabled = false): BottomTabDefinition[] => BOTTOM_TABS;

export const normalizeBottomTabOrder = (
  savedOrder: unknown,
  availableTabs = getAvailableBottomTabs(),
): BottomTabId[] => {
  return normalizeBottomTabOrderState(savedOrder, availableTabs.map((tab) => tab.id));
};

export const shouldRenderStorePane = (
  _activeTab: BottomTabId | 'store',
  _cloudEnabled = false,
): boolean => false;

const getAssetIcon = (type: ProjectAsset['type']) => {
  switch (type) {
    case 'model': return FileBox;
    case 'texture': return Image;
    case 'image': return Image;
    case 'sprite': return Image;
    case 'spritesheet': return Image;
    case 'tilemap': return Grid;
    case 'audio': return Music;
    case 'script': return Code;
    default: return Package;
  }
};

const clampContentBrowserSidebarWidth = (width: number) => Math.min(
  CONTENT_BROWSER_SIDEBAR_MAX_WIDTH,
  Math.max(CONTENT_BROWSER_SIDEBAR_MIN_WIDTH, width),
);

const FOLDER_PREFIXES: Record<string, string[]> = {
  assets: ['Assets/', 'assets/'],
  '3d_models': ['Assets/3D_Models', 'assets/3d_models'],
  sprites: ['Assets/Sprites', 'assets/sprites', 'assets/characters'],
  tilemaps: ['Assets/Tilemaps', 'assets/tilemaps', 'assets/maps'],
  audio: ['Assets/Audio', 'assets/audio'],
  vfx: ['Assets/VFX', 'assets/vfx', 'assets/fx'],
  dev: ['Scripts/', 'Dev/'],
};

const FOLDER_ID_TO_PROJECT_PATH: Record<string, string> = {
  project: 'Assets',
  assets: 'Assets',
  '3d_models': 'Assets/3D_Models',
  sprites: 'Assets/Sprites',
  tilemaps: 'Assets/Tilemaps',
  audio: 'Assets/Audio',
  vfx: 'Assets/VFX',
  dev: 'Dev',
};

const normalizeFolderPath = (value: string) => value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '') || 'Assets';

const getProjectFolderPath = (folderId: string) => normalizeFolderPath(FOLDER_ID_TO_PROJECT_PATH[folderId] ?? folderId);

const sanitizeFolderName = (value: string) => (
  value
    .replace(/[<>:"\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `Folder-${Date.now()}`
);

const getImportedAssetType = (fileName: string, folderPath: string): ProjectAsset['type'] => {
  const lowerName = fileName.toLowerCase();
  const ext = lowerName.split('.').pop() || '';
  const lowerFolder = folderPath.toLowerCase();

  if (lowerName.endsWith('.atlas.json')) return 'spritesheet';
  if (lowerName.endsWith('.tilemap.json') || lowerName.endsWith('.tilemap') || (ext === 'json' && lowerFolder.includes('/tilemaps'))) return 'tilemap';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    return lowerFolder.includes('/sprites') || lowerFolder.includes('/vfx') ? 'sprite' : 'image';
  }
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['js', 'ts', 'tsx'].includes(ext)) return 'script';
  if (['glb', 'gltf', 'fbx', 'obj'].includes(ext)) return 'model';
  return 'model';
};

const getAssetFileName = (asset: ProjectAsset) => {
  const source = asset.url || asset.name;
  return source.split('/').pop() || asset.name;
};

const getAssetFormat = (asset: ProjectAsset) => {
  const metadataFormat = typeof asset.metadata?.format === 'string' ? asset.metadata.format : undefined;
  const fileFormat = getAssetFileName(asset).split('.').pop();
  return (metadataFormat || fileFormat || asset.type).replace(/[^a-z0-9]/gi, '').toUpperCase();
};

const getAssetFolderLabel = (asset: ProjectAsset) => asset.folder.replace(/^Assets\//, '') || 'Project';

const getAssetMetadataLabel = (asset: ProjectAsset) => {
  const tags = Array.isArray(asset.metadata?.sourceTags)
    ? asset.metadata.sourceTags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  const role = typeof asset.metadata?.role === 'string' ? asset.metadata.role : undefined;
  const cropId = typeof asset.metadata?.cropId === 'string' ? asset.metadata.cropId : undefined;
  const runtimeArray = typeof asset.metadata?.runtimeArray === 'string' ? asset.metadata.runtimeArray : undefined;

  return role || cropId || tags.find((tag) => tag !== 'harvest-rush') || runtimeArray || getAssetFileName(asset);
};

const consoleToneClass: Record<ConsoleMessage['type'], string> = {
  info: 'text-[#6fb877]',
  warn: 'text-[#d0ad4f]',
  error: 'text-[#d16a61]',
};

const getAssetPreviewStyle = (asset: ProjectAsset) => {
  const text = `${asset.name} ${getAssetFileName(asset)} ${getAssetMetadataLabel(asset)}`.toLowerCase();
  if (['texture', 'image', 'sprite', 'spritesheet'].includes(asset.type)) return 'from-sky-500/35 via-cyan-300/20 to-slate-950';
  if (asset.type === 'audio') return 'from-emerald-500/35 via-lime-300/20 to-slate-950';
  if (asset.type === 'script') return 'from-violet-500/35 via-fuchsia-300/20 to-slate-950';
  if (text.includes('tractor') || text.includes('harvester')) return 'from-amber-500/35 via-lime-300/20 to-stone-950';
  if (text.includes('trailer') || text.includes('truck') || text.includes('vehicle')) return 'from-orange-500/35 via-slate-400/20 to-stone-950';
  if (text.includes('crop') || text.includes('plant') || text.includes('hay') || text.includes('farm')) return 'from-green-500/35 via-yellow-300/20 to-stone-950';
  return 'from-zinc-500/30 via-zinc-300/15 to-zinc-950';
};

const assetMatchesFolder = (asset: ProjectAsset, selectedFolder: string) => {
  if (selectedFolder === 'project') return true;
  const prefixes = FOLDER_PREFIXES[selectedFolder];
  const selectedPath = getProjectFolderPath(selectedFolder).toLowerCase();
  const folder = asset.folder.toLowerCase();
  if (!prefixes) return folder === selectedPath || folder.startsWith(`${selectedPath}/`);
  return prefixes.some((prefix) => {
    const normalized = prefix.toLowerCase().replace(/\/$/, '');
    return folder === normalized || folder.startsWith(`${normalized}/`);
  }) || folder === selectedPath || folder.startsWith(`${selectedPath}/`);
};

const AssetPreview = ({ asset, size = 'md' }: { asset: ProjectAsset; size?: 'sm' | 'md' }) => {
  const AssetIcon = getAssetIcon(asset.type);
  const format = getAssetFormat(asset);
  const label = getAssetMetadataLabel(asset);

  if (asset.thumbnail || ['texture', 'image', 'sprite', 'spritesheet'].includes(asset.type)) {
    const imageUrl = asset.thumbnail || asset.url;
    return (
      <div className={cn(
        'relative overflow-hidden border border-border bg-[var(--editor-panel-sunken)]',
        size === 'sm' ? 'h-8 w-10 rounded-sm' : 'h-[68px] w-full rounded-sm'
      )}>
        <img src={imageUrl} alt={asset.name} className="h-full w-full object-cover" />
        <span className="absolute left-1 top-1 rounded-[2px] bg-black/65 px-1 text-[8px] font-semibold uppercase text-white/80">
          {format}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      'relative overflow-hidden border border-border bg-gradient-to-br',
      getAssetPreviewStyle(asset),
      size === 'sm' ? 'h-8 w-10 rounded-sm' : 'h-[68px] w-full rounded-sm'
    )}>
      <div className="absolute inset-x-1 bottom-1 h-1/3 rounded-[2px] bg-black/25" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
      <div className="absolute right-1 top-1 rounded-[2px] bg-black/55 px-1 text-[8px] font-semibold uppercase text-white/75">
        {format}
      </div>
      <div className="relative flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
        <AssetIcon className={cn('text-white/80 drop-shadow', size === 'sm' ? 'h-4 w-4' : 'h-6 w-6')} />
        {size === 'md' && (
          <span className="max-w-full truncate text-[9px] font-medium text-white/75">
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

export const BottomPanel = () => {
  const dockChrome = useDockChrome();
  const availableBottomTabs = useMemo(() => getAvailableBottomTabs(), []);
  const activeTab = useBottomPanelTabsStore((s) => s.activeTab);
  const tabOrder = useBottomPanelTabsStore((s) => s.tabOrder);
  const closedTabs = useBottomPanelTabsStore((s) => s.closedTabs);
  const setActiveTab = useBottomPanelTabsStore((s) => s.setActiveTab);
  const moveTabBefore = useBottomPanelTabsStore((s) => s.moveTabBefore);
  const moveTabToEnd = useBottomPanelTabsStore((s) => s.moveTabToEnd);
  const closeBottomTab = useBottomPanelTabsStore((s) => s.closeTab);
  const restoreAllBottomTabs = useBottomPanelTabsStore((s) => s.restoreAllTabs);
  const [draggedTab, setDraggedTab] = useState<BottomTabId | null>(null);
  const [tabDropTarget, setTabDropTarget] = useState<BottomTabDropTarget | null>(null);
  const draggedTabRef = useRef<BottomTabId | null>(null);
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [consoleSearch, setConsoleSearch] = useState('');
  const [consoleCommand, setConsoleCommand] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('project');
  const [assetSearch, setAssetSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [customAssetFolders, setCustomAssetFolders] = useState<AssetFolder[]>([]);
  const [isResizingFolderTree, setIsResizingFolderTree] = useState(false);
  const [contentBrowserSidebarWidth, setContentBrowserSidebarWidth] = useState(() => {
    try {
      const savedWidth = Number(localStorage.getItem(CONTENT_BROWSER_SIDEBAR_WIDTH_KEY));
      if (Number.isFinite(savedWidth)) {
        return clampContentBrowserSidebarWidth(savedWidth);
      }
    } catch {
      localStorage.removeItem(CONTENT_BROWSER_SIDEBAR_WIDTH_KEY);
    }

    return CONTENT_BROWSER_SIDEBAR_DEFAULT_WIDTH;
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderTreeResizeRef = useRef({ startX: 0, startWidth: CONTENT_BROWSER_SIDEBAR_DEFAULT_WIDTH });
  const { projectAssets, loadingAssets, addProjectAsset, removeProjectAsset, updateProjectAsset } = useAssetStore();
  const localProjectId = useProjectStore((s) => s.currentProjectId);
  const localProject = useProjectStore((s) => s.projects.find((project) => project.id === localProjectId));
  const activeSceneKind = useEditorStore((s) => s.activeSceneKind);
  const objects = useEditorStore((s) => s.objects);
  const gameScript = useEditorStore((s) => s.gameScript);
  const transformSpace = useEditorStore((s) => s.transformSpace);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const snapTranslate = useEditorStore((s) => s.snapTranslate);
  const snapRotate = useEditorStore((s) => s.snapRotate);
  const snapScale = useEditorStore((s) => s.snapScale);
  const projectName = localProject?.name || 'Untitled Project';
  const diagnostics = useMemo(() => {
    try {
      return createActiveProjectDiagnosticsSnapshot(projectName).diagnostics;
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
  const diagnosticMessages = useMemo<ProjectDiagnosticConsoleMessage[]>(
    () => diagnostics ? createProjectDiagnosticConsoleMessages(diagnostics) : [],
    [diagnostics],
  );
  const consoleMessages = useMemo<ConsoleMessage[]>(
    () => [...INITIAL_CONSOLE, ...diagnosticMessages],
    [diagnosticMessages],
  );
  useEffect(() => {
    localStorage.setItem(CONTENT_BROWSER_SIDEBAR_WIDTH_KEY, String(contentBrowserSidebarWidth));
  }, [contentBrowserSidebarWidth]);

  const visibleTabIds = draggedTab && tabDropTarget
    ? previewBottomTabMove(tabOrder, closedTabs, draggedTab, tabDropTarget)
    : getVisibleBottomTabs(tabOrder, closedTabs);
  const tabs = visibleTabIds
    .map((id) => availableBottomTabs.find((tab) => tab.id === id))
    .filter((tab): tab is BottomTabDefinition => Boolean(tab));
  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? 'Project';

  const assetFolders = useMemo(() => ASSET_FOLDERS.map((folder) => {
    if (folder.id !== 'assets') return folder;
    return {
      ...folder,
      children: [...getSceneAssetChildren(folder.children ?? [], activeSceneKind), ...customAssetFolders],
    };
  }), [activeSceneKind, customAssetFolders]);

  useEffect(() => {
    if (activeSceneKind === '2d' && selectedFolder === '3d_models') setSelectedFolder('project');
  }, [activeSceneKind, selectedFolder]);

  const handleFolderTreeResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    folderTreeResizeRef.current = {
      startX: event.clientX,
      startWidth: contentBrowserSidebarWidth,
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setIsResizingFolderTree(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - folderTreeResizeRef.current.startX;
      setContentBrowserSidebarWidth(
        clampContentBrowserSidebarWidth(folderTreeResizeRef.current.startWidth + delta),
      );
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      setIsResizingFolderTree(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }, [contentBrowserSidebarWidth]);

  const handleTabDragStart = (tab: BottomTabId) => {
    draggedTabRef.current = tab;
    setDraggedTab(tab);
  };

  const handleTabDrop = () => {
    const sourceTab = draggedTabRef.current;
    const target = tabDropTarget;
    if (!sourceTab || !target || sourceTab === target) {
      handleTabDragEnd();
      return;
    }

    if (target === 'end') moveTabToEnd(sourceTab);
    else moveTabBefore(sourceTab, target);
    handleTabDragEnd();
  };

  const handleTabDropEnd = () => {
    const sourceTab = draggedTabRef.current;
    if (sourceTab) moveTabToEnd(sourceTab);
    handleTabDragEnd();
  };

  const handleTabDragEnd = () => {
    draggedTabRef.current = null;
    setDraggedTab(null);
    setTabDropTarget(null);
  };

  const consoleCounts = useMemo(() => ({
    all: consoleMessages.length,
    info: consoleMessages.filter((message) => message.type === 'info').length,
    warn: consoleMessages.filter((message) => message.type === 'warn').length,
    error: consoleMessages.filter((message) => message.type === 'error').length,
  }), [consoleMessages]);

  const filteredMessages = useMemo(() => {
    const normalizedSearch = consoleSearch.trim().toLowerCase();
    return consoleMessages.filter((message) => {
      if (consoleFilter !== 'all' && message.type !== consoleFilter) return false;
      if (!normalizedSearch) return true;
      return [
        message.message,
        message.source ?? '',
        message.path ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [consoleFilter, consoleMessages, consoleSearch]);

  const filteredProjectAssets = projectAssets.filter(
    a => a.name.toLowerCase().includes(assetSearch.toLowerCase()) &&
         assetMatchesFolder(a, selectedFolder)
  );
  
  // Editor store for adding to scene
  const addModelFromAsset = useEditorStore((s) => s.addModelFromAsset);
  const addSpriteFromAsset = useEditorStore((s) => s.addSpriteFromAsset);
  const selectObject = useEditorStore((s) => s.selectObject);
  const { startDrag, endDrag } = useAssetDragStore();

  const is2DAssetType = (type?: string) => (
    type === 'texture' ||
    type === 'image' ||
    type === 'sprite' ||
    type === 'spritesheet'
  );

  // Add asset to 3D scene (button click - adds at origin)
  const handleAddToScene = (name: string, url: string, type?: string) => {
    if (!url) {
      toast.error('Asset sem URL de modelo');
      return;
    }
    
    if (is2DAssetType(type)) {
      addSpriteFromAsset({
        name,
        url,
        type,
      }, [0, 0, 0]);
    } else {
      addModelFromAsset({
        name,
        url,
        type: type || 'model'
      }, [0, 0, 0]);
    }
    
    toast.success(`${name} adicionado à cena!`);
  };
  
  // Start dragging asset (for drag to scene)
  const handleDragStart = (
    e: React.DragEvent,
    name: string,
    url: string,
    type?: string,
    thumbnailUrl?: string,
    assetId?: string,
    assetPath?: string,
  ) => {
    if (!url) {
      e.preventDefault();
      return;
    }
    
    // Set drag data
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'pixlland-asset',
      name,
      url,
      assetType: type || 'model',
      thumbnailUrl,
      assetId,
      assetPath,
      source: assetId ? 'project' : 'library',
    }));
    e.dataTransfer.effectAllowed = assetId ? 'copyMove' : 'copy';
    
    // Update drag store for visual feedback
    startDrag({
      id: Math.random().toString(36).substring(2, 9),
      name,
      url,
      type: type || 'model',
      thumbnailUrl
    });
  };
  
  const handleDragEnd = () => {
    endDrag();
  };

  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;

    const targetFolder = getProjectFolderPath(selectedFolder);

    try {
      const importedFiles = await importProjectAssetFiles(files, targetFolder);
      importedFiles.forEach((importedFile, index) => {
        const sourceFile = files[index];
        const type = getImportedAssetType(importedFile.name, importedFile.folder);
        addProjectAsset({
          name: importedFile.name,
          type,
          url: importedFile.url,
          path: importedFile.path,
          folder: importedFile.folder,
          metadata: {
            ...importedFile.metadata,
            format: sourceFile?.name.split('.').pop()?.toLowerCase()
              || (typeof importedFile.metadata.format === 'string' ? importedFile.metadata.format : undefined),
          },
        });
      });

      const destination = hasActiveProjectWorkspace()
        ? targetFolder
        : `${targetFolder} (memoria)`;
      toast.success(`${importedFiles.length} asset(s) importado(s) em ${destination}.`);
    } catch (error) {
      console.error('[BottomPanel] Failed to import project assets:', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel importar assets.');
    }
  }, [selectedFolder, addProjectAsset]);

  const handleFolderDragOver = useCallback((event: React.DragEvent) => {
    const raw = Array.from(event.dataTransfer.types).includes('application/json');
    if (!raw) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleFolderDrop = useCallback(async (event: React.DragEvent, folderId: string) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const raw = event.dataTransfer.getData('application/json');
      if (!raw) return;
      const payload = JSON.parse(raw) as { type?: string; assetId?: string };
      if (payload.type !== 'pixlland-asset' || !payload.assetId) return;

      const asset = projectAssets.find((item) => item.id === payload.assetId);
      if (!asset) return;

      const targetFolder = getProjectFolderPath(folderId);
      const moved = await moveProjectAssetToFolder(asset, targetFolder);
      updateProjectAsset(asset.id, moved);
      setSelectedFolder(folderId);
      toast.success(`${asset.name} movido para ${targetFolder}.`);
    } catch (error) {
      console.error('[BottomPanel] Failed to move project asset:', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel mover asset.');
    }
  }, [projectAssets, updateProjectAsset]);

  const handleCreateFolder = useCallback(async () => {
    const folderName = window.prompt('Nome da nova pasta');
    if (!folderName) return;

    const parentFolder = getProjectFolderPath(selectedFolder);
    const folderPath = `${parentFolder}/${sanitizeFolderName(folderName)}`;

    try {
      const createdFolder = await ensureProjectAssetFolder(folderPath);
      setCustomAssetFolders((current) => {
        if (current.some((folder) => folder.id === createdFolder)) return current;
        return [
          ...current,
          {
            id: createdFolder,
            name: createdFolder.split('/').pop() || createdFolder,
            icon: '',
          },
        ];
      });
      setSelectedFolder(createdFolder);
      toast.success(
        hasActiveProjectWorkspace()
          ? `Pasta criada em ${createdFolder}.`
          : `Pasta ${createdFolder} criada no projeto em memoria.`,
      );
    } catch (error) {
      console.error('[BottomPanel] Failed to create asset folder:', error);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel criar pasta.');
    }
  }, [selectedFolder]);

  const handleConsoleMessageClick = useCallback((message: ConsoleMessage) => {
    if (!message.targetObjectId) return;

    selectObject(message.targetObjectId);
    toast.success(`Selecionado: ${message.targetObjectName ?? message.targetObjectId}`, {
      duration: 1200,
    });
  }, [selectObject]);

  const getMessageIcon = (type: ConsoleMessage['type']) => {
    switch (type) {
      case 'error': return <AlertCircle className={cn('w-3.5 h-3.5', consoleToneClass.error)} />;
      case 'warn': return <AlertTriangle className={cn('w-3.5 h-3.5', consoleToneClass.warn)} />;
      default: return <Info className={cn('w-3.5 h-3.5', consoleToneClass.info)} />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--editor-panel)]">
      {/* Tab Bar */}
      <div
        className="panel-header panel-tabs-left gap-0.5 px-1 pt-1"
        onPointerDown={(event) => dockChrome?.onPointerDown(event)}
        title="Arraste para reorganizar"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <div
              key={tab.id}
              draggable
              onDragStart={() => handleTabDragStart(tab.id)}
              onDragOver={(event) => {
                event.preventDefault();
                const source = draggedTabRef.current;
                if (source) {
                  setTabDropTarget(getBottomTabDropTarget(visibleTabIds, source, tab.id, event.currentTarget.getBoundingClientRect(), event.clientX));
                }
              }}
              onDragLeave={() => setTabDropTarget((target) => target === tab.id ? null : target)}
              onDrop={handleTabDrop}
              onDragEnd={handleTabDragEnd}
              onPointerDown={(event) => event.stopPropagation()}
              className={cn(
                'editor-panel-tab relative flex h-6 max-w-[160px] cursor-grab items-center gap-1 px-1.5 text-[11px] transition-[box-shadow,color,background,opacity] active:cursor-grabbing',
                activeTab === tab.id 
                  ? 'active' 
                  : 'text-muted-foreground',
                draggedTab === tab.id && 'opacity-55',
                tabDropTarget === tab.id && 'shadow-[inset_2px_0_0_var(--editor-command-highlight)]'
              )}
            >
              <button
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="flex h-full min-w-0 items-center gap-1"
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            </div>
          );
        })}
        <div className="ml-auto">
          <DockFrameMenu
            label={dockChrome?.label ?? 'Project'}
            closeLabel="Close Panel"
            items={[
              { label: `Move ${activeTabLabel} to End`, onClick: () => activeTab && moveTabToEnd(activeTab) },
              { label: 'Restore Project Tabs', onClick: restoreAllBottomTabs },
              { label: 'Close Tab', onClick: () => activeTab && closeBottomTab(activeTab) },
            ]}
          />
        </div>
        {draggedTab && (
          <div
            data-testid="bottom-tab-end-drop"
            onDragOver={(event) => {
              event.preventDefault();
              setTabDropTarget('end');
            }}
            onDragLeave={() => setTabDropTarget((target) => target === 'end' ? null : target)}
            onDrop={handleTabDropEnd}
            className={cn(
              'ml-1 h-7 w-10 border border-dashed border-[var(--editor-border-light)] bg-[rgba(38,38,38,0.4)] transition-colors',
              tabDropTarget === 'end' && 'border-solid bg-[var(--editor-command-active)] shadow-[inset_0_0_0_1px_var(--editor-command-highlight)]'
            )}
            title="Solte aqui para mover a aba ao fim"
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!activeTab && (
          <div className="flex h-full items-center justify-center bg-[var(--editor-bg)] text-xs text-muted-foreground">
            Reabra abas em Window.
          </div>
        )}
        {/* Assets Browser */}
        {activeTab === 'assets' && (
          <div className="h-full flex">
            {/* Folder Tree */}
            <div
              className="shrink-0 overflow-y-auto py-2"
              style={{ width: contentBrowserSidebarWidth }}
            >
              <div className="px-2 mb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    className="w-full border border-border bg-[var(--editor-panel-sunken)] pl-7 pr-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              
              {/* Folder Structure */}
              {assetFolders.map((folder) => {
                const FolderIcon = getFolderIcon(folder);
                return (
                  <div key={folder.id}>
                  <button
                    onClick={() => setSelectedFolder(folder.id)}
                    onDragOver={handleFolderDragOver}
                    onDrop={(event) => handleFolderDrop(event, folder.id)}
                    className={cn(
                      'w-full flex items-center gap-1.5 px-3 py-1 text-xs hover:bg-[var(--editor-row-hover)] transition-colors',
                      selectedFolder === folder.id && 'bg-[var(--editor-row-selected)] text-foreground'
                    )}
                  >
                    {folder.children ? <ChevronRight className="w-3 h-3" /> : <span className="w-3" />}
                    <FolderIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                  {folder.children && (
                    <div className="ml-4">
                      {folder.children.map((child) => {
                        const ChildIcon = getFolderIcon(child);
                        return (
                          <button
                          key={child.id}
                          onClick={() => setSelectedFolder(child.id)}
                          onDragOver={handleFolderDragOver}
                          onDrop={(event) => handleFolderDrop(event, child.id)}
                          className={cn(
                            'w-full flex items-center gap-1.5 px-3 py-1 text-xs hover:bg-[var(--editor-row-hover)] transition-colors',
                            selectedFolder === child.id && 'bg-[var(--editor-row-selected)] text-foreground'
                          )}
                        >
                          <ChevronRight className="w-3 h-3 opacity-0" />
                          <ChildIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="truncate">{child.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
            <div
              role="separator"
              aria-label="Resize content browser explorer"
              aria-orientation="vertical"
              title="Arraste para redimensionar. Duplo clique para restaurar."
              onPointerDown={handleFolderTreeResizeStart}
              onDoubleClick={() => setContentBrowserSidebarWidth(CONTENT_BROWSER_SIDEBAR_DEFAULT_WIDTH)}
              className={cn(
                'group relative z-10 h-full w-2 shrink-0 cursor-col-resize border-l border-r border-border bg-[var(--editor-panel-header)] touch-none transition-colors hover:bg-[var(--editor-row-hover)]',
                isResizingFolderTree && 'border-[var(--editor-border-light)] bg-[var(--editor-command-active)]'
              )}
            >
              <div className={cn(
                'absolute left-1/2 top-1/2 h-10 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/25 transition-colors group-hover:bg-foreground/70',
                isResizingFolderTree && 'bg-foreground'
              )} />
            </div>

            {/* Asset Grid */}
            <div className="flex-1 flex flex-col">
              {/* Toolbar */}
              <div className="flex items-center justify-between border-b border-border bg-[var(--editor-toolbar)] px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <button className="editor-command-chip flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground" title="Voltar">
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  </button>
                  <button className="editor-command-chip flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground" title="Atualizar">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".glb,.gltf,.fbx,.obj,.png,.jpg,.jpeg,.webp,.gif,.svg,.json,.atlas,.tilemap,.mp3,.wav,.ogg"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="editor-command-chip flex h-6 items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Import
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    className="editor-command-chip flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
                    title="Nova pasta"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={assetSearch}
                      onChange={(e) => setAssetSearch(e.target.value)}
                      className="w-40 border border-border bg-[var(--editor-panel-sunken)] pl-7 pr-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={cn("editor-command-chip flex h-6 w-6 items-center justify-center", viewMode === 'grid' ? 'is-active text-foreground' : 'text-muted-foreground hover:text-foreground')}
                    aria-label="Grid view"
                    title="Grid view"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn("editor-command-chip flex h-6 w-6 items-center justify-center", viewMode === 'list' ? 'is-active text-foreground' : 'text-muted-foreground hover:text-foreground')}
                    aria-label="Column list view"
                    title="Column list view"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Loading Progress */}
              {loadingAssets.length > 0 && (
                <div className="px-3 py-2 border-b border-border bg-secondary/30">
                  {loadingAssets.map(asset => (
                    <div key={asset.id} className="flex items-center gap-2 text-xs">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="truncate">{asset.name}</span>
                          <span className="text-muted-foreground">{asset.progress}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${asset.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Asset Content */}
              {filteredProjectAssets.length > 0 ? (
                <div className="flex-1 overflow-y-auto p-3">
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(116px,132px))] content-start gap-2.5">
                      {filteredProjectAssets.map((asset) => {
                        return (
                          <div 
                            key={asset.id}
                            draggable={!!asset.url}
                            onDragStart={(event) => handleDragStart(event, asset.name, asset.url, asset.type, asset.thumbnail, asset.id, asset.path)}
                            onDragEnd={handleDragEnd}
                            data-asset-id={asset.id}
                            className="group relative flex h-[126px] min-w-0 cursor-pointer flex-col border border-border bg-[var(--editor-panel-raised)] p-2 transition-colors hover:border-[var(--editor-border-light)] hover:bg-[var(--editor-row-hover)]"
                            title={`${asset.name}\n${asset.url}`}
                          >
                            <AssetPreview asset={asset} />
                            <div className="mt-2 min-w-0">
                              <div className="truncate text-[11px] font-medium leading-tight text-foreground">{asset.name}</div>
                              <div className="mt-0.5 flex items-center justify-between gap-1 text-[9px] text-muted-foreground">
                                <span className="truncate">{getAssetFolderLabel(asset)}</span>
                                <span className="shrink-0 uppercase">{asset.type}</span>
                              </div>
                            </div>
                            
                            {/* Delete overlay */}
                            <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeProjectAsset(asset.id);
                                }}
                                className="rounded-sm border border-[#3a1515] bg-destructive/90 p-1 text-destructive-foreground shadow-lg"
                                title="Remover asset"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="min-w-[760px] overflow-hidden border border-border bg-[var(--editor-panel)]">
                        <div className="grid grid-cols-[56px_minmax(180px,1fr)_88px_minmax(150px,0.55fr)_minmax(140px,0.55fr)_36px] items-center border-b border-border bg-[var(--editor-panel-header)] px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                          <span>Preview</span>
                          <span>Nome</span>
                          <span>Tipo</span>
                          <span>Pasta</span>
                          <span>Detalhes</span>
                          <span />
                        </div>
                        {filteredProjectAssets.map((asset) => {
                          return (
                            <div
                              key={asset.id}
                              draggable={!!asset.url}
                              onDragStart={(event) => handleDragStart(event, asset.name, asset.url, asset.type, asset.thumbnail, asset.id, asset.path)}
                              onDragEnd={handleDragEnd}
                              data-asset-id={asset.id}
                              className="grid h-11 grid-cols-[56px_minmax(180px,1fr)_88px_minmax(150px,0.55fr)_minmax(140px,0.55fr)_36px] items-center border-b border-border px-2 text-xs transition-colors last:border-b-0 hover:bg-[var(--editor-row-hover)]"
                              title={`${asset.name}\n${asset.url}`}
                            >
                              <AssetPreview asset={asset} size="sm" />
                              <div className="min-w-0 pr-3">
                                <div className="truncate font-medium text-foreground">{asset.name}</div>
                                <div className="truncate text-[10px] text-muted-foreground">{getAssetFileName(asset)}</div>
                              </div>
                              <span className="truncate text-[10px] uppercase text-muted-foreground">{asset.type}</span>
                              <span className="truncate text-[10px] text-muted-foreground">{getAssetFolderLabel(asset)}</span>
                              <span className="truncate text-[10px] text-muted-foreground">{getAssetMetadataLabel(asset)}</span>
                              <button
                                onClick={() => removeProjectAsset(asset.id)}
                                className="justify-self-end rounded-sm p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                                title="Remover asset"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <FolderOpen className="mb-2 h-9 w-9 opacity-20" />
                  <p className="text-xs">Pasta vazia</p>
                  <p className="mb-2 text-[10px] opacity-70">Importe modelos GLB/GLTF, texturas ou áudio</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-7 items-center gap-1.5 rounded-sm border border-border bg-secondary px-2.5 text-xs text-foreground hover:bg-muted"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Importar Assets
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* UI Editor */}
        {activeTab === 'ui' && <UIEditorPanel />}

        {/* Timeline */}
        {activeTab === 'timeline' && (
          <TimelinePanel />
        )}

        {/* Console */}
        {activeTab === 'console' && (
          <div className="h-full flex flex-col">
            {/* Console Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">Engine Console</span>
                {diagnostics && (
                  <span className="ml-1 rounded-sm border border-border bg-[var(--editor-panel-sunken)] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <span className={diagnostics.errors ? consoleToneClass.error : consoleToneClass.info}>{diagnostics.errors}E</span>
                    <span className="px-1">/</span>
                    <span className={diagnostics.warnings ? consoleToneClass.warn : consoleToneClass.info}>{diagnostics.warnings}W</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filtrar..."
                    value={consoleSearch}
                    onChange={(event) => setConsoleSearch(event.target.value)}
                    className="w-32 bg-muted border-0 rounded pl-7 pr-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button 
                  onClick={() => setConsoleFilter('all')}
                  className={cn("editor-command-chip h-6 px-1.5 text-[10px]", consoleFilter === 'all' ? 'is-active text-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  Todos {consoleCounts.all}
                </button>
                <button 
                  onClick={() => setConsoleFilter('info')}
                  aria-label={`Info ${consoleCounts.info}`}
                  className={cn("flex items-center gap-1 p-1 rounded bg-transparent", consoleToneClass.info, consoleFilter === 'info' ? 'font-semibold opacity-100' : 'opacity-75 hover:opacity-100')}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{consoleCounts.info}</span>
                </button>
                <button 
                  onClick={() => setConsoleFilter('warn')}
                  aria-label={`Warnings ${consoleCounts.warn}`}
                  className={cn("flex items-center gap-1 p-1 rounded bg-transparent", consoleToneClass.warn, consoleFilter === 'warn' ? 'font-semibold opacity-100' : 'opacity-75 hover:opacity-100')}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{consoleCounts.warn}</span>
                </button>
                <button 
                  onClick={() => setConsoleFilter('error')}
                  aria-label={`Errors ${consoleCounts.error}`}
                  className={cn("flex items-center gap-1 p-1 rounded bg-transparent", consoleToneClass.error, consoleFilter === 'error' ? 'font-semibold opacity-100' : 'opacity-75 hover:opacity-100')}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{consoleCounts.error}</span>
                </button>
                <div className="w-px h-4 bg-border" />
                <button className="p-1 rounded hover:bg-secondary text-muted-foreground" title="Pausar">
                  <Play className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setConsoleFilter('all');
                    setConsoleSearch('');
                  }}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground"
                  title="Limpar filtro"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto font-mono text-xs">
              {filteredMessages.length ? filteredMessages.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => handleConsoleMessageClick(msg)}
                  aria-disabled={!msg.targetObjectId}
                  title={msg.targetObjectId ? `Selecionar ${msg.targetObjectName ?? msg.targetObjectId}` : undefined}
                  className={cn(
                    'grid w-full grid-cols-[auto_minmax(96px,140px)_minmax(0,1fr)_auto] items-start gap-2 border-b border-border/50 px-3 py-1.5 text-left',
                    msg.targetObjectId
                      ? 'cursor-pointer hover:bg-secondary/30'
                      : 'cursor-default',
                  )}
                >
                  <div className="pt-0.5">{getMessageIcon(msg.type)}</div>
                  <span className="truncate rounded-sm border border-border bg-[var(--editor-panel-sunken)] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {msg.source ?? 'Console'}
                  </span>
                  <div className="min-w-0">
                    <div className={cn('truncate', consoleToneClass[msg.type])}>{msg.message}</div>
                    {msg.path && (
                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{msg.path}</div>
                    )}
                  </div>
                  <span className="text-muted-foreground text-[10px]">{msg.timestamp}</span>
                </button>
              )) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Nenhuma mensagem encontrada.
                </div>
              )}
            </div>

            {/* Command Input */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-[var(--editor-panel-sunken)]">
              <span className="text-muted-foreground text-xs">{'>'}</span>
              <input
                type="text"
                value={consoleCommand}
                onChange={(e) => setConsoleCommand(e.target.value)}
                placeholder="Pixl.createBox('myCube', 1, { x: 0, y: 2, z: 0 })"
                className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
              <button className="editor-command-chip h-6 px-3 text-[10px] font-semibold text-foreground hover:text-foreground">
                Executar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
