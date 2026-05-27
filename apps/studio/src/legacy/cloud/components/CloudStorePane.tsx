import { useCallback, useEffect, useState, type DragEvent } from 'react';
import {
  Check,
  ExternalLink,
  FolderPlus as AddToProject,
  Globe,
  Library,
  Link2,
  Loader2,
  LogIn,
  Move,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePixllandBridge } from '@/hooks/usePixllandBridge';
import {
  useAddAssetToProject,
  useProjectAssets,
  useRemoveAssetFromProject,
  useUserInventory,
} from '@/hooks/useProjects';
import { usePixllandAssetStore } from '@/stores/pixllandAssetStore';
import { useAuthStore } from '@/legacy/cloud/stores/authStore';

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

const STORE_ASSETS: StoreAsset[] = [
  { id: 'npc-villager', name: 'Villager NPC', category: 'characters', license: 'Built-in', prefab: 'MinecraftVillager', hasPreview: true },
  { id: 'npc-guard', name: 'Guard NPC', category: 'characters', license: 'Built-in', prefab: 'MinecraftGuard', hasPreview: true },
  { id: 'npc-merchant', name: 'Merchant NPC', category: 'characters', license: 'Built-in', prefab: 'MinecraftMerchant', hasPreview: true },
  { id: 'npc-zombie', name: 'Zombie Enemy', category: 'characters', license: 'Built-in', prefab: 'MinecraftZombie', hasPreview: true },
  { id: 'npc-skeleton', name: 'Skeleton Enemy', category: 'characters', license: 'Built-in', prefab: 'MinecraftSkeleton', hasPreview: true },
  { id: 'animal-pig', name: 'Pig', category: 'animals', license: 'Built-in', prefab: 'MinecraftPig', hasPreview: true },
  { id: 'animal-chicken', name: 'Chicken', category: 'animals', license: 'Built-in', prefab: 'MinecraftChicken', hasPreview: true },
  { id: 'animal-cow', name: 'Cow', category: 'animals', license: 'Built-in', prefab: 'MinecraftCow', hasPreview: true },
  { id: 'animal-sheep', name: 'Sheep', category: 'animals', license: 'Built-in', prefab: 'MinecraftSheep', hasPreview: true },
  { id: 'env-tree', name: 'Minecraft Tree', category: 'nature', license: 'Built-in', prefab: 'MinecraftTree' },
  { id: 'env-house', name: 'Minecraft House', category: 'construction', license: 'Built-in', prefab: 'MinecraftHouse' },
  { id: 'env-fence', name: 'Wooden Fence', category: 'construction', license: 'Built-in', prefab: 'MinecraftFence' },
  { id: 'env-lamp', name: 'Lamp Post', category: 'construction', license: 'Built-in', prefab: 'MinecraftLampPost' },
  { id: 'ctrl-motion', name: 'Motion Control', category: 'controls', license: 'Built-in', prefab: 'MotionControl', hasPreview: true, isSystem: true },
];

interface CloudStorePaneProps {
  handleAddToScene: (name: string, url: string, type?: string) => void;
  handleDragStart: (
    event: DragEvent,
    name: string,
    url: string,
    type?: string,
    thumbnailUrl?: string,
    assetId?: string,
    assetPath?: string,
  ) => void;
  handleDragEnd: () => void;
}

