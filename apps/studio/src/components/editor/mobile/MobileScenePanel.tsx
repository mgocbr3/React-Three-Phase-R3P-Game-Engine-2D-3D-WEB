import { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Search, 
  ChevronDown, 
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Layers,
  Box,
  Circle,
  Lightbulb,
  Camera,
  User,
  MoreHorizontal,
  Link,
  Sun,
  Cone,
  Mountain,
  Cylinder,
  Copy,
  Edit3,
  Focus
} from 'lucide-react';
import { useEditorStore, ObjectType, SceneObject } from '@/stores/editorStore';
import { cn } from '@/lib/utils';

interface MobileScenePanelProps {
  onClose: () => void;
}

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

  const glassStyle = {
    background: 'linear-gradient(135deg, hsl(225 15% 12% / 0.98) 0%, hsl(225 15% 10% / 0.98) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid hsl(225 12% 20% / 0.6)',
    fontFamily: 'Roboto, Noto Sans, sans-serif',
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-52 rounded-xl shadow-2xl py-1.5 overflow-hidden"
      style={{ ...glassStyle, left: `${x}px`, top: `${y}px` }}
    >
      <button
        onClick={() => { onRename(); onClose(); }}
        className="w-full px-3 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/10 flex items-center gap-2 transition-colors"
      >
        <Edit3 className="w-4 h-4 text-muted-foreground" />
        Renomear
      </button>
      <button
        onClick={() => { onDuplicate(); onClose(); }}
        className="w-full px-3 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/10 flex items-center gap-2 transition-colors"
      >
        <Copy className="w-4 h-4 text-muted-foreground" />
        Duplicar
      </button>
      <button
        onClick={() => { onFocus(); onClose(); }}
        className="w-full px-3 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/10 flex items-center gap-2 transition-colors"
      >
        <Focus className="w-4 h-4 text-muted-foreground" />
        Focar Câmera
      </button>
      <div className="h-px bg-white/10 my-1 mx-2" />
      <button
        onClick={() => { onToggleVisible(); onClose(); }}
        className="w-full px-3 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/10 flex items-center gap-2 transition-colors"
      >
        {object.visible !== false ? <EyeOff className="w-4 h-4 text-white/50" /> : <Eye className="w-4 h-4 text-white/50" />}
        {object.visible !== false ? 'Ocultar' : 'Mostrar'}
      </button>
      <button
        onClick={() => { onToggleLock(); onClose(); }}
        className="w-full px-3 py-2.5 text-left text-[13px] font-medium text-white/80 hover:bg-white/10 flex items-center gap-2 transition-colors"
      >
        {object.locked ? <Unlock className="w-4 h-4 text-muted-foreground" /> : <Lock className="w-4 h-4 text-white/50" />}
        {object.locked ? 'Desbloquear' : 'Bloquear'}
      </button>
      {canDelete && (
        <>
          <div className="h-px bg-white/10 my-1 mx-2" />
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="w-full px-3 py-2.5 text-left text-[13px] font-medium text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Deletar
          </button>
        </>
      )}
    </div>
  );
};

