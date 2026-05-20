import { useState } from 'react';
import { 
  MousePointer2, 
  Move3D, 
  RotateCw, 
  Maximize2, 
  Grid3X3, 
  Box, 
  Circle, 
  Layers, 
  Sun,
  Plus,
  Magnet,
  LucideIcon,
  Triangle,
  Eye,
  EyeOff,
  Mountain,
  Settings,
  Focus,
  Undo,
  Redo,
  Activity,
  Play,
  Square,
  Globe,
  Crosshair,
  Save
} from 'lucide-react';
import { useEditorStore, ObjectType } from '@/stores/editorStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { useTerrainStore } from '@/stores/terrainStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ToolButtonProps {
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  label?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

const ToolButton = ({ icon: Icon, active, onClick, label, size = 'md', disabled }: ToolButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'rounded-lg flex items-center justify-center transition-all active:scale-95',
      size === 'sm' ? 'w-9 h-9' : 'w-10 h-10',
      disabled && 'opacity-40 cursor-not-allowed',
      active 
        ? 'bg-primary/20 text-primary border border-primary/30' 
        : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
    )}
    title={label}
    style={{ fontFamily: 'Roboto, Noto Sans, sans-serif' }}
  >
    <Icon className={size === 'sm' ? 'w-[18px] h-[18px]' : 'w-5 h-5'} />
  </button>
);

const primitives = [
  { type: 'box' as ObjectType, icon: Box, label: 'Cubo', color: 'text-muted-foreground' },
  { type: 'sphere' as ObjectType, icon: Circle, label: 'Esfera', color: 'text-muted-foreground' },
  { type: 'cylinder' as ObjectType, icon: Layers, label: 'Cilindro', color: 'text-muted-foreground' },
  { type: 'plane' as ObjectType, icon: Grid3X3, label: 'Plano', color: 'text-muted-foreground' },
  { type: 'platform' as ObjectType, icon: Layers, label: 'Plataforma', color: 'text-muted-foreground' },
];

const lights = [
  { type: 'light' as ObjectType, icon: Sun, label: 'Point Light', color: 'text-muted-foreground' },
  { type: 'spotlight' as ObjectType, icon: Triangle, label: 'Spot Light', color: 'text-muted-foreground' },
  { type: 'sunlight' as ObjectType, icon: Eye, label: 'Directional', color: 'text-muted-foreground' },
];

interface MobileToolbarProps {
  onOpenSettings?: () => void;
  onOpenHierarchy?: () => void;
}

