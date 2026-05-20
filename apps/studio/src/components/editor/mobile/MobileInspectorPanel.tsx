import { useState } from 'react';
import { 
  X, 
  Search, 
  SlidersHorizontal,
  Wrench,
  LayoutGrid,
  Download,
  ChevronRight,
  ChevronDown,
  Book,
  MoreHorizontal,
  Box,
  Camera,
  User,
  Lightbulb,
  Sun,
  Mountain,
  LucideIcon,
  Eye,
  Lock,
  Copy,
  Trash2,
  Move,
  Palette,
  Atom,
  Tag,
  Target,
  Volume2,
  Sparkles,
  Video,
  Gamepad2,
  RefreshCw,
  Droplets,
  Trees,
  Snowflake,
  Palmtree,
  Waves
} from 'lucide-react';
import { useEditorStore, SceneObject, CameraSettings, CameraMode, PlayerSettings, GamePreset } from '@/stores/editorStore';
import { cn } from '@/lib/utils';
import { getDefaultAnimationSettings } from '@/components/editor/AnimationSection';
import { getDefaultParticleSettings } from '@/components/canvas/ParticleEmitter';
import { useTerrainStore, defaultTerrainSettings, TerrainBiome, TerrainSettings } from '@/stores/terrainStore';

// Game presets for quick setup
const GAME_PRESETS: { value: GamePreset; label: string; icon: string }[] = [
  { value: 'custom', label: 'Personalizado', icon: '' },
  { value: 'third-person-action', label: 'Ação 3ª Pessoa', icon: '' },
  { value: 'third-person-shooter', label: 'Shooter 3ª Pessoa', icon: '' },
  { value: 'platformer-2d', label: 'Plataforma 2D', icon: '' },
  { value: 'platformer-3d', label: 'Plataforma 3D', icon: '' },
  { value: 'fps-shooter', label: 'FPS Shooter', icon: '' },
  { value: 'fps-horror', label: 'FPS Horror', icon: '' },
  { value: 'racing-arcade', label: 'Corrida Arcade', icon: '' },
  { value: 'top-down-rpg', label: 'RPG Top-Down', icon: '' },
  { value: 'top-down-shooter', label: 'Shooter Top-Down', icon: '' },
];

const CAMERA_MODES: { value: CameraMode; label: string; icon: string }[] = [
  { value: 'third-person', label: 'Terceira Pessoa', icon: '' },
  { value: 'first-person', label: 'Primeira Pessoa', icon: '' },
  { value: 'side-2d', label: 'Side-Scroll 2D', icon: '' },
  { value: 'top-down', label: 'Top-Down', icon: '' },
  { value: 'fixed', label: 'Fixa', icon: '' },
];

const ATTACK_TYPES = [
  { value: 'melee', label: 'Corpo-a-corpo', icon: '' },
  { value: 'ranged', label: 'Tiro', icon: '' },
  { value: 'stomp', label: 'Pisão', icon: '' },
  { value: 'combo', label: 'Combo', icon: '' },
];

interface MobileInspectorPanelProps {
  onClose: () => void;
}

type InspectorTab = 'properties' | 'tools' | 'layout' | 'export';

const tabs: { id: InspectorTab; icon: LucideIcon }[] = [
  { id: 'properties', icon: SlidersHorizontal },
  { id: 'tools', icon: Wrench },
  { id: 'layout', icon: LayoutGrid },
  { id: 'export', icon: Download },
];

const glassStyle = {
  background: 'linear-gradient(135deg, hsl(225 15% 12% / 0.98) 0%, hsl(225 15% 10% / 0.98) 100%)',
  fontFamily: 'Roboto, Noto Sans, sans-serif',
};

// ============================================
// COLLAPSIBLE SECTION
// ============================================
interface CollapsibleSectionProps {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection = ({ title, icon: Icon, defaultOpen = false, children }: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2.5 transition-colors active:bg-white/5"
      >
        <div className={cn(
          "w-5 h-5 flex items-center justify-center rounded transition-all",
          isOpen ? "bg-primary/15" : ""
        )}>
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-primary" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-white/50" />
          )}
        </div>
        <Icon className={cn(
          "w-4 h-4 transition-colors",
          isOpen ? "text-primary" : "text-white/50"
        )} />
        <span className={cn(
          "text-[13px] font-medium transition-colors",
          isOpen ? "text-white/90" : "text-white/60"
        )}>
          {title}
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 bg-white/[0.02]">
          {children}
        </div>
      )}
    </div>
  );
};

// ============================================
// VECTOR3 INPUT
// ============================================
interface Vector3InputProps {
  label: string;
  value: [number, number, number];
  onChange: (value: [number, number, number]) => void;
  step?: number;
}

const Vector3Input = ({ label, value, onChange, step = 0.1 }: Vector3InputProps) => (
  <div className="space-y-1.5">
    <span className="text-[11px] font-medium text-white/45">{label}</span>
    <div className="grid grid-cols-3 gap-1.5">
      {(['X', 'Y', 'Z'] as const).map((axis, i) => (
        <div key={axis} className="relative">
          <span className={cn(
            'absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold',
            axis === 'X' ? 'text-muted-foreground' : axis === 'Y' ? 'text-muted-foreground' : 'text-muted-foreground'
          )}>
            {axis}
          </span>
          <input
            type="number"
            step={step}
            value={value[i].toFixed(1)}
            onChange={(e) => {
              const newValue: [number, number, number] = [...value];
              newValue[i] = parseFloat(e.target.value) || 0;
              onChange(newValue);
            }}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-2 text-[13px] text-right text-white/90 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      ))}
    </div>
  </div>
);

