import { ChevronDown, ChevronRight, Box, Circle, Layers, Eye, EyeOff, Lock, Unlock, Trash2, Camera, User, Lightbulb, Search, MoreHorizontal, Link, Unlink, Sun, Cone, Mountain, Cylinder, Copy, Edit3, Focus, Play } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useEditorStore, ObjectType, SceneObject } from '@/stores/editorStore';
import { cn } from '@/lib/utils';

// Helper to check if an object has movement/scripts attached
const hasMovementAttached = (object: SceneObject): boolean => {
  // Check if object has any scripts attached
  if (object.scriptInstances && object.scriptInstances.length > 0) {
    return true;
  }
  // Check if object has a behavior set
  if (object.logicSettings?.behavior && object.logicSettings.behavior !== 'none') {
    return true;
  }
  return false;
};

const SEARCH_RESULT_LIMIT = 300;
const SCENE_DRAG_ACTIVATION_PX = 6;
const SCENE_REORDER_EDGE_RATIO = 0.28;

type SceneDropPlacement = 'before' | 'inside' | 'after';

interface ScenePointerDrag {
  id: string;
  startX: number;
  startY: number;
  active: boolean;
}

const getSceneDropPlacement = (clientY: number, rect: DOMRect): SceneDropPlacement => {
  const ratio = (clientY - rect.top) / Math.max(rect.height, 1);
  if (ratio <= SCENE_REORDER_EDGE_RATIO) return 'before';
  if (ratio >= 1 - SCENE_REORDER_EDGE_RATIO) return 'after';
  return 'inside';
};

const objectMatchesSearch = (object: SceneObject, query: string): boolean => {
  if (!query) return true;

  const customData = object.logicSettings?.customData ?? {};
  const searchableValues = [
    object.name,
    object.id,
    object.type,
    object.logicSettings?.tags?.join(' '),
    customData.sourceNodeName,
    customData.sourcePrefix,
    customData.sourceAsset,
  ];

  return searchableValues
    .filter((value) => value !== undefined && value !== null)
    .map(String)
    .join(' ')
    .toLowerCase()
    .includes(query);
};

