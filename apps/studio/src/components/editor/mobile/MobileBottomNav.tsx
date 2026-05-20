import { 
  Wrench, 
  FileCode, 
  Gamepad2, 
  SlidersHorizontal,
  Sparkles,
  Square,
  LucideIcon 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editorStore';

export type MobileTab = 'editor' | 'inspector' | 'scripts' | 'vibecode' | 'play';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onInspector: () => void;
  onScripts: () => void;
  onVibeCode: () => void;
}

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  highlight?: boolean;
  danger?: boolean;
  onClick: () => void;
}

const NavItem = ({ icon: Icon, label, active, highlight, danger, onClick }: NavItemProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1 py-2.5 px-4 transition-all min-w-0 rounded-xl',
        danger
          ? 'text-muted-foreground bg-secondary/30'
          : active 
            ? highlight 
              ? 'text-muted-foreground bg-secondary/30' 
              : 'text-primary bg-primary/10' 
            : 'text-white/50 hover:text-white/70'
      )}
      style={{ fontFamily: 'Roboto, Noto Sans, sans-serif' }}
    >
      <Icon className={cn('w-5 h-5', (active || danger) && 'stroke-[2.5px]', danger && 'fill-red-400')} />
      <span className={cn(
        'text-[11px] font-medium',
        (active || danger) && 'font-semibold'
      )}>
        {label}
      </span>
    </button>
  );
};

const glassStyle = {
  background: 'linear-gradient(135deg, hsl(225 15% 12% / 0.95) 0%, hsl(225 15% 10% / 0.98) 100%)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  fontFamily: 'Roboto, Noto Sans, sans-serif',
};

export const MobileBottomNav = ({ 
  activeTab, 
  onTabChange, 
  onInspector, 
  onScripts, 
  onVibeCode 
}: MobileBottomNavProps) => {
  const { isEditMode } = useEditorStore();
  
  return (
    <nav className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div 
        className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/10 shadow-2xl shadow-black/40"
        style={glassStyle}
      >
        {/* Editor */}
        <NavItem 
          icon={Wrench} 
          label="Editor" 
          active={activeTab === 'editor'} 
          onClick={() => onTabChange('editor')} 
        />
        
        {/* Separator */}
        <div className="w-px h-8 bg-white/10" />
        
        {/* Inspector */}
        <NavItem 
          icon={SlidersHorizontal} 
          label="Inspector" 
          active={activeTab === 'inspector'} 
          onClick={() => {
            onTabChange('inspector');
            onInspector();
          }} 
        />
        
        {/* Scripts */}
        <NavItem 
          icon={FileCode} 
          label="Scripts" 
          active={activeTab === 'scripts'} 
          onClick={() => {
            onTabChange('scripts');
            onScripts();
          }} 
        />
        
        {/* Vibe Code */}
        <NavItem 
          icon={Sparkles} 
          label="VibeCode" 
          active={activeTab === 'vibecode'}
          highlight
          onClick={() => {
            onTabChange('vibecode');
            onVibeCode();
          }} 
        />
        
        {/* Separator */}
        <div className="w-px h-8 bg-white/10" />
        
        {/* Play/Stop toggle */}
        {isEditMode ? (
          <NavItem 
            icon={Gamepad2} 
            label="Play" 
            active={activeTab === 'play'} 
            onClick={() => onTabChange('play')} 
          />
        ) : (
          <NavItem 
            icon={Square} 
            label="Stop" 
            danger
            onClick={() => onTabChange('editor')} 
          />
        )}
      </div>
    </nav>
  );
};