// ============================================
// SLIDER PROPERTY
// ============================================
interface SliderPropertyProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

const SliderProperty = ({ label, value, min, max, step = 0.1, unit = '', onChange }: SliderPropertyProps) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-white/70">{label}</span>
      <span className="text-[13px] font-medium text-primary">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
    />
  </div>
);

// ============================================
// TOGGLE PROPERTY
// ============================================
interface TogglePropertyProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const ToggleProperty = ({ label, value, onChange }: TogglePropertyProps) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-[13px] text-white/70">{label}</span>
    <button
      onClick={() => onChange(!value)}
      className={cn(
        'w-11 h-6 rounded-full transition-all relative',
        value ? 'bg-primary' : 'bg-white/20'
      )}
    >
      <div className={cn(
        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-md',
        value ? 'left-6' : 'left-1'
      )} />
    </button>
  </div>
);

// ============================================
// COLOR PROPERTY
// ============================================
interface ColorPropertyProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorProperty = ({ label, value, onChange }: ColorPropertyProps) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-[13px] text-white/70">{label}</span>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
      />
      <span className="text-[11px] font-mono text-white/50">{value}</span>
    </div>
  </div>
);

// ============================================
// SELECT PROPERTY
// ============================================
interface SelectPropertyProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

const SelectProperty = ({ label, value, options, onChange }: SelectPropertyProps) => (
  <div className="space-y-1.5">
    <span className="text-[13px] text-white/70">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white/90 focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// ============================================
// OBJECT PROPERTIES PANEL
// ============================================
const ObjectPropertiesPanel = ({ object, objects, updateObject, deleteObject, duplicateObject }: { 
  object: SceneObject;
  objects: SceneObject[];
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
}) => {
  const isCamera = object.type === 'camera';
  const isPlayer = object.type === 'player';
  const isLight = object.type === 'light' || object.type === 'sunlight' || object.type === 'spotlight';
  const isTerrain = object.type === 'terrain';

  const getObjectIcon = () => {
    if (isCamera) return <Camera className="w-4 h-4 text-muted-foreground" />;
    if (isPlayer) return <User className="w-4 h-4 text-indigo-400" />;
    if (object.type === 'sunlight') return <Sun className="w-4 h-4 text-muted-foreground" />;
    if (isLight) return <Lightbulb className="w-4 h-4 text-muted-foreground" />;
    if (isTerrain) return <Mountain className="w-4 h-4 text-muted-foreground" />;
    return <Box className="w-4 h-4 text-primary" />;
  };

  const canDelete = object.id !== 'main-camera' && object.id !== 'main-player';

  return (
    <div className="space-y-0">
      {/* Object Header */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
            {getObjectIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={object.name}
              onChange={(e) => updateObject(object.id, { name: e.target.value })}
              className="w-full bg-transparent text-[15px] font-semibold text-white/90 focus:outline-none"
            />
            <p className="text-[11px] text-white/40 capitalize">{object.type}</p>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => updateObject(object.id, { visible: object.visible === false ? true : false })}
            className={cn(
              'flex-1 py-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all',
              object.visible !== false ? 'bg-white/5 text-white/70' : 'bg-white/10 text-white/40'
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            {object.visible !== false ? 'Visível' : 'Oculto'}
          </button>
          <button
            onClick={() => updateObject(object.id, { locked: !object.locked })}
            className={cn(
              'flex-1 py-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all',
              object.locked ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/70'
            )}
          >
            <Lock className="w-3.5 h-3.5" />
            {object.locked ? 'Bloqueado' : 'Livre'}
          </button>
          <button
            onClick={() => duplicateObject(object.id)}
            className="p-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-all"
          >
            <Copy className="w-4 h-4" />
          </button>
          {canDelete && (
            <button
              onClick={() => deleteObject(object.id)}
              className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Camera Settings - Full */}
      {isCamera && object.cameraSettings && (
        <MobileCameraSection object={object} updateObject={updateObject} objects={objects} />
      )}

      {/* Player Settings - Full with Game Presets */}
      {isPlayer && object.playerSettings && (
        <MobilePlayerSection object={object} updateObject={updateObject} objects={objects} />
      )}

      {/* Light Settings */}
      {isLight && (
        <CollapsibleSection title="Luz" icon={Lightbulb} defaultOpen>
          <div className="space-y-3">
            <ColorProperty
              label="Cor"
              value={object.color}
              onChange={(v) => updateObject(object.id, { color: v })}
            />
            <SliderProperty
              label="Intensidade"
              value={object.lightSettings?.intensity || 1}
              min={0}
              max={10}
              step={0.1}
              onChange={(v) => updateObject(object.id, { 
                lightSettings: { ...object.lightSettings, intensity: v } 
              })}
            />
            {object.type !== 'sunlight' && (
              <SliderProperty
                label="Distância"
                value={object.lightSettings?.distance || 25}
                min={1}
                max={100}
                step={1}
                unit="m"
                onChange={(v) => updateObject(object.id, { 
                  lightSettings: { ...object.lightSettings, distance: v } 
                })}
              />
            )}
            <ToggleProperty
              label="Projetar Sombras"
              value={object.lightSettings?.castShadow ?? true}
              onChange={(v) => updateObject(object.id, { 
                lightSettings: { ...object.lightSettings, castShadow: v } 
              })}
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Transform Section - Always visible */}
      <CollapsibleSection title="Transform" icon={Move} defaultOpen>
        <div className="space-y-3">
          <Vector3Input
            label="Posição"
            value={object.position}
            onChange={(pos) => updateObject(object.id, { position: pos })}
          />
          {!isCamera && !isPlayer && (
            <>
              <Vector3Input
                label="Rotação"
                value={object.rotation.map(r => Math.round((r * 180) / Math.PI)) as [number, number, number]}
                onChange={(rot) => updateObject(object.id, { 
                  rotation: rot.map(r => (r * Math.PI) / 180) as [number, number, number] 
                })}
                step={5}
              />
              <Vector3Input
                label="Escala"
                value={object.scale}
                onChange={(scale) => updateObject(object.id, { scale })}
              />
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* Visual Section */}
      {!isCamera && !isPlayer && !isTerrain && (
        <CollapsibleSection title="Visual" icon={Palette}>
          <div className="space-y-3">
            <ColorProperty
              label="Cor"
              value={object.color}
              onChange={(v) => updateObject(object.id, { color: v })}
            />
            <SliderProperty
              label="Opacidade"
              value={object.visualSettings?.opacity ?? 1}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateObject(object.id, { 
                visualSettings: { ...object.visualSettings, opacity: v } 
              })}
            />
            <SliderProperty
              label="Metalness"
              value={object.visualSettings?.metalness ?? 0.3}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateObject(object.id, { 
                visualSettings: { ...object.visualSettings, metalness: v } 
              })}
            />
            <SliderProperty
              label="Roughness"
              value={object.visualSettings?.roughness ?? 0.5}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateObject(object.id, { 
                visualSettings: { ...object.visualSettings, roughness: v } 
              })}
            />
            <ToggleProperty
              label="Wireframe"
              value={object.visualSettings?.wireframe ?? false}
              onChange={(v) => updateObject(object.id, { 
                visualSettings: { ...object.visualSettings, wireframe: v } 
              })}
            />
            <ToggleProperty
              label="Projetar Sombra"
              value={object.visualSettings?.castShadow ?? true}
              onChange={(v) => updateObject(object.id, { 
                visualSettings: { ...object.visualSettings, castShadow: v } 
              })}
            />
            <ToggleProperty
              label="Receber Sombra"
              value={object.visualSettings?.receiveShadow ?? true}
              onChange={(v) => updateObject(object.id, { 
                visualSettings: { ...object.visualSettings, receiveShadow: v } 
              })}
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Physics Section */}
      {!isCamera && !isPlayer && !isLight && !isTerrain && (
        <CollapsibleSection title="Física" icon={Atom}>
          <div className="space-y-3">
            <SelectProperty
              label="Tipo de Corpo"
              value={object.physicsSettings?.bodyType ?? 'fixed'}
              options={[
                { value: 'fixed', label: 'Fixo (Estático)' },
                { value: 'dynamic', label: 'Dinâmico' },
                { value: 'kinematic', label: 'Cinemático' },
              ]}
              onChange={(v) => updateObject(object.id, { 
                physicsSettings: { ...object.physicsSettings, bodyType: v as any } 
              })}
            />
            <SliderProperty
              label="Massa"
              value={object.physicsSettings?.mass ?? 1}
              min={0.1}
              max={100}
              step={0.1}
              unit=" kg"
              onChange={(v) => updateObject(object.id, { 
                physicsSettings: { ...object.physicsSettings, mass: v } 
              })}
            />
            <SliderProperty
              label="Elasticidade"
              value={object.physicsSettings?.restitution ?? 0.3}
              min={0}
              max={2}
              step={0.1}
              onChange={(v) => updateObject(object.id, { 
                physicsSettings: { ...object.physicsSettings, restitution: v } 
              })}
            />
            <SliderProperty
              label="Fricção"
              value={object.physicsSettings?.friction ?? 0.5}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateObject(object.id, { 
                physicsSettings: { ...object.physicsSettings, friction: v } 
              })}
            />
            <ToggleProperty
              label="Sensor (Trigger)"
              value={object.physicsSettings?.isSensor ?? false}
              onChange={(v) => updateObject(object.id, { 
                physicsSettings: { ...object.physicsSettings, isSensor: v } 
              })}
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Tags Section */}
      {!isCamera && !isPlayer && !isLight && !isTerrain && (
        <CollapsibleSection title="Tags" icon={Tag}>
          <div className="space-y-3">
            <p className="text-[11px] text-white/40">
              Tags são usadas para identificar objetos em scripts e lógica de jogo.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(object.logicSettings?.tags || []).map((tag, i) => (
                <span key={i} className="px-2 py-1 text-[11px] font-medium rounded-lg bg-primary/20 text-primary">
                  {tag}
                </span>
              ))}
              {(!object.logicSettings?.tags || object.logicSettings.tags.length === 0) && (
                <span className="text-[11px] text-white/30 italic">Nenhuma tag</span>
              )}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Entity Section */}
      {!isCamera && !isPlayer && !isLight && !isTerrain && (
        <CollapsibleSection title="Entidade" icon={Target}>
          <div className="space-y-3">
            <SelectProperty
              label="Tipo de Entidade"
              value={object.entitySettings?.entityType ?? 'static'}
              options={[
                { value: 'static', label: 'Estático' },
                { value: 'character', label: 'Personagem' },
                { value: 'projectile', label: 'Projétil' },
                { value: 'pickup', label: 'Coletável' },
                { value: 'destructible', label: 'Destrutível' },
                { value: 'trigger', label: 'Trigger' },
              ]}
              onChange={(v) => updateObject(object.id, { 
                entitySettings: { ...object.entitySettings, entityType: v as any } 
              })}
            />
            <SelectProperty
              label="Time"
              value={object.entitySettings?.team ?? 'neutral'}
              options={[
                { value: 'player', label: 'Jogador' },
                { value: 'enemy', label: 'Inimigo' },
                { value: 'neutral', label: 'Neutro' },
                { value: 'ally', label: 'Aliado' },
              ]}
              onChange={(v) => updateObject(object.id, { 
                entitySettings: { ...object.entitySettings, team: v as any } 
              })}
            />
            <SliderProperty
              label="Vida Máxima"
              value={object.entitySettings?.maxHealth ?? 100}
              min={1}
              max={1000}
              step={10}
              onChange={(v) => updateObject(object.id, { 
                entitySettings: { ...object.entitySettings, maxHealth: v, currentHealth: v } 
              })}
            />
            <ToggleProperty
              label="Invulnerável"
              value={object.entitySettings?.isInvulnerable ?? false}
              onChange={(v) => updateObject(object.id, { 
                entitySettings: { ...object.entitySettings, isInvulnerable: v } 
              })}
            />
            <ToggleProperty
              label="Causa Dano"
              value={object.entitySettings?.canDealDamage ?? false}
              onChange={(v) => updateObject(object.id, { 
                entitySettings: { ...object.entitySettings, canDealDamage: v } 
              })}
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Audio Section */}
      {!isCamera && !isPlayer && !isLight && !isTerrain && (
        <CollapsibleSection title="Áudio" icon={Volume2}>
          <div className="space-y-3">
            <SliderProperty
              label="Volume"
              value={object.audioSettings?.volume ?? 1}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateObject(object.id, { 
                audioSettings: { ...object.audioSettings, volume: v } 
              })}
            />
            <ToggleProperty
              label="Loop"
              value={object.audioSettings?.loop ?? false}
              onChange={(v) => updateObject(object.id, { 
                audioSettings: { ...object.audioSettings, loop: v } 
              })}
            />
            <ToggleProperty
              label="Auto Play"
              value={object.audioSettings?.autoplay ?? false}
              onChange={(v) => updateObject(object.id, { 
                audioSettings: { ...object.audioSettings, autoplay: v } 
              })}
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Animation Section */}
      {!isCamera && !isPlayer && !isLight && !isTerrain && (
        <CollapsibleSection title="Animação" icon={Sparkles}>
          <div className="space-y-3">
            <p className="text-[11px] text-white/40">
              Importe um modelo GLTF/GLB para acessar animações.
            </p>
            <ToggleProperty
              label="Auto Play"
              value={object.animationSettings?.autoPlay ?? false}
              onChange={(v) => updateObject(object.id, { 
                animationSettings: { 
                  ...(object.animationSettings || getDefaultAnimationSettings()), 
                  autoPlay: v 
                } 
              })}
            />
            <ToggleProperty
              label="Loop"
              value={object.animationSettings?.loop ?? true}
              onChange={(v) => updateObject(object.id, { 
                animationSettings: { 
                  ...(object.animationSettings || getDefaultAnimationSettings()), 
                  loop: v 
                } 
              })}
            />
            <SliderProperty
              label="Velocidade"
              value={object.animationSettings?.speed ?? 1}
              min={0.1}
              max={3}
              step={0.1}
              unit="x"
              onChange={(v) => updateObject(object.id, { 
                animationSettings: { 
                  ...(object.animationSettings || getDefaultAnimationSettings()), 
                  speed: v 
                } 
              })}
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Particles Section */}
      {!isCamera && !isPlayer && !isLight && !isTerrain && (
        <CollapsibleSection title="Partículas" icon={Sparkles}>
          <div className="space-y-3">
            <ToggleProperty
              label="Ativar Partículas"
              value={object.particleSettings?.enabled ?? false}
              onChange={(v) => updateObject(object.id, { 
                particleSettings: { 
                  ...(object.particleSettings || getDefaultParticleSettings()), 
                  enabled: v 
                } 
              })}
            />
            {object.particleSettings?.enabled && (
              <>
                <SelectProperty
                  label="Preset"
                  value={object.particleSettings?.preset ?? 'fire'}
                  options={[
                    { value: 'fire', label: 'Fogo' },
                    { value: 'smoke', label: 'Fumaça' },
                    { value: 'sparks', label: 'Faíscas' },
                    { value: 'magic', label: 'Magia' },
                    { value: 'rain', label: 'Chuva' },
                    { value: 'snow', label: 'Neve' },
                  ]}
                  onChange={(v) => updateObject(object.id, { 
                    particleSettings: { ...object.particleSettings, preset: v as any } 
                  })}
                />
                <SliderProperty
                  label="Quantidade"
                  value={object.particleSettings?.count ?? 100}
                  min={10}
                  max={1000}
                  step={10}
                  onChange={(v) => updateObject(object.id, { 
                    particleSettings: { ...object.particleSettings, count: v } 
                  })}
                />
                <SliderProperty
                  label="Tamanho"
                  value={object.particleSettings?.size ?? 0.1}
                  min={0.01}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateObject(object.id, { 
                    particleSettings: { ...object.particleSettings, size: v } 
                  })}
                />
              </>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* TERRAIN SECTION - Full functionality */}
      {isTerrain && <MobileTerrainSection object={object} />}
    </div>
  );
};

// ============================================
// MOBILE CAMERA SECTION - Full Camera Settings
// ============================================
const MobileCameraSection = ({ object, updateObject, objects }: { 
  object: SceneObject; 
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  objects: SceneObject[];
}) => {
  const cameraSettings = object.cameraSettings!;
  
  const followableObjects = objects.filter(obj => 
    obj.type === 'player' || obj.type === 'box' || obj.type === 'sphere' || obj.type === 'npc'
  );

  const updateCamera = (updates: Partial<CameraSettings>) => {
    updateObject(object.id, { 
      cameraSettings: { ...cameraSettings, ...updates } 
    });
  };

  return (
    <>
      <CollapsibleSection title="Modo de Câmera" icon={Video} defaultOpen>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {CAMERA_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => updateCamera({ mode: mode.value })}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all",
                  cameraSettings.mode === mode.value 
                    ? "border-primary bg-primary/10 text-primary" 
                    : "border-white/10 bg-white/5 text-white/70 active:bg-white/10"
                )}
              >
                <span className="text-lg">{mode.icon}</span>
                <span className="text-[11px] font-medium">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Configurações" icon={Camera} defaultOpen>
        <div className="space-y-3">
          <SliderProperty
            label="FOV"
            value={cameraSettings.fov}
            min={30}
            max={120}
            step={5}
            unit="°"
            onChange={(v) => updateCamera({ fov: v })}
          />
          
          {cameraSettings.mode !== 'first-person' && (
            <SliderProperty
              label="Distância"
              value={cameraSettings.distance}
              min={0}
              max={50}
              step={0.5}
              unit="m"
              onChange={(v) => updateCamera({ distance: v })}
            />
          )}
          
          <SliderProperty
            label="Altura"
            value={cameraSettings.height}
            min={0}
            max={30}
            step={0.5}
            unit="m"
            onChange={(v) => updateCamera({ height: v })}
          />
          
          <SliderProperty
            label="Suavização"
            value={(cameraSettings.smoothing || 0.1) * 100}
            min={1}
            max={50}
            step={1}
            unit="%"
            onChange={(v) => updateCamera({ smoothing: v / 100 })}
          />
          
          <SelectProperty
            label="Seguir Objeto"
            value={cameraSettings.targetId || ''}
            options={[
              { value: '', label: 'Nenhum' },
              ...followableObjects.map(obj => ({ value: obj.id, label: obj.name }))
            ]}
            onChange={(v) => updateCamera({ targetId: v || null })}
          />
          
          <ToggleProperty
            label="Seguir Jogador"
            value={cameraSettings.followPlayer}
            onChange={(v) => updateCamera({ followPlayer: v })}
          />
          
          {cameraSettings.mode === 'side-2d' && (
            <ToggleProperty
              label="Travar Eixo Z"
              value={cameraSettings.lockedZ ?? true}
              onChange={(v) => updateCamera({ lockedZ: v })}
            />
          )}
          
          {cameraSettings.mode === 'top-down' && (
            <ToggleProperty
              label="Travar Eixo Y"
              value={cameraSettings.lockedY ?? true}
              onChange={(v) => updateCamera({ lockedY: v })}
            />
          )}
        </div>
      </CollapsibleSection>
    </>
  );
};

// ============================================
// MOBILE PLAYER SECTION - Full Player Settings with Game Presets
// ============================================
const MobilePlayerSection = ({ object, updateObject, objects }: { 
  object: SceneObject; 
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  objects: SceneObject[];
}) => {
  const playerSettings = object.playerSettings!;
  
  const cameraObject = objects.find(obj => obj.id === 'main-camera' || obj.type === 'camera');
  
  const updatePlayer = (updates: Partial<PlayerSettings>) => {
    updateObject(object.id, { 
      playerSettings: { ...playerSettings, ...updates } 
    });
  };

  // Get camera mode for preset
  const getCameraModeForPreset = (preset: GamePreset): CameraMode => {
    switch (preset) {
      case 'platformer-2d': return 'side-2d';
      case 'fps-shooter':
      case 'fps-horror': return 'first-person';
      case 'top-down-rpg':
      case 'top-down-shooter': return 'top-down';
      default: return 'third-person';
    }
  };

  const applyPreset = (preset: GamePreset) => {
    const newCameraMode = getCameraModeForPreset(preset);
    
    // Update camera if exists
    if (cameraObject?.cameraSettings) {
      const base = cameraObject.cameraSettings;
      let newSettings: CameraSettings = { ...base, mode: newCameraMode };
      
      switch (newCameraMode) {
        case 'first-person':
          newSettings = { ...base, mode: newCameraMode, distance: 0, height: 1.6, lockedZ: false, lockedY: false };
          break;
        case 'side-2d':
          newSettings = { ...base, mode: newCameraMode, distance: 25, height: 5, lockedZ: true, lockedY: false };
          break;
        case 'top-down':
          newSettings = { ...base, mode: newCameraMode, distance: 0, height: 20, lockedZ: false, lockedY: true };
          break;
        default:
          newSettings = { ...base, mode: newCameraMode, distance: 8, height: 4, lockedZ: false, lockedY: false };
      }
      
      updateObject(cameraObject.id, { cameraSettings: newSettings });
    }
    
    // Apply preset-specific player settings
    const base: Partial<PlayerSettings> = { gamePreset: preset };
    
    switch (preset) {
      case 'platformer-2d':
        updatePlayer({ ...base, movementMode: '2d-sidescroll', speed: 7, jumpForce: 14, canDoubleJump: true, canWallJump: true, canSprint: false });
        break;
      case 'platformer-3d':
        updatePlayer({ ...base, movementMode: 'free', speed: 6, jumpForce: 12, canDoubleJump: true, canDodge: false });
        break;
      case 'fps-shooter':
        updatePlayer({ ...base, movementMode: 'free', speed: 5, jumpForce: 6, attackType: 'ranged', attackEnabled: true });
        break;
      case 'fps-horror':
        updatePlayer({ ...base, movementMode: 'free', speed: 3, jumpForce: 4, attackEnabled: false, maxStamina: 60 });
        break;
      case 'third-person-action':
        updatePlayer({ ...base, movementMode: 'free', speed: 5, attackType: 'melee', canDodge: true });
        break;
      case 'third-person-shooter':
        updatePlayer({ ...base, movementMode: 'free', speed: 4, attackType: 'ranged', attackEnabled: true });
        break;
      case 'top-down-rpg':
        updatePlayer({ ...base, movementMode: 'top-down', speed: 5, jumpForce: 0, attackType: 'combo' });
        break;
      case 'top-down-shooter':
        updatePlayer({ ...base, movementMode: 'top-down', speed: 6, jumpForce: 0, attackType: 'ranged' });
        break;
      case 'racing-arcade':
        updatePlayer({ ...base, movementMode: 'free', speed: 0, jumpForce: 0, attackEnabled: false });
        break;
      default:
        updatePlayer({ ...base });
    }
  };

  const currentPreset = GAME_PRESETS.find(p => p.value === playerSettings.gamePreset) || GAME_PRESETS[0];

  return (
    <>
      {/* Game Preset Selector */}
      <div className="p-3 border-b border-white/10">
        <div className="p-3 rounded-xl" style={{
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, hsl(270 60% 50% / 0.1) 100%)',
          border: '1px solid hsl(var(--primary) / 0.25)',
        }}>
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="text-2xl">{currentPreset.icon}</span>
            <div>
              <div className="text-[11px] font-medium text-primary">Preset de Jogo</div>
              <div className="text-[10px] text-white/50">{currentPreset.label}</div>
            </div>
          </div>
          <select
            value={playerSettings.gamePreset || 'custom'}
            onChange={(e) => applyPreset(e.target.value as GamePreset)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/90 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {GAME_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.icon} {preset.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Movement */}
      <CollapsibleSection title="Movimento" icon={Gamepad2} defaultOpen>
        <div className="space-y-3">
          <SliderProperty
            label="Velocidade"
            value={playerSettings.speed}
            min={1}
            max={20}
            step={0.5}
            onChange={(v) => updatePlayer({ speed: v })}
          />
          <SliderProperty
            label="Força do Pulo"
            value={playerSettings.jumpForce}
            min={0}
            max={20}
            step={0.5}
            onChange={(v) => updatePlayer({ jumpForce: v })}
          />
          <SliderProperty
            label="Gravidade"
            value={playerSettings.gravity}
            min={5}
            max={50}
            step={1}
            onChange={(v) => updatePlayer({ gravity: v })}
          />
          <SliderProperty
            label="Controle no Ar"
            value={(playerSettings.airControlMultiplier || 0.7) * 100}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => updatePlayer({ airControlMultiplier: v / 100 })}
          />
        </div>
      </CollapsibleSection>

      {/* Stats */}
      <CollapsibleSection title="Atributos" icon={Target}>
        <div className="space-y-3">
          <SliderProperty
            label="Vida Máxima"
            value={playerSettings.maxHealth}
            min={10}
            max={1000}
            step={10}
            unit=" HP"
            onChange={(v) => updatePlayer({ maxHealth: v })}
          />
          <SliderProperty
            label="Stamina Máxima"
            value={playerSettings.maxStamina || 100}
            min={20}
            max={200}
            step={10}
            onChange={(v) => updatePlayer({ maxStamina: v })}
          />
        </div>
      </CollapsibleSection>

      {/* Abilities */}
      <CollapsibleSection title="Habilidades" icon={Sparkles}>
        <div className="space-y-3">
          <ToggleProperty
            label="Pulo Duplo"
            value={playerSettings.canDoubleJump}
            onChange={(v) => updatePlayer({ canDoubleJump: v })}
          />
          {playerSettings.canDoubleJump && (
            <SliderProperty
              label="Força Pulo Duplo"
              value={playerSettings.doubleJumpForce || 6}
              min={1}
              max={15}
              step={0.5}
              onChange={(v) => updatePlayer({ doubleJumpForce: v })}
            />
          )}
          
          <ToggleProperty
            label="Pode Correr"
            value={playerSettings.canSprint ?? true}
            onChange={(v) => updatePlayer({ canSprint: v })}
          />
          {playerSettings.canSprint !== false && (
            <SliderProperty
              label="Velocidade Sprint"
              value={playerSettings.sprintSpeed || 8}
              min={1}
              max={25}
              step={0.5}
              onChange={(v) => updatePlayer({ sprintSpeed: v })}
            />
          )}
          
          <ToggleProperty
            label="Pode Esquivar"
            value={playerSettings.canDodge ?? true}
            onChange={(v) => updatePlayer({ canDodge: v })}
          />
          
          <ToggleProperty
            label="Wall Jump"
            value={playerSettings.canWallJump ?? false}
            onChange={(v) => updatePlayer({ canWallJump: v })}
          />
          
          <ToggleProperty
            label="Wall Slide"
            value={playerSettings.canWallSlide ?? false}
            onChange={(v) => updatePlayer({ canWallSlide: v })}
          />
        </div>
      </CollapsibleSection>

      {/* Attack */}
      <CollapsibleSection title="Ataque" icon={Target}>
        <div className="space-y-3">
          <ToggleProperty
            label="Ataque Ativado"
            value={playerSettings.attackEnabled ?? true}
            onChange={(v) => updatePlayer({ attackEnabled: v })}
          />
          
          {playerSettings.attackEnabled !== false && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {ATTACK_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => updatePlayer({ attackType: type.value as any })}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all",
                      playerSettings.attackType === type.value 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-white/10 bg-white/5 text-white/70 active:bg-white/10"
                    )}
                  >
                    <span className="text-lg">{type.icon}</span>
                    <span className="text-[11px] font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
              
              <SliderProperty
                label="Dano"
                value={playerSettings.attackDamage || 25}
                min={1}
                max={200}
                step={1}
                onChange={(v) => updatePlayer({ attackDamage: v })}
              />
              
              <SliderProperty
                label="Alcance"
                value={playerSettings.attackRange || 2}
                min={0.5}
                max={100}
                step={0.5}
                unit="m"
                onChange={(v) => updatePlayer({ attackRange: v })}
              />
              
              <SliderProperty
                label="Cooldown"
                value={(playerSettings.attackCooldown || 0.5) * 1000}
                min={10}
                max={3000}
                step={10}
                unit="ms"
                onChange={(v) => updatePlayer({ attackCooldown: v / 1000 })}
              />
            </>
          )}
        </div>
      </CollapsibleSection>
    </>
  );
};

// ============================================
// MOBILE TERRAIN SECTION
// ============================================
const biomeOptions: { id: TerrainBiome; label: string; icon: any; description: string; colors: { water: string; waterDeep: string } }[] = [
  { id: 'tropical', label: 'Tropical', icon: Palmtree, description: 'Ilhas com praias e vegetação densa', colors: { water: '#20d9d2', waterDeep: '#0a4a4a' } },
  { id: 'temperate', label: 'Temperado', icon: Trees, description: 'Florestas, colinas e vales verdes', colors: { water: '#1ca3ec', waterDeep: '#0c2d4a' } },
  { id: 'alpine', label: 'Alpino', icon: Snowflake, description: 'Montanhas com neve e rochas', colors: { water: '#7ec8e3', waterDeep: '#1a3a4a' } },
  { id: 'desert', label: 'Deserto', icon: Sun, description: 'Dunas, canyons e terreno árido', colors: { water: '#8b7355', waterDeep: '#4a3a2a' } },
  { id: 'island', label: 'Arquipélago', icon: Waves, description: 'Ilhas esparsas com águas rasas', colors: { water: '#40e0d0', waterDeep: '#006994' } },
  { id: 'canyon', label: 'Canyon', icon: Mountain, description: 'Formações rochosas e ravinas', colors: { water: '#6b8e9f', waterDeep: '#2a3f4f' } },
  { id: 'mixed', label: 'Misto', icon: Mountain, description: 'Combinação de diferentes biomas', colors: { water: '#1ca3ec', waterDeep: '#0c2d4a' } },
];

const MobileTerrainSection = ({ object }: { object: SceneObject }) => {
  const { terrainSettings, updateTerrainSettings, deleteTerrain } = useTerrainStore();
  
  const settings = terrainSettings || defaultTerrainSettings;

  const handleUpdate = (updates: Partial<TerrainSettings>) => {
    updateTerrainSettings(updates);
  };

  const handleRandomSeed = () => {
    handleUpdate({ seed: Math.floor(Math.random() * 1000000) });
  };

  const handleBiomeChange = (biome: TerrainBiome) => {
    const biomeData = biomeOptions.find(b => b.id === biome);
    if (biomeData) {
      handleUpdate({ 
        biome,
        waterColor: biomeData.colors.water,
        waterDeepColor: biomeData.colors.waterDeep,
      });
    }
  };

  return (
    <div className="space-y-0">
      {/* Terrain Header */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-lg bg-secondary/30 border border-border">
            <Mountain className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[15px] font-semibold text-white/90">Pixlland Terrain</span>
            <p className="text-[11px] text-white/40">Terreno Procedural</p>
          </div>
        </div>
        
        <button
          onClick={deleteTerrain}
          className="w-full py-2.5 rounded-lg bg-destructive/10 text-destructive text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-destructive/20 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          Remover Terreno
        </button>
      </div>

      {/* Biome Selection */}
      <CollapsibleSection title="Bioma" icon={Trees} defaultOpen>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {biomeOptions.map((biome) => {
              const Icon = biome.icon;
              const isSelected = settings.biome === biome.id;
              return (
                <button
                  key={biome.id}
                  onClick={() => handleBiomeChange(biome.id)}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all",
                    isSelected 
                      ? "border-primary bg-primary/10 text-primary" 
                      : "border-white/10 bg-white/5 text-white/70 active:bg-white/10"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-[12px] font-medium truncate">{biome.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-white/40">
            {biomeOptions.find(b => b.id === settings.biome)?.description}
          </p>
        </div>
      </CollapsibleSection>

      {/* Seed & Size */}
      <CollapsibleSection title="Geração" icon={RefreshCw} defaultOpen>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-white/45">Seed</span>
            <div className="flex gap-2">
              <input
                type="number"
                value={settings.seed}
                onChange={(e) => handleUpdate({ seed: parseInt(e.target.value) || 0 })}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white/90 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleRandomSeed}
                className="p-2.5 rounded-lg bg-primary/20 text-primary active:bg-primary/30 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <SliderProperty
            label={`Tamanho: ${settings.terrainSize}m x ${settings.terrainSize}m`}
            value={settings.terrainSize}
            min={50}
            max={1000}
            step={50}
            unit="m"
            onChange={(v) => handleUpdate({ terrainSize: v })}
          />
        </div>
      </CollapsibleSection>

      {/* Terrain Shape */}
      <CollapsibleSection title="Forma do Terreno" icon={Mountain}>
        <div className="space-y-3">
          <SliderProperty
            label="Montanhas"
            value={(settings.mountainousness ?? 0.5) * 100}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => handleUpdate({ mountainousness: v / 100 })}
          />
          <SliderProperty
            label="Planícies"
            value={(settings.flatness ?? 0.4) * 100}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => handleUpdate({ flatness: v / 100 })}
          />
          <SliderProperty
            label="Erosão"
            value={(settings.erosionStrength ?? 0.5) * 100}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => handleUpdate({ erosionStrength: v / 100 })}
          />
          <SliderProperty
            label="Costa/Litoral"
            value={(settings.coastalBlend ?? 0.3) * 100}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => handleUpdate({ coastalBlend: v / 100 })}
          />
          <SliderProperty
            label="Altura Máxima"
            value={settings.height}
            min={5}
            max={100}
            step={1}
            unit="m"
            onChange={(v) => handleUpdate({ height: v })}
          />
          <SliderProperty
            label="Nível da Água"
            value={settings.waterLevel}
            min={-10}
            max={20}
            step={0.5}
            unit="m"
            onChange={(v) => handleUpdate({ waterLevel: v })}
          />
        </div>
      </CollapsibleSection>

      {/* Water Settings */}
      <CollapsibleSection title="Água" icon={Droplets}>
        <div className="space-y-3">
          <ColorProperty
            label="Cor (Superfície)"
            value={settings.waterColor || '#1ca3ec'}
            onChange={(v) => handleUpdate({ waterColor: v })}
          />
          <ColorProperty
            label="Cor (Profunda)"
            value={settings.waterDeepColor || '#0c2d4a'}
            onChange={(v) => handleUpdate({ waterDeepColor: v })}
          />
          <SliderProperty
            label="Altura das Ondas"
            value={settings.waveHeight ?? 0.8}
            min={0}
            max={3}
            step={0.1}
            onChange={(v) => handleUpdate({ waveHeight: v })}
          />
          <SliderProperty
            label="Velocidade das Ondas"
            value={settings.waveSpeed ?? 1.0}
            min={0}
            max={3}
            step={0.1}
            unit="x"
            onChange={(v) => handleUpdate({ waveSpeed: v })}
          />
          <SliderProperty
            label="Opacidade"
            value={(settings.waterOpacity ?? 0.85) * 100}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => handleUpdate({ waterOpacity: v / 100 })}
          />
          <SliderProperty
            label="Intensidade da Espuma"
            value={(settings.foamIntensity ?? 0.5) * 100}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => handleUpdate({ foamIntensity: v / 100 })}
          />
        </div>
      </CollapsibleSection>

      {/* Vegetation */}
      <CollapsibleSection title="Vegetação" icon={Trees}>
        <div className="space-y-3">
          <ToggleProperty
            label="Mostrar Vegetação"
            value={settings.showVegetation}
            onChange={(v) => handleUpdate({ showVegetation: v })}
          />
          {settings.showVegetation && (
            <SliderProperty
              label="Densidade"
              value={(settings.vegetationDensity ?? 0.4) * 100}
              min={0}
              max={100}
              step={5}
              unit="%"
              onChange={(v) => handleUpdate({ vegetationDensity: v / 100 })}
            />
          )}
        </div>
      </CollapsibleSection>

      {/* Advanced */}
      <CollapsibleSection title="Avançado" icon={SlidersHorizontal}>
        <div className="space-y-3">
          <ToggleProperty
            label="Habilitar Colisão"
            value={settings.enableCollision}
            onChange={(v) => handleUpdate({ enableCollision: v })}
          />
          <SliderProperty
            label={`Resolução: ${settings.segmentsX} x ${settings.segmentsY}`}
            value={settings.segmentsX}
            min={32}
            max={512}
            step={32}
            onChange={(v) => handleUpdate({ segmentsX: v, segmentsY: v })}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const MobileInspectorPanel = ({ onClose }: MobileInspectorPanelProps) => {
  const { objects, selectedObjectId, updateObject, deleteObject, duplicateObject } = useEditorStore();
  const [activeTab, setActiveTab] = useState<InspectorTab>('properties');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedObject = objects.find(obj => obj.id === selectedObjectId);

  return (
    <div className="h-full flex flex-col" style={glassStyle}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-all"
        >
          <X className="w-5 h-5 text-white/80" />
        </button>
        
        {/* Tabs */}
        <div className="flex-1 flex items-center justify-center">
          <div 
            className="flex items-center rounded-xl p-1"
            style={{
              background: 'hsl(225 15% 15% / 0.8)',
              border: '1px solid hsl(225 12% 20% / 0.5)',
            }}
          >
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
                    activeTab === tab.id 
                      ? 'bg-primary/15 text-primary' 
                      : 'text-white/50 hover:text-white/70'
                  )}
                >
                  <TabIcon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-10" /> {/* Spacer for symmetry */}
      </div>

      {/* Search */}
      <div className="p-3 border-b border-white/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Buscar propriedades..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[13px] font-medium text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedObject ? (
          <ObjectPropertiesPanel 
            object={selectedObject}
            objects={objects}
            updateObject={updateObject}
            deleteObject={deleteObject}
            duplicateObject={duplicateObject}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div 
              className="p-4 rounded-2xl mb-4"
              style={{
                background: 'linear-gradient(135deg, hsl(225 15% 15% / 0.6) 0%, hsl(225 15% 12% / 0.8) 100%)',
                border: '1px solid hsl(225 12% 22% / 0.4)',
              }}
            >
              <Box className="w-10 h-10 text-white/20" />
            </div>
            <p className="text-[13px] font-medium text-white/70">Nenhum objeto selecionado</p>
            <p className="text-[11px] mt-1.5 max-w-[200px] text-white/40">
              Toque em um objeto na cena ou na Hierarquia para inspecionar suas propriedades
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
