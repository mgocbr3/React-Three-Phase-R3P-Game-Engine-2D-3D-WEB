import { useState } from 'react';
import { X, Monitor, Zap, Sparkles, Cloud, Volume2, Grid3X3, Hand, Gamepad2, Palette, ChevronRight, Keyboard, Smartphone, Eye } from 'lucide-react';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { useAudioStore } from '@/stores/audioStore';
import { useMotionControlStore, GestureAction } from '@/stores/motionControlStore';
import { useInputMapStore, getBindingLabel } from '@/stores/inputMapStore';
import { cn } from '@/lib/utils';

interface MobileSettingsSheetProps {
  onClose: () => void;
}

type SettingsCategory = 'appearance' | 'rendering' | 'color' | 'performance' | 'postprocessing' | 'environment' | 'audio' | 'input' | 'motion' | 'helpers';

const categories = [
  { id: 'appearance' as SettingsCategory, label: 'Aparência', icon: Eye },
  { id: 'rendering' as SettingsCategory, label: 'Render', icon: Monitor },
  { id: 'color' as SettingsCategory, label: 'Cor', icon: Palette },
  { id: 'performance' as SettingsCategory, label: 'Perf', icon: Zap },
  { id: 'postprocessing' as SettingsCategory, label: 'Efeitos', icon: Sparkles },
  { id: 'environment' as SettingsCategory, label: 'Ambiente', icon: Cloud },
  { id: 'audio' as SettingsCategory, label: 'Áudio', icon: Volume2 },
  { id: 'input' as SettingsCategory, label: 'Input', icon: Gamepad2 },
  { id: 'motion' as SettingsCategory, label: 'Motion', icon: Hand },
  { id: 'helpers' as SettingsCategory, label: 'Helpers', icon: Grid3X3 },
];

const glassStyle = {
  background: 'linear-gradient(135deg, hsl(225 15% 12% / 0.98) 0%, hsl(225 15% 10% / 0.98) 100%)',
  fontFamily: 'Roboto, Noto Sans, sans-serif',
};

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className={cn('w-11 h-6 rounded-full transition-all relative', checked ? 'bg-primary' : 'bg-white/20')}
  >
    <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-md', checked ? 'left-6' : 'left-1')} />
  </button>
);

const SliderRow = ({ label, value, min, max, step = 1, onChange, unit = '' }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-white/70">{label}</span>
      <span className="text-[13px] font-medium text-primary">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary" />
  </div>
);

const ToggleRow = ({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex-1">
      <span className="text-[13px] text-white/90">{label}</span>
      {description && <p className="text-[11px] text-white/40 mt-0.5">{description}</p>}
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

const SelectRow = ({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-[13px] text-white/70">{label}</span>
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-white/90"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">{opt.label}</option>
      ))}
    </select>
  </div>
);