export const MobileToolbar = ({ onOpenSettings, onOpenHierarchy }: MobileToolbarProps) => {
  const { 
    transformMode, 
    setTransformMode, 
    addObject, 
    isEditMode, 
    toggleEditMode, 
    selectedObjectId, 
    focusOnObject, 
    updateObject,
    objects,
    undo, 
    redo, 
    canUndo, 
    canRedo,
    transformSpace,
    toggleTransformSpace,
    snapEnabled,
    toggleSnapEnabled,
    saveProject
  } = useEditorStore();
  const { showGrid, showStats, updateSettings } = useEngineSettings();
  const { setModalOpen: setTerrainModalOpen } = useTerrainStore();
  const [showAddMenu, setShowAddMenu] = useState(false);

  const toggleGrid = () => updateSettings({ showGrid: !showGrid });
  const toggleStats = () => updateSettings({ showStats: !showStats });

  const handleFocusSelected = () => {
    if (selectedObjectId) {
      focusOnObject(selectedObjectId);
    }
  };

  const selectedObject = selectedObjectId ? objects.find((o) => o.id === selectedObjectId) : undefined;
  const isSelectedVisible = selectedObject ? selectedObject.visible !== false : true;

  const handleToggleSelectedVisible = () => {
    if (!selectedObjectId) return;
    updateObject(selectedObjectId, { visible: isSelectedVisible ? false : true });
  };

  const handleSave = () => {
    saveProject();
    toast.success('Projeto salvo!', { duration: 2000 });
  };

  // Hide toolbar in Play mode - Stop button is in bottom nav
  if (!isEditMode) return null;

  const glassStyle = {
    background: 'linear-gradient(135deg, hsl(225 15% 12% / 0.95) 0%, hsl(225 15% 10% / 0.98) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    fontFamily: 'Roboto, Noto Sans, sans-serif',
  };

  return (
    <div className="absolute top-2 left-2 right-2 flex justify-center pointer-events-none z-20">
      <div 
        className="flex flex-col gap-1 p-2 rounded-2xl border border-white/15 shadow-xl shadow-black/30 pointer-events-auto"
        style={glassStyle}
      >
        {/* ROW 1 - Transform & Object tools */}
        <div className="flex items-center gap-1">
          {/* Hierarchy */}
          {onOpenHierarchy && (
            <>
              <ToolButton 
                icon={Layers} 
                onClick={onOpenHierarchy} 
                label="Hierarquia" 
                size="sm"
              />
              <div className="w-px h-6 bg-white/10 mx-0.5" />
            </>
          )}
          
          {/* Transform tools */}
          <ToolButton 
            icon={MousePointer2} 
            active={transformMode === 'select'} 
            onClick={() => setTransformMode('select')} 
            label="Selecionar (Q)" 
            size="sm"
          />
          <ToolButton 
            icon={Move3D} 
            active={transformMode === 'translate'} 
            onClick={() => setTransformMode('translate')} 
            label="Mover (W)" 
            size="sm"
          />
          <ToolButton 
            icon={RotateCw} 
            active={transformMode === 'rotate'} 
            onClick={() => setTransformMode('rotate')} 
            label="Rotacionar (E)" 
            size="sm"
          />
          <ToolButton 
            icon={Maximize2} 
            active={transformMode === 'scale'} 
            onClick={() => setTransformMode('scale')} 
            label="Escalar (R)" 
            size="sm"
          />

          <div className="w-px h-6 bg-white/10 mx-0.5" />
          
          {/* Undo/Redo */}
          <ToolButton 
            icon={Undo} 
            onClick={() => canUndo() && undo()} 
            label="Desfazer" 
            size="sm"
            disabled={!canUndo()}
          />
          <ToolButton 
            icon={Redo} 
            onClick={() => canRedo() && redo()} 
            label="Refazer" 
            size="sm"
            disabled={!canRedo()}
          />

          <div className="w-px h-6 bg-white/10 mx-0.5" />
          
          {/* Add Object */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 border"
              style={{
                background: 'linear-gradient(135deg, hsl(25 95% 53% / 0.2) 0%, hsl(25 95% 53% / 0.1) 100%)',
                borderColor: 'hsl(25 95% 53% / 0.3)',
                color: 'hsl(25 95% 63%)',
              }}
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>

            {showAddMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowAddMenu(false)} 
                />
                <div 
                  className="absolute top-full right-0 mt-2 w-48 rounded-xl shadow-2xl z-20 py-1.5 overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, hsl(225 15% 12% / 0.98) 0%, hsl(225 15% 10% / 0.98) 100%)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    border: '1px solid hsl(225 12% 20% / 0.6)',
                    fontFamily: 'Roboto, Noto Sans, sans-serif',
                  }}
                >
                  {/* Terrain */}
                  <button
                    onClick={() => {
                      setTerrainModalOpen(true);
                      setShowAddMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-[13px] font-medium text-white/90 hover:bg-white/10 active:bg-white/20 transition-all"
                  >
                    <Mountain className="w-4 h-4 text-muted-foreground" />
                    <span>Terreno Procedural</span>
                  </button>
                  
                  <div className="my-1.5 mx-3 h-px bg-white/10" />
                  
                  <div className="px-3 py-1.5 text-[11px] font-medium text-white/45">
                    Primitivas
                  </div>
                  {primitives.map((prim) => {
                    const Icon = prim.icon;
                    return (
                      <button
                        key={prim.type + prim.label}
                        onClick={() => {
                          addObject(prim.type);
                          setShowAddMenu(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-white/80 hover:bg-white/10 active:bg-white/20 transition-all rounded-lg mx-1"
                        style={{ width: 'calc(100% - 8px)' }}
                      >
                        <Icon className={cn('w-4 h-4', prim.color)} />
                        {prim.label}
                      </button>
                    );
                  })}
                  <div className="my-1.5 mx-3 h-px bg-white/10" />
                  <div className="px-3 py-1.5 text-[11px] font-medium text-white/45">
                    Luzes
                  </div>
                  {lights.map((light, i) => {
                    const Icon = light.icon;
                    return (
                      <button
                        key={light.label + i}
                        onClick={() => {
                          addObject(light.type);
                          setShowAddMenu(false);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-white/80 hover:bg-white/10 active:bg-white/20 transition-all rounded-lg mx-1"
                        style={{ width: 'calc(100% - 8px)' }}
                      >
                        <Icon className={cn('w-4 h-4', light.color)} />
                        {light.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Play button */}
          <button
            onClick={toggleEditMode}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all border bg-secondary/30 text-muted-foreground border-border"
          >
            <Play className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* ROW 2 - View & Settings tools */}
        <div className="flex items-center gap-1">
          {/* Grid Toggle */}
          <ToolButton 
            icon={Grid3X3} 
            active={showGrid} 
            onClick={toggleGrid} 
            label="Grade" 
            size="sm"
          />

          {/* Selected Object Visibility */}
          <ToolButton
            icon={isSelectedVisible ? Eye : EyeOff}
            active={isSelectedVisible}
            onClick={handleToggleSelectedVisible}
            label={isSelectedVisible ? 'Ocultar selecionado' : 'Mostrar selecionado'}
            size="sm"
            disabled={!selectedObjectId}
          />
          
          {/* Stats Toggle */}
          <ToolButton 
            icon={Activity} 
            active={showStats} 
            onClick={toggleStats} 
            label="Stats" 
            size="sm"
          />

          <div className="w-px h-6 bg-white/10 mx-0.5" />
          
          {/* Space Toggle - World/Local */}
          <ToolButton 
            icon={transformSpace === 'world' ? Globe : Crosshair} 
            active={transformSpace === 'local'} 
            onClick={toggleTransformSpace} 
            label={`Espaço: ${transformSpace === 'world' ? 'World' : 'Local'}`} 
            size="sm"
          />
          
          {/* Snap Toggle */}
          <ToolButton 
            icon={Magnet} 
            active={snapEnabled} 
            onClick={toggleSnapEnabled} 
            label="Snap" 
            size="sm"
          />

          <div className="w-px h-6 bg-white/10 mx-0.5" />
          
          {/* Focus on Selected */}
          <ToolButton 
            icon={Focus} 
            onClick={handleFocusSelected} 
            label="Focar no selecionado" 
            size="sm"
            disabled={!selectedObjectId}
          />
          
          {/* Save */}
          <ToolButton 
            icon={Save} 
            onClick={handleSave} 
            label="Salvar" 
            size="sm"
          />

          <div className="w-px h-6 bg-white/10 mx-0.5" />
          
          {/* Settings */}
          {onOpenSettings && (
            <ToolButton 
              icon={Settings} 
              onClick={onOpenSettings} 
              label="Configurações" 
              size="sm"
            />
          )}
        </div>
      </div>
    </div>
  );
};
