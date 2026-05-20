import { Save, Upload, X, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePixllandBridge } from '@/hooks/usePixllandBridge';
import { cn } from '@/lib/utils';

interface EmbeddedActionsProps {
  className?: string;
  variant?: 'header' | 'floating';
}

export const EmbeddedActions = ({ className, variant = 'header' }: EmbeddedActionsProps) => {
  const { isEmbedded, saveToPixlland, publishToPixlland, recordVix, closeOverlay } = usePixllandBridge();

  if (!isEmbedded) return null;

  const handleSave = () => {
    saveToPixlland({ title: 'Meu Projeto' });
  };

  const handlePublish = () => {
    publishToPixlland({ title: 'Meu Jogo' });
  };

  const handleRecordVix = () => {
    // TODO: Implement video recording and then call recordVix with proper data
    console.log('[EmbeddedActions] Record VIX - needs video recording implementation');
  };

  if (variant === 'floating') {
    return (
      <div className={cn(
        'fixed top-4 right-4 z-50 flex items-center gap-2',
        className
      )}>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSave}
          className="gap-1.5 bg-secondary/90 backdrop-blur-sm"
        >
          <Save className="w-4 h-4" />
          Salvar
        </Button>
        
        <Button
          size="sm"
          variant="default"
          onClick={handlePublish}
          className="gap-1.5"
        >
          <Upload className="w-4 h-4" />
          Publicar
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={closeOverlay}
          className="w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleRecordVix}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Video className="w-4 h-4" />
        <span className="hidden sm:inline">Gravar</span>
      </Button>
      
      <Button
        size="sm"
        variant="secondary"
        onClick={handleSave}
        className="gap-1.5"
      >
        <Save className="w-4 h-4" />
        <span className="hidden sm:inline">Salvar</span>
      </Button>
      
      <Button
        size="sm"
        variant="default"
        onClick={handlePublish}
        className="gap-1.5"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Publicar</span>
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        size="icon"
        variant="ghost"
        onClick={closeOverlay}
        className="w-8 h-8 hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};
