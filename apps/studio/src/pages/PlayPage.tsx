import { useParams, Navigate } from 'react-router-dom';
import { GameCanvas } from '@/components/canvas/GameCanvas';
import { GameHUD } from '@/components/canvas/GameHUD';
import { MobileGameControls } from '@/components/canvas/MobileGameControls';
import { TemplateId, GAME_TEMPLATES } from '@/stores/gameStore';

const PlayPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  
  // Validate template ID
  const isValidTemplate = GAME_TEMPLATES.some(t => t.id === templateId);
  
  if (!templateId || !isValidTemplate) {
    return <Navigate to="/" replace />;
  }
  
  // Determine which controls to show based on template
  const isFPS = templateId === 'fps-horror';
  const isPlatformer = templateId === 'platformer-2d';
  const isRacing = templateId === 'racing';
  
  return (
    <div className="fixed inset-0 bg-background">
      <GameCanvas templateId={templateId as TemplateId} />
      <GameHUD templateId={templateId} />
      
      {/* Mobile Game Controls */}
      {!isRacing && (
        <MobileGameControls 
          showJump={!isFPS}
          showLookArea={isFPS}
          showActions={false}
        />
      )}
    </div>
  );
};

export default PlayPage;
