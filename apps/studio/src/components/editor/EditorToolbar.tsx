import {
  MousePointer2,
  Move,
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
  Square,
  Type,
  Image as ImageIcon,
} from 'lucide-react';
import { useEditorStore, TransformMode, ObjectType } from '@/stores/editorStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useTerrainStore } from '@/stores/terrainStore';
import { useViewportStore } from '@/stores/viewportStore';
import { getEditorAddMenuSections, getEditorAddObjectPosition, getEditorToolKind } from './editorAddMenu';

const getTransformTools = (kind: '2d' | '3d'): { mode: TransformMode; icon: typeof Move3D; label: string; shortcut: string }[] => [
  { mode: 'select', icon: MousePointer2, label: kind === '2d' ? 'Select 2D' : 'Select (Free Camera)', shortcut: 'Q' },
  { mode: 'translate', icon: kind === '2d' ? Move : Move3D, label: kind === '2d' ? 'Move 2D' : 'Move 3D', shortcut: 'W' },
  { mode: 'rotate', icon: RotateCw, label: kind === '2d' ? 'Rotate 2D' : 'Rotate 3D', shortcut: 'E' },
  { mode: 'scale', icon: Maximize2, label: kind === '2d' ? 'Scale 2D' : 'Scale 3D', shortcut: 'R' },
];

const addIcons: Partial<Record<ObjectType | 'terrain', typeof Box>> = {
  box: Box,
  sphere: Circle,
  cylinder: Layers,
  plane: Grid3X3,
  rectangle: Square,
  circle: Circle,
  text: Type,
  sprite: ImageIcon,
  light: Lightbulb,
  sunlight: Sun,
  spotlight: Cone,
  terrain: Mountain,
};

interface EditorToolbarProps {
  variant?: 'floating' | 'inline';
  className?: string;
}

export const EditorToolbar = ({ variant = 'floating', className }: EditorToolbarProps) => {
  const { 
    isEditMode, 
    activeSceneKind,
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
  const { viewportMode, setViewportMode, lockedKind } = useViewportStore();
  
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
  const addMenuKind = getEditorToolKind(lockedKind, viewportMode, activeSceneKind);
  const addMenuSections = getEditorAddMenuSections(addMenuKind);

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
            : 'border border-border bg-[var(--editor-toolbar)] p-1 shadow-xl'
        )}
      >
        {/*
         * Project kind (2D Phaser vs 3D Three.js) is locked at creation
         * time and persisted in the project document. Once a project is
         * loaded we render only the matching badge — clicking the wrong
         * engine mid-project causes too many cross-runtime bugs to be
         * worth keeping as a toggle.
         *
         * The toggle still appears when no project is loaded (Hub boot,
         * direct `/editor?kind=...` URL), so dev mode and tests can flip
         * it freely.
         */}
        {isInline && (
          <>
            <div className="mr-1 flex h-7 items-center border border-border bg-[var(--editor-panel-sunken)]">
              {lockedKind === null ? (
                <>
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
                </>
              ) : (
                <div
                  className="flex h-7 items-center gap-1.5 px-2 text-[11px] font-semibold text-foreground"
                  title={
                    lockedKind === '2d'
                      ? 'Projeto 2D (Phaser) — engine fixa na criação'
                      : 'Projeto 3D (Three.js) — engine fixa na criação'
                  }
                >
                  {lockedKind === '2d' ? (
                    <Grid3X3 className="h-3.5 w-3.5" />
                  ) : (
                    <Box className="h-3.5 w-3.5" />
                  )}
                  <span>{lockedKind.toUpperCase()}</span>
                </div>
              )}
            </div>
            <Separator />
          </>
        )}

        {getTransformTools(addMenuKind).map((tool) => (
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
            className="editor-command-chip flex h-7 items-center gap-1.5 border border-border bg-[var(--editor-toolbar)] px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-[var(--editor-panel-raised)]"
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
                {addMenuSections.map((section, sectionIndex) => (
                  <div key={section.label}>
                    {sectionIndex > 0 && <div className="my-1 mx-2 h-px bg-border" />}
                    <div className="px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
                      {section.label}
                    </div>
                    {section.items.map((item) => {
                      const action = item.kind === 'terrain' ? 'terrain' : item.objectType;
                      const Icon = addIcons[action] ?? Box;
                      return (
                        <button
                          key={`${section.label}-${item.label}`}
                          onClick={() => {
                            if (item.kind === 'terrain') setTerrainModalOpen(true);
                            else addObject(item.objectType, getEditorAddObjectPosition(addMenuKind));
                            setShowAddMenu(false);
                          }}
                          className="group flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
                        >
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1 text-left">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
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
const Separator = () => <div className="mx-1 h-5 w-px bg-border" />;

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
        : 'text-muted-foreground hover:bg-[var(--editor-row-hover)] hover:text-foreground'
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
      !active && !disabled && 'text-muted-foreground hover:border-border hover:bg-[var(--editor-row-hover)] hover:text-foreground'
    )}
    title={tooltip}
  >
    <Icon className="w-4 h-4" />
  </button>
);
