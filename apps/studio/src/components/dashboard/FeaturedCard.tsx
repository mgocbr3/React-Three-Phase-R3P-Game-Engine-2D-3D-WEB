import { GameTemplate } from '@/stores/gameStore';
import { Play, Pencil } from 'lucide-react';

// Import hero images
import adventureHero from '@/assets/templates/adventure-hero.jpg';
import horrorHero from '@/assets/templates/horror-hero.jpg';
import racingHero from '@/assets/templates/racing-hero.jpg';
import rpgHero from '@/assets/templates/rpg-hero.jpg';
import platformerHero from '@/assets/templates/platformer-hero.jpg';
import socialHero from '@/assets/templates/social-hero.jpg';
import hyperRealisticHero from '@/assets/templates/hyper-realistic-hero.jpg';
import gta6Hero from '@/assets/templates/gta6-hero.jpg';

interface FeaturedCardProps {
  template: GameTemplate;
  badge?: string;
  size?: 'large' | 'medium';
  onFork?: (template: GameTemplate) => void;
  onPlay?: (template: GameTemplate) => void;
}

const heroImages: Record<string, string> = {
  'adventure': adventureHero,
  'fps-horror': horrorHero,
  'racing': racingHero,
  'rpg-topdown': rpgHero,
  'platformer-2d': platformerHero,
  'social-hub': socialHero,
  'hyper-realistic': hyperRealisticHero,
  'gta6-vice-city': gta6Hero,
};

const overlayGradients = {
  purple: 'from-neon-purple/80 via-neon-purple/40 to-transparent',
  cyan: 'from-neon-cyan/80 via-neon-cyan/40 to-transparent',
  pink: 'from-neon-pink/80 via-neon-pink/40 to-transparent',
  green: 'from-neon-green/80 via-neon-green/40 to-transparent',
  orange: 'from-neon-orange/80 via-neon-orange/40 to-transparent',
  red: 'from-neon-red/80 via-neon-red/40 to-transparent',
  blue: 'from-blue-600/80 via-blue-600/40 to-transparent',
};

const iconBgColors = {
  purple: 'from-neon-purple to-neon-purple/60',
  cyan: 'from-neon-cyan to-neon-cyan/60',
  pink: 'from-neon-pink to-neon-pink/60',
  green: 'from-neon-green to-neon-green/60',
  orange: 'from-neon-orange to-neon-orange/60',
  red: 'from-neon-red to-neon-red/60',
  blue: 'from-blue-500 to-blue-600/60',
};

export const FeaturedCard = ({ template, badge, size = 'large', onFork, onPlay }: FeaturedCardProps) => {
  const isLarge = size === 'large';
  const heroImage = heroImages[template.id];

  const handlePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onPlay?.(template);
  };

  const handleFork = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFork?.(template);
  };
  
  return (
    <div
      className={`
        group relative overflow-hidden
        ${isLarge ? 'min-h-[380px] md:min-h-[420px]' : 'min-h-[280px]'}
        rounded-3xl cursor-pointer
        bg-card
        transition-all duration-500 ease-out
        hover:scale-[1.02] hover:shadow-2xl
        shadow-lg
      `}
      onClick={handlePlay}
    >
      {/* Hero Image Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      
      {/* Gradient overlays for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <div className={`absolute inset-0 bg-gradient-to-br ${overlayGradients[template.color]} opacity-30`} />
      
      {/* Animated glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-white/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-6">
        {/* Badge */}
        {badge && (
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-white/90 mb-2 drop-shadow-md">
            {badge}
          </span>
        )}
        
        {/* Title */}
        <h3 className={`
          font-bold text-white mb-1.5 leading-tight drop-shadow-lg
          ${isLarge ? 'text-2xl md:text-3xl' : 'text-xl'}
        `}>
          {template.name}
        </h3>
        
        {/* Description */}
        <p className={`
          text-white/90 mb-4 line-clamp-2 drop-shadow-md
          ${isLarge ? 'text-sm md:text-base' : 'text-sm'}
        `}>
          {template.description}
        </p>

        {/* App-style footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mini icon with gradient */}
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center text-2xl 
              shadow-lg border border-white/20
              bg-gradient-to-br ${iconBgColors[template.color]}
            `}>
              {template.icon}
            </div>
            <div>
              <p className="text-white font-medium text-sm drop-shadow">{template.name}</p>
              <p className="text-white/70 text-xs">{template.features[0]}</p>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleFork}
              className="
                px-4 py-2 rounded-full 
                bg-white/20 backdrop-blur-md 
                border border-white/20
                text-white text-sm font-semibold
                hover:bg-white/30 transition-all
                flex items-center gap-1.5
              "
            >
              <Pencil className="w-3.5 h-3.5" />
              Fork
            </button>
            <button
              onClick={handlePlay}
              className="
                px-4 py-2 rounded-full 
                bg-white text-gray-900
                text-sm font-semibold
                hover:bg-white/90 transition-all
                flex items-center gap-1.5
                shadow-lg
              "
            >
              <Play className="w-3.5 h-3.5" />
              Jogar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
