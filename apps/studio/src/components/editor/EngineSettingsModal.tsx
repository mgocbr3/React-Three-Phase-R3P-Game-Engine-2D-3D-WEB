import { useState, useEffect } from 'react';
import { 
  X, RotateCcw, Monitor, Palette, Zap, Sparkles, Cloud, Grid3X3,
  Sun, Eye, Layers, ChevronRight, Volume2, Hand, Gamepad2, Paintbrush
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEngineSettings, ShadowMapType, ToneMappingType, ColorSpaceType, QualityPreset, QUALITY_PRESETS, UITheme } from '@/stores/engineSettingsStore';
import { useAudioStore } from '@/stores/audioStore';
import { MotionControlPanel } from './MotionControlPanel';
import { InputMapPanel } from './InputMapPanel';

type SettingsCategory = 'appearance' | 'rendering' | 'color' | 'performance' | 'postprocessing' | 'environment' | 'audio' | 'input' | 'motion' | 'helpers';

const categories = [
  { id: 'appearance' as const, label: 'Aparência', icon: Paintbrush },
  { id: 'rendering' as const, label: 'Rendering', icon: Monitor },
  { id: 'color' as const, label: 'Cor & Tom', icon: Palette },
  { id: 'performance' as const, label: 'Performance', icon: Zap },
  { id: 'postprocessing' as const, label: 'Pós-Processamento', icon: Sparkles },
  { id: 'environment' as const, label: 'Ambiente', icon: Cloud },
  { id: 'audio' as const, label: 'Áudio', icon: Volume2 },
  { id: 'input' as const, label: 'Input Map', icon: Gamepad2 },
  { id: 'motion' as const, label: 'Motion Control', icon: Hand },
  { id: 'helpers' as const, label: 'Helpers', icon: Grid3X3 },
];

