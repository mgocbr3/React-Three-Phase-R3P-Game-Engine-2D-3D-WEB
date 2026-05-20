import { useState } from 'react';
import { 
  Play, Pause, RotateCcw, SkipBack, SkipForward, 
  RefreshCw, Layers, Clock, Zap, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimationSettings } from '@/stores/editorStore';

interface AnimationSectionProps {
  animationSettings?: AnimationSettings;
  onUpdate: (settings: Partial<AnimationSettings>) => void;
  onLoadModel?: () => void;
}

export const AnimationSection = ({
  animationSettings,
  onUpdate,
  onLoadModel,
}: AnimationSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const settings: AnimationSettings = animationSettings || {
    availableAnimations: [],
    autoPlay: true,
    loop: true,
    speed: 1,
    crossFadeDuration: 0.5,
    paused: false,
    currentTime: 0,
  };
  
  const hasAnimations = settings.availableAnimations.length > 0;
  const hasModel = !!settings.modelUrl;
  
  const handlePlayPause = () => {
    onUpdate({ paused: !settings.paused });
  };
  
  const handleReset = () => {
    onUpdate({ currentTime: 0, paused: false });
  };
  
  const handleAnimationChange = (animName: string) => {
    onUpdate({ currentAnimation: animName, currentTime: 0 });
  };
  
  return (
    <div className="border-b border-border">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium">Animation</span>
          {hasAnimations && (
            <span className="text-[10px] bg-secondary/30 text-muted-foreground px-1.5 py-0.5 rounded">
              {settings.availableAnimations.length}
            </span>
          )}
        </div>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-muted-foreground transition-transform",
          isExpanded && "rotate-180"
        )} />
      </button>
      
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Model URL */}
          {!hasModel && (
            <div className="flex flex-col items-center py-4 text-center">
              <Layers className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground mb-2">Nenhum modelo carregado</p>
              <button 
                onClick={onLoadModel}
                className="text-xs text-primary hover:underline"
              >
                Importar modelo GLTF
              </button>
            </div>
          )}
          
          {hasModel && (
            <>
              {/* Model info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded px-2 py-1.5">
                <RefreshCw className="w-3 h-3" />
                <span className="truncate flex-1">{settings.modelUrl?.split('/').pop()}</span>
              </div>
              
              {/* Animation Selector */}
              {hasAnimations ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Animação Atual
                  </label>
                  <select
                    value={settings.currentAnimation || ''}
                    onChange={(e) => handleAnimationChange(e.target.value)}
                    className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {settings.availableAnimations.map((anim) => (
                      <option key={anim} value={anim}>{anim}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Este modelo não possui animações
                </p>
              )}
              
              {/* Playback Controls */}
              {hasAnimations && (
                <>
                  <div className="flex items-center justify-center gap-2 py-2">
                    <button
                      onClick={handleReset}
                      className="p-2 rounded hover:bg-secondary text-muted-foreground"
                      title="Reiniciar"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handlePlayPause}
                      className={cn(
                        "p-3 rounded-full transition-colors",
                        settings.paused 
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-orange-500 text-white hover:bg-orange-600"
                      )}
                      title={settings.paused ? "Play" : "Pause"}
                    >
                      {settings.paused ? (
                        <Play className="w-5 h-5" />
                      ) : (
                        <Pause className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => onUpdate({ currentTime: 0 })}
                      className="p-2 rounded hover:bg-secondary text-muted-foreground"
                      title="Próximo"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Speed Control */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <Zap className="w-3 h-3" />
                        Velocidade
                      </label>
                      <span className="text-xs font-mono">{settings.speed.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={settings.speed}
                      onChange={(e) => onUpdate({ speed: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0.1x</span>
                      <span>3x</span>
                    </div>
                  </div>
                  
                  {/* Crossfade Duration */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Crossfade
                      </label>
                      <span className="text-xs font-mono">{settings.crossFadeDuration.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.crossFadeDuration}
                      onChange={(e) => onUpdate({ crossFadeDuration: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  
                  {/* Toggles */}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.loop}
                        onChange={(e) => onUpdate({ loop: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-border accent-primary"
                      />
                      <span className="text-xs">Loop</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoPlay}
                        onChange={(e) => onUpdate({ autoPlay: e.target.checked })}
                        className="w-3.5 h-3.5 rounded border-border accent-primary"
                      />
                      <span className="text-xs">Auto Play</span>
                    </label>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Helper to get default animation settings
export const getDefaultAnimationSettings = (): AnimationSettings => ({
  availableAnimations: [],
  autoPlay: true,
  loop: true,
  speed: 1,
  crossFadeDuration: 0.5,
  paused: false,
  currentTime: 0,
});
