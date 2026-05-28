import { useEffect, useState } from 'react';
import { 
  Settings, Palette, Box, Camera, Video, Eye, Lock, Copy, Trash2, User, Move, 
  Zap, Brain, Atom, Tag, Gamepad2, ChevronDown, ChevronRight, Sun, Lightbulb, 
  Search, Code, Target, Sparkles, Send, Volume2, Layers, Mountain, Image as ImageIcon, Type as TypeIcon,
  Plus, X
} from 'lucide-react';
import { 
  useEditorStore, 
  SceneObject, 
  CameraSettings, 
  CameraMode, 
  PlayerSettings,
  PhysicsSettings,
  PhysicsBodyType,
  ColliderShape,
  VisualSettings,
  LogicSettings,
  AudioSettings,
  AnimationSettings,
  ParticleSettings,
  BehaviorType,
  LightSettings,
  GamePreset,
  EntitySettings,
  EntityTeam,
  EntityType,
  DEFAULT_ENTITY_SETTINGS
} from '@/stores/editorStore';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScriptEditorPanel } from './ScriptEditorPanel';
import { VibeCodePanel } from './VibeCodePanel';
import { DockFrameMenu, useDockChrome } from './DockFrame';
import { AnimationSection, getDefaultAnimationSettings } from './AnimationSection';
import { ParticleSection } from './ParticleSection';
import { TerrainSection } from './TerrainSection';
import { getDefaultParticleSettings } from '@/components/canvas/ParticleEmitter';
import { useTerrainStore, defaultTerrainSettings } from '@/stores/terrainStore';
import { TexturePicker } from './TexturePicker';
import type { PixlComponentInstance } from '@/engine/project/schema';
import {
  createComponentInstance,
  getComponentDefinition,
  getComponentDefinitionsForScene,
  isEditableComponentDataValue,
  updateComponentDataField,
  type ComponentDataScalar,
} from '@/services/componentCatalog';
import { getEditorObjectIcon } from './editorObjectIcon';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';

// Tabs as icon-based navigation
const mainTabs = [
  { id: 'inspector', label: 'Inspector', shortLabel: 'Inspector', icon: Settings },
  { id: 'scripts', label: 'Scripts', shortLabel: 'Scripts', icon: Code },
  { id: 'vibe', label: 'Vibe Code', shortLabel: 'Vibe', icon: Sparkles },
] as const;

type MainTabId = typeof mainTabs[number]['id'];
type EntityAIType = EntitySettings['aiType'];
type EntityPickupType = NonNullable<EntitySettings['pickupType']>;

