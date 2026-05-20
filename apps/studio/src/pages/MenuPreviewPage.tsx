import { useState } from 'react';
import { MainMenu } from '@/components/game/MainMenu';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export const MenuPreviewPage = () => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(true);

  const handleStart = () => {
    toast.success('Jogo iniciado!');
    setShowMenu(false);
    // Aqui você pode navegar para o jogo propriamente dito
    // navigate('/play');
  };

  const handleOptions = () => {
    toast.info('Abrir painel de opções');
    // Implementar painel de opções
  };

  const handleExit = () => {
    toast.info('Sair do jogo');
    navigate(-1);
  };

  return (
    <div className="relative w-full h-screen">
      {/* Back button (editor mode) */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4 z-50"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar ao Editor
      </Button>

      {showMenu ? (
        <MainMenu
          onStart={handleStart}
          onOptions={handleOptions}
          onExit={handleExit}
        />
      ) : (
        <div className="flex items-center justify-center h-full bg-black text-white text-2xl">
          <div className="text-center">
            <h1 className="mb-4">Jogo Iniciado!</h1>
            <p className="text-lg text-gray-400 mb-8">
              Aqui seria renderizado o seu jogo
            </p>
            <Button onClick={() => setShowMenu(true)}>
              Voltar ao Menu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
