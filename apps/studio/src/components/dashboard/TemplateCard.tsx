import { GameTemplate } from '@/stores/gameStore';
import { Pencil, Play } from 'lucide-react';

import adventureHero from '@/assets/templates/adventure-hero.jpg';
import horrorHero from '@/assets/templates/horror-hero.jpg';
import racingHero from '@/assets/templates/racing-hero.jpg';
import rpgHero from '@/assets/templates/rpg-hero.jpg';
import platformerHero from '@/assets/templates/platformer-hero.jpg';
import socialHero from '@/assets/templates/social-hero.jpg';
import hyperRealisticHero from '@/assets/templates/hyper-realistic-hero.jpg';
import gta6Hero from '@/assets/templates/gta6-hero.jpg';

interface TemplateCardProps {
  template: GameTemplate;
  onEdit?: (template: GameTemplate) => void;
  onPlay?: (template: GameTemplate) => void;
}

const heroImages: Record<string, string> = {
  adventure: adventureHero,
  'fps-horror': horrorHero,
  racing: racingHero,
  'rpg-topdown': rpgHero,
  'platformer-2d': platformerHero,
  'social-hub': socialHero,
  'hyper-realistic': hyperRealisticHero,
  'gta6-vice-city': gta6Hero,
};

export const TemplateCard = ({ template, onEdit, onPlay }: TemplateCardProps) => {
  const heroImage = heroImages[template.id];

  return (
    <article className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50 hover:bg-secondary/40">
      <button
        type="button"
        onClick={() => onEdit?.(template)}
        className="block w-full text-left"
      >
        <div className="aspect-[16/9] overflow-hidden bg-secondary">
          <img
            src={heroImage}
            alt={template.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>

        <div className="p-3">
          <div className="flex min-w-0 items-start gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-base">
              {template.icon}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">{template.name}</h3>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{template.description}</p>
            </div>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={() => onEdit?.(template)}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-secondary text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </button>
        <button
          type="button"
          onClick={() => onPlay?.(template)}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Play className="h-3.5 w-3.5" />
          Jogar
        </button>
      </div>
    </article>
  );
};
