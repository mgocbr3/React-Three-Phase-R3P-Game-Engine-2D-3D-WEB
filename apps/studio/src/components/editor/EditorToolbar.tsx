import {
  MousePointer2,
  Move3D,
  RotateCw,
  Maximize2,
  Grid3X3,
  Box,
  Circle,
  Sun,
  Layers,
  Undo,
  Redo,
  ChevronDown,
  Magnet,
  Mountain,
  Lightbulb,
  Cone,
  Globe,
  Crosshair,
} from 'lucide-react';
import { useEditorStore, TransformMode, ObjectType } from '@/stores/editorStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useTerrainStore } from '@/stores/terrainStore';
import { useViewportStore } from '@/stores/viewportStore';

const transformTools: { mode: TransformMode; icon: typeof Move3D; label: string; shortcut: string }[] = [
  { mode: 'select', icon: MousePointer2, label: 'Select (Free Camera)', shortcut: 'Q' },
  { mode: 'translate', icon: Move3D, label: 'Move', shortcut: 'W' },
  { mode: 'rotate', icon: RotateCw, label: 'Rotate', shortcut: 'E' },
  { mode: 'scale', icon: Maximize2, label: 'Scale', shortcut: 'R' },
];

const primitives: { type: ObjectType; icon: typeof Box; label: string }[] = [
  { type: 'box', icon: Box, label: 'Cube' },
  { type: 'sphere', icon: Circle, label: 'Sphere' },
  { type: 'cylinder', icon: Layers, label: 'Cylinder' },
  { type: 'plane', icon: Grid3X3, label: 'Plane' },
];

// Light types for ultra-realistic illumination
const lights: { type: ObjectType; icon: typeof Sun; label: string; description: string }[] = [
  { type: 'light', icon: Lightbulb, label: 'Point Light', description: 'Omnidirectional light source' },
  { type: 'sunlight', icon: Sun, label: 'Sun Light', description: 'Directional light with shadows' },
  { type: 'spotlight', icon: Cone, label: 'Spot Light', description: 'Focused cone of light' },
];

interface EditorToolbarProps {
  variant?: 'floating' | 'inline';
  className?: string;
}

