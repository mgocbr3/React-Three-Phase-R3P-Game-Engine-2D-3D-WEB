import { Droplets, Mountain, RefreshCw, Trees } from 'lucide-react';
import { TerrainSettings, TerrainBiome } from '@/stores/terrainStore';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

interface TerrainSectionProps {
  terrainSettings: TerrainSettings;
  onUpdate: (settings: Partial<TerrainSettings>) => void;
}

const biomeOptions: { id: TerrainBiome; label: string; description: string; colors: { water: string; waterDeep: string } }[] = [
  { id: 'tropical', label: 'Tropical', description: 'Ilhas com praias e vegetacao densa', colors: { water: '#20d9d2', waterDeep: '#0a4a4a' } },
  { id: 'temperate', label: 'Temperado', description: 'Florestas, colinas e vales verdes', colors: { water: '#1ca3ec', waterDeep: '#0c2d4a' } },
  { id: 'alpine', label: 'Alpino', description: 'Montanhas com neve e rochas', colors: { water: '#7ec8e3', waterDeep: '#1a3a4a' } },
  { id: 'desert', label: 'Deserto', description: 'Dunas, canyons e terreno arido', colors: { water: '#8b7355', waterDeep: '#4a3a2a' } },
  { id: 'island', label: 'Arquipelago', description: 'Ilhas esparsas com aguas rasas', colors: { water: '#40e0d0', waterDeep: '#006994' } },
  { id: 'canyon', label: 'Canyon', description: 'Formacoes rochosas e ravinas', colors: { water: '#6b8e9f', waterDeep: '#2a3f4f' } },
  { id: 'mixed', label: 'Misto', description: 'Combinacao de diferentes biomas', colors: { water: '#1ca3ec', waterDeep: '#0c2d4a' } },
];