const getObjectPath = (object: SceneObject, objectsById: Map<string, SceneObject>): string => {
  const names: string[] = [];
  let parentId: string | null | undefined = object.parentId;
  let guard = 0;

  while (parentId && guard < 16) {
    const parent = objectsById.get(parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
    guard += 1;
  }

  return names.join(' / ');
};

// Context Menu Component
interface ContextMenuProps {
  x: number;
  y: number;
  object: SceneObject;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFocus: () => void;
  onDetachFromParent: () => void;
  onToggleVisible: () => void;
  onToggleLock: () => void;
}

const ContextMenu = ({ x, y, object, onClose, onRename, onDuplicate, onDelete, onFocus, onDetachFromParent, onToggleVisible, onToggleLock }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const canDelete = object.id !== 'main-camera' && object.id !== 'main-player';

  return (
    <div
      ref={menuRef}
      className="editor-menu-dropdown fixed z-50 w-52 py-1.5"
      style={{ 
        left: `${x}px`, 
        top: `${y}px`,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
      }}
    >
      <button
        onClick={() => { onRename(); onClose(); }}
        className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 transition-colors hover:bg-secondary"
      >
        <Edit3 className="w-4 h-4 text-muted-foreground" />
        <span className="text-foreground">Renomear</span>
      </button>
      <button
        onClick={() => { onDuplicate(); onClose(); }}
        className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 transition-colors hover:bg-secondary"
      >
        <Copy className="w-4 h-4 text-muted-foreground" />
        <span className="text-foreground">Duplicar</span>
      </button>
      <button
        onClick={() => { onFocus(); onClose(); }}
        className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 transition-colors hover:bg-secondary"
      >
        <Focus className="w-4 h-4 text-muted-foreground" />
        <span className="text-foreground">Focar Câmera</span>
      </button>
      {object.parentId && (
        <button
          onClick={() => { onDetachFromParent(); onClose(); }}
          className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 transition-colors hover:bg-secondary"
        >
          <Unlink className="w-4 h-4 text-muted-foreground" />
          <span className="text-foreground">Desanexar</span>
        </button>
      )}
      <div className="h-px bg-border my-1.5 mx-2" />
      <button
        onClick={() => { onToggleVisible(); onClose(); }}
        className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 transition-colors hover:bg-secondary"
      >
        {object.visible ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
        <span className="text-foreground">{object.visible ? 'Ocultar' : 'Mostrar'}</span>
      </button>
      <button
        onClick={() => { onToggleLock(); onClose(); }}
        className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 transition-colors hover:bg-secondary"
      >
        {object.locked ? <Unlock className="w-4 h-4 text-muted-foreground" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
        <span className="text-foreground">{object.locked ? 'Desbloquear' : 'Bloquear'}</span>
      </button>
      {canDelete && (
        <>
          <div className="h-px bg-border my-1.5 mx-2" />
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2.5 transition-colors hover:bg-secondary/30"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground">Deletar</span>
          </button>
        </>
      )}
    </div>
  );
};

const getTypeColor = (type: ObjectType): string => {
  return 'text-muted-foreground';
};

const getObjectIcon = (type: ObjectType) => {
  switch (type) {
    case 'box':
      return Box;
    case 'sphere':
      return Circle;
    case 'cylinder':
      return Cylinder;
    case 'light':
      return Lightbulb;
    case 'sunlight':
      return Sun;
    case 'spotlight':
      return Cone;
    case 'plane':
      return Layers;
    case 'camera':
      return Camera;
    case 'player':
      return User;
    case 'terrain':
      return Mountain;
    default:
      return Box;
  }
};

// Recursive component for rendering objects with children
interface SceneObjectItemProps {
  object: SceneObject;
  depth: number;
  selectedObjectId: string | null;
  selectObject: (id: string | null) => void;
  focusOnObject: (id: string) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  reparentObject: (id: string, parentId: string | null) => boolean;
  reorderObject: (id: string, targetId: string, position: 'before' | 'after') => boolean;
  deleteObject: (id: string) => void;
  childrenByParent: Map<string, SceneObject[]>;
  descendantCountByParent: Map<string, number>;
  draggedObjectId: string | null;
  onSceneObjectDragStart: (id: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onSceneObjectDragEnd: () => void;
  childrenHidden?: boolean;
  pathLabel?: string;
}

const SceneObjectItem = ({
  object,
  depth,
  selectedObjectId,
  selectObject,
  focusOnObject,
  updateObject,
  reparentObject,
  reorderObject,
  deleteObject,
  childrenByParent,
  descendantCountByParent,
  draggedObjectId,
  onSceneObjectDragStart,
  onSceneObjectDragEnd,
  childrenHidden = false,
  pathLabel,
}: SceneObjectItemProps) => {
  const [isExpanded, setIsExpanded] = useState(() => object.logicSettings?.customData?.defaultExpanded !== false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(object.name);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [dropPlacement, setDropPlacement] = useState<SceneDropPlacement | null>(null);
  const { duplicateObject } = useEditorStore();
  const Icon = getObjectIcon(object.type);
  const isSelected = object.id === selectedObjectId;
  const typeColor = getTypeColor(object.type);
  
  // Find children of this object
  const children = childrenByParent.get(object.id) ?? [];
  const hasChildren = children.length > 0;
  const descendantCount = descendantCountByParent.get(object.id) ?? children.length;

  useEffect(() => {
    if (!draggedObjectId) {
      setDropPlacement(null);
    }
  }, [draggedObjectId]);

  const handleRename = () => {
    if (editName.trim() && editName !== object.name) {
      updateObject(object.id, { name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditName(object.name);
      setIsEditing(false);
    }
  };

  const handleNameClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;
    
    // Se já está selecionado e clicou novamente após 300ms (slow double click)
    if (isSelected && timeSinceLastClick > 300 && timeSinceLastClick < 1000) {
      e.stopPropagation();
      setIsEditing(true);
    } else {
      // Primeiro clique ou clique muito rápido - seleciona o objeto
      selectObject(object.id);
    }
    
    setLastClickTime(now);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selectObject(object.id);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const updateDropPlacement = (event: React.PointerEvent<HTMLDivElement>) => {
    const draggedId = draggedObjectId;
    if (!draggedId || draggedId === object.id) {
      setDropPlacement(null);
      return;
    }

    setDropPlacement(getSceneDropPlacement(event.clientY, event.currentTarget.getBoundingClientRect()));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isEditing) return;
    if ((event.target as HTMLElement).closest('button,input,textarea,select')) return;

    onSceneObjectDragStart(object.id, event);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const draggedId = draggedObjectId;
    if (!draggedId) {
      onSceneObjectDragEnd();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const placement = dropPlacement ?? getSceneDropPlacement(event.clientY, event.currentTarget.getBoundingClientRect());
    setDropPlacement(null);

    if (draggedId !== object.id) {
      if (placement === 'inside') {
        if (reparentObject(draggedId, object.id)) {
          setIsExpanded(true);
        }
      } else {
        reorderObject(draggedId, object.id, placement);
      }
    }
    onSceneObjectDragEnd();
  };

  return (
    <div>
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          object={object}
          onClose={() => setContextMenu(null)}
          onRename={() => setIsEditing(true)}
          onDuplicate={() => duplicateObject(object.id)}
          onDelete={() => deleteObject(object.id)}
          onFocus={() => focusOnObject(object.id)}
          onDetachFromParent={() => reparentObject(object.id, null)}
          onToggleVisible={() => updateObject(object.id, { visible: object.visible === false ? true : false })}
          onToggleLock={() => updateObject(object.id, { locked: !object.locked })}
        />
      )}
      
      <div
        data-testid={`scene-object-${object.id}`}
        data-drop-placement={dropPlacement ?? undefined}
        className={cn(
          'group scene-item relative',
          isSelected && 'selected',
          draggedObjectId === object.id && 'opacity-70',
          dropPlacement === 'inside' && 'bg-primary/15 outline outline-1 outline-primary/70'
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={(e) => {
          e.stopPropagation();
          selectObject(object.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          focusOnObject(object.id);
        }}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerEnter={updateDropPlacement}
        onPointerMove={updateDropPlacement}
        onPointerLeave={() => setDropPlacement(null)}
        onPointerUp={handlePointerUp}
      >
        {dropPlacement === 'before' && (
          <span className="pointer-events-none absolute left-1 right-1 top-0 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.18)]" />
        )}
        {dropPlacement === 'after' && (
          <span className="pointer-events-none absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.18)]" />
        )}

        {/* Expand/Collapse */}
        {hasChildren ? (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        
        {/* Icon with type color */}
        <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', typeColor)} />
        
        {/* Name */}
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="flex-1 px-1 py-0 text-xs bg-secondary border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <span 
            className={cn(
              'flex-1 truncate text-xs',
              object.visible === false && 'opacity-50'
            )}
            onClick={handleNameClick}
            title="Dois cliques lentos para renomear"
          >{object.name}</span>
        )}
        
        {/* Movement/Script indicator */}
        {hasMovementAttached(object) && (
          <span title="Tem movimento/scripts anexados">
            <Play className="w-3 h-3 text-muted-foreground" />
          </span>
        )}
        
        {/* Parent indicator */}
        {object.parentId && (
          <Link className="w-3 h-3 text-muted-foreground" />
        )}

        {hasChildren && (
          <span
            className="text-[10px] text-muted-foreground tabular-nums"
            title={`${descendantCount} objetos dentro deste grupo`}
          >
            {descendantCount}
          </span>
        )}

        {pathLabel && (
          <span
            className="max-w-24 truncate text-[10px] text-muted-foreground"
            title={pathLabel}
          >
            {pathLabel}
          </span>
        )}
        
        {/* Quick actions */}
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateObject(object.id, { visible: object.visible === false ? true : false });
            }}
            className="p-0.5 rounded hover:bg-secondary"
          >
            {object.visible !== false ? (
              <Eye className="w-3 h-3 text-muted-foreground" />
            ) : (
              <EyeOff className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateObject(object.id, { locked: !object.locked });
            }}
            className="p-0.5 rounded hover:bg-secondary"
          >
            {object.locked ? (
              <Lock className="w-3 h-3 text-muted-foreground" />
            ) : (
              <Unlock className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
          {object.id !== 'main-camera' && object.id !== 'main-player' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteObject(object.id);
              }}
              className="p-0.5 rounded hover:bg-destructive/20"
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </button>
          )}
        </div>
      </div>
      
      {/* Render children */}
      {hasChildren && isExpanded && !childrenHidden && (
        <div className="border-l border-border/50 ml-4">
          {children.map((child) => (
            <SceneObjectItem
              key={child.id}
              object={child}
              depth={depth + 1}
              selectedObjectId={selectedObjectId}
              selectObject={selectObject}
              focusOnObject={focusOnObject}
              updateObject={updateObject}
              reparentObject={reparentObject}
              reorderObject={reorderObject}
              deleteObject={deleteObject}
              childrenByParent={childrenByParent}
              descendantCountByParent={descendantCountByParent}
              draggedObjectId={draggedObjectId}
              onSceneObjectDragStart={onSceneObjectDragStart}
              onSceneObjectDragEnd={onSceneObjectDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const SceneGraphPanel = () => {
  const { objects, selectedObjectId, selectObject, focusOnObject, updateObject, reparentObject, reorderObject, deleteObject } = useEditorStore();
  const [expanded, setExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRootDropTarget, setIsRootDropTarget] = useState(false);
  const [pointerDrag, setPointerDrag] = useState<ScenePointerDrag | null>(null);
  const suppressNextRootClickRef = useRef(false);
  const query = searchQuery.trim().toLowerCase();

  const childrenByParent = useMemo(() => {
    const byParent = new Map<string, SceneObject[]>();
    for (const object of objects) {
      if (!object.parentId) continue;
      const siblings = byParent.get(object.parentId) ?? [];
      siblings.push(object);
      byParent.set(object.parentId, siblings);
    }
    return byParent;
  }, [objects]);

  const objectsById = useMemo(() => {
    const byId = new Map<string, SceneObject>();
    for (const object of objects) {
      byId.set(object.id, object);
    }
    return byId;
  }, [objects]);

  const rootObjects = useMemo(() => objects.filter((object) => !object.parentId), [objects]);

  const descendantCountByParent = useMemo(() => {
    const cache = new Map<string, number>();
    const countDescendants = (objectId: string, visiting = new Set<string>()): number => {
      const cached = cache.get(objectId);
      if (cached !== undefined) return cached;
      if (visiting.has(objectId)) return 0;

      const nextVisiting = new Set(visiting);
      nextVisiting.add(objectId);
      const children = childrenByParent.get(objectId) ?? [];
      const total = children.reduce((sum, child) => sum + 1 + countDescendants(child.id, nextVisiting), 0);
      cache.set(objectId, total);
      return total;
    };

    for (const object of objects) {
      countDescendants(object.id);
    }

    return cache;
  }, [childrenByParent, objects]);

  const searchResults = useMemo(() => {
    if (!query) return [];
    return objects
      .filter((object) => objectMatchesSearch(object, query))
      .slice(0, SEARCH_RESULT_LIMIT);
  }, [objects, query]);

  const searchResultCount = useMemo(() => {
    if (!query) return 0;
    return objects.reduce(
      (count, object) => count + (objectMatchesSearch(object, query) ? 1 : 0),
      0,
    );
  }, [objects, query]);

  const isSearching = query.length > 0;
  const activeDraggedObjectId = pointerDrag?.active ? pointerDrag.id : null;

  const handleSceneObjectDragStart = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    setPointerDrag({
      id,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    });
    selectObject(id);
  };

  const handleSceneObjectDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    setPointerDrag((current) => {
      if (!current || current.active) return current;

      const deltaX = event.clientX - current.startX;
      const deltaY = event.clientY - current.startY;
      if (Math.hypot(deltaX, deltaY) < SCENE_DRAG_ACTIVATION_PX) {
        return current;
      }

      return { ...current, active: true };
    });
  };

  const handleRootPointerMove = () => {
    if (!activeDraggedObjectId) return;
    setIsRootDropTarget(true);
  };

  const handleRootPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const draggedId = activeDraggedObjectId;
    if (!draggedId) return;

    event.preventDefault();
    event.stopPropagation();
    suppressNextRootClickRef.current = true;
    setIsRootDropTarget(false);
    reparentObject(draggedId, null);
    setPointerDrag(null);
  };

  const handleSceneObjectDragEnd = () => {
    setPointerDrag(null);
    setIsRootDropTarget(false);
  };

  return (
    <div className="editor-dock editor-dock-outline w-full h-full border-r flex flex-col overflow-hidden">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-1">
          <button className="editor-panel-tab active">Scene</button>
          <button className="editor-panel-tab">Import</button>
        </div>
        <button className="p-1 hover:bg-secondary rounded transition-colors" title="Opções">
          <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-border bg-[var(--editor-panel-sunken)] pl-7 pr-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Scene Tree */}
      <div
        className="flex-1 overflow-y-auto py-1"
        onPointerMove={handleSceneObjectDragMove}
        onPointerCancel={handleSceneObjectDragEnd}
      >
        {/* Scene Root */}
        <div>
          <button
            onClick={(event) => {
              if (suppressNextRootClickRef.current) {
                suppressNextRootClickRef.current = false;
                event.preventDefault();
                return;
              }
              setExpanded(!expanded);
            }}
            data-testid="scene-root-drop-target"
            className={cn(
              'scene-item w-full font-medium text-foreground',
              isRootDropTarget && 'bg-primary/15 outline outline-1 outline-primary/70',
            )}
            onPointerMove={handleRootPointerMove}
            onPointerLeave={() => setIsRootDropTarget(false)}
            onPointerUp={handleRootPointerUp}
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs">Scene</span>
            <span className="ml-auto text-[10px] text-muted-foreground mr-1">{objects.length}</span>
          </button>

          {expanded && (
            <div className="ml-1">
              {isSearching ? (
                <>
                  <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
                    {searchResultCount === 0
                      ? 'Nenhum resultado'
                      : `${Math.min(searchResultCount, SEARCH_RESULT_LIMIT)} de ${searchResultCount} resultados`}
                  </div>
                  {searchResults.map((obj) => (
                    <SceneObjectItem
                      key={obj.id}
                      object={obj}
                      depth={0}
                      selectedObjectId={selectedObjectId}
                      selectObject={selectObject}
                      focusOnObject={focusOnObject}
                      updateObject={updateObject}
                      reparentObject={reparentObject}
                      reorderObject={reorderObject}
                      deleteObject={deleteObject}
                      childrenByParent={childrenByParent}
                      descendantCountByParent={descendantCountByParent}
                      draggedObjectId={activeDraggedObjectId}
                      onSceneObjectDragStart={handleSceneObjectDragStart}
                      onSceneObjectDragEnd={handleSceneObjectDragEnd}
                      childrenHidden
                      pathLabel={getObjectPath(obj, objectsById)}
                    />
                  ))}
                </>
              ) : (
                rootObjects.map((obj) => (
                  <SceneObjectItem
                    key={obj.id}
                    object={obj}
                    depth={0}
                    selectedObjectId={selectedObjectId}
                    selectObject={selectObject}
                    focusOnObject={focusOnObject}
                    updateObject={updateObject}
                    reparentObject={reparentObject}
                    reorderObject={reorderObject}
                    deleteObject={deleteObject}
                    childrenByParent={childrenByParent}
                    descendantCountByParent={descendantCountByParent}
                    draggedObjectId={activeDraggedObjectId}
                    onSceneObjectDragStart={handleSceneObjectDragStart}
                    onSceneObjectDragEnd={handleSceneObjectDragEnd}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between">
        <span>{objects.length} objetos</span>
        <div className="flex items-center gap-1">
          <Link className="w-3 h-3" />
          <span>Parent-Child</span>
        </div>
      </div>
    </div>
  );
};