export const MobileSettingsSheet = ({ onClose }: MobileSettingsSheetProps) => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('appearance');
  const settings = useEngineSettings();
  const audioSettings = useAudioStore();
  const motionControl = useMotionControlStore();
  const inputMap = useInputMapStore();

  const renderContent = () => {
    switch (activeCategory) {
      case 'appearance':
        return (
          <div className="space-y-4">
            <SelectRow
              label="Tema da Interface"
              value={settings.uiTheme}
              options={[
                { value: 'black', label: 'Dark Mode' },
                { value: 'blue', label: 'Classic Mode' },
                { value: 'light', label: 'Light Mode' },
              ]}
              onChange={(v) => settings.updateSettings({ uiTheme: v as 'black' | 'blue' | 'light' })}
            />
            <ToggleRow 
              label="Transparência nos Menus" 
              description="Efeito de vidro translúcido" 
              checked={settings.menuTransparency} 
              onChange={(v) => settings.updateSettings({ menuTransparency: v })} 
            />
          </div>
        );
      
      case 'rendering':
        return (
          <div className="space-y-4">
            <ToggleRow label="Sombras" description="Renderizar sombras em tempo real" checked={settings.shadows} onChange={(v) => settings.updateSettings({ shadows: v })} />
            <div className="space-y-2">
              <span className="text-[13px] text-white/70">Resolução de Sombras</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[512, 1024, 2048, 4096].map((res) => (
                  <button key={res} onClick={() => settings.updateSettings({ shadowMapSize: res })}
                    className={cn('py-2 text-[11px] font-medium rounded-lg transition-all', settings.shadowMapSize === res ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-white/60 border border-white/10')}>
                    {res}
                  </button>
                ))}
              </div>
            </div>
            <ToggleRow label="Antialiasing" checked={settings.antialias} onChange={(v) => settings.updateSettings({ antialias: v })} />
            <SelectRow 
              label="Tipo de Sombra" 
              value={settings.shadowMapType}
              options={[
                { value: 'basic', label: 'Basic' },
                { value: 'percentage', label: 'PCF' },
                { value: 'soft', label: 'PCF Soft' },
                { value: 'variance', label: 'VSM' },
              ]}
              onChange={(v) => settings.updateSettings({ shadowMapType: v as any })}
            />
          </div>
        );
      
      case 'color':
        return (
          <div className="space-y-4">
            <SelectRow
              label="Tone Mapping"
              value={settings.toneMapping}
              options={[
                { value: 'aces', label: 'ACES Filmic' },
                { value: 'cineon', label: 'Cineon' },
                { value: 'reinhard', label: 'Reinhard' },
                { value: 'linear', label: 'Linear' },
                { value: 'none', label: 'Nenhum' },
              ]}
              onChange={(v) => settings.updateSettings({ toneMapping: v as any })}
            />
            <SliderRow label="Exposição" value={settings.toneMappingExposure} min={0} max={3} step={0.1} onChange={(v) => settings.updateSettings({ toneMappingExposure: v })} />
            <SelectRow
              label="Color Space"
              value={settings.colorSpace}
              options={[
                { value: 'srgb', label: 'sRGB' },
                { value: 'linear', label: 'Linear' },
              ]}
              onChange={(v) => settings.updateSettings({ colorSpace: v as any })}
            />
          </div>
        );

      case 'performance':
        return (
          <div className="space-y-4">
            <SelectRow
              label="Preset de Qualidade"
              value={settings.currentQualityPreset}
              options={[
                { value: 'ultra-low', label: 'Ultra Baixo' },
                { value: 'low', label: 'Baixo' },
                { value: 'medium', label: 'Médio' },
                { value: 'high', label: 'Alto' },
                { value: 'ultra', label: 'Ultra' },
                { value: 'custom', label: 'Personalizado' },
              ]}
              onChange={(v) => settings.applyQualityPreset(v as any)}
            />
            <ToggleRow label="Auto-Qualidade" description="Ajuste automático baseado no FPS" checked={settings.autoQuality} onChange={(v) => settings.updateSettings({ autoQuality: v })} />
            <ToggleRow label="LOD Automático" description="Reduz detalhes à distância" checked={settings.lodEnabled} onChange={(v) => settings.updateSettings({ lodEnabled: v })} />
            <ToggleRow label="Auto-Instancing" description="Agrupa objetos iguais" checked={settings.instancingEnabled} onChange={(v) => settings.updateSettings({ instancingEnabled: v })} />
            <SliderRow label="Target FPS" value={settings.targetFps} min={30} max={144} step={10} onChange={(v) => settings.updateSettings({ targetFps: v })} unit=" fps" />
            <SliderRow label="DPR" value={settings.dpr} min={0.5} max={2} step={0.25} onChange={(v) => settings.updateSettings({ dpr: v })} />
            <SliderRow label="DPR Máximo" value={settings.maxDpr} min={1} max={3} step={0.5} onChange={(v) => settings.updateSettings({ maxDpr: v })} />
          </div>
        );
      
      case 'postprocessing':
        return (
          <div className="space-y-4">
            <ToggleRow label="Bloom" description="Efeito de brilho" checked={settings.bloom} onChange={(v) => settings.updateSettings({ bloom: v })} />
            {settings.bloom && (
              <>
                <SliderRow label="Intensidade" value={settings.bloomIntensity} min={0} max={3} step={0.1} onChange={(v) => settings.updateSettings({ bloomIntensity: v })} />
                <SliderRow label="Threshold" value={settings.bloomThreshold} min={0} max={1} step={0.05} onChange={(v) => settings.updateSettings({ bloomThreshold: v })} />
              </>
            )}
            <ToggleRow label="SSAO" description="Oclusão ambiente" checked={settings.ssao} onChange={(v) => settings.updateSettings({ ssao: v })} />
            <ToggleRow label="Vinheta" description="Escurecimento nas bordas" checked={settings.vignette} onChange={(v) => settings.updateSettings({ vignette: v })} />
            <ToggleRow label="Profundidade de Campo" description="Desfoque bokeh" checked={settings.depthOfField} onChange={(v) => settings.updateSettings({ depthOfField: v })} />
            <ToggleRow label="Motion Blur" checked={settings.motionBlur} onChange={(v) => settings.updateSettings({ motionBlur: v })} />
            <ToggleRow label="Aberração Cromática" checked={settings.chromaticAberration} onChange={(v) => settings.updateSettings({ chromaticAberration: v })} />
            <ToggleRow label="Ruído de Filme" checked={settings.noise} onChange={(v) => settings.updateSettings({ noise: v })} />
            <ToggleRow label="God Rays" description="Raios volumétricos" checked={settings.godRays} onChange={(v) => settings.updateSettings({ godRays: v })} />
          </div>
        );
      
      case 'environment':
        return (
          <div className="space-y-4">
            <ToggleRow label="Névoa" description="Névoa atmosférica" checked={settings.fog} onChange={(v) => settings.updateSettings({ fog: v })} />
            {settings.fog && (
              <>
                <SliderRow label="Near" value={settings.fogNear} min={1} max={200} step={1} onChange={(v) => settings.updateSettings({ fogNear: v })} unit="m" />
                <SliderRow label="Far" value={settings.fogFar} min={50} max={500} step={10} onChange={(v) => settings.updateSettings({ fogFar: v })} unit="m" />
              </>
            )}
            <SliderRow label="Luz Ambiente" value={settings.ambientLightIntensity} min={0} max={2} step={0.1} onChange={(v) => settings.updateSettings({ ambientLightIntensity: v })} />
          </div>
        );

      case 'audio':
        return (
          <div className="space-y-4">
            <SliderRow 
              label="Volume Master" 
              value={audioSettings.settings.masterVolume} 
              min={0} max={1} step={0.05} 
              onChange={(v) => audioSettings.setMasterVolume(v)} 
            />
            <ToggleRow 
              label="Áudio 3D" 
              description="Posicional espacial" 
              checked={audioSettings.settings.enabled3DAudio} 
              onChange={(v) => audioSettings.toggle3DAudio(v)} 
            />
          </div>
        );

      case 'input':
        return (
          <div className="space-y-4">
            <div className="text-[11px] text-white/50 mb-2">
              Mapeamento de teclas, controle e touch. Expanda uma ação para ver os bindings.
            </div>
            <div className="space-y-2">
              {inputMap.actions.slice(0, 6).map((action) => (
                <div key={action.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium text-white/90">{action.name}</span>
                    <span className="text-[10px] text-white/40">{action.bindings.length} bindings</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {action.bindings.map((binding, i) => (
                      <span key={i} className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1',
                        binding.type === 'keyboard' && 'bg-secondary/30 text-muted-foreground',
                        binding.type === 'gamepad' && 'bg-secondary/30 text-muted-foreground',
                        binding.type === 'touch' && 'bg-secondary/30 text-muted-foreground',
                      )}>
                        {binding.type === 'keyboard' && <Keyboard className="w-2.5 h-2.5" />}
                        {binding.type === 'gamepad' && <Gamepad2 className="w-2.5 h-2.5" />}
                        {binding.type === 'touch' && <Smartphone className="w-2.5 h-2.5" />}
                        {getBindingLabel(binding)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/40 text-center mt-3">
              Use o Editor Desktop para adicionar/editar bindings
            </p>
          </div>
        );

      case 'motion':
        return (
          <div className="space-y-4">
            <ToggleRow 
              label="Motion Control" 
              description="Controle por gestos via câmera" 
              checked={motionControl.enabled} 
              onChange={(v) => motionControl.setEnabled(v)} 
            />
            {motionControl.enabled && (
              <>
                <SelectRow
                  label="Modo"
                  value={motionControl.mode}
                  options={[
                    { value: 'off', label: 'Desligado' },
                    { value: 'cursor', label: 'Cursor' },
                    { value: 'character', label: 'Personagem' },
                    { value: 'camera', label: 'Câmera' },
                  ]}
                  onChange={(v) => motionControl.setMode(v as any)}
                />
                <SliderRow 
                  label="Sensibilidade" 
                  value={motionControl.mapping.movementSensitivity} 
                  min={0.5} max={3} step={0.1} 
                  onChange={(v) => motionControl.updateMapping({ movementSensitivity: v })} 
                />
                <SliderRow 
                  label="Suavização" 
                  value={motionControl.mapping.smoothing} 
                  min={0.1} max={0.9} step={0.1} 
                  onChange={(v) => motionControl.updateMapping({ smoothing: v })} 
                />
                
                <div className="pt-2 border-t border-white/10">
                  <p className="text-[11px] text-white/50 mb-3">Mapeamento de Gestos</p>
                  <SelectRow
                    label="Pinça "
                    value={motionControl.mapping.pinchAction}
                    options={[
                      { value: 'click', label: 'Clique' },
                      { value: 'attack', label: 'Atacar' },
                      { value: 'jump', label: 'Pular' },
                      { value: 'interact', label: 'Interagir' },
                    ]}
                    onChange={(v) => motionControl.updateMapping({ pinchAction: v as GestureAction })}
                  />
                  <SelectRow
                    label="Punho "
                    value={motionControl.mapping.fistAction}
                    options={[
                      { value: 'special', label: 'Especial' },
                      { value: 'attack', label: 'Atacar' },
                      { value: 'shoot', label: 'Atirar' },
                    ]}
                    onChange={(v) => motionControl.updateMapping({ fistAction: v as GestureAction })}
                  />
                  <SelectRow
                    label="Mão Aberta "
                    value={motionControl.mapping.openHandAction}
                    options={[
                      { value: 'jump', label: 'Pular' },
                      { value: 'interact', label: 'Interagir' },
                      { value: 'none', label: 'Nenhum' },
                    ]}
                    onChange={(v) => motionControl.updateMapping({ openHandAction: v as GestureAction })}
                  />
                  <SelectRow
                    label="Apontar "
                    value={motionControl.mapping.pointAction}
                    options={[
                      { value: 'shoot', label: 'Atirar' },
                      { value: 'interact', label: 'Interagir' },
                      { value: 'click', label: 'Clique' },
                    ]}
                    onChange={(v) => motionControl.updateMapping({ pointAction: v as GestureAction })}
                  />
                </div>
              </>
            )}
          </div>
        );

      case 'helpers':
        return (
          <div className="space-y-4">
            <ToggleRow label="Grade" description="Mostrar grade no viewport" checked={settings.showGrid} onChange={(v) => settings.updateSettings({ showGrid: v })} />
            <ToggleRow label="Estatísticas" description="Exibir FPS" checked={settings.showStats} onChange={(v) => settings.updateSettings({ showStats: v })} />
            <ToggleRow label="Gizmo" description="Mostrar gizmo de orientação" checked={settings.showGizmo} onChange={(v) => settings.updateSettings({ showGizmo: v })} />
            <ToggleRow label="Controles Touch" description="Joystick e botões durante o jogo" checked={settings.showTouchControls} onChange={(v) => settings.updateSettings({ showTouchControls: v })} />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col" style={glassStyle}>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center active:scale-95 transition-all border border-white/10">
          <X className="w-5 h-5 text-white/80" />
        </button>
        <h2 className="text-[15px] font-semibold text-white/90">Configurações da Engine</h2>
      </div>

      <div className="border-b border-white/10">
        <div className="flex overflow-x-auto px-2 py-2 gap-1 no-scrollbar">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all',
                  activeCategory === cat.id ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-white/60 border border-transparent hover:bg-white/10')}>
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>

      <div className="px-4 py-3 border-t border-white/10">
        <button onClick={() => settings.resetToDefaults()} className="w-full py-2.5 text-[13px] font-medium text-white/60 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all">
          Restaurar Padrões
        </button>
      </div>
    </div>
  );
};