export const EditorToolbar = ({ variant = 'floating', className }: EditorToolbarProps) => {
  const { 
    isEditMode, 
    transformMode, 
    setTransformMode, 
    transformSpace,
    toggleTransformSpace,
    snapEnabled,
    toggleSnapEnabled,
    addObject,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorStore();

  const { setModalOpen: setTerrainModalOpen } = useTerrainStore();
  const { viewportMode, setViewportMode } = useViewportStore();
  
  const { showGrid, updateSettings } = useEngineSettings();
  const toggleGrid = () => updateSettings({ showGrid: !showGrid });
  
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Keyboard shortcuts for undo/redo and transform tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) undo();
      }
      
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        if (canRedo()) redo();
      }
      
      // Transform mode shortcuts (only without modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'q':
            setTransformMode('select');
            break;
          case 'w':
            setTransformMode('translate');
            break;
          case 'e':
            setTransformMode('rotate');
            break;
          case 'r':
            setTransformMode('scale');
            break;
          case 'x':
            toggleTransformSpace();
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, setTransformMode, toggleTransformSpace]);

  const isInline = variant === 'inline';

  return (
    <div
      className={cn(
        isInline
          ? 'flex items-center'
          : 'absolute top-2 left-1/2 z-20 -translate-x-1/2',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center gap-0.5',
          isInline
            ? 'h-7 border-0 bg-transparent p-0 shadow-none'
            : 'border border-[#111] bg-[#242424]/95 p-1 shadow-xl shadow-black/35 backdrop-blur-md'
        )}
      >
        {isInline && (
          <>
            <div className="mr-1 flex h-7 items-center border border-[#111] bg-[#1b1b1b]">
              <ModeButton
                icon={Grid3X3}
                label="2D"
                active={viewportMode === '2d'}
                onClick={() => setViewportMode('2d')}
              />
              <ModeButton
                icon={Box}
                label="3D"
                active={viewportMode === '3d'}
                onClick={() => setViewportMode('3d')}
              />
            </div>
            <Separator />
          </>
        )}

        {transformTools.map((tool) => (
          <ToolButton
            key={tool.mode}
            icon={tool.icon}
            active={transformMode === tool.mode && isEditMode}
            onClick={() => setTransformMode(tool.mode)}
            tooltip={`${tool.label} (${tool.shortcut})`}
          />
        ))}

        <Separator />

        {/* Grid Toggle */}
        <ToolButton
          icon={Grid3X3}
          active={showGrid}
          onClick={toggleGrid}
          tooltip="Toggle Grid (G)"
        />

        {/* Space Toggle - World/Local */}
        <ToolButton
          icon={transformSpace === 'world' ? Globe : Crosshair}
          active={transformSpace === 'local'}
          onClick={toggleTransformSpace}
          tooltip={`Space: ${transformSpace === 'world' ? 'World' : 'Local'} (X)`}
        />

        {/* Snap Toggle */}
        <ToolButton
          icon={Magnet}
          active={snapEnabled}
          onClick={toggleSnapEnabled}
          tooltip="Snap (Shift hold)"
        />

        <Separator />

        {/* Add Object Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="editor-command-chip flex h-7 items-center gap-1.5 border border-[#111] bg-[#242424] px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-[#303030]"
          >
            <span className="text-sm font-semibold leading-none">+</span>
            Add
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>

          {showAddMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowAddMenu(false)} 
              />
              <div 
                className="editor-menu-dropdown absolute left-0 top-full z-20 mt-1.5 w-48 overflow-hidden py-1.5"
              >
                <div className="px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
                  Terrain
                </div>
                <button
                  onClick={() => {
                    setTerrainModalOpen(true);
                    setShowAddMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
                >
                  <Mountain className="w-4 h-4 text-muted-foreground" />
                  Pixlland Terrain
                </button>
                <div className="my-1 mx-2 h-px bg-border" />
                <div className="px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
                  Primitives
                </div>
                {primitives.map((prim) => {
                  const Icon = prim.icon;
                  return (
                    <button
                      key={prim.type}
                      onClick={() => {
                        addObject(prim.type);
                        setShowAddMenu(false);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
                    >
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      {prim.label}
                    </button>
                  );
                })}
                <div className="my-1 mx-2 h-px bg-border" />
                <div className="px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
                  Lights
                </div>
                {lights.map((light) => {
                  const Icon = light.icon;
                  return (
                    <button
                      key={light.type}
                      onClick={() => {
                        addObject(light.type);
                        setShowAddMenu(false);
                      }}
                      className="group flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
                      title={light.description}
                    >
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1 text-left">{light.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Undo/Redo */}
        <ToolButton
          icon={Undo}
          onClick={() => canUndo() && undo()}
          disabled={!canUndo()}
          tooltip="Undo (Ctrl+Z)"
        />
        <ToolButton
          icon={Redo}
          onClick={() => canRedo() && redo()}
          disabled={!canRedo()}
          tooltip="Redo (Ctrl+Y)"
        />
      </div>
    </div>
  );
};

// Helper Components
const Separator = () => <div className="mx-1 h-5 w-px bg-[#151515] shadow-[1px_0_0_#333]" />;

interface ModeButtonProps {
  icon: typeof Box;
  label: string;
  active: boolean;
  onClick: () => void;
}

const ModeButton = ({ icon: Icon, label, active, onClick }: ModeButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      'engine-view-tab flex h-[26px] items-center gap-1 px-2 text-xs font-semibold transition-colors',
      active
        ? 'active'
        : 'text-muted-foreground hover:bg-[#2b2b2b] hover:text-foreground'
    )}
  >
    <Icon className="h-3.5 w-3.5" />
    <span>{label}</span>
  </button>
);

interface ToolButtonProps {
  icon: typeof Box;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  tooltip?: string;
}

const ToolButton = ({ icon: Icon, active, disabled, onClick, tooltip }: ToolButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex h-7 w-7 items-center justify-center border border-transparent transition-colors',
      active && 'border-primary bg-primary text-primary-foreground',
      disabled && 'opacity-30 cursor-not-allowed',
      !active && !disabled && 'text-muted-foreground hover:border-[#111] hover:bg-[#303030] hover:text-foreground'
    )}
    title={tooltip}
  >
    <Icon className="w-4 h-4" />
  </button>
);