interface EngineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EngineSettingsModal = ({ isOpen, onClose }: EngineSettingsModalProps) => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('appearance');
  const settings = useEngineSettings();
  const { updateSettings, resetToDefaults } = settings;
  const audioSettings = useAudioStore();
  const { setMasterVolume, toggle3DAudio } = audioSettings;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal - Fixed size with liquid glass */}
      <div 
        className="relative w-[850px] h-[560px] rounded-2xl shadow-2xl flex overflow-hidden bg-card border border-border backdrop-blur-xl"
        style={{
          boxShadow: '0 25px 80px -12px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Sidebar - Using semantic colors */}
        <div 
          className="w-56 p-3 flex flex-col bg-sidebar-background border-r border-border"
        >
          <h2 className="px-3 py-2 text-[11px] font-medium text-muted-foreground">
            Configurações
          </h2>
          <div className="space-y-1 mt-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
                    activeCategory === cat.id
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )}
                  style={activeCategory === cat.id ? {
                    background: 'linear-gradient(90deg, hsl(var(--primary) / 0.15) 0%, transparent 100%)',
                    borderLeft: '2px solid hsl(var(--primary))',
                  } : { borderLeft: '2px solid transparent' }}
                >
                  <Icon className={cn("w-4 h-4", activeCategory === cat.id ? "text-primary" : "")} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          {/* Header - Using semantic colors */}
          <div 
            className="flex items-center justify-between px-5 py-3 bg-background border-b border-border"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {categories.find(c => c.id === activeCategory)?.label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/5 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar Padrões
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Settings Content - Fixed height with scroll */}
          <div className="flex-1 overflow-y-auto p-5" style={{ minHeight: '400px' }}>
            {activeCategory === 'appearance' && (
              <div className="space-y-6">
                <SettingGroup title="Tema da Interface">
                  <SelectSetting
                    label="Tema de Cores"
                    value={settings.uiTheme}
                    options={[
                      { value: 'black', label: 'Dark Mode' },
                      { value: 'blue', label: 'Classic Mode' },
                      { value: 'light', label: 'Light Mode' },
                    ]}
                    onChange={(v) => updateSettings({ uiTheme: v as UITheme })}
                  />
                </SettingGroup>

                <SettingGroup title="Menus Flutuantes">
                  <ToggleSetting
                    label="Transparência nos Menus"
                    description="Ativa efeito de vidro translúcido nos menus suspensos"
                    value={settings.menuTransparency}
                    onChange={(v) => updateSettings({ menuTransparency: v })}
                  />
                </SettingGroup>
              </div>
            )}

            {activeCategory === 'rendering' && (
              <div className="space-y-6">
                <SettingGroup title="Sombras">
                  <ToggleSetting
                    label="Habilitar Sombras"
                    description="Renderiza sombras em tempo real para objetos"
                    value={settings.shadows}
                    onChange={(v) => updateSettings({ shadows: v })}
                  />
                  <SelectSetting
                    label="Tipo de Shadow Map"
                    value={settings.shadowMapType}
                    options={[
                      { value: 'basic', label: 'Basic' },
                      { value: 'percentage', label: 'PCF (Percentage Closer)' },
                      { value: 'soft', label: 'PCF Soft' },
                      { value: 'variance', label: 'Variance (VSM)' },
                    ]}
                    onChange={(v) => updateSettings({ shadowMapType: v as ShadowMapType })}
                  />
                  <SelectSetting
                    label="Resolução do Shadow Map"
                    value={settings.shadowMapSize.toString()}
                    options={[
                      { value: '256', label: '256 (Ultra Low)' },
                      { value: '512', label: '512 (Low)' },
                      { value: '1024', label: '1024 (Medium)' },
                      { value: '2048', label: '2048 (High)' },
                      { value: '4096', label: '4096 (Ultra)' },
                    ]}
                    onChange={(v) => updateSettings({ shadowMapSize: parseInt(v) })}
                  />
                </SettingGroup>

                <SettingGroup title="Anti-Aliasing">
                  <ToggleSetting
                    label="Antialias"
                    description="Suaviza bordas serrilhadas (pode impactar performance)"
                    value={settings.antialias}
                    onChange={(v) => updateSettings({ antialias: v })}
                  />
                </SettingGroup>

                <SettingGroup title="Texturas">
                  <SelectSetting
                    label="Filtro padrão"
                    value={settings.textureFilterDefault}
                    options={[
                      { value: 'nearest', label: 'Nearest (pixelado)' },
                      { value: 'bilinear', label: 'Bilinear' },
                      { value: 'trilinear', label: 'Trilinear (suave)' },
                    ]}
                    onChange={(v) => updateSettings({ textureFilterDefault: v as any, currentQualityPreset: 'custom' })}
                  />
                </SettingGroup>
              </div>
            )}

            {activeCategory === 'color' && (
              <div className="space-y-6">
                <SettingGroup title="Tone Mapping">
                  <SelectSetting
                    label="Algoritmo"
                    value={settings.toneMapping}
                    options={[
                      { value: 'aces', label: 'ACES Filmic' },
                      { value: 'cineon', label: 'Cineon' },
                      { value: 'reinhard', label: 'Reinhard' },
                      { value: 'linear', label: 'Linear' },
                      { value: 'none', label: 'Nenhum' },
                    ]}
                    onChange={(v) => updateSettings({ toneMapping: v as ToneMappingType })}
                  />
                  <SliderSetting
                    label="Exposição"
                    value={settings.toneMappingExposure}
                    min={0}
                    max={3}
                    step={0.1}
                    onChange={(v) => updateSettings({ toneMappingExposure: v })}
                  />
                </SettingGroup>

                <SettingGroup title="Espaço de Cor">
                  <SelectSetting
                    label="Output Color Space"
                    value={settings.colorSpace}
                    options={[
                      { value: 'srgb', label: 'sRGB (Recomendado)' },
                      { value: 'linear', label: 'Linear' },
                    ]}
                    onChange={(v) => updateSettings({ colorSpace: v as ColorSpaceType })}
                  />
                </SettingGroup>
              </div>
            )}

            {activeCategory === 'performance' && (
              <div className="space-y-6">
                <SettingGroup title="Preset de Qualidade">
                  <SelectSetting
                    label="Preset"
                    value={settings.currentQualityPreset}
                    options={[
                      { value: 'ultra-low', label: 'Ultra Baixo (PCs fracos)' },
                      { value: 'low', label: 'Baixo' },
                      { value: 'medium', label: 'Médio' },
                      { value: 'high', label: 'Alto' },
                      { value: 'ultra', label: 'Ultra' },
                      { value: 'custom', label: 'Personalizado' },
                    ]}
                    onChange={(v) => settings.applyQualityPreset(v as QualityPreset)}
                  />
                </SettingGroup>

                <SettingGroup title="Auto-Qualidade">
                  <ToggleSetting
                    label="Ajuste Automático"
                    description="Ajusta qualidade automaticamente baseado no FPS"
                    value={settings.autoQuality}
                    onChange={(v) => updateSettings({ autoQuality: v })}
                  />
                  {settings.autoQuality && (
                    <>
                      <SliderSetting
                        label="FPS Alvo"
                        value={settings.targetFps}
                        min={30}
                        max={120}
                        step={10}
                        onChange={(v) => updateSettings({ targetFps: v })}
                      />
                      <SliderSetting
                        label="FPS Mínimo"
                        value={settings.minFps}
                        min={15}
                        max={60}
                        step={5}
                        onChange={(v) => updateSettings({ minFps: v })}
                      />
                    </>
                  )}
                </SettingGroup>

                <SettingGroup title="Resolução">
                  <SliderSetting
                    label="Device Pixel Ratio (DPR)"
                    value={settings.dpr}
                    min={0.5}
                    max={2}
                    step={0.25}
                    onChange={(v) => updateSettings({ dpr: v, currentQualityPreset: 'custom' })}
                  />
                  <SliderSetting
                    label="DPR Máximo"
                    value={settings.maxDpr}
                    min={1}
                    max={3}
                    step={0.5}
                    onChange={(v) => updateSettings({ maxDpr: v })}
                  />
                </SettingGroup>

                <SettingGroup title="LOD (Level of Detail)">
                  <ToggleSetting
                    label="Habilitar LOD"
                    description="Reduz detalhes de objetos distantes"
                    value={settings.lodEnabled}
                    onChange={(v) => updateSettings({ lodEnabled: v })}
                  />
                  {settings.lodEnabled && (
                    <SliderSetting
                      label="LOD Bias"
                      value={settings.lodBias}
                      min={0.5}
                      max={2}
                      step={0.1}
                      onChange={(v) => updateSettings({ lodBias: v })}
                    />
                  )}
                </SettingGroup>

                <SettingGroup title="Instancing">
                  <ToggleSetting
                    label="Auto-Instancing"
                    description="Agrupa objetos iguais para melhor performance"
                    value={settings.instancingEnabled}
                    onChange={(v) => updateSettings({ instancingEnabled: v })}
                  />
                  {settings.instancingEnabled && (
                    <SliderSetting
                      label="Threshold Mínimo"
                      value={settings.instancingThreshold}
                      min={2}
                      max={20}
                      step={1}
                      onChange={(v) => updateSettings({ instancingThreshold: v })}
                    />
                  )}
                </SettingGroup>

                <SettingGroup title="Render Loop">
                  <SelectSetting
                    label="Frameloop Mode"
                    value={settings.frameloop}
                    options={[
                      { value: 'always', label: 'Always (Padrão)' },
                      { value: 'demand', label: 'On Demand (Economia)' },
                      { value: 'never', label: 'Never (Manual)' },
                    ]}
                    onChange={(v) => updateSettings({ frameloop: v as 'always' | 'demand' | 'never' })}
                  />
                </SettingGroup>
              </div>
            )}

            {activeCategory === 'postprocessing' && (
              <div className="space-y-6">
                <SettingGroup title="Bloom">
                  <ToggleSetting
                    label="Habilitar Bloom"
                    description="Adiciona brilho em áreas luminosas"
                    value={settings.bloom}
                    onChange={(v) => updateSettings({ bloom: v })}
                  />
                  {settings.bloom && (
                    <>
                      <SliderSetting
                        label="Intensidade"
                        value={settings.bloomIntensity}
                        min={0}
                        max={2}
                        step={0.1}
                        onChange={(v) => updateSettings({ bloomIntensity: v })}
                      />
                      <SliderSetting
                        label="Threshold"
                        value={settings.bloomThreshold}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateSettings({ bloomThreshold: v })}
                      />
                      <SliderSetting
                        label="Radius"
                        value={settings.bloomRadius}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateSettings({ bloomRadius: v })}
                      />
                    </>
                  )}
                </SettingGroup>

                <SettingGroup title="SSAO (Ambient Occlusion)">
                  <ToggleSetting
                    label="Habilitar SSAO"
                    description="Adiciona sombras suaves em cantos e frestas"
                    value={settings.ssao}
                    onChange={(v) => updateSettings({ ssao: v })}
                  />
                  {settings.ssao && (
                    <>
                      <SliderSetting
                        label="Intensidade"
                        value={settings.ssaoIntensity}
                        min={0}
                        max={3}
                        step={0.1}
                        onChange={(v) => updateSettings({ ssaoIntensity: v })}
                      />
                      <SliderSetting
                        label="Raio"
                        value={settings.ssaoRadius}
                        min={0.1}
                        max={2}
                        step={0.1}
                        onChange={(v) => updateSettings({ ssaoRadius: v })}
                      />
                      <SliderSetting
                        label="Bias"
                        value={settings.ssaoBias}
                        min={0}
                        max={0.1}
                        step={0.005}
                        onChange={(v) => updateSettings({ ssaoBias: v })}
                      />
                    </>
                  )}
                </SettingGroup>

                <SettingGroup title="Profundidade de Campo">
                  <ToggleSetting
                    label="Habilitar DOF"
                    description="Desfoque bokeh cinematográfico"
                    value={settings.depthOfField}
                    onChange={(v) => updateSettings({ depthOfField: v })}
                  />
                  {settings.depthOfField && (
                    <>
                      <SliderSetting
                        label="Distância de Foco"
                        value={settings.dofFocusDistance}
                        min={1}
                        max={100}
                        step={1}
                        onChange={(v) => updateSettings({ dofFocusDistance: v })}
                      />
                      <SliderSetting
                        label="Comprimento Focal"
                        value={settings.dofFocalLength}
                        min={10}
                        max={200}
                        step={5}
                        onChange={(v) => updateSettings({ dofFocalLength: v })}
                      />
                      <SliderSetting
                        label="Escala do Bokeh"
                        value={settings.dofBokehScale}
                        min={0.5}
                        max={6}
                        step={0.5}
                        onChange={(v) => updateSettings({ dofBokehScale: v })}
                      />
                    </>
                  )}
                </SettingGroup>

                <SettingGroup title="God Rays (Volumetric Light)">
                  <ToggleSetting
                    label="Habilitar God Rays"
                    description="Raios de luz volumétricos do sol"
                    value={settings.godRays}
                    onChange={(v) => updateSettings({ godRays: v })}
                  />
                  {settings.godRays && (
                    <>
                      <SliderSetting
                        label="Intensidade"
                        value={settings.godRaysIntensity}
                        min={0}
                        max={2}
                        step={0.1}
                        onChange={(v) => updateSettings({ godRaysIntensity: v })}
                      />
                      <SliderSetting
                        label="Decay"
                        value={settings.godRaysDecay}
                        min={0.8}
                        max={1}
                        step={0.01}
                        onChange={(v) => updateSettings({ godRaysDecay: v })}
                      />
                      <SliderSetting
                        label="Densidade"
                        value={settings.godRaysDensity}
                        min={0.8}
                        max={1}
                        step={0.01}
                        onChange={(v) => updateSettings({ godRaysDensity: v })}
                      />
                    </>
                  )}
                </SettingGroup>

                <SettingGroup title="Color Grading">
                  <ToggleSetting
                    label="Habilitar Color Grading"
                    description="Ajuste de cores profissional"
                    value={settings.colorGrading}
                    onChange={(v) => updateSettings({ colorGrading: v })}
                  />
                  {settings.colorGrading && (
                    <>
                      <SliderSetting
                        label="Brilho"
                        value={settings.brightness}
                        min={-1}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateSettings({ brightness: v })}
                      />
                      <SliderSetting
                        label="Contraste"
                        value={settings.contrast}
                        min={-1}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateSettings({ contrast: v })}
                      />
                      <SliderSetting
                        label="Saturação"
                        value={settings.saturation}
                        min={-1}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateSettings({ saturation: v })}
                      />
                      <SliderSetting
                        label="Hue"
                        value={settings.hue}
                        min={-1}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateSettings({ hue: v })}
                      />
                    </>
                  )}
                </SettingGroup>

                <SettingGroup title="Chromatic Aberration">
                  <ToggleSetting
                    label="Habilitar Chromatic Aberration"
                    description="Efeito de aberração cromática de lente"
                    value={settings.chromaticAberration}
                    onChange={(v) => updateSettings({ chromaticAberration: v })}
                  />
                  {settings.chromaticAberration && (
                    <SliderSetting
                      label="Offset"
                      value={settings.chromaticAberrationOffset}
                      min={0}
                      max={0.02}
                      step={0.001}
                      onChange={(v) => updateSettings({ chromaticAberrationOffset: v })}
                    />
                  )}
                </SettingGroup>

                <SettingGroup title="Vignette">
                  <ToggleSetting
                    label="Habilitar Vignette"
                    description="Escurece as bordas da tela"
                    value={settings.vignette}
                    onChange={(v) => updateSettings({ vignette: v })}
                  />
                  {settings.vignette && (
                    <>
                      <SliderSetting
                        label="Intensidade"
                        value={settings.vignetteIntensity}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateSettings({ vignetteIntensity: v })}
                      />
                      <SliderSetting
                        label="Offset"
                        value={settings.vignetteOffset}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateSettings({ vignetteOffset: v })}
                      />
                    </>
                  )}
                </SettingGroup>

                <SettingGroup title="Film Grain">
                  <ToggleSetting
                    label="Habilitar Film Grain"
                    description="Adiciona ruído cinematográfico"
                    value={settings.noise}
                    onChange={(v) => updateSettings({ noise: v })}
                  />
                  {settings.noise && (
                    <SliderSetting
                      label="Intensidade"
                      value={settings.noiseIntensity}
                      min={0}
                      max={0.5}
                      step={0.02}
                      onChange={(v) => updateSettings({ noiseIntensity: v })}
                    />
                  )}
                </SettingGroup>
              </div>
            )}

            {activeCategory === 'environment' && (
              <div className="space-y-6">
                <SettingGroup title="Névoa (Fog)">
                  <ToggleSetting
                    label="Habilitar Fog"
                    description="Adiciona névoa atmosférica à distância"
                    value={settings.fog}
                    onChange={(v) => updateSettings({ fog: v })}
                  />
                  {settings.fog && (
                    <>
                      <ColorSetting
                        label="Cor do Fog"
                        value={settings.fogColor}
                        onChange={(v) => updateSettings({ fogColor: v })}
                      />
                      <SliderSetting
                        label="Distância Próxima"
                        value={settings.fogNear}
                        min={0}
                        max={50}
                        step={1}
                        onChange={(v) => updateSettings({ fogNear: v })}
                      />
                      <SliderSetting
                        label="Distância Distante"
                        value={settings.fogFar}
                        min={20}
                        max={500}
                        step={10}
                        onChange={(v) => updateSettings({ fogFar: v })}
                      />
                    </>
                  )}
                </SettingGroup>

                <SettingGroup title="Iluminação Ambiente">
                  <SliderSetting
                    label="Intensidade da Luz Ambiente"
                    value={settings.ambientLightIntensity}
                    min={0}
                    max={2}
                    step={0.1}
                    onChange={(v) => updateSettings({ ambientLightIntensity: v })}
                  />
                </SettingGroup>
              </div>
            )}

            {activeCategory === 'audio' && (
              <div className="space-y-6">
                <SettingGroup title="Áudio">
                  <SliderSetting
                    label="Volume Mestre"
                    value={audioSettings.settings.masterVolume}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setMasterVolume(v)}
                  />
                  <ToggleSetting
                    label="Áudio 3D"
                    description="Ativa áudio espacial (requer navegador compatível)"
                    value={audioSettings.settings.enabled3DAudio}
                    onChange={(v) => toggle3DAudio(v)}
                  />
                </SettingGroup>
              </div>
            )}

            {activeCategory === 'helpers' && (
              <div className="space-y-6">
                <SettingGroup title="Grid">
                  <ToggleSetting
                    label="Mostrar Grid"
                    description="Exibe a grade de referência no editor"
                    value={settings.showGrid}
                    onChange={(v) => updateSettings({ showGrid: v })}
                  />
                  <SliderSetting
                    label="Tamanho do Grid"
                    value={settings.gridSize}
                    min={10}
                    max={200}
                    step={10}
                    onChange={(v) => updateSettings({ gridSize: v })}
                  />
                </SettingGroup>

                <SettingGroup title="Indicadores">
                  <ToggleSetting
                    label="Mostrar Gizmo de Orientação"
                    description="Exibe os eixos XYZ no canto da tela"
                    value={settings.showGizmo}
                    onChange={(v) => updateSettings({ showGizmo: v })}
                  />
                  <ToggleSetting
                    label="Mostrar Stats (FPS)"
                    description="Exibe estatísticas de performance"
                    value={settings.showStats}
                    onChange={(v) => updateSettings({ showStats: v })}
                  />
                </SettingGroup>

                <SettingGroup title="Gameplay">
                  <ToggleSetting
                    label="Controles Touch (Mobile)"
                    description="Exibe joystick e botões de ação durante o jogo"
                    value={settings.showTouchControls}
                    onChange={(v) => updateSettings({ showTouchControls: v })}
                  />
                </SettingGroup>
              </div>
            )}

            {/* Input Map */}
            {activeCategory === 'input' && (
              <div className="space-y-4">
                <InputMapPanel />
              </div>
            )}

            {/* Motion Control */}
            {activeCategory === 'motion' && (
              <div className="space-y-4">
                <MotionControlPanel />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 flex items-center justify-end gap-3 bg-background/60 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 text-[13px] font-medium rounded-lg transition-all bg-primary text-primary-foreground hover:bg-primary/90"
              style={{
                boxShadow: '0 4px 12px hsl(var(--primary) / 0.4)',
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Setting Group Component - Liquid Glass
const SettingGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-4">
    <h3 className="text-[11px] font-medium text-muted-foreground">{title}</h3>
    <div className="space-y-4 pl-0.5">{children}</div>
  </div>
);

// Toggle Setting Component - Liquid Glass
interface ToggleSettingProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const ToggleSetting = ({ label, description, value, onChange }: ToggleSettingProps) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-[13px] font-medium text-foreground">{label}</p>
      {description && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!value)}
      className={cn(
        'w-10 h-[22px] rounded-full transition-all relative flex-shrink-0',
        value 
          ? '' 
          : 'bg-muted/80 border border-border/50'
      )}
      style={value ? {
        background: 'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(220 70% 50%) 100%)',
        boxShadow: '0 2px 8px hsl(var(--primary) / 0.4)',
      } : {}}
    >
      <div
        className={cn(
          'absolute top-[3px] w-4 h-4 rounded-full shadow-md transition-all',
          value ? 'translate-x-5 bg-white' : 'translate-x-[3px] bg-muted-foreground/60'
        )}
      />
    </button>
  </div>
);

// Select Setting Component - Liquid Glass
interface SelectSettingProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

const SelectSetting = ({ label, value, options, onChange }: SelectSettingProps) => (
  <div className="flex items-center justify-between">
    <p className="text-[13px] font-medium text-foreground">{label}</p>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="glass-select text-[12px] min-w-[160px]"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

// Slider Setting Component - Liquid Glass
interface SliderSettingProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

const SliderSetting = ({ label, value, min, max, step, onChange }: SliderSettingProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-[13px] font-medium text-foreground">{label}</p>
      <span className="text-[11px] text-primary font-semibold tabular-nums">{value.toFixed(step < 1 ? 2 : 0)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full"
    />
  </div>
);

// Color Setting Component - Liquid Glass
interface ColorSettingProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorSetting = ({ label, value, onChange }: ColorSettingProps) => (
  <div className="flex items-center justify-between">
    <p className="text-[13px] font-medium text-foreground">{label}</p>
    <div className="flex items-center gap-2.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-lg cursor-pointer border border-border/50"
      />
      <span className="text-[11px] font-mono text-muted-foreground">{value}</span>
    </div>
  </div>
);