// Color mapping for object types
const getTypeColor = (type: ObjectType): string => {
  switch (type) {
    case 'light': return 'text-muted-foreground';
    case 'sunlight': return 'text-muted-foreground';
    case 'spotlight': return 'text-muted-foreground';
    case 'camera': return 'text-muted-foreground';
    case 'player': return 'text-indigo-400';
    case 'sphere': return 'text-muted-foreground';
    case 'box': return 'text-muted-foreground';
    case 'cylinder': return 'text-muted-foreground';
    case 'plane': return 'text-muted-foreground';
    case 'terrain': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
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

interface SceneItemProps {
  object: SceneObject;
  depth: number;
  objects: SceneObject[];
  selectedObjectId: string | null;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  onUpdate: (id: string, updates: Partial<SceneObject>) => void;
  onDelete: (id: string) => void;
}

const SceneItem = ({ object, depth, objects, selectedObjectId, onSelect, onFocus, onUpdate, onDelete }: SceneItemProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(object.name);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { duplicateObject } = useEditorStore();
  const Icon = getObjectIcon(object.type);
  const isSelected = object.id === selectedObjectId;
  const typeColor = getTypeColor(object.type);
  
  const children = objects.filter(o => o.parentId === object.id);
  const hasChildren = children.length > 0;

  const handleRename = () => {
    if (editName.trim() && editName !== object.name) {
      onUpdate(object.id, { name: editName.trim() });
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
      onSelect(object.id);
    }
    
    setLastClickTime(now);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(object.id);
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
          onDelete={() => onDelete(object.id)}
          onFocus={() => onFocus(object.id)}
          onToggleVisible={() => onUpdate(object.id, { visible: object.visible === false ? true : false })}
          onToggleLock={() => onUpdate(object.id, { locked: !object.locked })}
        />
      )}
      
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect(object.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onFocus(object.id);
        }}
        onContextMenu={handleContextMenu}
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 transition-colors active:bg-secondary/80',
          isSelected ? 'bg-primary/15' : 'hover:bg-secondary/50',
          object.visible === false && 'opacity-50'
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
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
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Icon with type color */}
        <Icon className={cn('w-4 h-4 flex-shrink-0', typeColor)} />

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
            className="flex-1 px-2 py-1 text-sm bg-secondary border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <span 
            className={cn(
              'flex-1 text-sm truncate',
              isSelected ? 'text-foreground font-medium' : 'text-foreground/80'
            )}
            onClick={handleNameClick}
          >
            {object.name}
          </span>
        )}

        {/* Parent indicator */}
        {object.parentId && (
          <Link className="w-3 h-3 text-primary/50" />
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(object.id, { visible: object.visible === false ? true : false });
            }}
            className="p-1.5 rounded-lg hover:bg-secondary"
          >
            {object.visible !== false ? (
              <Eye className="w-4 h-4 text-muted-foreground" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(object.id, { locked: !object.locked });
            }}
            className="p-1.5 rounded-lg hover:bg-secondary"
          >
            {object.locked ? (
              <Lock className="w-4 h-4 text-primary" />
            ) : (
              <Unlock className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {object.id !== 'main-camera' && object.id !== 'main-player' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(object.id);
              }}
              className="p-1.5 rounded-lg hover:bg-destructive/20"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="border-l border-border/50 ml-6">
          {children.map((child) => (
            <SceneItem
              key={child.id}
              object={child}
              depth={depth + 1}
              objects={objects}
              selectedObjectId={selectedObjectId}
              onSelect={onSelect}
              onFocus={onFocus}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const MobileScenePanel = ({ onClose }: MobileScenePanelProps) => {
  const { objects, selectedObjectId, selectObject, focusOnObject, updateObject, deleteObject } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(true);

  const rootObjects = objects.filter(obj => 
    !obj.parentId && 
    obj.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const glassStyle = {
    background: 'linear-gradient(135deg, hsl(225 15% 12% / 0.98) 0%, hsl(225 15% 10% / 0.98) 100%)',
    fontFamily: 'Roboto, Noto Sans, sans-serif',
  };

  return (
    <div className="h-full flex flex-col" style={glassStyle}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center active:scale-95 transition-all border border-white/10"
          >
            <X className="w-5 h-5 text-white/80" />
          </button>
          <h2 className="text-[15px] font-semibold text-white/90">Hierarchy</h2>
        </div>
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <MoreHorizontal className="w-5 h-5 text-white/50" />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[13px] font-medium text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Scene Tree */}
      <div className="flex-1 overflow-y-auto">
        {/* Scene Root */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-2 px-4 py-3 text-white/90 font-medium hover:bg-white/5 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-white/50" />
            ) : (
              <ChevronRight className="w-4 h-4 text-white/50" />
            )}
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-[13px]">Scene</span>
            <span className="ml-auto text-[11px] text-white/40">{objects.length}</span>
          </button>

          {expanded && (
            <div>
              {rootObjects.map((obj) => (
                <SceneItem
                  key={obj.id}
                  object={obj}
                  depth={0}
                  objects={objects}
                  selectedObjectId={selectedObjectId}
                  onSelect={(id) => {
                    selectObject(id);
                  }}
                  onFocus={(id) => {
                    focusOnObject(id);
                    onClose();
                  }}
                  onUpdate={updateObject}
                  onDelete={deleteObject}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40 flex items-center justify-between">
        <span>{objects.length} objetos</span>
        <div className="flex items-center gap-1">
          <Link className="w-3 h-3" />
          <span>Parent-Child</span>
        </div>
      </div>
    </div>
  );
};
