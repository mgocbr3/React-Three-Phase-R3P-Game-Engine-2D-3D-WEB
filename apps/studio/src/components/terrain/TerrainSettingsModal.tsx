import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { TerrainSettings } from '@/stores/terrainStore';

interface TerrainSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TerrainSettings;
  onSettingsChange: (settings: TerrainSettings) => void;
  onGenerate: (settings: TerrainSettings) => void;
}

export const TerrainSettingsModal = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onGenerate,
}: TerrainSettingsModalProps) => {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!isOpen) return null;

  const handleChange = (key: string, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleApply = () => {
    onGenerate(localSettings);
    onClose();
  };

  const handleRandomSeed = () => {
    const newSeed = Math.floor(Math.random() * 1000000);
    handleChange('seed', newSeed);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 pointer-events-auto backdrop-blur-sm">
      <Card 
        className="w-[400px] p-6 max-h-[500px] overflow-y-auto rounded-2xl border-0"
        style={{
          background: 'linear-gradient(135deg, hsl(225 15% 12% / 0.95) 0%, hsl(225 15% 10% / 0.98) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid hsl(225 12% 20% / 0.6)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          fontFamily: 'Roboto, Noto Sans, sans-serif',
        }}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-[15px] font-semibold text-white/95">Pixlland Terrain System</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} className="text-white/70" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Seed */}
          <div>
            <Label className="text-[13px] font-medium text-white/70 mb-1.5 block">Seed</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={localSettings.seed}
                onChange={(e) => handleChange('seed', parseInt(e.target.value) || 0)}
                className="bg-white/5 border-white/10 text-white/90 text-[13px] rounded-lg h-9 focus:border-primary/50"
              />
              <Button
                onClick={handleRandomSeed}
                size="sm"
                className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-[13px] font-medium h-9 px-4"
              >
                Random
              </Button>
            </div>
          </div>

          {/* Scale */}
          <div>
            <Label className="text-[13px] font-medium text-white/70 mb-1.5 block">
              Scale: <span className="text-primary">{localSettings.scale.toFixed(3)}</span>
            </Label>
            <Slider
              value={[localSettings.scale]}
              onValueChange={(value) => handleChange('scale', value[0])}
              min={0.01}
              max={0.2}
              step={0.01}
              className="w-full"
            />
          </div>

          {/* Height */}
          <div>
            <Label className="text-[13px] font-medium text-white/70 mb-1.5 block">
              Max Height: <span className="text-primary">{localSettings.height.toFixed(1)}</span>
            </Label>
            <Slider
              value={[localSettings.height]}
              onValueChange={(value) => handleChange('height', value[0])}
              min={5}
              max={50}
              step={1}
              className="w-full"
            />
          </div>

          {/* Terrain Size */}
          <div>
            <Label className="text-[13px] font-medium text-white/70 mb-1.5 block">
              Terrain Size: <span className="text-primary">{localSettings.terrainSize}m × {localSettings.terrainSize}m</span>
            </Label>
            <Slider
              value={[localSettings.terrainSize]}
              onValueChange={(value) => handleChange('terrainSize', value[0])}
              min={50}
              max={1000}
              step={50}
              className="w-full"
            />
          </div>

          {/* Water Level */}
          <div>
            <Label className="text-[13px] font-medium text-white/70 mb-1.5 block">
              Water Level: <span className="text-primary">{localSettings.waterLevel.toFixed(1)}</span>
            </Label>
            <Slider
              value={[localSettings.waterLevel]}
              onValueChange={(value) => handleChange('waterLevel', value[0])}
              min={-10}
              max={10}
              step={0.5}
              className="w-full"
            />
          </div>

          {/* Segments X */}
          <div>
            <Label className="text-[13px] font-medium text-white/70 mb-1.5 block">
              Segments X: <span className="text-primary">{localSettings.segmentsX}</span>
            </Label>
            <Slider
              value={[localSettings.segmentsX]}
              onValueChange={(value) => handleChange('segmentsX', value[0])}
              min={32}
              max={128}
              step={16}
              className="w-full"
            />
          </div>

          {/* Segments Y */}
          <div>
            <Label className="text-[13px] font-medium text-white/70 mb-1.5 block">
              Segments Y: <span className="text-primary">{localSettings.segmentsY}</span>
            </Label>
            <Slider
              value={[localSettings.segmentsY]}
              onValueChange={(value) => handleChange('segmentsY', value[0])}
              min={32}
              max={128}
              step={16}
              className="w-full"
            />
          </div>

          {/* Enable Collision */}
          <div className="flex items-center justify-between py-1">
            <Label className="text-[13px] font-medium text-white/70">Enable Collision</Label>
            <Switch
              checked={localSettings.enableCollision}
              onCheckedChange={(value) => handleChange('enableCollision', value)}
            />
          </div>

          {/* Show Vegetation */}
          <div className="flex items-center justify-between py-1">
            <Label className="text-[13px] font-medium text-white/70">Show Vegetation</Label>
            <Switch
              checked={localSettings.showVegetation}
              onCheckedChange={(value) => handleChange('showVegetation', value)}
            />
          </div>

          {/* Vegetation Density */}
          {localSettings.showVegetation && (
            <div>
              <Label className="text-[13px] font-medium text-white/70 mb-1.5 block">
                Vegetation Density: <span className="text-primary">{(localSettings.vegetationDensity * 100).toFixed(0)}%</span>
              </Label>
              <Slider
                value={[localSettings.vegetationDensity]}
                onValueChange={(value) => handleChange('vegetationDensity', value[0])}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
          <Button
            onClick={handleApply}
            className="flex-1 text-[13px] font-medium h-10 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(210 100% 50%) 100%)',
              boxShadow: '0 4px 15px hsl(var(--primary) / 0.3)',
            }}
          >
            Generate Terrain
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 text-[13px] font-medium h-10 rounded-lg bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
          >
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
};
