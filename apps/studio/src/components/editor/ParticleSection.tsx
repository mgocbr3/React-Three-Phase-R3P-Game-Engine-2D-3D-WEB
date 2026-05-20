import { useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles, Flame, Cloud, CloudRain, Snowflake, Wand2, Zap, Wind, Circle, Settings2, Sun, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  ParticleSettings, 
  ParticlePreset, 
  getDefaultParticleSettings, 
  applyParticlePreset
} from '@/components/canvas/ParticleEmitter';

interface ParticleSectionProps {
  particleSettings?: ParticleSettings;
  onUpdate: (settings: Partial<ParticleSettings>) => void;
}

const PARTICLE_PRESETS: { value: ParticlePreset; label: string; icon: typeof Sparkles }[] = [
  { value: 'sparkles', label: 'Brilhos', icon: Sparkles },
  { value: 'fire', label: 'Fogo', icon: Flame },
  { value: 'smoke', label: 'Fumaça', icon: Cloud },
  { value: 'rain', label: 'Chuva', icon: CloudRain },
  { value: 'snow', label: 'Neve', icon: Snowflake },
  { value: 'magic', label: 'Magia', icon: Wand2 },
  { value: 'explosion', label: 'Explosão', icon: Zap },
  { value: 'dust', label: 'Poeira', icon: Wind },
  { value: 'bubbles', label: 'Bolhas', icon: Circle },
  { value: 'custom', label: 'Customizado', icon: Settings2 },
];

const BLENDING_MODES: { value: 'normal' | 'additive' | 'multiply'; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'additive', label: 'Aditivo' },
  { value: 'multiply', label: 'Multiplicar' },
];

const TEXTURE_TYPES: { value: 'soft' | 'fire' | 'smoke' | 'sparkle'; label: string }[] = [
  { value: 'soft', label: 'Suave' },
  { value: 'fire', label: 'Fogo' },
  { value: 'smoke', label: 'Fumaça' },
  { value: 'sparkle', label: 'Estrela' },
];

const SIZE_OVER_LIFETIME: { value: 'constant' | 'shrink' | 'grow' | 'pulse'; label: string }[] = [
  { value: 'constant', label: 'Constante' },
  { value: 'shrink', label: 'Diminuir' },
  { value: 'grow', label: 'Crescer' },
  { value: 'pulse', label: 'Pulsar' },
];

