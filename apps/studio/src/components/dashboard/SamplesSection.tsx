// SamplesSection — Hub block listing every project registered in
// apps/studio/src/services/sampleProjects.ts. Sits between Recent and
// Templates so canonical demos (harvest-rush-3d, magic-battleground-2d, etc.)
// are discoverable instead of requiring users to memorise URL query strings.

import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import {
  buildSampleEditorUrl,
  listSampleProjects,
  type SampleAccent,
  type SampleProjectEntry,
} from '@/services/sampleProjects';

// Map accent name -> Tailwind classes for the kind badge + icon ring. Keeps
// each card visually distinct without needing per-sample CSS.
const ACCENT_CLASSES: Record<SampleAccent, { ring: string; badge: string; chip: string }> = {
  purple: { ring: 'ring-purple-500/40', badge: 'bg-purple-500/15 text-purple-300', chip: 'text-purple-300' },
  cyan:   { ring: 'ring-cyan-500/40',   badge: 'bg-cyan-500/15 text-cyan-300',     chip: 'text-cyan-300' },
  pink:   { ring: 'ring-pink-500/40',   badge: 'bg-pink-500/15 text-pink-300',     chip: 'text-pink-300' },
  orange: { ring: 'ring-orange-500/40', badge: 'bg-orange-500/15 text-orange-300', chip: 'text-orange-300' },
  red:    { ring: 'ring-red-500/40',    badge: 'bg-red-500/15 text-red-300',       chip: 'text-red-300' },
  green:  { ring: 'ring-green-500/40',  badge: 'bg-green-500/15 text-green-300',   chip: 'text-green-300' },
  blue:   { ring: 'ring-blue-500/40',   badge: 'bg-blue-500/15 text-blue-300',     chip: 'text-blue-300' },
};

const DEFAULT_ACCENT: SampleAccent = 'cyan';

const SampleCard = ({
  entry,
  onOpen,
}: {
  entry: SampleProjectEntry;
  onOpen: (slug: string) => void;
}) => {
  const accent = ACCENT_CLASSES[entry.accent ?? DEFAULT_ACCENT];
  const kindLabel = entry.kind.toUpperCase();

  return (
    <Card
      className={`group flex h-20 cursor-pointer items-center gap-3 rounded-lg border-border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-secondary/50 ring-1 ring-inset ${accent.ring}`}
      onClick={() => onOpen(entry.slug)}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tracking-wide ${accent.badge}`}>
        {kindLabel}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-foreground">{entry.displayName}</h3>
        <p className="truncate text-xs text-muted-foreground">{entry.description}</p>
        <p className={`mt-1 truncate text-[11px] ${accent.chip}`}>
          {entry.slug}
        </p>
      </div>
    </Card>
  );
};

export interface SamplesSectionProps {
  /** Optional override: pre-fetched list (e.g. for testing). Falls back to the registry. */
  entries?: SampleProjectEntry[];
}

export const SamplesSection = ({ entries }: SamplesSectionProps = {}) => {
  const navigate = useNavigate();
  const all = entries ?? listSampleProjects();

  if (all.length === 0) return null;

  const handleOpen = (slug: string) => {
    const url = buildSampleEditorUrl(slug);
    if (url) navigate(url);
  };

  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Samples</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cenas canônicas servidas pela engine. Abrem direto no editor com a viewport correta.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{all.length}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {all.map((entry) => (
          <SampleCard key={entry.slug} entry={entry} onOpen={handleOpen} />
        ))}
      </div>
    </section>
  );
};
