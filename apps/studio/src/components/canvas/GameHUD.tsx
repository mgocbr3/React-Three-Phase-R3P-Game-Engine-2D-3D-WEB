import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useGameStore, GAME_TEMPLATES } from '@/stores/gameStore';
import { ArrowLeft, Settings, Share2, Heart, Maximize } from 'lucide-react';
import logo from '@/assets/logo.png';

interface GameHUDProps {
  templateId: string;
}

export const GameHUD = ({ templateId }: GameHUDProps) => {
  const navigate = useNavigate();
  const { health, score } = useGameStore();
  
  const template = GAME_TEMPLATES.find(t => t.id === templateId);
  
  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };
  
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-background/90 backdrop-blur-sm border-b border-border flex items-center justify-between px-3 pointer-events-auto">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/')}>
            <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>

          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="w-5 h-5" />
            <span className="text-sm text-foreground font-medium">{template?.name}</span>
            <span className="text-lg">{template?.icon}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleFullscreen}>
            <Maximize className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
      
      {/* Game Stats (left side) */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto">
        {/* Health */}
        <div className="bg-background/90 backdrop-blur-sm border border-border rounded-md p-3 w-40">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-3.5 h-3.5 text-destructive" />
            <span className="text-xs text-muted-foreground">Vida</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-destructive transition-all duration-300"
              style={{ width: `${health}%` }}
            />
          </div>
        </div>
        
        {/* Score */}
        <div className="bg-background/90 backdrop-blur-sm border border-border rounded-md p-3">
          <div className="text-xs text-muted-foreground mb-0.5">Pontos</div>
          <div className="text-xl font-semibold text-primary">{score.toLocaleString()}</div>
        </div>
      </div>
      
      {/* Controls hint (bottom) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm border border-border rounded-md px-4 py-2 pointer-events-auto">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-secondary rounded text-foreground font-mono text-[10px]">WASD</kbd>
            <span>Mover</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-secondary rounded text-foreground font-mono text-[10px]">SPACE</kbd>
            <span>Pular</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-secondary rounded text-foreground font-mono text-[10px]">MOUSE</kbd>
            <span>Câmera</span>
          </div>
        </div>
      </div>
    </div>
  );
};
