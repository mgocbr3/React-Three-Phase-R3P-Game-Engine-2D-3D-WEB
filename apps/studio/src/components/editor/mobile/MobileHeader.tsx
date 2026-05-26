import { useState, useRef, useEffect } from 'react';
import { 
  Layers, 
  Play, 
  Square,
  Home,
  ArrowLeft,
  X,
  Save,
  Upload,
  ExternalLink,
  Mountain,
  Download,
  FolderOpen,
  Undo,
  Redo,
  Smartphone,
  Monitor,
  MonitorSmartphone,
  Box,
  Circle,
  Sun,
  Camera,
  Gamepad2,
  Grid3X3,
  Eye,
  PanelLeft,
  PanelBottom,
  LayoutGrid,
  HelpCircle,
  Book,
  MessageSquare,
  Github,
  Keyboard,
  Copy,
  Clipboard,
  Trash2,
  Pause,
  Triangle
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { useNavigate } from 'react-router-dom';
import { useTerrainStore } from '@/stores/terrainStore';
import { useInterfaceStore } from '@/stores/interfaceStore';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { cn } from '@/lib/utils';

// No props needed - hierarchy moved to toolbar

interface MenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
  color?: string;
}

export const MobileHeader = () => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const {
    isEditMode,
    toggleEditMode,
    undo,
    redo,
    canUndo,
    canRedo,
    addObject,
    deleteObject,
    duplicateObject,
    selectedObjectId
  } = useEditorStore();
  const { setModalOpen: setTerrainModalOpen } = useTerrainStore();
  const { interfaceMode, setInterfaceMode } = useInterfaceStore();
  const { showGrid, showStats, updateSettings } = useEngineSettings();

  const toggleGrid = () => updateSettings({ showGrid: !showGrid });
  const toggleStats = () => updateSettings({ showStats: !showStats });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const glassStyle = {
    background: 'linear-gradient(135deg, hsl(225 15% 12% / 0.95) 0%, hsl(225 15% 10% / 0.98) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    fontFamily: 'Roboto, Noto Sans, sans-serif',
  };

  const menuConfig: Record<string, MenuItem[]> = {
    File: [
      { label: 'Novo Projeto', icon: FolderOpen, color: 'text-muted-foreground' },
      { label: 'Abrir...', icon: FolderOpen, color: 'text-muted-foreground' },
      { label: 'Salvar', icon: Save, color: 'text-muted-foreground' },
      { label: '', divider: true },
      { label: 'Exportar', icon: Download, color: 'text-muted-foreground' },
      { label: '', divider: true },
      { label: 'Início', icon: Home, action: () => navigate('/'), color: 'text-muted-foreground' },
    ],
    Edit: [
      { label: 'Desfazer', icon: Undo, action: undo, disabled: !canUndo(), color: 'text-muted-foreground' },
      { label: 'Refazer', icon: Redo, action: redo, disabled: !canRedo(), color: 'text-muted-foreground' },
      { label: '', divider: true },
      { label: 'Copiar', icon: Copy, disabled: !selectedObjectId, color: 'text-muted-foreground' },
      { label: 'Colar', icon: Clipboard, color: 'text-muted-foreground' },
      { label: 'Duplicar', icon: Copy, action: () => selectedObjectId && duplicateObject(selectedObjectId), disabled: !selectedObjectId, color: 'text-muted-foreground' },
      { label: '', divider: true },
      { label: 'Deletar', icon: Trash2, action: () => selectedObjectId && deleteObject(selectedObjectId), disabled: !selectedObjectId, color: 'text-muted-foreground' },
    ],
    Add: [
      { label: 'Terreno', icon: Mountain, action: () => setTerrainModalOpen(true), color: 'text-muted-foreground' },
      { label: '', divider: true },
      { label: 'Cubo', icon: Box, action: () => addObject('box'), color: 'text-muted-foreground' },
      { label: 'Esfera', icon: Circle, action: () => addObject('sphere'), color: 'text-muted-foreground' },
      { label: 'Cilindro', icon: Box, action: () => addObject('cylinder'), color: 'text-muted-foreground' },
      { label: 'Plano', icon: Grid3X3, action: () => addObject('plane'), color: 'text-muted-foreground' },
      { label: '', divider: true },
      { label: 'Luz Pontual', icon: Sun, action: () => addObject('light'), color: 'text-muted-foreground' },
      { label: 'Spot Light', icon: Triangle, action: () => addObject('spotlight'), color: 'text-muted-foreground' },
      { label: 'Luz Direcional', icon: Sun, action: () => addObject('sunlight'), color: 'text-muted-foreground' },
    ],
    Window: [
      { label: showGrid ? ' Mostrar Grid' : 'Mostrar Grid', icon: Grid3X3, action: toggleGrid, color: 'text-muted-foreground' },
      { label: showStats ? ' Mostrar Stats' : 'Mostrar Stats', icon: Eye, action: toggleStats, color: 'text-muted-foreground' },
      { label: '', divider: true },
      { label: 'Hierarquia', icon: PanelLeft, color: 'text-muted-foreground' },
      { label: 'Assets Browser', icon: PanelBottom, color: 'text-muted-foreground' },
      { label: 'Console', icon: PanelBottom, color: 'text-muted-foreground' },
      { label: '', divider: true },
      { label: interfaceMode === 'auto' ? ' Automático' : 'Automático', icon: MonitorSmartphone, action: () => setInterfaceMode('auto'), color: 'text-muted-foreground' },
      { label: interfaceMode === 'mobile' ? ' PixlPlayground' : 'PixlPlayground', icon: Smartphone, action: () => setInterfaceMode('mobile'), color: 'text-muted-foreground' },
      { label: interfaceMode === 'desktop' ? ' PixlStudio Pro' : 'PixlStudio Pro', icon: Monitor, action: () => setInterfaceMode('desktop'), color: 'text-muted-foreground' },
      { label: '', divider: true },
      { label: 'Restaurar Layout', icon: LayoutGrid, color: 'text-slate-400' },
    ],
    Help: [
      { label: 'Documentação', icon: Book, color: 'text-muted-foreground' },
      { label: 'Tutoriais', icon: HelpCircle, color: 'text-muted-foreground' },
      { label: 'Atalhos', icon: Keyboard, color: 'text-muted-foreground' },
      { label: '', divider: true },
      { label: 'Discord', icon: MessageSquare, color: 'text-indigo-400' },
      { label: 'GitHub', icon: Github, color: 'text-slate-300' },
    ],
  };

  const currentMenuConfig = menuConfig;

  return (
    <header
      className="h-11 shrink-0 px-2 flex items-center justify-between border-b border-white/10 relative z-[100]"
      style={glassStyle}
    >
      {/* Left - Back */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => navigate('/')}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center active:scale-95 transition-all border border-white/10"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4 text-white/80" />
        </button>
      </div>

      {/* Center - Desktop-style Menu */}
      <nav ref={menuRef} className="flex items-center">
        {Object.keys(currentMenuConfig).map((menu) => (
          <div key={menu} className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === menu ? null : menu)}
              onMouseEnter={() => activeMenu && setActiveMenu(menu)}
              className={cn(
                "px-2 py-1 text-[11px] font-medium transition-colors rounded",
                activeMenu === menu 
                  ? "bg-white/10 text-white" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              {menu}
            </button>
            
            {/* Dropdown Menu */}
            {activeMenu === menu && (
              <div 
                className="absolute top-full left-0 mt-1 w-44 bg-[#1e1e2e] border border-[#3a3a4a] rounded-xl shadow-2xl shadow-black/50 py-1 z-[200] overflow-hidden"
                style={{ fontFamily: 'Roboto, Noto Sans, sans-serif' }}
              >
                {currentMenuConfig[menu].map((item, idx) => (
                  item.divider ? (
                    <div key={idx} className="h-px bg-[#3a3a4a] my-1 mx-2" />
                  ) : (
                    <button
                      key={idx}
                      onClick={() => {
                        item.action?.();
                        setActiveMenu(null);
                      }}
                      disabled={item.disabled}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-2 text-[12px] text-left transition-colors",
                        item.disabled 
                          ? "text-[#6a6a7a] cursor-not-allowed" 
                          : "text-[#e0e0e8] hover:bg-[#2a2a3a] active:bg-[#3a3a4a]"
                      )}
                    >
                      {item.icon && <item.icon className={cn("w-3.5 h-3.5", item.color)} />}
                      <span className="flex-1">{item.label}</span>
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
        ))}
        </nav>

      {/* Right - spacer */}
      <div className="w-8" />
    </header>
  );
};