export const TerrainSection = ({ terrainSettings, onUpdate }: TerrainSectionProps) => {
  const handleRandomSeed = () => {
    onUpdate({ seed: Math.floor(Math.random() * 1000000) });
  };

  const handleBiomeChange = (biome: TerrainBiome) => {
    const biomeData = biomeOptions.find((option) => option.id === biome);
    if (!biomeData) return;

    onUpdate({
      biome,
      waterColor: biomeData.colors.water,
      waterDeepColor: biomeData.colors.waterDeep,
    });
  };

  return (
    <div className="inspector-section space-y-2">
      <div className="border-b border-border/70 pb-2">
        <label className="inspector-label mb-1 block">Tipo de bioma</label>
        <select
          value={terrainSettings.biome}
          onChange={(event) => handleBiomeChange(event.target.value as TerrainBiome)}
          className="glass-select"
        >
          {biomeOptions.map((biome) => (
            <option key={biome.id} value={biome.id}>
              {biome.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {biomeOptions.find((biome) => biome.id === terrainSettings.biome)?.description}
        </p>
      </div>

      <div className="border-b border-border/70 pb-2">
        <label className="inspector-label mb-1 block">Seed</label>
        <div className="flex gap-2">
          <Input
            type="number"
            value={terrainSettings.seed}
            onChange={(event) => onUpdate({ seed: parseInt(event.target.value, 10) || 0 })}
            className="flex-1 inspector-input"
          />
          <button
            onClick={handleRandomSeed}
            className="flex h-7 w-8 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
            title="Gerar seed"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <SliderRow
        label={`Tamanho: ${terrainSettings.terrainSize}m x ${terrainSettings.terrainSize}m`}
        value={terrainSettings.terrainSize}
        min={50}
        max={1000}
        step={50}
        onChange={(value) => onUpdate({ terrainSize: value })}
      />

      <SectionLabel icon={Mountain} label="Forma do terreno" />

      <SliderRow
        label={`Montanhas: ${((terrainSettings.mountainousness ?? 0.5) * 100).toFixed(0)}%`}
        value={terrainSettings.mountainousness ?? 0.5}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => onUpdate({ mountainousness: value })}
      />
      <SliderRow
        label={`Planicies: ${((terrainSettings.flatness ?? 0.4) * 100).toFixed(0)}%`}
        value={terrainSettings.flatness ?? 0.4}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => onUpdate({ flatness: value })}
      />
      <SliderRow
        label={`Erosao: ${((terrainSettings.erosionStrength ?? 0.5) * 100).toFixed(0)}%`}
        value={terrainSettings.erosionStrength ?? 0.5}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => onUpdate({ erosionStrength: value })}
      />
      <SliderRow
        label={`Costa/litoral: ${((terrainSettings.coastalBlend ?? 0.3) * 100).toFixed(0)}%`}
        value={terrainSettings.coastalBlend ?? 0.3}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => onUpdate({ coastalBlend: value })}
      />
      <SliderRow
        label={`Altura maxima: ${terrainSettings.height.toFixed(1)}m`}
        value={terrainSettings.height}
        min={5}
        max={100}
        step={1}
        onChange={(value) => onUpdate({ height: value })}
      />
      <SliderRow
        label={`Nivel da agua: ${terrainSettings.waterLevel.toFixed(1)}m`}
        value={terrainSettings.waterLevel}
        min={-10}
        max={20}
        step={0.5}
        onChange={(value) => onUpdate({ waterLevel: value })}
      />

      <SectionLabel icon={Droplets} label="Configuracoes da agua" />

      <ColorRow
        label="Cor da agua (superficie)"
        value={terrainSettings.waterColor || '#1ca3ec'}
        onChange={(value) => onUpdate({ waterColor: value })}
      />
      <ColorRow
        label="Cor da agua (profunda)"
        value={terrainSettings.waterDeepColor || '#0c2d4a'}
        onChange={(value) => onUpdate({ waterDeepColor: value })}
      />
      <SliderRow
        label={`Altura das ondas: ${(terrainSettings.waveHeight ?? 0.8).toFixed(2)}`}
        value={terrainSettings.waveHeight ?? 0.8}
        min={0}
        max={3}
        step={0.1}
        onChange={(value) => onUpdate({ waveHeight: value })}
      />
      <SliderRow
        label={`Velocidade das ondas: ${(terrainSettings.waveSpeed ?? 1).toFixed(2)}`}
        value={terrainSettings.waveSpeed ?? 1}
        min={0}
        max={3}
        step={0.1}
        onChange={(value) => onUpdate({ waveSpeed: value })}
      />
      <SliderRow
        label={`Intensidade da espuma: ${((terrainSettings.foamIntensity ?? 0.5) * 100).toFixed(0)}%`}
        value={terrainSettings.foamIntensity ?? 0.5}
        min={0}
        max={1}
        step={0.05}
        onChange={(value) => onUpdate({ foamIntensity: value })}
      />

      <SectionLabel icon={Trees} label="Vegetacao" />

      <SwitchRow
        label="Mostrar vegetacao"
        checked={terrainSettings.showVegetation}
        onChange={(value) => onUpdate({ showVegetation: value })}
      />
      {terrainSettings.showVegetation && (
        <SliderRow
          label={`Densidade: ${(terrainSettings.vegetationDensity * 100).toFixed(0)}%`}
          value={terrainSettings.vegetationDensity}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) => onUpdate({ vegetationDensity: value })}
        />
      )}

      <SectionLabel icon={Mountain} label="Avancado" />

      <SwitchRow
        label="Habilitar colisao"
        checked={terrainSettings.enableCollision}
        onChange={(value) => onUpdate({ enableCollision: value })}
      />
      <SliderRow
        label={`Resolucao: ${terrainSettings.segmentsX} x ${terrainSettings.segmentsY}`}
        value={terrainSettings.segmentsX}
        min={32}
        max={512}
        step={32}
        onChange={(value) => onUpdate({ segmentsX: value, segmentsY: value })}
      />
    </div>
  );
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

const SliderRow = ({ label, value, min, max, step, onChange }: SliderRowProps) => (
  <div className="inspector-slider-row">
    <label className="inspector-label mb-1 block">{label}</label>
    <Slider
      value={[value]}
      onValueChange={(nextValue) => onChange(nextValue[0])}
      min={min}
      max={max}
      step={step}
      className="w-full"
    />
  </div>
);

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorRow = ({ label, value, onChange }: ColorRowProps) => (
  <div className="inspector-color-row">
    <label className="inspector-label mb-1 block">{label}</label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-8 rounded-sm border border-border"
      />
      <Input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex-1 inspector-input font-mono"
      />
    </div>
  </div>
);

interface SwitchRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const SwitchRow = ({ label, checked, onChange }: SwitchRowProps) => (
  <div className="flex items-center justify-between border-b border-border/70 pb-2">
    <label className="inspector-label">{label}</label>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const SectionLabel = ({ icon: Icon, label }: { icon: typeof Mountain; label: string }) => (
  <div className="engine-section-label">
    <Icon className="h-3.5 w-3.5" />
    <span>{label}</span>
  </div>
);
