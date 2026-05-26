import { useState, useRef, useCallback, useEffect } from 'react';
import {
  FolderOpen, Terminal, Package,
  Search, Filter, RefreshCw, Download, FolderPlus, Trash2,
  AlertCircle, AlertTriangle, Info, ChevronRight, Play, X, Grid, List,
  Upload, FileBox, Image, Music, Code, Clock, Layout,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssetStore, ProjectAsset } from '@/stores/assetStore';
import { useAssetDragStore } from '@/stores/assetDragStore';
import { useEditorStore } from '@/stores/editorStore';
import { TimelinePanel } from './TimelinePanel';
import { UIEditorPanel } from './UIEditorPanel';
import { toast } from 'sonner';

interface ConsoleMessage {
  id: string;
  type: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
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

const INITIAL_CONSOLE: ConsoleMessage[] = [
  { id: '1', type: 'info', message: 'PixlPlayground inicializado', timestamp: new Date().toLocaleTimeString() },
];

type BottomTabId = 'assets' | 'ui' | 'console' | 'timeline';

const BOTTOM_TAB_ORDER_KEY = 'pixlplayground.bottomTabOrder';
const CONTENT_BROWSER_SIDEBAR_WIDTH_KEY = 'pixlplayground.contentBrowserSidebarWidth';
const CONTENT_BROWSER_SIDEBAR_DEFAULT_WIDTH = 188;
const CONTENT_BROWSER_SIDEBAR_MIN_WIDTH = 132;
const CONTENT_BROWSER_SIDEBAR_MAX_WIDTH = 360;

const BOTTOM_TABS: { id: BottomTabId; label: string; icon: LucideIcon }[] = [
  { id: 'assets', label: 'Content Browser', icon: FolderOpen },
  { id: 'ui', label: 'UI Editor', icon: Layout },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'console', label: 'Console', icon: Terminal },
];