export const ParticleSection = ({ particleSettings, onUpdate }: ParticleSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const settings = particleSettings || getDefaultParticleSettings();
  
  const handlePresetChange = (preset: ParticlePreset) => {
    const newSettings = applyParticlePreset(preset, settings);
    onUpdate(newSettings);
  };
  
  const handleToggleEnabled = () => {
    onUpdate({ enabled: !settings.enabled });
  };
  
  const currentPreset = PARTICLE_PRESETS.find(p => p.value === settings.preset);
  
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="collapsible-header w-full"
      >
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
        <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Partículas</span>
        {settings.enabled && (
          <span className="ml-auto text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            {currentPreset?.label}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="px-3 pb-3 space-y-3">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Ativar Partículas</span>
            <button
              onClick={handleToggleEnabled}
              className={cn(
                "w-8 h-4 rounded-full transition-colors relative",
                settings.enabled ? "bg-primary" : "bg-muted"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform",
                  settings.enabled ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
          
          {settings.enabled && (
            <>
              {/* Preset Selector */}
              <div className="space-y-1.5">
                <label className="inspector-label">PRESET</label>
                <div className="grid grid-cols-5 gap-1">
                  {PARTICLE_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = settings.preset === preset.value;
                    return (
                      <button
                        key={preset.value}
                        onClick={() => handlePresetChange(preset.value)}
                        className={cn(
                          "p-2 rounded transition-colors flex flex-col items-center gap-1",
                          isSelected 
                            ? "bg-primary/20 text-primary ring-1 ring-primary" 
                            : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                        )}
                        title={preset.label}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[8px] leading-none">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Quick Settings */}
              <div className="space-y-3 pt-2 border-t border-border">
                {/* Count */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="inspector-label">QUANTIDADE</label>
                    <span className="text-[10px] text-muted-foreground">{settings.count}</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={settings.count}
                    onChange={(e) => onUpdate({ count: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
                
                {/* Size */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="inspector-label">TAMANHO</label>
                    <span className="text-[10px] text-muted-foreground">{settings.size.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="1"
                    step="0.01"
                    value={settings.size}
                    onChange={(e) => onUpdate({ size: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
                
                {/* Speed */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="inspector-label">VELOCIDADE</label>
                    <span className="text-[10px] text-muted-foreground">{settings.speed.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={settings.speed}
                    onChange={(e) => onUpdate({ speed: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
                
                {/* Spread */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="inspector-label">DISPERSÃO</label>
                    <span className="text-[10px] text-muted-foreground">{settings.spread.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={settings.spread}
                    onChange={(e) => onUpdate({ spread: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
                
                {/* Colors */}
                <div className="space-y-1">
                  <label className="inspector-label">COR</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.color}
                      onChange={(e) => onUpdate({ color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.color}
                      onChange={(e) => onUpdate({ color: e.target.value })}
                      className="flex-1 inspector-input font-mono text-xs"
                    />
                  </div>
                </div>
                
                {/* End Color (for gradients) */}
                <div className="space-y-1">
                  <label className="inspector-label">COR FINAL (opcional)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.colorEnd || settings.color}
                      onChange={(e) => onUpdate({ colorEnd: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.colorEnd || ''}
                      onChange={(e) => onUpdate({ colorEnd: e.target.value || undefined })}
                      placeholder="Gradiente"
                      className="flex-1 inspector-input font-mono text-xs"
                    />
                    {settings.colorEnd && (
                      <button
                        onClick={() => onUpdate({ colorEnd: undefined })}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Advanced Settings Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1"
              >
                {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Configurações Avançadas
              </button>
              
              {showAdvanced && (
                <div className="space-y-3 pt-2 border-t border-border">
                  {/* Opacity */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="inspector-label">OPACIDADE</label>
                      <span className="text-[10px] text-muted-foreground">{(settings.opacity * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.opacity}
                      onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  
                  {/* Lifetime */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="inspector-label">VIDA ÚTIL</label>
                      <span className="text-[10px] text-muted-foreground">{settings.lifetime.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={settings.lifetime}
                      onChange={(e) => onUpdate({ lifetime: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  
                  {/* Gravity */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="inspector-label">GRAVIDADE</label>
                      <span className="text-[10px] text-muted-foreground">{settings.gravity.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.05"
                      value={settings.gravity}
                      onChange={(e) => onUpdate({ gravity: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  
                  {/* Turbulence */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="inspector-label">TURBULÊNCIA</label>
                      <span className="text-[10px] text-muted-foreground">{settings.turbulence.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.turbulence}
                      onChange={(e) => onUpdate({ turbulence: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  
                  {/* Cone Angle */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="inspector-label">ÂNGULO DO CONE</label>
                      <span className="text-[10px] text-muted-foreground">{settings.cone}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="180"
                      step="5"
                      value={settings.cone}
                      onChange={(e) => onUpdate({ cone: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  
                  {/* Blending Mode */}
                  <div className="space-y-1">
                    <label className="inspector-label">MODO DE MISTURA</label>
                    <select
                      value={settings.blending}
                      onChange={(e) => onUpdate({ blending: e.target.value as 'normal' | 'additive' | 'multiply' })}
                      className="w-full inspector-input"
                    >
                      {BLENDING_MODES.map((mode) => (
                        <option key={mode.value} value={mode.value}>{mode.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Direction */}
                  <div className="space-y-1.5">
                    <label className="inspector-label">DIREÇÃO</label>
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
                            min="-1"
                            max="1"
                            value={settings.direction[i].toFixed(1)}
                            onChange={(e) => {
                              const newDir: [number, number, number] = [...settings.direction];
                              newDir[i] = parseFloat(e.target.value) || 0;
                              onUpdate({ direction: newDir });
                            }}
                            className="w-full inspector-input pl-6 pr-1 text-right"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Toggles */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Fade de Opacidade</span>
                      <ToggleSwitch 
                        checked={settings.opacityFade} 
                        onChange={(v) => onUpdate({ opacityFade: v })} 
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Loop</span>
                      <ToggleSwitch 
                        checked={settings.loop} 
                        onChange={(v) => onUpdate({ loop: v })} 
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Burst (explosão única)</span>
                      <ToggleSwitch 
                        checked={settings.burst} 
                        onChange={(v) => onUpdate({ burst: v })} 
                      />
                    </div>
                  </div>
                  
                  {/* EMISSIVE LIGHTING SECTION */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2 text-xs font-medium text-primary">
                      <Sun className="w-3.5 h-3.5" />
                      ILUMINAÇÃO EMISSIVA
                    </div>
                    
                    {/* Texture Type */}
                    <div className="space-y-1">
                      <label className="inspector-label">TIPO DE TEXTURA</label>
                      <select
                        value={settings.textureType || 'soft'}
                        onChange={(e) => onUpdate({ textureType: e.target.value as 'soft' | 'fire' | 'smoke' | 'sparkle' })}
                        className="w-full inspector-input"
                      >
                        {TEXTURE_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Emissive Toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Brilho Emissivo</span>
                      <ToggleSwitch 
                        checked={settings.emissive ?? false} 
                        onChange={(v) => onUpdate({ emissive: v })} 
                      />
                    </div>
                    
                    {/* Emissive Intensity */}
                    {settings.emissive && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="inspector-label">INTENSIDADE EMISSIVA</label>
                          <span className="text-[10px] text-muted-foreground">{(settings.emissiveIntensity || 1.5).toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="5"
                          step="0.1"
                          value={settings.emissiveIntensity || 1.5}
                          onChange={(e) => onUpdate({ emissiveIntensity: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                    )}
                    
                    {/* Point Light Intensity */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="inspector-label flex items-center gap-1">
                          <Lightbulb className="w-3 h-3 text-muted-foreground" />
                          LUZ DINÂMICA
                        </label>
                        <span className="text-[10px] text-muted-foreground">{(settings.pointLightIntensity || 0).toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.1"
                        value={settings.pointLightIntensity || 0}
                        onChange={(e) => onUpdate({ pointLightIntensity: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                      <p className="text-[9px] text-muted-foreground">Adiciona uma luz real que ilumina objetos próximos</p>
                    </div>
                    
                    {/* Size Over Lifetime */}
                    <div className="space-y-1">
                      <label className="inspector-label">TAMANHO AO LONGO DA VIDA</label>
                      <select
                        value={settings.sizeOverLifetime || 'constant'}
                        onChange={(e) => onUpdate({ sizeOverLifetime: e.target.value as 'constant' | 'shrink' | 'grow' | 'pulse' })}
                        className="w-full inspector-input"
                      >
                        {SIZE_OVER_LIFETIME.map((mode) => (
                          <option key={mode.value} value={mode.value}>{mode.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Color Over Lifetime */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Gradiente de Cor</span>
                      <ToggleSwitch 
                        checked={settings.colorOverLifetime ?? false} 
                        onChange={(v) => onUpdate({ colorOverLifetime: v })} 
                      />
                    </div>
                    
                    {/* Rotate Particles */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Rotacionar Partículas</span>
                      <ToggleSwitch 
                        checked={settings.rotateParticles ?? false} 
                        onChange={(v) => onUpdate({ rotateParticles: v })} 
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Toggle Switch Component
const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className={cn(
      "w-8 h-4 rounded-full transition-colors relative",
      checked ? "bg-primary" : "bg-muted"
    )}
  >
    <div
      className={cn(
        "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-4" : "translate-x-0.5"
      )}
    />
  </button>
);

export default ParticleSection;
