import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Globe, FolderOpen, Terminal, ShoppingBag, Package, 
  Search, Filter, RefreshCw, Download, FolderPlus, Trash2,
  AlertCircle, AlertTriangle, Info, ChevronRight, Play, X, Grid, List,
  Upload, FileBox, Image, Music, Code, Clock, ExternalLink, Loader2,
  User, LogIn, Library, FolderPlus as AddToProject, Check, Link2, Plus, Move, Layout,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAssetStore, ProjectAsset } from '@/stores/assetStore';
import { usePixllandAssetStore, PixllandAsset } from '@/stores/pixllandAssetStore';
import { useAssetDragStore } from '@/stores/assetDragStore';
import { useEditorStore } from '@/stores/editorStore';
import { TimelinePanel } from './TimelinePanel';
import { UIEditorPanel } from './UIEditorPanel';
import { usePixllandBridge } from '@/hooks/usePixllandBridge';
import { useAuthStore } from '@/stores/authStore';
import { useUserInventory, useProjectAssets, useAddAssetToProject, useRemoveAssetFromProject } from '@/hooks/useProjects';
import { useSearchParams } from 'react-router-dom';
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

// Store asset categories
const STORE_CATEGORIES = [
  { id: 'all', label: 'Todos', icon: Package },
  { id: 'characters', label: 'Personagens', icon: Globe },
  { id: 'animals', label: 'Animais', icon: Globe },
  { id: 'nature', label: 'Natureza', icon: Globe },
  { id: 'construction', label: 'Construção', icon: Globe },
  { id: 'effects', label: 'Efeitos', icon: Globe },
  { id: 'controls', label: 'Controles', icon: Globe },
];

interface StoreAsset {
  id: string;
  name: string;
  category: string;
  license: string;
  prefab: string;
  hasPreview?: boolean;
  isSystem?: boolean;
  pixllandId?: string;
  thumbnailUrl?: string;
}

// Minecraft-style prefab assets
const STORE_ASSETS: StoreAsset[] = [
  // NPCs - Minecraft Style
  { id: 'npc-villager', name: 'Villager NPC', category: 'characters', license: 'Built-in', prefab: 'MinecraftVillager', hasPreview: true },
  { id: 'npc-guard', name: 'Guard NPC', category: 'characters', license: 'Built-in', prefab: 'MinecraftGuard', hasPreview: true },
  { id: 'npc-merchant', name: 'Merchant NPC', category: 'characters', license: 'Built-in', prefab: 'MinecraftMerchant', hasPreview: true },
  { id: 'npc-zombie', name: 'Zombie Enemy', category: 'characters', license: 'Built-in', prefab: 'MinecraftZombie', hasPreview: true },
  { id: 'npc-skeleton', name: 'Skeleton Enemy', category: 'characters', license: 'Built-in', prefab: 'MinecraftSkeleton', hasPreview: true },
  // Animals - Minecraft Style
  { id: 'animal-pig', name: 'Pig', category: 'animals', license: 'Built-in', prefab: 'MinecraftPig', hasPreview: true },
  { id: 'animal-chicken', name: 'Chicken', category: 'animals', license: 'Built-in', prefab: 'MinecraftChicken', hasPreview: true },
  { id: 'animal-cow', name: 'Cow', category: 'animals', license: 'Built-in', prefab: 'MinecraftCow', hasPreview: true },
  { id: 'animal-sheep', name: 'Sheep', category: 'animals', license: 'Built-in', prefab: 'MinecraftSheep', hasPreview: true },
  // Environment
  { id: 'env-tree', name: 'Minecraft Tree', category: 'nature', license: 'Built-in', prefab: 'MinecraftTree' },
  { id: 'env-house', name: 'Minecraft House', category: 'construction', license: 'Built-in', prefab: 'MinecraftHouse' },
  { id: 'env-fence', name: 'Wooden Fence', category: 'construction', license: 'Built-in', prefab: 'MinecraftFence' },
  { id: 'env-lamp', name: 'Lamp Post', category: 'construction', license: 'Built-in', prefab: 'MinecraftLampPost' },
  // Motion Controls - Wii Style
  { id: 'ctrl-motion', name: 'Motion Control', category: 'controls', license: 'Built-in', prefab: 'MotionControl', hasPreview: true, isSystem: true },
];