export const InspectorPanel = () => {
  const dockChrome = useDockChrome();
  const {
    objects,
    selectedObjectId,
    activeSceneKind,
    isEditMode,
    updateObject,
    addComponentToObject,
    updateObjectComponent,
    updateObjectComponentData,
    removeComponentFromObject,
    deleteObject,
    duplicateObject,
  } = useEditorStore();
  const [mainTab, setMainTab] = useState<MainTabId>('inspector');
  const [searchQuery, setSearchQuery] = useState('');
  const previewSession = useRuntimeGameStore((s) => s.previewSession);
  const isRuntimePreviewActive = Boolean(previewSession) || !isEditMode;
  
  const selectedObject = objects.find(obj => obj.id === selectedObjectId);

  useEffect(() => {
    if (isRuntimePreviewActive && mainTab !== 'inspector') setMainTab('inspector');
  }, [isRuntimePreviewActive, mainTab]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--editor-panel)]">
      {/* Professional Tab Navigation */}
      <div
        className="panel-header panel-tabs-left gap-0.5 px-1 pt-1"
        onPointerDown={(event) => dockChrome?.onPointerDown(event)}
        title="Arraste para reorganizar"
      >
        <div className="flex min-w-0 flex-1 items-end gap-0.5">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = mainTab === tab.id;
            return (
              <button
                key={tab.id}
                aria-label={tab.label}
                aria-pressed={isActive}
                disabled={isRuntimePreviewActive && tab.id !== 'inspector'}
                onClick={() => setMainTab(tab.id)}
                title={tab.label}
                className={cn(
                  'editor-panel-tab flex h-6 flex-1 min-w-0 items-center justify-center gap-1 px-1.5 text-[11px] transition-colors',
                  isRuntimePreviewActive && tab.id !== 'inspector'
                    ? 'cursor-not-allowed opacity-35'
                    : isActive
                    ? 'active'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate whitespace-nowrap">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
        <DockFrameMenu label={dockChrome?.label ?? 'Inspector'} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {mainTab === 'scripts' ? (
          <ScriptEditorPanel selectedObject={selectedObject || null} />
        ) : mainTab === 'vibe' ? (
          <VibeCodePanel />
        ) : selectedObject ? (
          <PropertiesPanel 
            object={selectedObject}
            objects={objects}
            updateObject={updateObject} 
            addComponentToObject={addComponentToObject}
            updateObjectComponent={updateObjectComponent}
            updateObjectComponentData={updateObjectComponentData}
            removeComponentFromObject={removeComponentFromObject}
            deleteObject={deleteObject} 
            duplicateObject={duplicateObject}
            activeSceneKind={activeSceneKind}
            readOnly={isRuntimePreviewActive}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="flex flex-col items-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center border border-border bg-[var(--editor-panel-sunken)]">
                <Box className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-xs font-semibold text-foreground/80 mb-1">Nenhum objeto selecionado</p>
              <p className="text-[10px] text-muted-foreground max-w-[200px] leading-relaxed">
                Clique em um objeto na cena ou na Hierarquia para inspecionar suas propriedades
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// PROPERTIES PANEL - Consolidated view
// ============================================
interface PropertiesPanelProps {
  object: SceneObject;
  objects: SceneObject[];
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  addComponentToObject: (objectId: string, component: PixlComponentInstance) => void;
  updateObjectComponent: (objectId: string, componentId: string, updates: Partial<PixlComponentInstance>) => void;
  updateObjectComponentData: (objectId: string, componentId: string, data: Record<string, unknown>) => void;
  removeComponentFromObject: (objectId: string, componentId: string) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  activeSceneKind: '2d' | '3d';
  readOnly?: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const PropertiesPanel = ({
  object,
  objects,
  updateObject,
  addComponentToObject,
  updateObjectComponent,
  updateObjectComponentData,
  removeComponentFromObject,
  deleteObject,
  duplicateObject,
  activeSceneKind,
  readOnly = false,
  searchQuery,
  setSearchQuery,
}: PropertiesPanelProps) => {
  const isCamera = object.type === 'camera';
  const isPlayer = object.type === 'player';
  const isLight = object.type === 'light' || object.type === 'sunlight' || object.type === 'spotlight';
  const isTerrain = object.type === 'terrain';
  const is2DScene = activeSceneKind === '2d';
  const is2DVisual = object.type === 'image' || object.type === 'sprite';
  const is2DShape = object.type === 'rectangle' || object.type === 'circle';
  const is2DText = object.type === 'text';
  
  const ObjectIcon = getEditorObjectIcon(object.type);
  
  return (
    <fieldset
      disabled={readOnly}
      className={cn('flex h-full flex-col', readOnly && 'opacity-70')}
      title={readOnly ? 'Inspector locked during Play Mode' : undefined}
    >
      {/* Search */}
      <div className="p-2.5 border-b border-border/50">
        <div className="glass-search">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar propriedades..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Object Header */}
      <div className="glass-object-header">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center border border-border bg-[var(--editor-panel-sunken)]">
            <ObjectIcon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={object.name}
              onChange={(e) => updateObject(object.id, { name: e.target.value })}
              className="w-full bg-transparent text-[13px] font-semibold text-foreground focus:outline-none"
            />
            <p className="text-[10px] text-muted-foreground capitalize font-medium">{object.type}</p>
          </div>
        </div>
        
        {/* Object Actions */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <ActionButton
            icon={Eye}
            active={object.visible !== false}
            onClick={() => updateObject(object.id, { visible: object.visible === false ? true : false })}
            tooltip={object.visible !== false ? "Ocultar" : "Mostrar"}
          />
          <ActionButton
            icon={Lock}
            active={object.locked}
            onClick={() => updateObject(object.id, { locked: !object.locked })}
            tooltip={object.locked ? "Desbloquear" : "Bloquear"}
          />
          <ActionButton
            icon={Copy}
            onClick={() => duplicateObject(object.id)}
            tooltip="Duplicar"
          />
          {object.id !== 'main-camera' && object.id !== 'main-player' && (
            <ActionButton
              icon={Trash2}
              onClick={() => deleteObject(object.id)}
              tooltip="Deletar"
              destructive
            />
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Special Settings for Terrain */}
        {isTerrain && object.terrainSettings && (
          <CollapsibleSection title="Terreno" icon={Mountain} defaultOpen>
            <TerrainSection 
              terrainSettings={object.terrainSettings} 
              onUpdate={(settings) => {
                // Update the object in editor store
                updateObject(object.id, { 
                  terrainSettings: { 
                    ...(object.terrainSettings || defaultTerrainSettings),
                    ...settings 
                  } 
                });
                // Also update terrain store so the terrain re-renders
                useTerrainStore.getState().updateTerrainSettings(settings);
              }}
            />
          </CollapsibleSection>
        )}

        {/* Special Settings for Camera */}
        {isCamera && object.cameraSettings && (
          <CollapsibleSection title="Câmera" icon={Video} defaultOpen>
            <CameraSettingsSection 
              cameraSettings={object.cameraSettings} 
              onUpdate={(settings) => updateObject(object.id, { cameraSettings: settings })}
            />
          </CollapsibleSection>
        )}

        {/* Special Settings for Player */}
        {isPlayer && object.playerSettings && (
          <CollapsibleSection title="Jogador" icon={Gamepad2} defaultOpen>
            <PlayerSettingsSection 
              playerSettings={object.playerSettings} 
              onUpdate={(settings) => updateObject(object.id, { playerSettings: settings })}
              objects={objects}
              updateObject={updateObject}
            />
          </CollapsibleSection>
        )}

        {/* Light Settings */}
        {isLight && (
          <CollapsibleSection title="Luz" icon={Lightbulb} defaultOpen>
            <LightSection object={object} updateObject={updateObject} />
          </CollapsibleSection>
        )}

        <CollapsibleSection title="Components" icon={Settings} defaultOpen>
          <ComponentStackSection
            object={object}
            activeSceneKind={activeSceneKind}
            addComponentToObject={addComponentToObject}
            updateObjectComponent={updateObjectComponent}
            updateObjectComponentData={updateObjectComponentData}
            removeComponentFromObject={removeComponentFromObject}
          />
        </CollapsibleSection>

        {/* Transform - Always visible */}
        <CollapsibleSection title="Transform" icon={Move} defaultOpen>
          <TransformSection object={object} updateObject={updateObject} isSimple={isCamera || isPlayer} />
        </CollapsibleSection>

        {is2DScene && is2DVisual && (
          <CollapsibleSection title="Sprite 2D" icon={ImageIcon} defaultOpen>
            <Sprite2DSection object={object} updateObject={updateObject} />
          </CollapsibleSection>
        )}

        {is2DScene && is2DShape && (
          <CollapsibleSection title="Forma 2D" icon={Layers} defaultOpen>
            <Shape2DSection object={object} updateObject={updateObject} />
          </CollapsibleSection>
        )}

        {is2DScene && is2DText && (
          <CollapsibleSection title="Texto 2D" icon={TypeIcon} defaultOpen>
            <Text2DSection object={object} updateObject={updateObject} />
          </CollapsibleSection>
        )}

        {/* Visual - For non-special objects and non-terrain */}
        {!is2DScene && !isCamera && !isPlayer && !isTerrain && (
          <CollapsibleSection title="Visual" icon={Palette}>
            <VisualSection object={object} updateObject={updateObject} />
          </CollapsibleSection>
        )}

        {/* Physics - For non-special objects and non-terrain */}
        {!is2DScene && !isCamera && !isPlayer && !isLight && !isTerrain && (
          <CollapsibleSection title="Física" icon={Atom}>
            <PhysicsSection object={object} updateObject={updateObject} />
          </CollapsibleSection>
        )}

        {/* Logic/Tags - For non-special objects and non-terrain */}
        {!is2DScene && !isCamera && !isPlayer && !isLight && !isTerrain && (
          <CollapsibleSection title="Tags" icon={Tag}>
            <TagsSection object={object} updateObject={updateObject} />
          </CollapsibleSection>
        )}

        {/* Entity System - For game entities (enemies, pickups, destructibles) */}
        {!is2DScene && !isCamera && !isPlayer && !isLight && !isTerrain && (
          <CollapsibleSection title="Sistema de Entidade" icon={Target}>
            <EntitySection object={object} updateObject={updateObject} />
          </CollapsibleSection>
        )}

        {/* Audio - For non-special objects and non-terrain */}
        {!is2DScene && !isCamera && !isPlayer && !isLight && !isTerrain && (
          <CollapsibleSection title="Áudio" icon={Volume2}>
            <AudioSection object={object} updateObject={updateObject} />
          </CollapsibleSection>
        )}

        {/* Animation - For objects with models and non-terrain */}
        {!is2DScene && !isCamera && !isPlayer && !isLight && !isTerrain && (
          <AnimationSection
            animationSettings={object.animationSettings}
            onUpdate={(settings) => updateObject(object.id, { 
              animationSettings: { 
                ...(object.animationSettings || getDefaultAnimationSettings()),
                ...settings 
              } 
            })}
          />
        )}

        {/* Particles - For non-special objects and non-terrain */}
        {!is2DScene && !isCamera && !isPlayer && !isLight && !isTerrain && (
          <ParticleSection
            particleSettings={object.particleSettings}
            onUpdate={(settings) => updateObject(object.id, { 
              particleSettings: { 
                ...(object.particleSettings || getDefaultParticleSettings()),
                ...settings 
              } 
            })}
          />
        )}
      </div>
    </fieldset>
  );
};

// ============================================
// COLLAPSIBLE SECTION
// ============================================
interface CollapsibleSectionProps {
  title: string;
  icon: typeof Box;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection = ({ title, icon: Icon, defaultOpen = false, children }: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="collapsible-header w-full group"
      >
        <div className={cn(
          "w-4 h-4 flex items-center justify-center rounded transition-all",
          isOpen ? "bg-[var(--editor-panel-raised)]" : "group-hover:bg-[var(--editor-row-hover)]"
        )}>
          {isOpen ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
          )}
        </div>
        <Icon className={cn(
          "w-3.5 h-3.5 transition-colors",
          isOpen ? "text-muted-foreground" : "text-muted-foreground group-hover:text-foreground"
        )} />
        <span className={cn(
          "text-xs font-medium transition-colors",
          isOpen ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        )}>
          {title}
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 bg-[var(--editor-panel)]">
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================
// ACTION BUTTON
// ============================================
interface ActionButtonProps {
  icon: typeof Box;
  active?: boolean;
  destructive?: boolean;
  onClick: () => void;
  tooltip?: string;
}

const ActionButton = ({ icon: Icon, active, destructive, onClick, tooltip }: ActionButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      "glass-action-btn",
      destructive && "destructive",
      active && "active"
    )}
    title={tooltip}
  >
    <Icon className="w-3.5 h-3.5" />
  </button>
);

// ============================================
// COMPONENT STACK
// ============================================
interface ComponentStackSectionProps {
  object: SceneObject;
  activeSceneKind: '2d' | '3d';
  addComponentToObject: (objectId: string, component: PixlComponentInstance) => void;
  updateObjectComponent: (objectId: string, componentId: string, updates: Partial<PixlComponentInstance>) => void;
  updateObjectComponentData: (objectId: string, componentId: string, data: Record<string, unknown>) => void;
  removeComponentFromObject: (objectId: string, componentId: string) => void;
}

const summarizeComponentData = (component: PixlComponentInstance): string => {
  const keys = Object.keys(component.data ?? {});
  if (!keys.length) return 'Sem dados';
  const preview = keys.slice(0, 4).join(', ');
  return keys.length > 4 ? `${preview}, ...` : preview;
};

const formatComponentDataValue = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.length}]`;
  if (value && typeof value === 'object') return '{...}';
  if (value === null) return 'null';
  return String(value);
};

const ComponentStackSection = ({
  object,
  activeSceneKind,
  addComponentToObject,
  updateObjectComponent,
  updateObjectComponentData,
  removeComponentFromObject,
}: ComponentStackSectionProps) => {
  const components = object.components ?? [];
  const existingTypes = new Set(components.map((component) => component.type));
  const availableDefinitions = getComponentDefinitionsForScene(activeSceneKind);
  const addableDefinitions = availableDefinitions.filter((definition) => !existingTypes.has(definition.type));
  const [selectedType, setSelectedType] = useState(addableDefinitions[0]?.type ?? '');
  const selectedAddableType = addableDefinitions.some((definition) => definition.type === selectedType)
    ? selectedType
    : addableDefinitions[0]?.type ?? '';

  const addComponent = () => {
    const nextType = selectedAddableType;
    if (!nextType) return;

    addComponentToObject(object.id, createComponentInstance(object.id, nextType));

    const nextAddableType = addableDefinitions.find((definition) => definition.type !== nextType)?.type ?? '';
    setSelectedType(nextAddableType);
  };

  const updateComponentData = (
    component: PixlComponentInstance,
    key: string,
    value: ComponentDataScalar,
  ) => {
    updateObjectComponentData(object.id, component.id, updateComponentDataField(component, key, value).data);
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {components.length ? components.map((component) => {
          const definition = getComponentDefinition(component.type);
          return (
            <div
              key={component.id}
              className="rounded-sm border border-border bg-[var(--editor-panel-sunken)] p-2"
            >
              <div className="flex items-start gap-2">
                <ToggleSwitch
                  checked={component.enabled !== false}
                  onChange={(enabled) => updateObjectComponent(object.id, component.id, { enabled })}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {definition?.label ?? component.type}
                    </span>
                    <span className="rounded-sm border border-border px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
                      {component.type}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-muted-foreground">
                    {definition?.description ?? summarizeComponentData(component)}
                  </div>
                  <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground/80">
                    {summarizeComponentData(component)}
                  </div>
                  <ComponentDataFields
                    component={component}
                    onUpdate={updateComponentData}
                  />
                </div>
                <button
                  onClick={() => removeComponentFromObject(object.id, component.id)}
                  className="rounded-sm p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Remover componente"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="rounded-sm border border-dashed border-border bg-[var(--editor-panel-sunken)] p-3 text-[11px] text-muted-foreground">
            Nenhum componente estruturado neste objeto.
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border/50 pt-2">
        <select
          value={selectedAddableType}
          onChange={(event) => setSelectedType(event.target.value)}
          disabled={!addableDefinitions.length}
          className="min-w-0 flex-1 rounded-sm border border-border bg-[var(--editor-panel-sunken)] px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {addableDefinitions.length ? addableDefinitions.map((definition) => (
            <option key={definition.type} value={definition.type}>{definition.label}</option>
          )) : (
            <option value="">Todos adicionados</option>
          )}
        </select>
        <button
          onClick={addComponent}
          disabled={!addableDefinitions.length}
          className={cn(
            'editor-command-chip flex h-7 items-center gap-1.5 px-2 text-xs font-semibold',
            addableDefinitions.length
              ? 'text-foreground hover:text-primary'
              : 'cursor-not-allowed text-muted-foreground/45',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
    </div>
  );
};

interface ComponentDataFieldsProps {
  component: PixlComponentInstance;
  onUpdate: (component: PixlComponentInstance, key: string, value: ComponentDataScalar) => void;
}

const ComponentDataFields = ({ component, onUpdate }: ComponentDataFieldsProps) => {
  const entries = Object.entries(component.data ?? {});
  if (!entries.length) return null;

  return (
    <div className="mt-2 grid gap-1.5">
      {entries.map(([key, value]) => (
        <ComponentDataField
          key={`${component.id}:${key}`}
          component={component}
          fieldKey={key}
          value={value}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
};

interface ComponentDataFieldProps {
  component: PixlComponentInstance;
  fieldKey: string;
  value: unknown;
  onUpdate: (component: PixlComponentInstance, key: string, value: ComponentDataScalar) => void;
}

const isColorField = (key: string, value: string): boolean => (
  key.toLowerCase().includes('color') ||
  key.toLowerCase().includes('tint') ||
  /^#[0-9a-f]{6}$/i.test(value)
);

const ComponentDataField = ({ component, fieldKey, value, onUpdate }: ComponentDataFieldProps) => {
  const label = fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());

  if (!isEditableComponentDataValue(value)) {
    return (
      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
        <span className="truncate text-[10px] font-medium text-muted-foreground">{label}</span>
        <code className="truncate rounded-sm border border-border bg-background px-1.5 py-1 text-[10px] text-muted-foreground">
          {formatComponentDataValue(value)}
        </code>
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-medium text-muted-foreground">{label}</span>
        <ToggleSwitch checked={value} onChange={(next) => onUpdate(component, fieldKey, next)} />
      </div>
    );
  }

  if (typeof value === 'number') {
    return (
      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
        <span className="truncate text-[10px] font-medium text-muted-foreground">{label}</span>
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onUpdate(component, fieldKey, next);
          }}
          className="min-w-0 rounded-sm border border-border bg-background px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    );
  }

  if (typeof value === 'string' && isColorField(fieldKey, value)) {
    return (
      <div className="grid grid-cols-[96px_auto_minmax(0,1fr)] items-center gap-2">
        <span className="truncate text-[10px] font-medium text-muted-foreground">{label}</span>
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
          onChange={(event) => onUpdate(component, fieldKey, event.target.value)}
          className="h-7 w-8 rounded-sm border border-border bg-background p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onUpdate(component, fieldKey, event.target.value)}
          className="min-w-0 rounded-sm border border-border bg-background px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
      <span className="truncate text-[10px] font-medium text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value ?? ''}
        onChange={(event) => onUpdate(component, fieldKey, event.target.value)}
        className="min-w-0 rounded-sm border border-border bg-background px-1.5 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
};

// ============================================
// LIGHT SECTION - Ultra-Realistic Lighting
// ============================================
interface LightSectionProps {
  object: SceneObject;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
}

// Temperature to color conversion (Kelvin to RGB approximation)
const kelvinToHex = (kelvin: number): string => {
  const temp = kelvin / 100;
  let r, g, b;
  
  if (temp <= 66) {
    r = 255;
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661));
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
    g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
  }
  
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
  }
  
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
};

const LightSection = ({ object, updateObject }: LightSectionProps) => {
  const light = object.lightSettings || {
    intensity: 1,
    distance: 25,
    decay: 2,
    temperature: 4000,
    useTemperature: false,
    angle: Math.PI / 6,
    penumbra: 0.5,
    sunElevation: 45,
    sunAzimuth: 180,
    castShadow: true,
    shadowMapSize: 1024,
    shadowBias: -0.0001,
    shadowNormalBias: 0.02,
    shadowRadius: 1,
    shadowCameraSize: 50,
    volumetric: false,
    volumetricIntensity: 0.5,
    helperVisible: true,
  } as LightSettings;

  const updateLight = (updates: Partial<LightSettings>) => {
    updateObject(object.id, {
      lightSettings: { ...light, ...updates }
    });
    
    // Auto-update color if using temperature
    if (updates.temperature !== undefined && light.useTemperature) {
      updateObject(object.id, { color: kelvinToHex(updates.temperature) });
    }
    if (updates.useTemperature && updates.useTemperature) {
      updateObject(object.id, { color: kelvinToHex(light.temperature) });
    }
  };

  const isPointLight = object.type === 'light';
  const isSunLight = object.type === 'sunlight';
  const isSpotLight = object.type === 'spotlight';

  const lightTypeName = isSunLight ? 'Sun Light' : isSpotLight ? 'Spot Light' : 'Point Light';
  const LightTypeIcon = isSunLight ? Sun : Lightbulb;

  return (
    <div className="space-y-3">
      {/* Light Type Header */}
      <div className="engine-property-callout border-border bg-secondary/30 text-muted-foreground">
        <LightTypeIcon className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">{lightTypeName}</span>
      </div>

      {/* Core Properties */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-foreground">Propriedades</div>
        
        <PropertyRow label="Intensidade" value={light.intensity.toFixed(2)}>
          <input
            type="range"
            min="0"
            max={isSunLight ? 5 : 10}
            step="0.1"
            value={light.intensity}
            onChange={(e) => updateLight({ intensity: parseFloat(e.target.value) })}
            className="w-full"
          />
        </PropertyRow>

        {!isSunLight && (
          <>
            <PropertyRow label="Distância" value={`${light.distance}m`}>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={light.distance}
                onChange={(e) => updateLight({ distance: parseFloat(e.target.value) })}
                className="w-full"
              />
            </PropertyRow>

            <PropertyRow label="Decay" value={light.decay.toFixed(1)}>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={light.decay}
                onChange={(e) => updateLight({ decay: parseFloat(e.target.value) })}
                className="w-full"
              />
            </PropertyRow>
          </>
        )}

        {isSpotLight && (
          <>
            <PropertyRow label="Ângulo" value={`${Math.round((light.angle * 180) / Math.PI)}°`}>
              <input
                type="range"
                min="0.1"
                max={Math.PI / 2}
                step="0.01"
                value={light.angle}
                onChange={(e) => updateLight({ angle: parseFloat(e.target.value) })}
                className="w-full"
              />
            </PropertyRow>

            <PropertyRow label="Penumbra" value={`${Math.round(light.penumbra * 100)}%`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={light.penumbra}
                onChange={(e) => updateLight({ penumbra: parseFloat(e.target.value) })}
                className="w-full"
              />
            </PropertyRow>
          </>
        )}

        {isSunLight && (
          <>
            <PropertyRow label="Elevação" value={`${Math.round(light.sunElevation)}°`}>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={light.sunElevation}
                onChange={(e) => updateLight({ sunElevation: parseFloat(e.target.value) })}
                className="w-full"
              />
            </PropertyRow>

            <PropertyRow label="Azimute" value={`${Math.round(light.sunAzimuth)}°`}>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={light.sunAzimuth}
                onChange={(e) => updateLight({ sunAzimuth: parseFloat(e.target.value) })}
                className="w-full"
              />
            </PropertyRow>
          </>
        )}
      </div>

      {/* Color & Temperature */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-foreground">Cor</div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Usar Temperatura</span>
          <ToggleSwitch
            checked={light.useTemperature}
            onChange={(v) => updateLight({ useTemperature: v })}
          />
        </div>

        {light.useTemperature ? (
          <PropertyRow label="Temperatura" value={`${light.temperature}K`}>
            <div className="relative w-full">
              <input
                type="range"
                min="1800"
                max="12000"
                step="100"
                value={light.temperature}
                onChange={(e) => {
                  const temp = parseFloat(e.target.value);
                  updateLight({ temperature: temp });
                  updateObject(object.id, { color: kelvinToHex(temp) });
                }}
                className="w-full"
                style={{
                  background: `linear-gradient(to right, #ff8a00, #fff5e6, #e0f0ff, #9cb8ff)`
                }}
              />
              <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
                <span>Vela</span>
                <span>Tungstênio</span>
                <span>Dia</span>
                <span>Céu</span>
              </div>
            </div>
          </PropertyRow>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={object.color}
                onChange={(e) => updateObject(object.id, { color: e.target.value })}
                className="w-10 h-8 rounded cursor-pointer"
              />
              <input
                type="text"
                value={object.color}
                onChange={(e) => updateObject(object.id, { color: e.target.value })}
                className="flex-1 inspector-input font-mono text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Shadow Settings */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-foreground">Sombras</div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Projetar Sombras</span>
          <ToggleSwitch
            checked={light.castShadow}
            onChange={(v) => updateLight({ castShadow: v })}
          />
        </div>

        {light.castShadow && (
          <>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Resolução</label>
              <div className="grid grid-cols-4 gap-1">
                {[512, 1024, 2048, 4096].map((size) => (
                  <button
                    key={size}
                    onClick={() => updateLight({ shadowMapSize: size })}
                    className={cn(
                      "h-6 rounded border px-2 text-[10px] transition-colors",
                      light.shadowMapSize === size
                        ? "border-border bg-secondary text-foreground"
                        : "border-border bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <PropertyRow label="Suavidade" value={light.shadowRadius.toFixed(1)}>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={light.shadowRadius}
                onChange={(e) => updateLight({ shadowRadius: parseFloat(e.target.value) })}
                className="w-full"
              />
            </PropertyRow>

            {isSunLight && (
              <PropertyRow label="Área Sombra" value={`${light.shadowCameraSize}m`}>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="5"
                  value={light.shadowCameraSize}
                  onChange={(e) => updateLight({ shadowCameraSize: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </PropertyRow>
            )}
          </>
        )}
      </div>

      {/* Presets for quick setup */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-foreground">Presets</div>
        <div className="grid grid-cols-2 gap-1">
          {isSunLight && (
            <>
              <button
                onClick={() => {
                  updateLight({ sunElevation: 25, intensity: 1.2, temperature: 3000 });
                  updateObject(object.id, { color: '#ffaa55' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                Por do Sol
              </button>
              <button
                onClick={() => {
                  updateLight({ sunElevation: 70, intensity: 1.5, temperature: 5600 });
                  updateObject(object.id, { color: '#fffaf0' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                Meio-dia
              </button>
              <button
                onClick={() => {
                  updateLight({ sunElevation: 15, intensity: 0.8, temperature: 7500 });
                  updateObject(object.id, { color: '#b4c8ff' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                Crepusculo
              </button>
              <button
                onClick={() => {
                  updateLight({ sunElevation: 45, intensity: 0.6, temperature: 6500 });
                  updateObject(object.id, { color: '#dde8ff' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                Nublado
              </button>
            </>
          )}
          {isPointLight && (
            <>
              <button
                onClick={() => {
                  updateLight({ intensity: 1, temperature: 2700, decay: 2 });
                  updateObject(object.id, { color: '#ffcc88' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                Vela
              </button>
              <button
                onClick={() => {
                  updateLight({ intensity: 2, temperature: 3200, decay: 2 });
                  updateObject(object.id, { color: '#ffe4c4' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                Tungstenio
              </button>
              <button
                onClick={() => {
                  updateLight({ intensity: 3, temperature: 4100, decay: 2 });
                  updateObject(object.id, { color: '#fff5e6' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                Fluorescente
              </button>
              <button
                onClick={() => {
                  updateLight({ intensity: 2.5, temperature: 6500, decay: 2 });
                  updateObject(object.id, { color: '#f0f5ff' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                LED Frio
              </button>
            </>
          )}
          {isSpotLight && (
            <>
              <button
                onClick={() => {
                  updateLight({ intensity: 3, angle: Math.PI / 12, penumbra: 0.2, decay: 2 });
                  updateObject(object.id, { color: '#ffffff' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                Lanterna
              </button>
              <button
                onClick={() => {
                  updateLight({ intensity: 5, angle: Math.PI / 8, penumbra: 0.1, decay: 1 });
                  updateObject(object.id, { color: '#ffffff' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                Palco
              </button>
              <button
                onClick={() => {
                  updateLight({ intensity: 2, angle: Math.PI / 4, penumbra: 0.8, decay: 2 });
                  updateObject(object.id, { color: '#fffaf0' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                Ambiente
              </button>
              <button
                onClick={() => {
                  updateLight({ intensity: 4, angle: Math.PI / 6, penumbra: 0.3, decay: 1.5 });
                  updateObject(object.id, { color: '#ff4444' });
                }}
                className="rounded-sm border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground hover:bg-muted"
              >
                Alerta
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// TRANSFORM SECTION
// ============================================
interface TransformSectionProps {
  object: SceneObject;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  isSimple?: boolean;
}

const TransformSection = ({ object, updateObject, isSimple }: TransformSectionProps) => {
  return (
    <div className="space-y-3">
      {/* Position */}
      <div className="space-y-1.5">
        <label className="inspector-label">POSIÇÃO</label>
        <div className="grid grid-cols-3 gap-1">
          {(['x', 'y', 'z'] as const).map((axis, i) => (
            <div key={axis} className="relative">
              <span className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold',
                axis === 'x' ? 'text-muted-foreground' : axis === 'y' ? 'text-muted-foreground' : 'text-muted-foreground'
              )}>
                {axis}
              </span>
              <input
                type="number"
                step="0.1"
                value={object.position[i].toFixed(1)}
                onChange={(e) => {
                  const newPos: [number, number, number] = [...object.position];
                  newPos[i] = parseFloat(e.target.value) || 0;
                  updateObject(object.id, { position: newPos });
                }}
                className="w-full inspector-input pl-6 pr-1 text-right"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Rotation */}
      {!isSimple && (
        <div className="space-y-1.5">
          <label className="inspector-label">ROTAÇÃO</label>
          <div className="grid grid-cols-3 gap-1">
            {(['x', 'y', 'z'] as const).map((axis, i) => (
              <div key={axis} className="relative">
                <span className={cn(
                  'absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold',
                  axis === 'x' ? 'text-muted-foreground' : axis === 'y' ? 'text-muted-foreground' : 'text-muted-foreground'
                )}>
                  {axis}
                </span>
                <input
                  type="number"
                  step="5"
                  value={Math.round((object.rotation[i] * 180) / Math.PI)}
                  onChange={(e) => {
                    const newRot: [number, number, number] = [...object.rotation];
                    newRot[i] = ((parseFloat(e.target.value) || 0) * Math.PI) / 180;
                    updateObject(object.id, { rotation: newRot });
                  }}
                  className="w-full inspector-input pl-6 pr-1 text-right"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scale */}
      {!isSimple && (
        <div className="space-y-1.5">
          <label className="inspector-label">ESCALA</label>
          <div className="grid grid-cols-3 gap-1">
            {(['x', 'y', 'z'] as const).map((axis, i) => (
              <div key={axis} className="relative">
                <span className={cn(
                  'absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold',
                  axis === 'x' ? 'text-muted-foreground' : axis === 'y' ? 'text-muted-foreground' : 'text-muted-foreground'
                )}>
                  {axis}
                </span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={object.scale[i].toFixed(1)}
                  onChange={(e) => {
                    const newScale: [number, number, number] = [...object.scale];
                    newScale[i] = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                    updateObject(object.id, { scale: newScale });
                  }}
                  className="w-full inspector-input pl-6 pr-1 text-right"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// 2D PIXL SCHEMA SECTIONS
// ============================================
interface Pixl2DSectionProps {
  object: SceneObject;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
}

const get2DDataString = (data: Record<string, unknown> | undefined, key: string, fallback = ''): string => {
  const value = data?.[key];
  return typeof value === 'string' ? value : fallback;
};

const get2DDataNumber = (data: Record<string, unknown> | undefined, key: string, fallback = 0): number => {
  const value = data?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const get2DDataBoolean = (data: Record<string, unknown> | undefined, key: string, fallback = false): boolean => {
  const value = data?.[key];
  return typeof value === 'boolean' ? value : fallback;
};

const update2DData = (
  object: SceneObject,
  updateObject: (id: string, updates: Partial<SceneObject>) => void,
  updates: Record<string, unknown>,
) => {
  updateObject(object.id, {
    data: {
      ...(object.data ?? {}),
      ...updates,
    },
  });
};

const Sprite2DSection = ({ object, updateObject }: Pixl2DSectionProps) => {
  const data = object.data ?? {};
  const imageUrl = get2DDataString(data, 'imageUrl', get2DDataString(data, 'url'));
  const frameWidth = get2DDataNumber(data, 'frameWidth');
  const frameHeight = get2DDataNumber(data, 'frameHeight');
  const frame = get2DDataNumber(data, 'frame');
  const spriteScale = get2DDataNumber(data, 'scale', 1);
  const depth = get2DDataNumber(data, 'depth');

  return (
    <div className="space-y-3">
      <TexturePicker
        value={imageUrl}
        onChange={(url) => update2DData(object, updateObject, { imageUrl: url, url })}
        label="Imagem"
        placeholder="Selecione sprite ou imagem"
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="inspector-label">FRAME W</label>
          <input
            type="number"
            min="0"
            step="1"
            value={frameWidth || ''}
            onChange={(event) => update2DData(object, updateObject, { frameWidth: parseFloat(event.target.value) || undefined })}
            className="w-full inspector-input text-right"
          />
        </div>
        <div className="space-y-1">
          <label className="inspector-label">FRAME H</label>
          <input
            type="number"
            min="0"
            step="1"
            value={frameHeight || ''}
            onChange={(event) => update2DData(object, updateObject, { frameHeight: parseFloat(event.target.value) || undefined })}
            className="w-full inspector-input text-right"
          />
        </div>
      </div>

      <PropertyRow label="Frame" value={frame.toFixed(0)}>
        <input
          type="range"
          min="0"
          max="64"
          step="1"
          value={frame}
          onChange={(event) => update2DData(object, updateObject, { frame: parseFloat(event.target.value) || 0 })}
          className="w-full"
        />
      </PropertyRow>

      <PropertyRow label="Escala" value={spriteScale.toFixed(2)}>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.05"
          value={spriteScale}
          onChange={(event) => update2DData(object, updateObject, { scale: parseFloat(event.target.value) || 1 })}
          className="w-full"
        />
      </PropertyRow>

      <PropertyRow label="Depth" value={depth.toFixed(0)}>
        <input
          type="range"
          min="-100"
          max="200"
          step="1"
          value={depth}
          onChange={(event) => update2DData(object, updateObject, { depth: parseFloat(event.target.value) || 0 })}
          className="w-full"
        />
      </PropertyRow>

      <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Flip X</span>
          <ToggleSwitch
            checked={get2DDataBoolean(data, 'flipX')}
            onChange={(value) => update2DData(object, updateObject, { flipX: value })}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Flip Y</span>
          <ToggleSwitch
            checked={get2DDataBoolean(data, 'flipY')}
            onChange={(value) => update2DData(object, updateObject, { flipY: value })}
          />
        </div>
      </div>
    </div>
  );
};

const Shape2DSection = ({ object, updateObject }: Pixl2DSectionProps) => {
  const data = object.data ?? {};
  const width = get2DDataNumber(data, 'width', 40);
  const height = get2DDataNumber(data, 'height', 40);
  const radius = get2DDataNumber(data, 'radius', 20);
  const depth = get2DDataNumber(data, 'depth');
  const color = get2DDataString(data, 'color', object.color || '#ffffff');

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="inspector-label">COR</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(event) => {
              update2DData(object, updateObject, { color: event.target.value });
              updateObject(object.id, { color: event.target.value });
            }}
          />
          <input
            type="text"
            value={color}
            onChange={(event) => update2DData(object, updateObject, { color: event.target.value })}
            className="flex-1 inspector-input font-mono"
          />
        </div>
      </div>

      {object.type === 'circle' ? (
        <PropertyRow label="Raio" value={radius.toFixed(0)}>
          <input
            type="range"
            min="1"
            max="300"
            step="1"
            value={radius}
            onChange={(event) => update2DData(object, updateObject, { radius: parseFloat(event.target.value) || 20 })}
            className="w-full"
          />
        </PropertyRow>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="inspector-label">WIDTH</label>
            <input
              type="number"
              min="1"
              step="1"
              value={width}
              onChange={(event) => update2DData(object, updateObject, { width: parseFloat(event.target.value) || 1 })}
              className="w-full inspector-input text-right"
            />
          </div>
          <div className="space-y-1">
            <label className="inspector-label">HEIGHT</label>
            <input
              type="number"
              min="1"
              step="1"
              value={height}
              onChange={(event) => update2DData(object, updateObject, { height: parseFloat(event.target.value) || 1 })}
              className="w-full inspector-input text-right"
            />
          </div>
        </div>
      )}

      <PropertyRow label="Depth" value={depth.toFixed(0)}>
        <input
          type="range"
          min="-100"
          max="200"
          step="1"
          value={depth}
          onChange={(event) => update2DData(object, updateObject, { depth: parseFloat(event.target.value) || 0 })}
          className="w-full"
        />
      </PropertyRow>
    </div>
  );
};

const Text2DSection = ({ object, updateObject }: Pixl2DSectionProps) => {
  const data = object.data ?? {};
  const text = get2DDataString(data, 'text');
  const fontSize = get2DDataNumber(data, 'fontSize', 16);
  const fontFamily = get2DDataString(data, 'fontFamily', 'monospace');
  const depth = get2DDataNumber(data, 'depth');
  const color = get2DDataString(data, 'color', object.color || '#ffffff');

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="inspector-label">TEXTO</label>
        <textarea
          value={text}
          onChange={(event) => update2DData(object, updateObject, { text: event.target.value })}
          className="min-h-[68px] w-full resize-none inspector-input"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="inspector-label">FONTE</label>
          <input
            type="text"
            value={fontFamily}
            onChange={(event) => update2DData(object, updateObject, { fontFamily: event.target.value })}
            className="w-full inspector-input"
          />
        </div>
        <div className="space-y-1">
          <label className="inspector-label">TAMANHO</label>
          <input
            type="number"
            min="1"
            step="1"
            value={fontSize}
            onChange={(event) => update2DData(object, updateObject, { fontSize: parseFloat(event.target.value) || 16 })}
            className="w-full inspector-input text-right"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="inspector-label">COR</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(event) => update2DData(object, updateObject, { color: event.target.value })}
          />
          <input
            type="text"
            value={color}
            onChange={(event) => update2DData(object, updateObject, { color: event.target.value })}
            className="flex-1 inspector-input font-mono"
          />
        </div>
      </div>

      <PropertyRow label="Depth" value={depth.toFixed(0)}>
        <input
          type="range"
          min="-100"
          max="200"
          step="1"
          value={depth}
          onChange={(event) => update2DData(object, updateObject, { depth: parseFloat(event.target.value) || 0 })}
          className="w-full"
        />
      </PropertyRow>
    </div>
  );
};

// ============================================
// VISUAL SECTION
// ============================================
interface VisualSectionProps {
  object: SceneObject;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
}

const VisualSection = ({ object, updateObject }: VisualSectionProps) => {
  const visual = object.visualSettings || {
    textureUrl: '',
    textureRepeat: [1, 1],
    textureOffset: [0, 0],
    textureRotation: 0,
    textureFlipY: false,
    textureAutoScale: true,
    textureFilter: undefined,
    opacity: 1,
    metalness: 0.3,
    roughness: 0.5,
    emissiveIntensity: 0,
    wireframe: false,
    castShadow: true,
    receiveShadow: false,
  };

  const updateVisual = (updates: Partial<VisualSettings>) => {
    updateObject(object.id, { 
      visualSettings: { ...visual, ...updates } 
    });
  };

  return (
    <div className="space-y-3">
      {/* Color */}
      <div className="space-y-1">
        <label className="inspector-label">COR</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={object.color}
            onChange={(e) => updateObject(object.id, { color: e.target.value })}
          />
          <input
            type="text"
            value={object.color}
            onChange={(e) => updateObject(object.id, { color: e.target.value })}
            className="flex-1 inspector-input font-mono"
          />
        </div>
      </div>

      {/* Texture Picker */}
      <TexturePicker
        value={visual.textureUrl || ''}
        onChange={(url) => updateVisual({ textureUrl: url })}
        label="Textura"
        placeholder="Selecione uma textura"
      />

      {/* Tiling */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="inspector-label">TILING X</label>
          <input
            type="number"
            step="0.1"
            min="0.01"
            value={(visual.textureRepeat?.[0] ?? 1).toFixed(2)}
            onChange={(e) => {
              const x = Math.max(0.01, parseFloat(e.target.value) || 1);
              updateVisual({ textureRepeat: [x, visual.textureRepeat?.[1] ?? 1] });
            }}
            className="w-full inspector-input text-right"
          />
        </div>
        <div className="space-y-1">
          <label className="inspector-label">TILING Y</label>
          <input
            type="number"
            step="0.1"
            min="0.01"
            value={(visual.textureRepeat?.[1] ?? 1).toFixed(2)}
            onChange={(e) => {
              const y = Math.max(0.01, parseFloat(e.target.value) || 1);
              updateVisual({ textureRepeat: [visual.textureRepeat?.[0] ?? 1, y] });
            }}
            className="w-full inspector-input text-right"
          />
        </div>
      </div>

      {/* Offset & rotation */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="inspector-label">OFFSET X</label>
          <input
            type="number"
            step="0.05"
            value={(visual.textureOffset?.[0] ?? 0).toFixed(2)}
            onChange={(e) => {
              const x = parseFloat(e.target.value) || 0;
              updateVisual({ textureOffset: [x, visual.textureOffset?.[1] ?? 0] });
            }}
            className="w-full inspector-input text-right"
          />
        </div>
        <div className="space-y-1">
          <label className="inspector-label">OFFSET Y</label>
          <input
            type="number"
            step="0.05"
            value={(visual.textureOffset?.[1] ?? 0).toFixed(2)}
            onChange={(e) => {
              const y = parseFloat(e.target.value) || 0;
              updateVisual({ textureOffset: [visual.textureOffset?.[0] ?? 0, y] });
            }}
            className="w-full inspector-input text-right"
          />
        </div>
      </div>

      <PropertyRow label="Rotação" value={`${(((visual.textureRotation ?? 0) * 180) / Math.PI).toFixed(0)}°`}>
        <input
          type="range"
          min={-Math.PI}
          max={Math.PI}
          step={Math.PI / 180}
          value={visual.textureRotation ?? 0}
          onChange={(e) => updateVisual({ textureRotation: parseFloat(e.target.value) })}
          className="w-full"
        />
      </PropertyRow>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Flip Y</span>
        <ToggleSwitch
          checked={visual.textureFlipY ?? false}
          onChange={(v) => updateVisual({ textureFlipY: v })}
        />
      </div>

      {/* Filtering */}
      <div className="space-y-1">
        <label className="inspector-label">FILTRO</label>
        <select
          value={visual.textureFilter ?? 'inherit'}
          onChange={(e) => {
            const val = e.target.value as VisualSettings['textureFilter'] | 'inherit';
            updateVisual({ textureFilter: val === 'inherit' ? undefined : val });
          }}
          className="w-full inspector-input"
        >
          <option value="inherit">Padrão global</option>
          <option value="nearest">Nearest (pixelado)</option>
          <option value="bilinear">Bilinear</option>
          <option value="trilinear">Trilinear (suave)</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Auto escalar tiling</span>
        <ToggleSwitch
          checked={visual.textureAutoScale !== false}
          onChange={(v) => updateVisual({ textureAutoScale: v })}
        />
      </div>

      <PropertyRow label="Opacidade" value={`${(visual.opacity * 100).toFixed(0)}%`}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={visual.opacity}
          onChange={(e) => updateVisual({ opacity: parseFloat(e.target.value) })}
          className="w-full"
        />
      </PropertyRow>

      <PropertyRow label="Metalness" value={`${(visual.metalness * 100).toFixed(0)}%`}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={visual.metalness}
          onChange={(e) => updateVisual({ metalness: parseFloat(e.target.value) })}
          className="w-full"
        />
      </PropertyRow>

      <PropertyRow label="Roughness" value={`${(visual.roughness * 100).toFixed(0)}%`}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={visual.roughness}
          onChange={(e) => updateVisual({ roughness: parseFloat(e.target.value) })}
          className="w-full"
        />
      </PropertyRow>

      <PropertyRow label="Emissivo" value={`${(visual.emissiveIntensity * 100).toFixed(0)}%`}>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={visual.emissiveIntensity}
          onChange={(e) => updateVisual({ emissiveIntensity: parseFloat(e.target.value) })}
          className="w-full"
        />
      </PropertyRow>

      <div className="pt-2 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Wireframe</span>
          <ToggleSwitch checked={visual.wireframe} onChange={(v) => updateVisual({ wireframe: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Projeta Sombra</span>
          <ToggleSwitch checked={visual.castShadow} onChange={(v) => updateVisual({ castShadow: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Recebe Sombra</span>
          <ToggleSwitch checked={visual.receiveShadow} onChange={(v) => updateVisual({ receiveShadow: v })} />
        </div>
      </div>
    </div>
  );
};

// ============================================
// PHYSICS SECTION
// ============================================
interface PhysicsSectionProps {
  object: SceneObject;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
}

const BODY_TYPES: { value: PhysicsBodyType; label: string }[] = [
  { value: 'fixed', label: 'Fixo (Estático)' },
  { value: 'dynamic', label: 'Dinâmico' },
  { value: 'kinematic', label: 'Cinemático' },
];

const COLLIDER_SHAPES: { value: ColliderShape; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'cuboid', label: 'Cubo' },
  { value: 'ball', label: 'Esfera' },
  { value: 'hull', label: 'Convex Hull' },
  { value: 'capsule', label: 'Cápsula' },
  { value: 'trimesh', label: 'Trimesh' },
];

const PhysicsSection = ({ object, updateObject }: PhysicsSectionProps) => {
  const physics = object.physicsSettings || {
    bodyType: 'dynamic',
    colliderShape: 'auto',
    mass: 1,
    restitution: 0.3,
    friction: 0.5,
    linearDamping: 0,
    angularDamping: 0.1,
    isSensor: false,
  };

  const updatePhysics = (updates: Partial<PhysicsSettings>) => {
    updateObject(object.id, { 
      physicsSettings: { ...physics, ...updates } 
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="inspector-label">TIPO DE CORPO</label>
        <select
          value={physics.bodyType}
          onChange={(e) => updatePhysics({ bodyType: e.target.value as PhysicsBodyType })}
          className="w-full inspector-input"
        >
          {BODY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="inspector-label">COLISOR</label>
        <select
          value={physics.colliderShape}
          onChange={(e) => updatePhysics({ colliderShape: e.target.value as ColliderShape })}
          className="w-full inspector-input"
        >
          {COLLIDER_SHAPES.map((shape) => (
            <option key={shape.value} value={shape.value}>{shape.label}</option>
          ))}
        </select>
      </div>

      {physics.bodyType === 'dynamic' && (
        <PropertyRow label="Massa" value={`${physics.mass.toFixed(1)} kg`}>
          <input
            type="range"
            min="0.1"
            max="100"
            step="0.1"
            value={physics.mass}
            onChange={(e) => updatePhysics({ mass: parseFloat(e.target.value) })}
            className="w-full"
          />
        </PropertyRow>
      )}

      <PropertyRow label="Elasticidade" value={physics.restitution.toFixed(2)}>
        <input
          type="range"
          min="0"
          max="2"
          step="0.05"
          value={physics.restitution}
          onChange={(e) => updatePhysics({ restitution: parseFloat(e.target.value) })}
          className="w-full"
        />
      </PropertyRow>

      <PropertyRow label="Fricção" value={physics.friction.toFixed(2)}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={physics.friction}
          onChange={(e) => updatePhysics({ friction: parseFloat(e.target.value) })}
          className="w-full"
        />
      </PropertyRow>

      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Sensor (Trigger)</span>
          <ToggleSwitch checked={physics.isSensor} onChange={(v) => updatePhysics({ isSensor: v })} />
        </div>
      </div>
    </div>
  );
};

// ============================================
// TAGS SECTION (Simplified Logic)
// ============================================
interface TagsSectionProps {
  object: SceneObject;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
}

const TagsSection = ({ object, updateObject }: TagsSectionProps) => {
  const logic = object.logicSettings || {
    tags: [],
    behavior: 'none',
    behaviorSpeed: 1,
    patrolDistance: 5,
    customData: {},
  };

  const [tagInput, setTagInput] = useState('');

  const updateLogic = (updates: Partial<LogicSettings>) => {
    updateObject(object.id, { 
      logicSettings: { ...logic, ...updates } 
    });
  };

  const addTag = () => {
    if (tagInput.trim() && !logic.tags.includes(tagInput.trim())) {
      updateLogic({ tags: [...logic.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    updateLogic({ tags: logic.tags.filter(t => t !== tag) });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <input
          type="text"
          placeholder="enemy, coin..."
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          className="flex-1 inspector-input"
        />
        <button
          onClick={addTag}
          className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 transition-colors"
        >
          +
        </button>
      </div>
      {logic.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {logic.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/15 text-primary text-[10px] rounded"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-destructive">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// ENTITY SECTION - Game Entity System
// For enemies, NPCs, pickups, destructibles etc.
// This enables swapping placeholders with final assets while keeping mechanics
// ============================================

const ENTITY_TYPES: { value: EntityType; label: string; description: string }[] = [
  { value: 'static', label: 'Estático', description: 'Objeto sem comportamento' },
  { value: 'character', label: 'Personagem', description: 'Inimigo ou NPC com IA' },
  { value: 'projectile', label: 'Projétil', description: 'Projétil de ataque' },
  { value: 'pickup', label: 'Coletável', description: 'Item que pode ser coletado' },
  { value: 'destructible', label: 'Destrutível', description: 'Pode ser destruído' },
  { value: 'trigger', label: 'Gatilho', description: 'Área de trigger invisível' },
];

const ENTITY_TEAMS: { value: EntityTeam; label: string; color: string }[] = [
  { value: 'player', label: 'Jogador', color: 'bg-green-500' },
  { value: 'enemy', label: 'Inimigo', color: 'bg-red-500' },
  { value: 'ally', label: 'Aliado', color: 'bg-blue-500' },
  { value: 'neutral', label: 'Neutro', color: 'bg-gray-500' },
];

const AI_TYPES: { value: string; label: string }[] = [
  { value: 'none', label: 'Nenhum' },
  { value: 'patrol', label: 'Patrulha' },
  { value: 'chase', label: 'Perseguir' },
  { value: 'flee', label: 'Fugir' },
  { value: 'guard', label: 'Guardar' },
  { value: 'follow', label: 'Seguir' },
];

const PICKUP_TYPES: { value: string; label: string }[] = [
  { value: 'health', label: 'Vida' },
  { value: 'ammo', label: 'Munição' },
  { value: 'coin', label: 'Moeda' },
  { value: 'key', label: 'Chave' },
  { value: 'powerup', label: 'Power-Up' },
  { value: 'custom', label: 'Customizado' },
];

interface EntitySectionProps {
  object: SceneObject;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
}

const EntitySection = ({ object, updateObject }: EntitySectionProps) => {
  const [expanded, setExpanded] = useState({
    health: true,
    combat: false,
    ai: false,
    model: false,
    pickup: false,
    death: false,
  });

  const entity = object.entitySettings || DEFAULT_ENTITY_SETTINGS;

  const updateEntity = (updates: Partial<EntitySettings>) => {
    updateObject(object.id, {
      entitySettings: { ...entity, ...updates }
    });
  };

  const toggleSection = (key: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isCharacter = entity.entityType === 'character';
  const isPickup = entity.entityType === 'pickup';
  const isDestructible = entity.entityType === 'destructible' || entity.entityType === 'character';

  return (
    <div className="space-y-3">
      {/* Entity Type */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-muted-foreground">Tipo de Entidade</label>
        <select
          value={entity.entityType}
          onChange={(e) => updateEntity({ entityType: e.target.value as EntityType })}
          className="inspector-input w-full"
        >
          {ENTITY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <p className="text-[9px] text-muted-foreground/70">
          {ENTITY_TYPES.find(t => t.value === entity.entityType)?.description}
        </p>
      </div>

      {/* Team Selection */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-muted-foreground">Time</label>
        <div className="grid grid-cols-4 gap-1">
          {ENTITY_TEAMS.map((team) => (
            <button
              key={team.value}
              onClick={() => updateEntity({ team: team.value })}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded border text-[9px] transition-all',
                entity.team === team.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className={cn('w-3 h-3 rounded-full', team.color)} />
              <span>{team.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Health Section (for characters/destructibles) */}
      {isDestructible && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('health')}
            className="w-full flex items-center justify-between p-2 bg-[var(--editor-panel-header)] text-foreground text-[10px] font-medium"
          >
            <span className="flex items-center gap-2">
              <span className="text-base"></span> Vida e Dano
            </span>
            {expanded.health ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {expanded.health && (
            <div className="p-2 space-y-2 bg-secondary/30">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-muted-foreground">Vida Máxima</label>
                  <input
                    type="number"
                    value={entity.maxHealth}
                    onChange={(e) => updateEntity({ maxHealth: Number(e.target.value), currentHealth: Number(e.target.value) })}
                    className="inspector-input w-full"
                    min="1"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground">Vida Atual</label>
                  <input
                    type="number"
                    value={entity.currentHealth}
                    onChange={(e) => updateEntity({ currentHealth: Number(e.target.value) })}
                    className="inspector-input w-full"
                    min="0"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={entity.isInvulnerable}
                  onChange={(e) => updateEntity({ isInvulnerable: e.target.checked })}
                  className="rounded accent-red-500"
                />
                <span>Invulnerável</span>
              </label>
              {!entity.isInvulnerable && (
                <div>
                  <label className="text-[9px] text-muted-foreground">Duração I-Frames (s)</label>
                  <input
                    type="number"
                    value={entity.invulnerabilityDuration}
                    onChange={(e) => updateEntity({ invulnerabilityDuration: Number(e.target.value) })}
                    className="inspector-input w-full"
                    min="0"
                    step="0.1"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Combat Section (for enemies) */}
      {isCharacter && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('combat')}
            className="w-full flex items-center justify-between p-2 bg-[var(--editor-panel-header)] text-foreground text-[10px] font-medium"
          >
            <span className="flex items-center gap-2">
              <span className="text-base"></span> Combate
            </span>
            {expanded.combat ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {expanded.combat && (
            <div className="p-2 space-y-2 bg-secondary/30">
              <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={entity.canDealDamage}
                  onChange={(e) => updateEntity({ canDealDamage: e.target.checked })}
                  className="rounded accent-orange-500"
                />
                <span>Causa Dano</span>
              </label>
              {entity.canDealDamage && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-muted-foreground">Dano por Contato</label>
                    <input
                      type="number"
                      value={entity.contactDamage}
                      onChange={(e) => updateEntity({ contactDamage: Number(e.target.value) })}
                      className="inspector-input w-full"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Resist. Knockback</label>
                    <input
                      type="number"
                      value={entity.knockbackResistance}
                      onChange={(e) => updateEntity({ knockbackResistance: Number(e.target.value) })}
                      className="inspector-input w-full"
                      min="0"
                      max="1"
                      step="0.1"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Section (for characters) */}
      {isCharacter && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('ai')}
            className="w-full flex items-center justify-between p-2 bg-[var(--editor-panel-header)] text-foreground text-[10px] font-medium"
          >
            <span className="flex items-center gap-2">
              <Brain className="w-3 h-3" /> Inteligência Artificial
            </span>
            {expanded.ai ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {expanded.ai && (
            <div className="p-2 space-y-2 bg-secondary/30">
              <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={entity.aiEnabled}
                  onChange={(e) => updateEntity({ aiEnabled: e.target.checked })}
                  className="rounded accent-purple-500"
                />
                <span>IA Ativa</span>
              </label>
              {entity.aiEnabled && (
                <>
                  <div>
                    <label className="text-[9px] text-muted-foreground">Tipo de IA</label>
                    <select
                      value={entity.aiType}
                      onChange={(e) => updateEntity({ aiType: e.target.value as EntityAIType })}
                      className="inspector-input w-full"
                    >
                      {AI_TYPES.map((ai) => (
                        <option key={ai.value} value={ai.value}>{ai.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted-foreground">Velocidade</label>
                      <input
                        type="number"
                        value={entity.aiSpeed}
                        onChange={(e) => updateEntity({ aiSpeed: Number(e.target.value) })}
                        className="inspector-input w-full"
                        min="0"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">Alcance Detecção</label>
                      <input
                        type="number"
                        value={entity.aiDetectionRange}
                        onChange={(e) => updateEntity({ aiDetectionRange: Number(e.target.value) })}
                        className="inspector-input w-full"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">Alcance Ataque</label>
                      <input
                        type="number"
                        value={entity.aiAttackRange}
                        onChange={(e) => updateEntity({ aiAttackRange: Number(e.target.value) })}
                        className="inspector-input w-full"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground">Cooldown Ataque</label>
                      <input
                        type="number"
                        value={entity.aiAttackCooldown}
                        onChange={(e) => updateEntity({ aiAttackCooldown: Number(e.target.value) })}
                        className="inspector-input w-full"
                        min="0"
                        step="0.1"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Model Offset Section - For aligning 3D models with hitbox */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('model')}
          className="w-full flex items-center justify-between p-2 bg-[var(--editor-panel-header)] text-foreground text-[10px] font-medium"
        >
          <span className="flex items-center gap-2">
            <Box className="w-3 h-3" /> Modelo 3D (Offset)
          </span>
          {expanded.model ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        {expanded.model && (
          <div className="p-2 space-y-2 bg-secondary/30">
            <p className="text-[9px] text-muted-foreground/70 mb-2">
              Ajuste o modelo 3D para alinhar com a hitbox do placeholder
            </p>
            <div>
              <label className="text-[9px] text-muted-foreground">Escala do Modelo</label>
              <input
                type="number"
                value={entity.modelScale}
                onChange={(e) => updateEntity({ modelScale: Number(e.target.value) })}
                className="inspector-input w-full"
                min="0.1"
                step="0.1"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground">Offset Posição (X, Y, Z)</label>
              <div className="grid grid-cols-3 gap-1">
                {['X', 'Y', 'Z'].map((axis, i) => (
                  <input
                    key={axis}
                    type="number"
                    value={entity.modelOffset[i]}
                    onChange={(e) => {
                      const newOffset = [...entity.modelOffset] as [number, number, number];
                      newOffset[i] = Number(e.target.value);
                      updateEntity({ modelOffset: newOffset });
                    }}
                    className="inspector-input w-full text-center"
                    step="0.1"
                    placeholder={axis}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground">Offset Rotação (X, Y, Z)</label>
              <div className="grid grid-cols-3 gap-1">
                {['X', 'Y', 'Z'].map((axis, i) => (
                  <input
                    key={axis}
                    type="number"
                    value={(entity.modelRotationOffset[i] * 180 / Math.PI).toFixed(1)}
                    onChange={(e) => {
                      const newRot = [...entity.modelRotationOffset] as [number, number, number];
                      newRot[i] = Number(e.target.value) * Math.PI / 180;
                      updateEntity({ modelRotationOffset: newRot });
                    }}
                    className="inspector-input w-full text-center"
                    step="15"
                    placeholder={axis}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground">Escala Hitbox (X, Y, Z)</label>
              <div className="grid grid-cols-3 gap-1">
                {['X', 'Y', 'Z'].map((axis, i) => (
                  <input
                    key={axis}
                    type="number"
                    value={entity.hitboxScale[i]}
                    onChange={(e) => {
                      const newScale = [...entity.hitboxScale] as [number, number, number];
                      newScale[i] = Number(e.target.value);
                      updateEntity({ hitboxScale: newScale });
                    }}
                    className="inspector-input w-full text-center"
                    step="0.1"
                    min="0.1"
                    placeholder={axis}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pickup Section */}
      {isPickup && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('pickup')}
            className="w-full flex items-center justify-between p-2 bg-[var(--editor-panel-header)] text-foreground text-[10px] font-medium"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">⭐</span> Coletável
            </span>
            {expanded.pickup ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {expanded.pickup && (
            <div className="p-2 space-y-2 bg-secondary/30">
              <div>
                <label className="text-[9px] text-muted-foreground">Tipo</label>
                <select
                  value={entity.pickupType || 'coin'}
                  onChange={(e) => updateEntity({ pickupType: e.target.value as EntityPickupType })}
                  className="inspector-input w-full"
                >
                  {PICKUP_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground">Valor</label>
                <input
                  type="number"
                  value={entity.pickupValue ?? 1}
                  onChange={(e) => updateEntity({ pickupValue: Number(e.target.value) })}
                  className="inspector-input w-full"
                  min="0"
                />
              </div>
              <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={entity.pickupRespawns ?? false}
                  onChange={(e) => updateEntity({ pickupRespawns: e.target.checked })}
                  className="rounded accent-yellow-500"
                />
                <span>Reaparece</span>
              </label>
              {entity.pickupRespawns && (
                <div>
                  <label className="text-[9px] text-muted-foreground">Tempo (s)</label>
                  <input
                    type="number"
                    value={entity.pickupRespawnTime ?? 5}
                    onChange={(e) => updateEntity({ pickupRespawnTime: Number(e.target.value) })}
                    className="inspector-input w-full"
                    min="0"
                    step="0.5"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Death/Destruction Section */}
      {isDestructible && (
        <div className="border border-gray-500/30 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('death')}
            className="w-full flex items-center justify-between p-2 bg-gray-500/10 text-gray-400 text-[10px] font-medium"
          >
            <span className="flex items-center gap-2">
              <span className="text-base"></span> Morte/Destruição
            </span>
            {expanded.death ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {expanded.death && (
            <div className="p-2 space-y-2 bg-gray-500/5">
              <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={entity.destroyOnDeath}
                  onChange={(e) => updateEntity({ destroyOnDeath: e.target.checked })}
                  className="rounded accent-gray-500"
                />
                <span>Destruir ao Morrer</span>
              </label>
              <div>
                <label className="text-[9px] text-muted-foreground">Som de Morte (URL)</label>
                <input
                  type="text"
                  value={entity.deathSound || ''}
                  onChange={(e) => updateEntity({ deathSound: e.target.value })}
                  className="inspector-input w-full"
                  placeholder="death.mp3"
                />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground">Partícula de Morte</label>
                <select
                  value={entity.deathParticle || ''}
                  onChange={(e) => updateEntity({ deathParticle: e.target.value })}
                  className="inspector-input w-full"
                >
                  <option value="">Nenhum</option>
                  <option value="explosion">Explosão</option>
                  <option value="sparkles">Brilhos</option>
                  <option value="smoke">Fumaça</option>
                  <option value="dust">Poeira</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// AUDIO SECTION
// ============================================
interface AudioSectionProps {
  object: SceneObject;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
}

const AudioSection = ({ object, updateObject }: AudioSectionProps) => {
  const audio = object.audioSettings || {
    volume: 0.8,
    loop: false,
    autoplay: false,
    distance: 50,
    refDistance: 1,
    rolloffFactor: 1,
    url: '',
  };

  const updateAudio = (updates: Partial<AudioSettings>) => {
    updateObject(object.id, {
      audioSettings: { ...audio, ...updates } as AudioSettings
    });
  };

  return (
    <div className="space-y-3">
      <PropertyRow label="URL" value={audio.url ? '' : '—'}>
        <input
          type="text"
          placeholder="URL do arquivo de áudio (mp3, wav, ogg)"
          value={audio.url || ''}
          onChange={(e) => updateAudio({ url: e.target.value })}
          className="w-full inspector-input text-xs"
        />
      </PropertyRow>

      <PropertyRow label="Volume" value={`${(audio.volume * 100).toFixed(0)}%`}>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={audio.volume}
          onChange={(e) => updateAudio({ volume: parseFloat(e.target.value) })}
          className="w-full"
        />
      </PropertyRow>

      <PropertyRow label="Distância" value={`${audio.distance.toFixed(1)}m`}>
        <input
          type="range"
          min="1"
          max="100"
          step="1"
          value={audio.distance}
          onChange={(e) => updateAudio({ distance: parseFloat(e.target.value) })}
          className="w-full"
        />
      </PropertyRow>

      <PropertyRow label="Dist. Ref." value={`${audio.refDistance.toFixed(1)}m`}>
        <input
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={audio.refDistance}
          onChange={(e) => updateAudio({ refDistance: parseFloat(e.target.value) })}
          className="w-full"
        />
      </PropertyRow>

      <PropertyRow label="Rolloff" value={audio.rolloffFactor.toFixed(2)}>
        <input
          type="range"
          min="0"
          max="3"
          step="0.1"
          value={audio.rolloffFactor}
          onChange={(e) => updateAudio({ rolloffFactor: parseFloat(e.target.value) })}
          className="w-full"
        />
      </PropertyRow>

      <div className="space-y-2 border-t border-border pt-2">
        <div className="flex items-center justify-between">
          <label className="inspector-label">LOOP</label>
          <ToggleSwitch
            checked={audio.loop}
            onChange={(v) => updateAudio({ loop: v })}
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="inspector-label">AUTOPLAY</label>
          <ToggleSwitch
            checked={audio.autoplay}
            onChange={(v) => updateAudio({ autoplay: v })}
          />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mt-2">
         Dica: Use URLs públicas de áudio (CORS ativado) ou sirva do mesmo servidor
      </p>
    </div>
  );
};

// ============================================
// CAMERA SETTINGS SECTION
// ============================================
interface CameraSettingsSectionProps {
  cameraSettings: CameraSettings;
  onUpdate: (settings: CameraSettings) => void;
}

const CAMERA_MODES: { value: CameraMode; label: string }[] = [
  { value: 'third-person', label: 'Terceira Pessoa' },
  { value: 'first-person', label: 'Primeira Pessoa' },
  { value: 'side-2d', label: '2.5D Side-Scroll' },
  { value: 'top-down', label: 'Top-Down' },
  { value: 'fixed', label: 'Fixa' },
];

const CameraSettingsSection = ({ cameraSettings, onUpdate }: CameraSettingsSectionProps) => {
  const { objects } = useEditorStore();
  
  const followableObjects = objects.filter(obj => 
    obj.type === 'player' || obj.type === 'box' || obj.type === 'sphere' || obj.type === 'npc'
  );
  
  const updateSetting = <K extends keyof CameraSettings>(key: K, value: CameraSettings[K]) => {
    onUpdate({ ...cameraSettings, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="inspector-label">MODO</label>
        <select
          value={cameraSettings.mode}
          onChange={(e) => updateSetting('mode', e.target.value as CameraMode)}
          className="w-full inspector-input"
        >
          {CAMERA_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>{mode.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="inspector-label">SEGUIR</label>
        <select
          value={cameraSettings.targetId || ''}
          onChange={(e) => updateSetting('targetId', e.target.value || null)}
          className="w-full inspector-input"
        >
          <option value="">Nenhum</option>
          {followableObjects.map((obj) => (
            <option key={obj.id} value={obj.id}>{obj.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {cameraSettings.mode !== 'first-person' && (
          <div className="space-y-1">
            <label className="inspector-label">DISTÂNCIA</label>
            <input
              type="number"
              step="1"
              min="0"
              value={cameraSettings.distance}
              onChange={(e) => updateSetting('distance', parseFloat(e.target.value) || 0)}
              className="w-full inspector-input"
            />
          </div>
        )}
        <div className="space-y-1">
          <label className="inspector-label">ALTURA</label>
          <input
            type="number"
            step="0.5"
            value={cameraSettings.height}
            onChange={(e) => updateSetting('height', parseFloat(e.target.value) || 0)}
            className="w-full inspector-input"
          />
        </div>
      </div>

      <PropertyRow label="FOV" value={`${cameraSettings.fov}°`}>
        <input
          type="range"
          min="30"
          max="120"
          value={cameraSettings.fov}
          onChange={(e) => updateSetting('fov', parseInt(e.target.value))}
          className="w-full"
        />
      </PropertyRow>
    </div>
  );
};

// ============================================
// PLAYER SETTINGS SECTION
// ============================================
interface PlayerSettingsSectionProps {
  playerSettings: PlayerSettings;
  onUpdate: (settings: PlayerSettings) => void;
  objects: SceneObject[];
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
}

const CAMERA_MODE_OPTIONS: { value: CameraMode; label: string; icon: string }[] = [
  { value: 'third-person', label: 'Terceira Pessoa', icon: '' },
  { value: 'first-person', label: 'Primeira Pessoa', icon: '' },
  { value: 'side-2d', label: 'Side-Scroll 2D', icon: '' },
  { value: 'top-down', label: 'Top-Down', icon: '' },
  { value: 'fixed', label: 'Fixa', icon: '' },
];

const GAME_PRESETS: { value: GamePreset; label: string; icon: string; description: string }[] = [
  { value: 'custom', label: 'Personalizado', icon: '', description: 'Configure manualmente' },
  { value: 'third-person-action', label: 'Ação 3ª Pessoa', icon: '', description: 'Estilo Dark Souls/Zelda' },
  { value: 'third-person-shooter', label: 'Shooter 3ª Pessoa', icon: '', description: 'Estilo Gears of War' },
  { value: 'platformer-2d', label: 'Plataforma 2D', icon: '', description: 'Estilo Mario/Celeste' },
  { value: 'platformer-3d', label: 'Plataforma 3D', icon: '', description: 'Estilo Mario 64' },
  { value: 'fps-shooter', label: 'FPS Shooter', icon: '', description: 'Estilo COD/CS' },
  { value: 'fps-horror', label: 'FPS Horror', icon: '', description: 'Estilo Outlast' },
  { value: 'racing-arcade', label: 'Corrida Arcade', icon: '', description: 'Estilo Mario Kart' },
  { value: 'racing-sim', label: 'Corrida Sim', icon: '', description: 'Estilo Forza' },
  { value: 'top-down-rpg', label: 'RPG Top-Down', icon: '', description: 'Estilo Zelda clássico' },
  { value: 'top-down-shooter', label: 'Shooter Top-Down', icon: '', description: 'Estilo Hotline Miami' },
];

const ATTACK_TYPES: { value: 'melee' | 'ranged' | 'stomp' | 'combo'; label: string; icon: string; description: string }[] = [
  { value: 'melee', label: 'Corpo-a-corpo', icon: '', description: 'Espada, soco, martelo' },
  { value: 'ranged', label: 'Ranged (Tiro)', icon: '', description: 'Armas de fogo, arcos' },
  { value: 'stomp', label: 'Pisão (Mario)', icon: '', description: 'Pular na cabeça dos inimigos' },
  { value: 'combo', label: 'Combo', icon: '', description: 'Melee + Ranged' },
];

const MELEE_WEAPONS: { value: string; label: string; icon: string }[] = [
  { value: 'fist', label: 'Punhos', icon: '' },
  { value: 'sword', label: 'Espada', icon: '' },
  { value: 'hammer', label: 'Martelo', icon: '' },
  { value: 'spear', label: 'Lança', icon: '' },
  { value: 'axe', label: 'Machado', icon: '' },
];

const PROJECTILE_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'bullet', label: 'Bala', icon: '' },
  { value: 'arrow', label: 'Flecha', icon: '' },
  { value: 'fireball', label: 'Bola de Fogo', icon: '' },
  { value: 'laser', label: 'Laser', icon: '' },
  { value: 'grenade', label: 'Granada', icon: '' },
];

// Sub-section component for collapsible groups
const SettingsGroup = ({ title, icon, defaultOpen = false, children }: { 
  title: string; 
  icon: string | React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean; 
  children: React.ReactNode 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const Icon = typeof icon === 'string' ? null : icon;
  
  return (
    <div className="border-b border-border/70">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-7 w-full items-center gap-1.5 bg-[var(--editor-panel-header)] px-2 text-left transition-colors hover:bg-secondary/70"
      >
        {isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        {Icon ? (
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <span className="text-[11px] text-muted-foreground">{String(icon)}</span>
        )}
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </button>
      {isOpen && <div className="space-y-2 bg-background px-2 py-2">{children}</div>}
    </div>
  );
};

const PlayerSettingsSection = ({ playerSettings, onUpdate, objects, updateObject }: PlayerSettingsSectionProps) => {
  const updateSetting = <K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]) => {
    onUpdate({ ...playerSettings, [key]: value });
  };
  
  // Find camera object to sync with - look for main-camera or any camera type
  const cameraObject = objects.find(obj => obj.id === 'main-camera' || obj.type === 'camera');
  const cameraId = cameraObject?.id;
  
  // Get camera mode for preset
  const getCameraModeForPreset = (preset: GamePreset): CameraMode => {
    switch (preset) {
      case 'platformer-2d': return 'side-2d';
      case 'fps-shooter':
      case 'fps-horror': return 'first-person';
      case 'top-down-rpg':
      case 'top-down-shooter': return 'top-down';
      case 'racing-arcade':
      case 'racing-sim': return 'third-person';
      default: return 'third-person';
    }
  };
  
  // Get default camera settings for a mode - returns full CameraSettings
  const getDefaultCameraSettingsForMode = (mode: CameraMode, currentSettings?: CameraSettings): CameraSettings => {
    const base: CameraSettings = currentSettings || {
      mode: 'third-person',
      distance: 8,
      height: 4,
      fov: 50,
      followPlayer: true,
      targetId: 'main-player',
      lockedZ: false,
      lockedY: false,
      smoothing: 0.1,
    };
    
    switch (mode) {
      case 'first-person':
        return { ...base, mode, distance: 0, height: 1.6, lockedZ: false, lockedY: false };
      case 'side-2d':
        return { ...base, mode, distance: 25, height: 5, lockedZ: true, lockedY: false };
      case 'top-down':
        return { ...base, mode, distance: 0, height: 20, lockedZ: false, lockedY: true };
      case 'third-person':
      default:
        return { ...base, mode, distance: 8, height: 4, lockedZ: false, lockedY: false };
    }
  };
  
  // When preset changes, apply all preset settings AND update camera
  const applyPreset = (preset: GamePreset) => {
    // Get new camera mode for this preset
    const newCameraMode = getCameraModeForPreset(preset);
    
    // Update camera FIRST (before player settings to avoid stale reference)
    if (cameraId && cameraObject?.cameraSettings) {
      const newCameraSettings = getDefaultCameraSettingsForMode(newCameraMode, cameraObject.cameraSettings);
      updateObject(cameraId, { cameraSettings: newCameraSettings });
    }
    
    // Then update player settings
    const presetSettings = getPresetSettings(preset);
    onUpdate(presetSettings);
  };
  
  // Get preset settings
  const getPresetSettings = (preset: GamePreset): PlayerSettings => {
    const base: PlayerSettings = {
      speed: 5,
      jumpForce: 8,
      gravity: 20,
      maxHealth: 100,
      movementMode: 'free',
      gamePreset: preset,
      canDoubleJump: false,
      doubleJumpForce: 6,
      coyoteTime: 0.15,
      jumpBufferTime: 0.1,
      canSprint: true,
      sprintSpeed: 8,
      sprintStaminaCost: 10,
      maxStamina: 100,
      staminaRegenRate: 15,
      canCrouch: true,
      crouchSpeed: 2.5,
      crouchHeightMultiplier: 0.5,
      canDodge: true,
      dodgeDistance: 4,
      dodgeDuration: 0.3,
      dodgeCooldown: 0.8,
      dodgeInvincibilityFrames: true,
      attackEnabled: true,
      attackType: 'melee',
      attackDamage: 25,
      attackCooldown: 0.5,
      attackRange: 2,
      canWallJump: false,
      canWallSlide: false,
      wallSlideSpeed: 2,
      wallJumpForce: 10,
      canSwim: false,
      swimSpeed: 3,
      airControlMultiplier: 0.7,
      // Melee settings
      meleeWeaponType: 'fist',
      meleeComboEnabled: false,
      meleeComboHits: 3,
      meleeKnockback: 5,
      meleeSweepAngle: 90,
      // Ranged settings
      projectileSpeed: 50,
      projectileGravity: 0,
      projectileSpread: 0,
      projectilesPerShot: 1,
      ammoEnabled: false,
      maxAmmo: 30,
      ammoPerShot: 1,
      reloadTime: 1.5,
      projectileType: 'bullet',
      explosionRadius: 5,
      explosionForce: 20,
      // Stomp settings
      stompEnabled: false,
      stompDamage: 50,
      stompBounceForce: 10,
      stompRequiresDownward: true,
    };
    
    switch (preset) {
      case 'third-person-action':
        return { ...base, movementMode: 'free', speed: 5, sprintSpeed: 9, attackDamage: 30, attackRange: 2.5 };
      case 'third-person-shooter':
        return { ...base, movementMode: 'free', speed: 4, sprintSpeed: 7, attackType: 'ranged', attackDamage: 15, attackRange: 50, attackCooldown: 0.1 };
      case 'platformer-2d':
        return { ...base, movementMode: '2d-sidescroll', speed: 7, jumpForce: 14, canDoubleJump: true, doubleJumpForce: 10, canWallJump: true, canWallSlide: true, canSprint: false, canCrouch: false, airControlMultiplier: 0.9 };
      case 'platformer-3d':
        return { ...base, movementMode: 'free', speed: 6, sprintSpeed: 10, jumpForce: 12, canDoubleJump: true, doubleJumpForce: 8, canDodge: false, airControlMultiplier: 0.8 };
      case 'fps-shooter':
        return { ...base, movementMode: 'free', speed: 5, sprintSpeed: 8, jumpForce: 6, attackType: 'ranged', attackDamage: 20, attackRange: 100, attackCooldown: 0.08, canDodge: false };
      case 'fps-horror':
        return { ...base, movementMode: 'free', speed: 3, sprintSpeed: 5, maxStamina: 60, sprintStaminaCost: 20, jumpForce: 4, attackEnabled: false, canDodge: false };
      case 'racing-arcade':
      case 'racing-sim':
        return { ...base, movementMode: 'free', speed: 0, jumpForce: 0, canSprint: false, canDodge: false, canCrouch: false, attackEnabled: false };
      case 'top-down-rpg':
        return { ...base, movementMode: 'top-down', speed: 5, jumpForce: 0, attackType: 'combo', canCrouch: false };
      case 'top-down-shooter':
        return { ...base, movementMode: 'top-down', speed: 6, sprintSpeed: 9, jumpForce: 0, attackType: 'ranged', attackDamage: 15, attackCooldown: 0.15, canCrouch: false };
      default:
        return base;
    }
  };
  
  // Check if it's a racing preset
  const isRacing = playerSettings.gamePreset === 'racing-arcade' || playerSettings.gamePreset === 'racing-sim';

  const currentPreset = GAME_PRESETS.find(p => p.value === playerSettings.gamePreset) || GAME_PRESETS[0];

  return (
    <div className="space-y-0">
      {/* Preset Selector */}
      <div className="border-b border-border/70 bg-background px-2 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Gamepad2 className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="text-[11px] font-medium text-muted-foreground">Preset de jogo</div>
          <div className="ml-auto max-w-[180px] truncate text-[10px] text-muted-foreground/80">{currentPreset.description}</div>
        </div>
        <select
          value={playerSettings.gamePreset || 'custom'}
          onChange={(e) => applyPreset(e.target.value as GamePreset)}
          className="glass-select text-xs font-medium"
        >
          {GAME_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {/* Camera Mode Indicator - Shows current mode, edit in Main Camera */}
      {cameraObject && (
        <div className="border-b border-border/70 bg-[var(--editor-panel-header)] px-2 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-medium">Câmera Atual:</span>
            <span className="text-[11px] font-semibold flex items-center gap-1.5 text-foreground">
              {CAMERA_MODE_OPTIONS.find(m => m.value === cameraObject.cameraSettings?.mode)?.label || 'Terceira Pessoa'}
            </span>
          </div>
          <div className="mt-1 text-[9px] text-muted-foreground/70">
            Selecione Main Camera na hierarquia para ajuste fino
          </div>
        </div>
      )}

      {/* Core Stats */}
      <SettingsGroup title="Movimento Base" icon={Move} defaultOpen>
        <PropertyRow label="Velocidade" value={playerSettings.speed?.toFixed(1) || '5'}>
          <input type="range" min="1" max="20" step="0.5" value={playerSettings.speed || 5}
            onChange={(e) => updateSetting('speed', parseFloat(e.target.value))} className="w-full" />
        </PropertyRow>
        
        <PropertyRow label="Força do Pulo" value={playerSettings.jumpForce?.toFixed(1) || '8'}>
          <input type="range" min="0" max="20" step="0.5" value={playerSettings.jumpForce || 8}
            onChange={(e) => updateSetting('jumpForce', parseFloat(e.target.value))} className="w-full" />
        </PropertyRow>
        
        <PropertyRow label="Vida Máxima" value={`${playerSettings.maxHealth || 100} HP`}>
          <input type="range" min="10" max="500" step="10" value={playerSettings.maxHealth || 100}
            onChange={(e) => updateSetting('maxHealth', parseFloat(e.target.value))} className="w-full" />
        </PropertyRow>
        
        <PropertyRow label="Controle no Ar" value={`${Math.round((playerSettings.airControlMultiplier || 0.7) * 100)}%`}>
          <input type="range" min="0" max="1" step="0.05" value={playerSettings.airControlMultiplier || 0.7}
            onChange={(e) => updateSetting('airControlMultiplier', parseFloat(e.target.value))} className="w-full" />
        </PropertyRow>
      </SettingsGroup>

      {/* Jump Settings */}
      <SettingsGroup title="Pulo" icon={Zap}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Pulo Duplo</span>
          <ToggleSwitch checked={playerSettings.canDoubleJump || false} onChange={(v) => updateSetting('canDoubleJump', v)} />
        </div>
        
        {playerSettings.canDoubleJump && (
          <PropertyRow label="Força Pulo Duplo" value={(playerSettings.doubleJumpForce || 6).toFixed(1)}>
            <input type="range" min="1" max="15" step="0.5" value={playerSettings.doubleJumpForce || 6}
              onChange={(e) => updateSetting('doubleJumpForce', parseFloat(e.target.value))} className="w-full" />
          </PropertyRow>
        )}
        
        <PropertyRow label="Coyote Time" value={`${((playerSettings.coyoteTime || 0.15) * 1000).toFixed(0)}ms`}>
          <input type="range" min="0" max="0.3" step="0.01" value={playerSettings.coyoteTime || 0.15}
            onChange={(e) => updateSetting('coyoteTime', parseFloat(e.target.value))} className="w-full" />
        </PropertyRow>
        
        <PropertyRow label="Jump Buffer" value={`${((playerSettings.jumpBufferTime || 0.1) * 1000).toFixed(0)}ms`}>
          <input type="range" min="0" max="0.3" step="0.01" value={playerSettings.jumpBufferTime || 0.1}
            onChange={(e) => updateSetting('jumpBufferTime', parseFloat(e.target.value))} className="w-full" />
        </PropertyRow>
      </SettingsGroup>

      {/* Sprint Settings */}
      <SettingsGroup title="Corrida (Sprint)" icon={Zap}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Pode Correr</span>
          <ToggleSwitch checked={playerSettings.canSprint ?? true} onChange={(v) => updateSetting('canSprint', v)} />
        </div>
        
        {playerSettings.canSprint !== false && (
          <>
            <PropertyRow label="Velocidade Sprint" value={(playerSettings.sprintSpeed || 8).toFixed(1)}>
              <input type="range" min="1" max="25" step="0.5" value={playerSettings.sprintSpeed || 8}
                onChange={(e) => updateSetting('sprintSpeed', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>
            
            <PropertyRow label="Stamina Máxima" value={(playerSettings.maxStamina || 100).toFixed(0)}>
              <input type="range" min="20" max="200" step="10" value={playerSettings.maxStamina || 100}
                onChange={(e) => updateSetting('maxStamina', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>
            
            <PropertyRow label="Custo/segundo" value={(playerSettings.sprintStaminaCost || 10).toFixed(0)}>
              <input type="range" min="5" max="50" step="5" value={playerSettings.sprintStaminaCost || 10}
                onChange={(e) => updateSetting('sprintStaminaCost', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>
          </>
        )}
      </SettingsGroup>

      {/* Crouch Settings */}
      <SettingsGroup title="Agachamento" icon={User}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Pode Agachar</span>
          <ToggleSwitch checked={playerSettings.canCrouch ?? true} onChange={(v) => updateSetting('canCrouch', v)} />
        </div>
        
        {playerSettings.canCrouch !== false && (
          <>
            <PropertyRow label="Velocidade Agachado" value={(playerSettings.crouchSpeed || 2.5).toFixed(1)}>
              <input type="range" min="0.5" max="5" step="0.25" value={playerSettings.crouchSpeed || 2.5}
                onChange={(e) => updateSetting('crouchSpeed', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>
            
            <PropertyRow label="Altura" value={`${Math.round((playerSettings.crouchHeightMultiplier || 0.5) * 100)}%`}>
              <input type="range" min="0.3" max="0.8" step="0.05" value={playerSettings.crouchHeightMultiplier || 0.5}
                onChange={(e) => updateSetting('crouchHeightMultiplier', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>
          </>
        )}
      </SettingsGroup>

      {/* Dodge Settings */}
      <SettingsGroup title="Esquiva/Dash" icon={Zap}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Pode Esquivar</span>
          <ToggleSwitch checked={playerSettings.canDodge ?? true} onChange={(v) => updateSetting('canDodge', v)} />
        </div>
        
        {playerSettings.canDodge !== false && (
          <>
            <PropertyRow label="Distância" value={`${(playerSettings.dodgeDistance || 4).toFixed(1)}m`}>
              <input type="range" min="1" max="10" step="0.5" value={playerSettings.dodgeDistance || 4}
                onChange={(e) => updateSetting('dodgeDistance', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>
            
            <PropertyRow label="Duração" value={`${((playerSettings.dodgeDuration || 0.3) * 1000).toFixed(0)}ms`}>
              <input type="range" min="0.1" max="0.8" step="0.05" value={playerSettings.dodgeDuration || 0.3}
                onChange={(e) => updateSetting('dodgeDuration', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>
            
            <PropertyRow label="Cooldown" value={`${(playerSettings.dodgeCooldown || 0.8).toFixed(2)}s`}>
              <input type="range" min="0.2" max="3" step="0.1" value={playerSettings.dodgeCooldown || 0.8}
                onChange={(e) => updateSetting('dodgeCooldown', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Invencibilidade</span>
              <ToggleSwitch checked={playerSettings.dodgeInvincibilityFrames ?? true} 
                onChange={(v) => updateSetting('dodgeInvincibilityFrames', v)} />
            </div>
          </>
        )}
      </SettingsGroup>

      {/* Attack Settings */}
      <SettingsGroup title="Ataque" icon={Target}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Ataque Ativado</span>
          <ToggleSwitch checked={playerSettings.attackEnabled ?? true} onChange={(v) => updateSetting('attackEnabled', v)} />
        </div>
        
        {playerSettings.attackEnabled !== false && (
          <>
            {/* Attack Type Selection */}
            <div className="space-y-1">
              <label className="inspector-label">TIPO DE ATAQUE</label>
              <div className="grid grid-cols-2 gap-1">
                {ATTACK_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => updateSetting('attackType', type.value)}
                    className={`p-2 rounded-md text-xs flex flex-col items-start gap-1 transition-colors ${
                      playerSettings.attackType === type.value 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-secondary/50 hover:bg-secondary'
                    }`}
                  >
                    <span className="font-medium">{type.label}</span>
                    <span className="text-[10px] opacity-70">{type.description}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Base Attack Settings */}
            <PropertyRow label="Dano Base" value={(playerSettings.attackDamage || 25).toFixed(0)}>
              <input type="range" min="1" max="200" step="1" value={playerSettings.attackDamage || 25}
                onChange={(e) => updateSetting('attackDamage', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>
            
            <PropertyRow label="Cooldown" value={`${(playerSettings.attackCooldown || 0.5).toFixed(2)}s`}>
              <input type="range" min="0.01" max="3" step="0.01" value={playerSettings.attackCooldown || 0.5}
                onChange={(e) => updateSetting('attackCooldown', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>

            {/* ========== MELEE SETTINGS ========== */}
            {(playerSettings.attackType === 'melee' || playerSettings.attackType === 'combo') && (
              <div className="space-y-2 rounded-sm border border-border bg-secondary/25 p-2">
                <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                  Combate corpo-a-corpo
                </div>
                
                <div className="space-y-1">
                  <label className="inspector-label">ARMA</label>
                  <select value={playerSettings.meleeWeaponType || 'fist'}
                    onChange={(e) => updateSetting('meleeWeaponType', e.target.value as 'fist' | 'sword' | 'hammer' | 'spear' | 'axe')}
                    className="w-full inspector-input">
                    {MELEE_WEAPONS.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
                
                <PropertyRow label="Alcance" value={`${(playerSettings.attackRange || 2).toFixed(1)}m`}>
                  <input type="range" min="0.5" max="5" step="0.1" value={playerSettings.attackRange || 2}
                    onChange={(e) => updateSetting('attackRange', parseFloat(e.target.value))} className="w-full" />
                </PropertyRow>
                
                <PropertyRow label="Knockback" value={(playerSettings.meleeKnockback || 5).toFixed(1)}>
                  <input type="range" min="0" max="20" step="0.5" value={playerSettings.meleeKnockback || 5}
                    onChange={(e) => updateSetting('meleeKnockback', parseFloat(e.target.value))} className="w-full" />
                </PropertyRow>
                
                <PropertyRow label="Ângulo Sweep" value={`${(playerSettings.meleeSweepAngle || 90).toFixed(0)}°`}>
                  <input type="range" min="30" max="360" step="10" value={playerSettings.meleeSweepAngle || 90}
                    onChange={(e) => updateSetting('meleeSweepAngle', parseFloat(e.target.value))} className="w-full" />
                </PropertyRow>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Combo Ativado</span>
                  <ToggleSwitch checked={playerSettings.meleeComboEnabled ?? false} 
                    onChange={(v) => updateSetting('meleeComboEnabled', v)} />
                </div>
                
                {playerSettings.meleeComboEnabled && (
                  <PropertyRow label="Hits no Combo" value={(playerSettings.meleeComboHits || 3).toFixed(0)}>
                    <input type="range" min="2" max="8" step="1" value={playerSettings.meleeComboHits || 3}
                      onChange={(e) => updateSetting('meleeComboHits', parseFloat(e.target.value))} className="w-full" />
                  </PropertyRow>
                )}
              </div>
            )}

            {/* ========== RANGED SETTINGS ========== */}
            {(playerSettings.attackType === 'ranged' || playerSettings.attackType === 'combo') && (
              <div className="space-y-2 rounded-sm border border-border bg-secondary/25 p-2">
                <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                  Ataque a distancia
                </div>
                
                <div className="space-y-1">
                  <label className="inspector-label">TIPO DE PROJÉTIL</label>
                  <select value={playerSettings.projectileType || 'bullet'}
                    onChange={(e) => updateSetting('projectileType', e.target.value as 'bullet' | 'arrow' | 'fireball' | 'laser' | 'grenade')}
                    className="w-full inspector-input">
                    {PROJECTILE_TYPES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                
                <PropertyRow label="Alcance" value={`${(playerSettings.attackRange || 50).toFixed(0)}m`}>
                  <input type="range" min="5" max="200" step="5" value={playerSettings.attackRange || 50}
                    onChange={(e) => updateSetting('attackRange', parseFloat(e.target.value))} className="w-full" />
                </PropertyRow>
                
                <PropertyRow label="Velocidade" value={(playerSettings.projectileSpeed || 50).toFixed(0)}>
                  <input type="range" min="10" max="200" step="5" value={playerSettings.projectileSpeed || 50}
                    onChange={(e) => updateSetting('projectileSpeed', parseFloat(e.target.value))} className="w-full" />
                </PropertyRow>
                
                <PropertyRow label="Gravidade" value={(playerSettings.projectileGravity || 0).toFixed(2)}>
                  <input type="range" min="0" max="1" step="0.05" value={playerSettings.projectileGravity || 0}
                    onChange={(e) => updateSetting('projectileGravity', parseFloat(e.target.value))} className="w-full" />
                </PropertyRow>
                
                <PropertyRow label="Spread" value={`${(playerSettings.projectileSpread || 0).toFixed(0)}°`}>
                  <input type="range" min="0" max="30" step="1" value={playerSettings.projectileSpread || 0}
                    onChange={(e) => updateSetting('projectileSpread', parseFloat(e.target.value))} className="w-full" />
                </PropertyRow>
                
                <PropertyRow label="Projéteis/Tiro" value={(playerSettings.projectilesPerShot || 1).toFixed(0)}>
                  <input type="range" min="1" max="12" step="1" value={playerSettings.projectilesPerShot || 1}
                    onChange={(e) => updateSetting('projectilesPerShot', parseFloat(e.target.value))} className="w-full" />
                </PropertyRow>
                
                {/* Explosion settings for grenades */}
                {playerSettings.projectileType === 'grenade' && (
                  <>
                    <PropertyRow label="Raio Explosão" value={`${(playerSettings.explosionRadius || 5).toFixed(1)}m`}>
                      <input type="range" min="1" max="20" step="0.5" value={playerSettings.explosionRadius || 5}
                        onChange={(e) => updateSetting('explosionRadius', parseFloat(e.target.value))} className="w-full" />
                    </PropertyRow>
                    
                    <PropertyRow label="Força Explosão" value={(playerSettings.explosionForce || 20).toFixed(0)}>
                      <input type="range" min="5" max="100" step="5" value={playerSettings.explosionForce || 20}
                        onChange={(e) => updateSetting('explosionForce', parseFloat(e.target.value))} className="w-full" />
                    </PropertyRow>
                  </>
                )}
                
                {/* Ammo Settings */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                  <span className="text-xs text-muted-foreground">Sistema de Munição</span>
                  <ToggleSwitch checked={playerSettings.ammoEnabled ?? false} 
                    onChange={(v) => updateSetting('ammoEnabled', v)} />
                </div>
                
                {playerSettings.ammoEnabled && (
                  <>
                    <PropertyRow label="Munição Máx" value={(playerSettings.maxAmmo || 30).toFixed(0)}>
                      <input type="range" min="1" max="200" step="1" value={playerSettings.maxAmmo || 30}
                        onChange={(e) => updateSetting('maxAmmo', parseFloat(e.target.value))} className="w-full" />
                    </PropertyRow>
                    
                    <PropertyRow label="Munição/Tiro" value={(playerSettings.ammoPerShot || 1).toFixed(0)}>
                      <input type="range" min="1" max="10" step="1" value={playerSettings.ammoPerShot || 1}
                        onChange={(e) => updateSetting('ammoPerShot', parseFloat(e.target.value))} className="w-full" />
                    </PropertyRow>
                    
                    <PropertyRow label="Tempo Recarga" value={`${(playerSettings.reloadTime || 1.5).toFixed(1)}s`}>
                      <input type="range" min="0.5" max="5" step="0.1" value={playerSettings.reloadTime || 1.5}
                        onChange={(e) => updateSetting('reloadTime', parseFloat(e.target.value))} className="w-full" />
                    </PropertyRow>
                  </>
                )}
              </div>
            )}

            {/* ========== STOMP SETTINGS (Mario-style) ========== */}
            {playerSettings.attackType === 'stomp' && (
              <div className="space-y-2 rounded-sm border border-border bg-secondary/25 p-2">
                <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                  Ataque pisao
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Stomp Ativado</span>
                  <ToggleSwitch checked={playerSettings.stompEnabled ?? true} 
                    onChange={(v) => updateSetting('stompEnabled', v)} />
                </div>
                
                <PropertyRow label="Dano Pisão" value={(playerSettings.stompDamage || 50).toFixed(0)}>
                  <input type="range" min="10" max="500" step="10" value={playerSettings.stompDamage || 50}
                    onChange={(e) => updateSetting('stompDamage', parseFloat(e.target.value))} className="w-full" />
                </PropertyRow>
                
                <PropertyRow label="Força do Bounce" value={(playerSettings.stompBounceForce || 10).toFixed(1)}>
                  <input type="range" min="5" max="25" step="0.5" value={playerSettings.stompBounceForce || 10}
                    onChange={(e) => updateSetting('stompBounceForce', parseFloat(e.target.value))} className="w-full" />
                </PropertyRow>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Só funciona caindo</span>
                  <ToggleSwitch checked={playerSettings.stompRequiresDownward ?? true} 
                    onChange={(v) => updateSetting('stompRequiresDownward', v)} />
                </div>
                
                <div className="rounded-sm bg-secondary/30 p-2 text-[10px] text-muted-foreground">
                  <strong>Como funciona:</strong> Pule em cima dos inimigos.
                  Quando você pousar na cabeça de um inimigo, causa dano e rebate para cima.
                </div>
              </div>
            )}
          </>
        )}
      </SettingsGroup>

      {/* Wall Mechanics (for platformers) */}
      <SettingsGroup title="Mecanicas de Parede" icon={Layers}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Wall Jump</span>
          <ToggleSwitch checked={playerSettings.canWallJump ?? false} onChange={(v) => updateSetting('canWallJump', v)} />
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Wall Slide</span>
          <ToggleSwitch checked={playerSettings.canWallSlide ?? false} onChange={(v) => updateSetting('canWallSlide', v)} />
        </div>
        
        {(playerSettings.canWallSlide || playerSettings.canWallJump) && (
          <>
            <PropertyRow label="Vel. Slide" value={(playerSettings.wallSlideSpeed || 2).toFixed(1)}>
              <input type="range" min="0.5" max="5" step="0.25" value={playerSettings.wallSlideSpeed || 2}
                onChange={(e) => updateSetting('wallSlideSpeed', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>
            
            <PropertyRow label="Força Wall Jump" value={(playerSettings.wallJumpForce || 10).toFixed(1)}>
              <input type="range" min="5" max="20" step="0.5" value={playerSettings.wallJumpForce || 10}
                onChange={(e) => updateSetting('wallJumpForce', parseFloat(e.target.value))} className="w-full" />
            </PropertyRow>
          </>
        )}
      </SettingsGroup>

      {/* Controls Reference */}
      <div className="space-y-1 border-t border-border/70 bg-[var(--editor-panel-header)] px-2 py-2 text-[10px] text-muted-foreground">
        <div className="font-semibold text-foreground">Controles</div>
        {isRacing ? (
          <>
            <div>• W/↑: Acelerar</div>
            <div>• S/↓: Frear / Ré</div>
            <div>• A/D ou ←/→: Virar</div>
            <div>• Espaço: Freio de Mão (Drift)</div>
            <div>• Shift: Nitro Boost</div>
            <div>• C: Olhar para Trás</div>
          </>
        ) : (
          <>
            <div>• WASD/Setas: Movimento</div>
            <div>• Espaço: Pular</div>
            <div>• Shift: Correr</div>
            <div>• C/Ctrl: Agachar</div>
            <div>• Q/Alt: Esquivar</div>
            <div>• E/Click: Atacar</div>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================
// SHARED COMPONENTS
// ============================================
interface PropertyRowProps {
  label: string;
  value: string;
  children: React.ReactNode;
}

const PropertyRow = ({ label, value, children }: PropertyRowProps) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-center">
      <label className="inspector-label">{label}</label>
      <span className="text-[10px] text-primary font-semibold tabular-nums">{value}</span>
    </div>
    {children}
  </div>
);

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
}

const ToggleSwitch = ({ checked, onChange }: ToggleSwitchProps) => (
  <button
    onClick={() => onChange(!checked)}
    className={cn(
      'relative h-4 w-7 flex-shrink-0 rounded-full border transition-colors',
      checked 
        ? 'border-primary/55 bg-primary/75' 
        : 'border-border bg-muted'
    )}
  >
    <span className={cn(
      'absolute top-[2px] h-2.5 w-2.5 rounded-full bg-foreground/80 transition-all',
      checked ? 'left-[14px]' : 'left-[3px] bg-muted-foreground/60'
    )} />
  </button>
);