export default function CloudStorePane({
  handleAddToScene,
  handleDragStart,
  handleDragEnd,
}: CloudStorePaneProps) {
  const [storeSearch, setStoreSearch] = useState('');
  const [storeTab, setStoreTab] = useState<'library' | 'project'>('library');
  const {
    isEmbedded,
    openStore,
    requestUserLibrary,
    syncProjectAssets,
    connectAccount,
  } = usePixllandBridge();
  const { user, profile } = useAuthStore();
  const [searchParams] = useSearchParams();
  const currentProjectId = searchParams.get('project');
  const { data: userInventory = [], isLoading: isLoadingInventory, refetch: refetchInventory } = useUserInventory();
  const {
    data: supabaseProjectAssets = [],
    isLoading: isLoadingProjectAssets,
    refetch: refetchProjectAssets,
  } = useProjectAssets(currentProjectId);
  const addAssetMutation = useAddAssetToProject();
  const removeAssetMutation = useRemoveAssetFromProject();
  const { connection, libraryAssets } = usePixllandAssetStore();
  const isConnected = !!user;
  const username = profile?.displayName || user?.email?.split('@')[0] || null;
  const searchQuery = storeSearch.trim().toLowerCase();

  useEffect(() => {
    if (connection.isConnected && isEmbedded && libraryAssets.length === 0) {
      requestUserLibrary();
      syncProjectAssets();
    }
  }, [connection.isConnected, isEmbedded, libraryAssets.length, requestUserLibrary, syncProjectAssets]);

  const filteredInventoryAssets = userInventory.filter(
    (item) => item.asset && item.asset.name.toLowerCase().includes(searchQuery),
  );

  const filteredSupabaseProjectAssets = supabaseProjectAssets.filter(
    (asset) => asset.name.toLowerCase().includes(searchQuery),
  );

  const isInProject = useCallback((assetId: string) => (
    supabaseProjectAssets.some((asset) =>
      asset.metadata?.original_asset_id === assetId || asset.id === assetId
    )
  ), [supabaseProjectAssets]);

  const handleAddInventoryToProject = async (inventoryItem: (typeof userInventory)[number]) => {
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
        },
      });
      toast.success(`${inventoryItem.asset.name} adicionado ao projeto`);
    } catch (error) {
      toast.error('Erro ao adicionar asset');
    }
  };

  const handleRemoveAssetFromProject = async (assetId: string) => {
    if (!currentProjectId) return;

    try {
      await removeAssetMutation.mutateAsync({ assetId, projectId: currentProjectId });
      toast.info('Asset removido do projeto');
    } catch (error) {
      toast.error('Erro ao remover asset');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
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

          {isConnected && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setStoreTab('library')}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
                  storeTab === 'library'
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:bg-secondary',
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
                    : 'text-muted-foreground hover:bg-secondary',
                )}
              >
                <Link2 className="w-3 h-3" />
                No Projeto ({filteredSupabaseProjectAssets.length})
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar assets..."
              value={storeSearch}
              onChange={(event) => setStoreSearch(event.target.value)}
              className="w-40 bg-muted border-0 rounded pl-7 pr-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

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
              <RefreshCw className={cn('w-3.5 h-3.5', (isLoadingInventory || isLoadingProjectAssets) && 'animate-spin')} />
            </button>
          )}

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

      <div className="flex-1 overflow-y-auto p-3">
        {!isConnected ? (
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
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : storeTab === 'library' ? (
          filteredInventoryAssets.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
              {filteredInventoryAssets.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex flex-col items-center p-2 bg-secondary/30 rounded-lg hover:bg-secondary/60 cursor-grab active:cursor-grabbing transition-colors"
                  draggable={!!item.asset?.asset_url}
                  onDragStart={(event) => handleDragStart(
                    event,
                    item.asset?.name || 'Asset',
                    item.asset?.asset_url || '',
                    item.asset?.asset_type || 'model',
                    item.asset?.thumbnail_url || undefined,
                  )}
                  onDragEnd={handleDragEnd}
                >
                  {isInProject(item.asset_id) && (
                    <span className="absolute top-1 right-1 text-[8px] px-1 py-0.5 bg-secondary/30 text-muted-foreground rounded flex items-center gap-0.5">
                      <Check className="w-2 h-2" />
                    </span>
                  )}

                  <span className="absolute top-1 left-1 text-[8px] px-1 py-0.5 bg-secondary/30 text-muted-foreground rounded">
                    {item.asset?.category || 'Asset'}
                  </span>

                  <div className="w-14 h-14 flex items-center justify-center text-muted-foreground mb-1 overflow-hidden rounded">
                    {item.asset?.thumbnail_url ? (
                      <img src={item.asset.thumbnail_url} alt={item.asset.name} className="w-full h-full object-cover pointer-events-none" />
                    ) : (
                      <Package className="w-8 h-8 opacity-30" />
                    )}
                  </div>

                  <span className="text-[10px] text-center truncate w-full">{item.asset?.name || 'Asset'}</span>

                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity">
                    {item.asset?.asset_url && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAddToScene(
                            item.asset?.name || 'Asset',
                            item.asset?.asset_url || '',
                            item.asset?.asset_type || 'model',
                          );
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-green-500 rounded text-white text-[9px] font-medium hover:bg-green-600"
                        title="Adicionar a cena"
                      >
                        <Plus className="w-3 h-3" />
                        Cena
                      </button>
                    )}

                    {!isInProject(item.asset_id) && currentProjectId && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
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
              <p className="text-xs">Sua biblioteca esta vazia</p>
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
          filteredSupabaseProjectAssets.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
              {filteredSupabaseProjectAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative flex flex-col items-center p-2 bg-secondary/30 rounded-lg hover:bg-secondary/60 cursor-grab active:cursor-grabbing transition-colors"
                  draggable={!!asset.asset_url}
                  onDragStart={(event) => handleDragStart(
                    event,
                    asset.name,
                    asset.asset_url || '',
                    asset.asset_type || 'model',
                    undefined,
                  )}
                  onDragEnd={handleDragEnd}
                >
                  <span className="absolute top-1 left-1 text-[8px] px-1 py-0.5 bg-secondary/30 text-muted-foreground rounded">
                    Vinculado
                  </span>

                  <div className="w-14 h-14 flex items-center justify-center text-muted-foreground mb-1 overflow-hidden rounded">
                    {asset.asset_url ? (
                      <img src={asset.asset_url} alt={asset.name} className="w-full h-full object-cover pointer-events-none" />
                    ) : (
                      <Package className="w-8 h-8 opacity-30" />
                    )}
                  </div>

                  <span className="text-[10px] text-center truncate w-full">{asset.name}</span>

                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity">
                    {asset.asset_url && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAddToScene(asset.name, asset.asset_url || '', asset.asset_type || 'model');
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-green-500 rounded text-white text-[9px] font-medium hover:bg-green-600"
                        title="Adicionar a cena"
                      >
                        <Plus className="w-3 h-3" />
                        Cena
                      </button>
                    )}

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRemoveAssetFromProject(asset.id);
                      }}
                      disabled={removeAssetMutation.isPending}
                      className="flex items-center gap-1 px-2 py-1 bg-destructive rounded text-destructive-foreground text-[9px] font-medium hover:bg-destructive/90 disabled:opacity-50"
                      title="Remover do projeto"
                    >
                      <X className="w-3 h-3" />
                      Remover
                    </button>

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
  );
}