const getAssetIcon = (type: ProjectAsset['type']) => {
  switch (type) {
    case 'model': return FileBox;
    case 'texture': return Image;
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
  assets: ['Assets/'],
  '3d_models': ['Assets/3D_Models'],
  sprites: ['Assets/Sprites'],
  audio: ['Assets/Audio'],
  vfx: ['Assets/VFX'],
  dev: ['Scripts/', 'Dev/'],
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

const getAssetPreviewStyle = (asset: ProjectAsset) => {
  const text = `${asset.name} ${getAssetFileName(asset)} ${getAssetMetadataLabel(asset)}`.toLowerCase();
  if (asset.type === 'texture') return 'from-sky-500/35 via-cyan-300/20 to-slate-950';
  if (asset.type === 'audio') return 'from-emerald-500/35 via-lime-300/20 to-slate-950';
  if (asset.type === 'script') return 'from-violet-500/35 via-fuchsia-300/20 to-slate-950';
  if (text.includes('tractor') || text.includes('harvester')) return 'from-amber-500/35 via-lime-300/20 to-stone-950';
  if (text.includes('trailer') || text.includes('truck') || text.includes('vehicle')) return 'from-orange-500/35 via-slate-400/20 to-stone-950';
  if (text.includes('crop') || text.includes('plant') || text.includes('hay') || text.includes('farm')) return 'from-green-500/35 via-yellow-300/20 to-stone-950';
  return 'from-blue-500/30 via-slate-300/15 to-slate-950';
};

const assetMatchesFolder = (asset: ProjectAsset, selectedFolder: string) => {
  if (selectedFolder === 'project') return true;
  const prefixes = FOLDER_PREFIXES[selectedFolder];
  if (!prefixes) return asset.folder === selectedFolder;
  return prefixes.some((prefix) => asset.folder === prefix || asset.folder.startsWith(`${prefix}/`));
};

const AssetPreview = ({ asset, size = 'md' }: { asset: ProjectAsset; size?: 'sm' | 'md' }) => {
  const AssetIcon = getAssetIcon(asset.type);
  const format = getAssetFormat(asset);
  const label = getAssetMetadataLabel(asset);

  if (asset.thumbnail || asset.type === 'texture') {
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
  const [activeTab, setActiveTab] = useState<BottomTabId>('assets');
  const [tabOrder, setTabOrder] = useState<BottomTabId[]>(() => BOTTOM_TABS.map((tab) => tab.id));
  const [draggedTab, setDraggedTab] = useState<BottomTabId | null>(null);
  const draggedTabRef = useRef<BottomTabId | null>(null);
  const [consoleMessages] = useState<ConsoleMessage[]>(INITIAL_CONSOLE);
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [consoleCommand, setConsoleCommand] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('project');
  const [assetSearch, setAssetSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [storeTab, setStoreTab] = useState<'library' | 'project'>('library');
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
  const { projectAssets, loadingAssets, addProjectAsset, removeProjectAsset } = useAssetStore();

  useEffect(() => {
    try {
      const savedOrder = JSON.parse(localStorage.getItem(BOTTOM_TAB_ORDER_KEY) || '[]') as BottomTabId[];
      const validIds = new Set(BOTTOM_TABS.map((tab) => tab.id));
      if (
        Array.isArray(savedOrder) &&
        savedOrder.length === BOTTOM_TABS.length &&
        savedOrder.every((id) => validIds.has(id))
      ) {
        setTabOrder(savedOrder);
      }
    } catch {
      localStorage.removeItem(BOTTOM_TAB_ORDER_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(BOTTOM_TAB_ORDER_KEY, JSON.stringify(tabOrder));
  }, [tabOrder]);

  useEffect(() => {
    localStorage.setItem(CONTENT_BROWSER_SIDEBAR_WIDTH_KEY, String(contentBrowserSidebarWidth));
  }, [contentBrowserSidebarWidth]);

  const tabs = tabOrder
    .map((id) => BOTTOM_TABS.find((tab) => tab.id === id))
    .filter((tab): tab is { id: BottomTabId; label: string; icon: LucideIcon } => Boolean(tab));

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

  const handleTabDrop = (targetTab: BottomTabId) => {
    const sourceTab = draggedTabRef.current;
    if (!sourceTab || sourceTab === targetTab) return;

    setTabOrder((current) => {
      const next = current.filter((id) => id !== sourceTab);
      const targetIndex = next.indexOf(targetTab);
      next.splice(targetIndex, 0, sourceTab);
      return next;
    });
    draggedTabRef.current = null;
    setDraggedTab(null);
  };

  const handleTabDragEnd = () => {
    draggedTabRef.current = null;
    setDraggedTab(null);
  };

  const filteredMessages = consoleMessages.filter(
    m => consoleFilter === 'all' || m.type === consoleFilter
  );

  const filteredProjectAssets = projectAssets.filter(
    a => a.name.toLowerCase().includes(assetSearch.toLowerCase()) &&
         assetMatchesFolder(a, selectedFolder)
  );

  // Editor store for adding to scene
  const { addModelFromAsset } = useEditorStore();
  const { startDrag, endDrag } = useAssetDragStore();
  
  // Add asset to 3D scene (button click - adds at origin)
  const handleAddToScene = (name: string, url: string, type?: string) => {
    if (!url) {
      toast.error('Asset sem URL de modelo');
      return;
    }
    
    addModelFromAsset({ 
      name, 
      url,
      type: type || 'model'
    }, [0, 0, 0]);
    
    toast.success(`${name} adicionado à cena!`);
  };
  
  // Start dragging asset (for drag to scene)
  const handleDragStart = (e: React.DragEvent, name: string, url: string, type?: string, thumbnailUrl?: string) => {
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
      thumbnailUrl
    }));
    e.dataTransfer.effectAllowed = 'copy';
    
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

  const handleFileImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      
      let type: ProjectAsset['type'] = 'model';
      if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) type = 'texture';
      else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) type = 'audio';
      else if (['js', 'ts', 'tsx'].includes(ext)) type = 'script';
      else if (['glb', 'gltf', 'fbx', 'obj'].includes(ext)) type = 'model';
      
      addProjectAsset({
        name: file.name,
        type,
        url,
        folder: selectedFolder,
        metadata: { format: ext },
      });
    });
    
    event.target.value = '';
  }, [selectedFolder, addProjectAsset]);

  const getMessageIcon = (type: ConsoleMessage['type']) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />;
      case 'warn': return <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />;
      default: return <Info className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="editor-dock editor-dock-outline w-full h-full flex flex-col border-t overflow-hidden">
      {/* Tab Bar */}
      <div className="panel-header panel-tabs-left gap-0.5 px-1 pt-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              draggable
              onClick={() => setActiveTab(tab.id)}
              onDragStart={() => handleTabDragStart(tab.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleTabDrop(tab.id)}
              onDragEnd={handleTabDragEnd}
              className={cn(
                'editor-panel-tab flex h-7 cursor-grab items-center gap-1.5 px-3 text-xs transition-colors active:cursor-grabbing',
                activeTab === tab.id 
                  ? 'active' 
                  : 'text-muted-foreground',
                draggedTab === tab.id && 'opacity-55'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
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
              {ASSET_FOLDERS.map((folder) => {
                const FolderIcon = getFolderIcon(folder);
                return (
                  <div key={folder.id}>
                  <button
                    onClick={() => setSelectedFolder(folder.id)}
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
                isResizingFolderTree && 'bg-primary/25 border-primary/50'
              )}
            >
              <div className={cn(
                'absolute left-1/2 top-1/2 h-10 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/25 transition-colors group-hover:bg-primary/70',
                isResizingFolderTree && 'bg-primary'
              )} />
            </div>

            {/* Asset Grid */}
            <div className="flex-1 flex flex-col">
              {/* Toolbar */}
              <div className="flex items-center justify-between border-b border-border bg-[var(--editor-toolbar)] px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <button className="p-1 hover:bg-[var(--editor-row-hover)] text-muted-foreground" title="Voltar">
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  </button>
                  <button className="p-1 hover:bg-[var(--editor-row-hover)] text-muted-foreground" title="Atualizar">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".glb,.gltf,.fbx,.obj,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 hover:bg-[var(--editor-row-hover)] text-muted-foreground text-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Import
                  </button>
                  <button className="p-1 hover:bg-[var(--editor-row-hover)] text-muted-foreground" title="Nova pasta">
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
                    className={cn("p-1", viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-[var(--editor-row-hover)]')}
                    aria-label="Grid view"
                    title="Grid view"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn("p-1", viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-[var(--editor-row-hover)]')}
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
                            className="group relative flex h-[126px] min-w-0 cursor-pointer flex-col border border-border bg-[var(--editor-panel-raised)] p-2 transition-colors hover:border-primary/50 hover:bg-[var(--editor-row-hover)]"
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
                <span className="text-xs font-medium">Console</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Filtrar..."
                    className="w-32 bg-muted border-0 rounded pl-7 pr-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button 
                  onClick={() => setConsoleFilter('all')}
                  className={cn("p-1 rounded text-[10px]", consoleFilter === 'all' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary')}
                >
                  Todos
                </button>
                <button 
                  onClick={() => setConsoleFilter('info')}
                  className={cn("p-1 rounded", consoleFilter === 'info' ? 'bg-secondary/30 text-muted-foreground' : 'text-muted-foreground hover:bg-secondary')}
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setConsoleFilter('warn')}
                  className={cn("p-1 rounded", consoleFilter === 'warn' ? 'bg-secondary/30 text-muted-foreground' : 'text-muted-foreground hover:bg-secondary')}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setConsoleFilter('error')}
                  className={cn("p-1 rounded", consoleFilter === 'error' ? 'bg-secondary/30 text-muted-foreground' : 'text-muted-foreground hover:bg-secondary')}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-border" />
                <button className="p-1 rounded hover:bg-secondary text-muted-foreground" title="Pausar">
                  <Play className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 rounded hover:bg-secondary text-muted-foreground" title="Limpar">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto font-mono text-xs">
              {filteredMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={cn(
                    'flex items-start gap-2 px-3 py-1 hover:bg-secondary/30 border-b border-border/50',
                    msg.type === 'error' && 'bg-secondary/30',
                    msg.type === 'warn' && 'bg-secondary/30'
                  )}
                >
                  {getMessageIcon(msg.type)}
                  <span className="flex-1 text-foreground">{msg.message}</span>
                  <span className="text-muted-foreground text-[10px]">{msg.timestamp}</span>
                </div>
              ))}
            </div>

            {/* Command Input */}
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-[var(--editor-panel-sunken)]">
              <span className="text-primary text-xs">{'>'}</span>
              <input
                type="text"
                value={consoleCommand}
                onChange={(e) => setConsoleCommand(e.target.value)}
                placeholder="Pixl.createBox('myCube', 1, { x: 0, y: 2, z: 0 })"
                className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
              <button className="px-3 py-1 bg-neon-green text-black rounded text-[10px] font-semibold hover:bg-neon-green/90 transition-colors">
                Executar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