type BottomTabId = 'assets' | 'ui' | 'console' | 'store' | 'timeline';

const BOTTOM_TAB_ORDER_KEY = 'pixlplayground.bottomTabOrder';

const BOTTOM_TABS: { id: BottomTabId; label: string; icon: LucideIcon }[] = [
  { id: 'assets', label: 'Content Browser', icon: FolderOpen },
  { id: 'ui', label: 'UI Editor', icon: Layout },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'store', label: 'Store', icon: ShoppingBag },
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

export const BottomPanel = () => {
  const [activeTab, setActiveTab] = useState<BottomTabId>('assets');
  const [tabOrder, setTabOrder] = useState<BottomTabId[]>(() => BOTTOM_TABS.map((tab) => tab.id));
  const [draggedTab, setDraggedTab] = useState<BottomTabId | null>(null);
  const draggedTabRef = useRef<BottomTabId | null>(null);
  const [consoleMessages] = useState<ConsoleMessage[]>(INITIAL_CONSOLE);
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [consoleCommand, setConsoleCommand] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('project');
  const [storeCategory, setStoreCategory] = useState('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [storeTab, setStoreTab] = useState<'library' | 'project'>('library');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { projectAssets, loadingAssets, addProjectAsset, removeProjectAsset } = useAssetStore();
  const { 
    isEmbedded, 
    requestStoreAssets, 
    importStoreAsset, 
    openStore,
    requestUserLibrary,
    syncProjectAssets,
    connectAccount 
  } = usePixllandBridge();
  
  // Auth from unified Supabase
  const { user, profile } = useAuthStore();
  const [searchParams] = useSearchParams();
  const currentProjectId = searchParams.get('project');
  
  // Fetch user inventory (assets purchased on Pixlland) - directly from Supabase
  const { data: userInventory = [], isLoading: isLoadingInventory, refetch: refetchInventory } = useUserInventory();
  
  // Fetch project assets - directly from Supabase
  const { data: supabaseProjectAssets = [], isLoading: isLoadingProjectAssets, refetch: refetchProjectAssets } = useProjectAssets(currentProjectId);
  
  // Mutations
  const addAssetMutation = useAddAssetToProject();
  const removeAssetMutation = useRemoveAssetFromProject();
  
  // Legacy Pixlland Asset Store (for embedded mode compatibility)
  const { 
    connection,
    libraryAssets,
    projectAssets: pixllandProjectAssets,
    isLoadingLibrary,
    isLoadingProject,
    addToProject,
    removeFromProject,
    isInProject: isInProjectLegacy,
  } = usePixllandAssetStore();
  
  // Determine if connected (user logged in via authStore)
  const isConnected = !!user;
  const username = profile?.displayName || user?.email?.split('@')[0] || null;
  
  // Check if asset is in current project
  const isInProject = useCallback((assetId: string) => {
    return supabaseProjectAssets.some(a => 
      a.metadata?.original_asset_id === assetId || a.id === assetId
    );
  }, [supabaseProjectAssets]);
  
  const [storeLoading, setStoreLoading] = useState(false);

  // No need to request library on mount - useUserInventory handles it automatically
  useEffect(() => {
    if (connection.isConnected && isEmbedded && libraryAssets.length === 0) {
      requestUserLibrary();
      syncProjectAssets();
    }
  }, [connection.isConnected, isEmbedded]);

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

  const tabs = tabOrder
    .map((id) => BOTTOM_TABS.find((tab) => tab.id === id))
    .filter((tab): tab is { id: BottomTabId; label: string; icon: LucideIcon } => Boolean(tab));

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

  const filteredStoreAssets = STORE_ASSETS.filter(
    a => (storeCategory === 'all' || a.category === storeCategory) &&
         a.name.toLowerCase().includes(storeSearch.toLowerCase())
  );

  const filteredProjectAssets = projectAssets.filter(
    a => a.name.toLowerCase().includes(assetSearch.toLowerCase()) &&
         (selectedFolder === 'project' || a.folder === selectedFolder)
  );
  
  // Filter user inventory from Supabase (Minha Biblioteca)
  const filteredInventoryAssets = userInventory.filter(
    item => item.asset && 
            item.asset.name.toLowerCase().includes(storeSearch.toLowerCase()) &&
            (storeCategory === 'all' || item.asset.category === storeCategory)
  );
  
  // Filter project assets from Supabase (No Projeto)
  const filteredSupabaseProjectAssets = supabaseProjectAssets.filter(
    a => a.name.toLowerCase().includes(storeSearch.toLowerCase())
  );
  
  // Legacy: Filter Pixlland library assets (for embedded mode)
  const filteredLibraryAssets = libraryAssets.filter(
    a => a.name.toLowerCase().includes(storeSearch.toLowerCase()) &&
         (storeCategory === 'all' || a.category === storeCategory)
  );
  
  // Legacy: Filter Pixlland project assets
  const filteredPixllandProjectAssets = pixllandProjectAssets.filter(
    a => a.name.toLowerCase().includes(storeSearch.toLowerCase())
  );
  
  // Handle adding inventory asset to project (saves to arcade_game_project_assets)
  const handleAddInventoryToProject = async (inventoryItem: typeof userInventory[0]) => {
    if (!currentProjectId) {
      toast.error('Abra um projeto primeiro para adicionar assets');
      return;
    }
    if (!inventoryItem.asset) return;
    
    try {
      await addAssetMutation.mutateAsync({
        projectId: currentProjectId,
        asset: {
          name: inventoryItem.asset.name,
          asset_type: inventoryItem.asset.asset_type || undefined,
          asset_url: inventoryItem.asset.asset_url || undefined,
          category: inventoryItem.asset.category || undefined,
          source: 'pixlland_store',
          metadata: { original_asset_id: inventoryItem.asset_id },
        }
      });
      toast.success(`${inventoryItem.asset.name} adicionado ao projeto`);
    } catch (error) {
      toast.error('Erro ao adicionar asset');
    }
  };
  
  // Handle removing asset from project
  const handleRemoveAssetFromProject = async (assetId: string) => {
    if (!currentProjectId) return;
    
    try {
      await removeAssetMutation.mutateAsync({ assetId, projectId: currentProjectId });
      toast.info('Asset removido do projeto');
    } catch (error) {
      toast.error('Erro ao remover asset');
    }
  };
  
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
  
  // Legacy: Handle adding Pixlland asset to project
  const handleAddToProject = (asset: PixllandAsset) => {
    addToProject(asset);
    toast.success(`${asset.name} adicionado ao projeto`);
  };
  
  // Handle removing Pixlland asset from project
  const handleRemoveFromProject = (assetId: string) => {
    removeFromProject(assetId);
    toast.info('Asset removido do projeto');
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
            <div className="w-48 border-r border-border overflow-y-auto py-2">
              <div className="px-2 mb-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    className="w-full border border-[#111] bg-[#1d1d1d] pl-7 pr-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                      'w-full flex items-center gap-1.5 px-3 py-1 text-xs hover:bg-[#353535] transition-colors',
                      selectedFolder === folder.id && 'bg-[#4a4a4a] text-foreground'
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
                            'w-full flex items-center gap-1.5 px-3 py-1 text-xs hover:bg-[#353535] transition-colors',
                            selectedFolder === child.id && 'bg-[#4a4a4a] text-foreground'
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

            {/* Asset Grid */}
            <div className="flex-1 flex flex-col">
              {/* Toolbar */}
              <div className="flex items-center justify-between border-b border-[#111] bg-[#242424] px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <button className="p-1 hover:bg-[#353535] text-muted-foreground" title="Voltar">
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  </button>
                  <button className="p-1 hover:bg-[#353535] text-muted-foreground" title="Atualizar">
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
                    className="flex items-center gap-1 px-2 py-1 hover:bg-[#353535] text-muted-foreground text-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Import
                  </button>
                  <button className="p-1 hover:bg-[#353535] text-muted-foreground" title="Nova pasta">
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
                      className="w-40 border border-[#111] bg-[#1d1d1d] pl-7 pr-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={cn("p-1", viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-[#353535]')}
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn("p-1", viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-[#353535]')}
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
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
                      {filteredProjectAssets.map((asset) => {
                        const AssetIcon = getAssetIcon(asset.type);
                        return (
                          <div 
                            key={asset.id}
                            className="group relative flex flex-col items-center border border-[#111] bg-[#242424] p-2 cursor-pointer transition-colors hover:bg-[#303030]"
                          >
                            <span className="absolute top-1 left-1 bg-[#1d1d1d] px-1 py-0.5 text-[9px] text-muted-foreground">
                              {asset.type}
                            </span>
                            
                            {asset.thumbnail ? (
                              <img src={asset.thumbnail} alt={asset.name} className="w-12 h-12 object-cover rounded mb-1" />
                            ) : (
                              <div className="w-12 h-12 flex items-center justify-center text-muted-foreground mb-1">
                                <AssetIcon className="w-8 h-8 opacity-50" />
                              </div>
                            )}
                            
                            <span className="text-[10px] text-center truncate w-full">{asset.name}</span>
                            
                            {/* Delete overlay */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeProjectAsset(asset.id);
                                }}
                                className="p-1.5 bg-destructive text-destructive-foreground"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredProjectAssets.map((asset) => {
                        const AssetIcon = getAssetIcon(asset.type);
                        return (
                          <div 
                            key={asset.id}
                            className="flex items-center gap-2 border border-[#111] bg-[#242424] px-2 py-1 hover:bg-[#303030] cursor-pointer transition-colors"
                          >
                            <AssetIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="flex-1 text-xs truncate">{asset.name}</span>
                            <span className="text-[10px] text-muted-foreground">{asset.type}</span>
                            <button 
                              onClick={() => removeProjectAsset(asset.id)}
                              className="p-1 hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
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
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-[#181825]">
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

        {/* Store */}
        {activeTab === 'store' && (
          <div className="h-full flex flex-col">
            {/* Store Header with Connection Status */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                {/* Connection Status - Use authStore instead */}
                {isConnected ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary/30 border border-border rounded">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {username || 'Conectado'}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={connectAccount}
                    className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/30 rounded hover:bg-primary/20 transition-colors"
                  >
                    <LogIn className="w-3 h-3 text-primary" />
                    <span className="text-[10px] text-primary font-medium">Conectar Pixlland</span>
                  </button>
                )}
                
                {/* Tabs: Minha Biblioteca / No Projeto */}
                {isConnected && (
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => setStoreTab('library')}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
                        storeTab === 'library'
                          ? 'bg-primary/20 text-primary'
                          : 'text-muted-foreground hover:bg-secondary'
                      )}
                    >
                      <Library className="w-3 h-3" />
                      Minha Biblioteca ({filteredInventoryAssets.length})
                    </button>
                    <button
                      onClick={() => setStoreTab('project')}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
                        storeTab === 'project'
                          ? 'bg-primary/20 text-primary'
                          : 'text-muted-foreground hover:bg-secondary'
                      )}
                    >
                      <Link2 className="w-3 h-3" />
                      No Projeto ({filteredSupabaseProjectAssets.length})
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar assets..."
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    className="w-40 bg-muted border-0 rounded pl-7 pr-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                
                {/* Refresh */}
                {isConnected && (
                  <button
                    onClick={() => {
                      refetchInventory();
                      refetchProjectAssets();
                    }}
                    disabled={isLoadingInventory || isLoadingProjectAssets}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground disabled:opacity-50"
                    title="Sincronizar"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", (isLoadingInventory || isLoadingProjectAssets) && "animate-spin")} />
                  </button>
                )}
                
                {/* Pixlland Store Button */}
                <button
                  onClick={openStore}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-gradient-to-r from-muted to-muted text-white text-[10px] font-medium hover:opacity-90 transition-opacity"
                >
                  <Globe className="w-3 h-3" />
                  Loja
                  {!isEmbedded && <ExternalLink className="w-2.5 h-2.5" />}
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3">
              {!isConnected ? (
                /* Not Connected State */
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-muted/20 to-muted/20 flex items-center justify-center mb-4">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-medium mb-1">Conecte sua conta Pixlland</h3>
                  <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                    Acesse sua biblioteca de assets e adicione-os diretamente aos seus projetos
                  </p>
                  <button
                    onClick={connectAccount}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-muted to-muted text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <LogIn className="w-4 h-4" />
                    Conectar Conta
                  </button>
                  
                  {/* Built-in assets below */}
                  <div className="w-full mt-6 pt-6 border-t border-border">
                    <p className="text-[10px] text-muted-foreground mb-3">{STORE_ASSETS.length} assets built-in</p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
                      {STORE_ASSETS.slice(0, 6).map((asset) => (
                        <div 
                          key={asset.id} 
                          className="flex flex-col items-center p-2 bg-secondary/30 rounded-lg"
                        >
                          <Package className="w-6 h-6 opacity-30 mb-1" />
                          <span className="text-[9px] text-center truncate w-full text-muted-foreground">{asset.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : isLoadingInventory || isLoadingProjectAssets ? (
                /* Loading State */
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : storeTab === 'library' ? (
                /* Library Tab - User inventory from Supabase */
                filteredInventoryAssets.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
                    {filteredInventoryAssets.map((item) => (
                      <div 
                        key={item.id} 
                        className="group relative flex flex-col items-center p-2 bg-secondary/30 rounded-lg hover:bg-secondary/60 cursor-grab active:cursor-grabbing transition-colors"
                        draggable={!!item.asset?.asset_url}
                        onDragStart={(e) => handleDragStart(
                          e, 
                          item.asset?.name || 'Asset', 
                          item.asset?.asset_url || '', 
                          item.asset?.asset_type || 'model',
                          item.asset?.thumbnail_url || undefined
                        )}
                        onDragEnd={handleDragEnd}
                      >
                        {/* In Project Badge */}
                        {isInProject(item.asset_id) && (
                          <span className="absolute top-1 right-1 text-[8px] px-1 py-0.5 bg-secondary/30 text-muted-foreground rounded flex items-center gap-0.5">
                            <Check className="w-2 h-2" />
                          </span>
                        )}
                        
                        <span className="absolute top-1 left-1 text-[8px] px-1 py-0.5 bg-secondary/30 text-muted-foreground rounded">
                          {item.asset?.category || 'Asset'}
                        </span>
                        
                        {/* Thumbnail */}
                        <div className="w-14 h-14 flex items-center justify-center text-muted-foreground mb-1 overflow-hidden rounded">
                          {item.asset?.thumbnail_url ? (
                            <img src={item.asset.thumbnail_url} alt={item.asset.name} className="w-full h-full object-cover pointer-events-none" />
                          ) : (
                            <Package className="w-8 h-8 opacity-30" />
                          )}
                        </div>
                        
                        <span className="text-[10px] text-center truncate w-full">{item.asset?.name || 'Asset'}</span>
                        
                        {/* Action buttons overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity">
                          {/* Add to Scene button */}
                          {item.asset?.asset_url && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToScene(
                                  item.asset?.name || 'Asset',
                                  item.asset?.asset_url || '',
                                  item.asset?.asset_type || 'model'
                                );
                              }}
                              className="flex items-center gap-1 px-2 py-1 bg-green-500 rounded text-white text-[9px] font-medium hover:bg-green-600"
                              title="Adicionar à cena"
                            >
                              <Plus className="w-3 h-3" />
                              Cena
                            </button>
                          )}
                          
                          {/* Add to Project button */}
                          {!isInProject(item.asset_id) && currentProjectId && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddInventoryToProject(item);
                              }}
                              disabled={addAssetMutation.isPending}
                              className="flex items-center gap-1 px-2 py-1 bg-primary rounded text-primary-foreground text-[9px] font-medium hover:bg-primary/90 disabled:opacity-50"
                              title="Adicionar ao projeto"
                            >
                              <AddToProject className="w-3 h-3" />
                              Projeto
                            </button>
                          )}
                          
                          {/* Drag hint */}
                          {item.asset?.asset_url && (
                            <span className="text-[8px] text-white/50 flex items-center gap-1 mt-1">
                              <Move className="w-2.5 h-2.5" />
                              Arraste para a cena
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Library className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-xs">Sua biblioteca está vazia</p>
                    <p className="mb-2 text-[10px] opacity-70">Adquira assets na Pixlland Store</p>
                    <button 
                      onClick={openStore}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Visitar Loja
                    </button>
                  </div>
                )
              ) : (
                /* Project Tab - Assets linked to this project from Supabase */
                filteredSupabaseProjectAssets.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
                    {filteredSupabaseProjectAssets.map((asset) => (
                      <div 
                        key={asset.id} 
                        className="group relative flex flex-col items-center p-2 bg-secondary/30 rounded-lg hover:bg-secondary/60 cursor-grab active:cursor-grabbing transition-colors"
                        draggable={!!asset.asset_url}
                        onDragStart={(e) => handleDragStart(
                          e, 
                          asset.name, 
                          asset.asset_url || '', 
                          asset.asset_type || 'model',
                          undefined
                        )}
                        onDragEnd={handleDragEnd}
                      >
                        <span className="absolute top-1 left-1 text-[8px] px-1 py-0.5 bg-secondary/30 text-muted-foreground rounded">
                          Vinculado
                        </span>
                        
                        {/* Thumbnail */}
                        <div className="w-14 h-14 flex items-center justify-center text-muted-foreground mb-1 overflow-hidden rounded">
                          {asset.asset_url ? (
                            <img src={asset.asset_url} alt={asset.name} className="w-full h-full object-cover pointer-events-none" />
                          ) : (
                            <Package className="w-8 h-8 opacity-30" />
                          )}
                        </div>
                        
                        <span className="text-[10px] text-center truncate w-full">{asset.name}</span>
                        
                        {/* Action buttons overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity">
                          {/* Add to Scene button */}
                          {asset.asset_url && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToScene(asset.name, asset.asset_url || '', asset.asset_type || 'model');
                              }}
                              className="flex items-center gap-1 px-2 py-1 bg-green-500 rounded text-white text-[9px] font-medium hover:bg-green-600"
                              title="Adicionar à cena"
                            >
                              <Plus className="w-3 h-3" />
                              Cena
                            </button>
                          )}
                          
                          {/* Remove from project */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAssetFromProject(asset.id);
                            }}
                            disabled={removeAssetMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 bg-destructive rounded text-destructive-foreground text-[9px] font-medium hover:bg-destructive/90 disabled:opacity-50"
                            title="Remover do projeto"
                          >
                            <X className="w-3 h-3" />
                            Remover
                          </button>
                          
                          {/* Drag hint */}
                          {asset.asset_url && (
                            <span className="text-[8px] text-white/50 flex items-center gap-1 mt-1">
                              <Move className="w-2.5 h-2.5" />
                              Arraste para a cena
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Link2 className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-xs">Nenhum asset vinculado</p>
                    <p className="mb-2 text-[10px] opacity-70">Adicione assets da sua biblioteca</p>
                    <button 
                      onClick={() => setStoreTab('library')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-foreground rounded text-xs hover:bg-secondary/80"
                    >
                      <Library className="w-3.5 h-3.5" />
                      Ver Biblioteca
                    </button>
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
              <span>
                {isConnected 
                  ? storeTab === 'library'
                    ? `${filteredInventoryAssets.length} assets na biblioteca`
                    : `${filteredSupabaseProjectAssets.length} assets no projeto`
                  : `${STORE_ASSETS.length} assets built-in`
                }
              </span>
              <button 
                onClick={openStore}
                className="text-primary hover:underline flex items-center gap-1"
              >
                Adquirir mais na Pixlland Store
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
