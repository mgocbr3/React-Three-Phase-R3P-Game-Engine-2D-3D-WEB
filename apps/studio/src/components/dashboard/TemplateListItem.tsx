import { GameTemplate } from '@/stores/gameStore';
import { Play, Pencil } from 'lucide-react';

// Import hero images for thumbnails
import adventureHero from '@/assets/templates/adventure-hero.jpg';
import horrorHero from '@/assets/templates/horror-hero.jpg';
import racingHero from '@/assets/templates/racing-hero.jpg';
import rpgHero from '@/assets/templates/rpg-hero.jpg';
import platformerHero from '@/assets/templates/platformer-hero.jpg';
import socialHero from '@/assets/templates/social-hero.jpg';
import hyperRealisticHero from '@/assets/templates/hyper-realistic-hero.jpg';

interface TemplateListItemProps {
  template: GameTemplate;
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

export const TemplateListItem = ({ template, onFork, onPlay }: TemplateListItemProps) => {
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
    <div className={`
      group relative flex items-center gap-4 p-4
      rounded-2xl transition-all duration-200
      bg-card/50 backdrop-blur-sm
      border border-border/50
      hover:bg-secondary/50 hover:border-border
      cursor-pointer
    `}
    onClick={handlePlay}
    >
      {/* Thumbnail Image */}
      <div className="
        w-16 h-16 rounded-2xl flex-shrink-0
        overflow-hidden shadow-lg
        relative
      ">
        <img 
          src={heroImage} 
          alt={template.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        {/* Colored overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${iconBgColors[template.color]} opacity-20`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground truncate">
          {template.name}
        </h4>
        <p className="text-sm text-muted-foreground truncate">
          {template.description}
        </p>
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {template.features.slice(0, 3).map((feature) => (
            <span
              key={feature}
              className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleFork}
          className="
            p-2.5 rounded-full 
            bg-secondary/80 text-muted-foreground
            hover:bg-primary/20 hover:text-primary
            transition-all
          "
          title="Fazer fork do template"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={handlePlay}
          className={`
            px-5 py-2 rounded-full 
            bg-gradient-to-r ${iconBgColors[template.color]}
            text-white text-sm font-semibold
            hover:opacity-90 transition-all
            shadow-md
            flex items-center gap-1.5
          `}
        >
          <Play className="w-3.5 h-3.5" />
          Jogar
        </button>
      </div>
    </div>
  );
};
