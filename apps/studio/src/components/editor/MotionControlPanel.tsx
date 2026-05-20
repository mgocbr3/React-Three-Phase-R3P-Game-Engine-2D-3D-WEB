import React from 'react';
import { 
  Hand, Camera, Gamepad2, Video, Eye, Bug, 
  Sliders, MousePointer, User, RotateCcw, Zap,
  Target, Grab, Shield, Rocket,
  LucideIcon
} from 'lucide-react';
import type { GestureAction } from '@/stores/motionControlStore';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useMotionControlStore, MotionControlMode } from '@/stores/motionControlStore';
import { cn } from '@/lib/utils';

interface MotionControlPanelProps {
  className?: string;
}

const MODE_OPTIONS: { value: MotionControlMode; label: string; icon: LucideIcon; description: string }[] = [
  { value: 'off', label: 'Desligado', icon: Video, description: 'Controle por movimento desativado' },
  { value: 'cursor', label: 'Cursor', icon: MousePointer, description: 'Move o cursor na tela' },
  { value: 'character', label: 'Personagem', icon: User, description: 'Controla movimento do personagem' },
  { value: 'camera', label: 'Câmera', icon: RotateCcw, description: 'Gira a câmera do jogo' },
  { value: 'custom', label: 'Personalizado', icon: Sliders, description: 'Configure cada ação manualmente' },
];

const ACTION_OPTIONS: { value: GestureAction; label: string }[] = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'click', label: 'Clique' },
  { value: 'grab', label: 'Agarrar' },
  { value: 'attack', label: 'Atacar' },
  { value: 'brake', label: 'Frear' },
  { value: 'block', label: 'Bloquear' },
  { value: 'special', label: 'Especial' },
  { value: 'jump', label: 'Pular' },
  { value: 'release', label: 'Soltar' },
  { value: 'interact', label: 'Interagir' },
  { value: 'shoot', label: 'Atirar' },
  { value: 'select', label: 'Selecionar' },
  { value: 'aim', label: 'Mirar' },
];

export const MotionControlPanel: React.FC<MotionControlPanelProps> = ({ className }) => {
  const {
    enabled,
    mode,
    mapping,
    showPreview,
    showDebugOverlay,
    setEnabled,
    setMode,
    updateMapping,
    setShowPreview,
    setShowDebugOverlay,
    resetToDefaults,
  } = useMotionControlStore();

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'p-2 rounded-lg',
            enabled ? 'bg-gradient-to-br from-muted to-muted' : 'bg-muted'
          )}>
            <Hand className={cn('w-5 h-5', enabled ? 'text-muted-foreground' : 'text-muted-foreground')} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Motion Control</h3>
            <p className="text-xs text-muted-foreground">Controle por movimento estilo Wii</p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      <Separator className="bg-border/50" />

      {/* Mode Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Modo de Controle</Label>
        <div className="grid grid-cols-2 gap-2">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setMode(option.value)}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg border transition-all text-left',
                mode === option.value
                  ? 'bg-secondary/30 border-border text-muted-foreground'
                  : 'bg-muted/30 border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              <option.icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium truncate">{option.label}</span>
            </button>
          ))}
        </div>
        
        {/* Mode explanation */}
        {mode === 'character' && (
          <div className="p-2 rounded-lg bg-secondary/30 border border-border text-xs text-muted-foreground">
            <p className="font-medium mb-1"> Modo Personagem</p>
            <p className="text-muted-foreground/80">
              Mova a mão para controlar o personagem. Use gestos para pular, atacar e interagir!
            </p>
          </div>
        )}
        {mode === 'cursor' && (
          <div className="p-2 rounded-lg bg-secondary/30 border border-border text-xs text-muted-foreground">
            <p className="font-medium mb-1"> Modo Cursor</p>
            <p className="text-muted-foreground/80">
              Mova a mão para controlar o cursor. Pinça para clicar!
            </p>
          </div>
        )}
        {mode === 'camera' && (
          <div className="p-2 rounded-lg bg-secondary/30 border border-border text-xs text-muted-foreground">
            <p className="font-medium mb-1"> Modo Câmera</p>
            <p className="text-muted-foreground/80">
              Mova a mão para rotacionar a câmera do jogo.
            </p>
          </div>
        )}
      </div>

      {enabled && (
        <>
          <Separator className="bg-border/50" />

          {/* Gesture Mappings */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Gamepad2 className="w-3 h-3" />
              Mapeamento de Gestos
            </Label>

            <div className="space-y-2">
              {/* Pinch Action */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Grab className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Pinça (→)</span>
                </div>
                <Select
                  value={mapping.pinchAction}
                  onValueChange={(v) => updateMapping({ pinchAction: v as GestureAction })}
                >
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fist Action */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Shield className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Punho ()</span>
                </div>
                <Select
                  value={mapping.fistAction}
                  onValueChange={(v) => updateMapping({ fistAction: v as GestureAction })}
                >
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Open Hand Action */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Rocket className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Mão Aberta ()</span>
                </div>
                <Select
                  value={mapping.openHandAction}
                  onValueChange={(v) => updateMapping({ openHandAction: v as GestureAction })}
                >
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Point Action */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Target className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Apontar ()</span>
                </div>
                <Select
                  value={mapping.pointAction}
                  onValueChange={(v) => updateMapping({ pointAction: v as GestureAction })}
                >
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Sensitivity */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Sliders className="w-3 h-3" />
              Ajustes
            </Label>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Sensibilidade</span>
                  <span className="text-xs text-muted-foreground">{mapping.movementSensitivity.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[mapping.movementSensitivity]}
                  min={0.1}
                  max={3}
                  step={0.1}
                  onValueChange={([v]) => updateMapping({ movementSensitivity: v })}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Suavização</span>
                  <span className="text-xs text-muted-foreground">{(mapping.smoothing * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[mapping.smoothing]}
                  min={0.05}
                  max={0.5}
                  step={0.01}
                  onValueChange={([v]) => updateMapping({ smoothing: v })}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Display Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Eye className="w-3 h-3" />
                <span className="text-muted-foreground">Mostrar Preview</span>
              </div>
              <Switch
                checked={showPreview}
                onCheckedChange={setShowPreview}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Bug className="w-3 h-3" />
                <span className="text-muted-foreground">Debug Overlay</span>
              </div>
              <Switch
                checked={showDebugOverlay}
                onCheckedChange={setShowDebugOverlay}
              />
            </div>
          </div>

          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={resetToDefaults}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Restaurar Padrões
          </Button>
        </>
      )}

      {/* Info */}
      <div className="bg-gradient-to-br from-secondary to-secondary rounded-lg p-3 border border-border">
        <div className="flex items-start gap-2">
          <Zap className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Estilo Nintendo Wii!</p>
            <p>
              Use gestos da sua mão para controlar o jogo. 
              Aponte , feche o punho , ou faça pinça  para ações diferentes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
