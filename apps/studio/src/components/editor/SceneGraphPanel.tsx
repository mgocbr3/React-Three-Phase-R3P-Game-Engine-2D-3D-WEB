import { ChevronDown, ChevronRight, Box, Circle, Layers, Eye, EyeOff, Lock, Unlock, Trash2, Camera, User, Lightbulb, Search, MoreHorizontal, Link, Unlink, Sun, Cone, Mountain, Cylinder, Copy, Edit3, Focus, Play } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
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
  onToggleVisible: () => void;
  onToggleLock: () => void;
}

const ContextMenu = ({ x, y, object, onClose, onRename, onDuplicate, onDelete, onFocus, onToggleVisible, onToggleLock }: ContextMenuProps) => {
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
  deleteObject: (id: string) => void;
  objects: SceneObject[];
}

const SceneObjectItem = ({ object, depth, selectedObjectId, selectObject, focusOnObject, updateObject, deleteObject, objects }: SceneObjectItemProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(object.name);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { duplicateObject } = useEditorStore();
  const Icon = getObjectIcon(object.type);
  const isSelected = object.id === selectedObjectId;
  const typeColor = getTypeColor(object.type);
  
  // Find children of this object
  const children = objects.filter(o => o.parentId === object.id);
  const hasChildren = children.length > 0;

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
          onToggleVisible={() => updateObject(object.id, { visible: object.visible === false ? true : false })}
          onToggleLock={() => updateObject(object.id, { locked: !object.locked })}
        />
      )}
      
      <div
        className={cn(
          'group scene-item',
          isSelected && 'selected'
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
      >
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
      {hasChildren && isExpanded && (
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
              deleteObject={deleteObject}
              objects={objects}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const SceneGraphPanel = () => {
  const { objects, selectedObjectId, selectObject, focusOnObject, updateObject, deleteObject } = useEditorStore();
  const [expanded, setExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter objects and only show root-level (no parent) objects in the main list
  const filteredObjects = objects.filter(obj => 
    obj.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !obj.parentId // Only show root objects
  );

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
            className="w-full border border-[#111] bg-[#1d1d1d] pl-7 pr-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Scene Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Scene Root */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="scene-item w-full font-medium text-foreground"
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
              {filteredObjects.map((obj) => (
                <SceneObjectItem
                  key={obj.id}
                  object={obj}
                  depth={0}
                  selectedObjectId={selectedObjectId}
                  selectObject={selectObject}
                  focusOnObject={focusOnObject}
                  updateObject={updateObject}
                  deleteObject={deleteObject}
                  objects={objects}
                />
              ))}
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
