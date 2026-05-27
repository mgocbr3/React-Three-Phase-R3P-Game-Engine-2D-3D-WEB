import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  FileArchive,
  Globe2,
  Info,
  Package,
  Play,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import type { PixlProjectDocument } from '@/engine/project/schema';
import { cn } from '@/lib/utils';
import type { LocalProjectWorkspace } from '@/services/localProjectFiles';
import type { BuildTarget } from '@/services/buildTargets';
import {
  createProjectDiagnostics,
  type ProjectDiagnosticIssue,
  type ProjectDiagnosticStatus,
  type ProjectDiagnosticsSummary,
} from '@/services/projectDiagnostics';

interface BuildSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: PixlProjectDocument | null;
  workspace: LocalProjectWorkspace;
}

const targetIcons: Record<BuildTarget['id'], typeof Globe2> = {
  'three-web': Globe2,
  'phaser-web': Play,
  pixlland: Package,
};

const targetTone: Record<BuildTarget['id'], string> = {
  'three-web': 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200',
  'phaser-web': 'border-amber-500/25 bg-amber-500/10 text-amber-100',
  pixlland: 'border-primary/25 bg-primary/10 text-primary',
};

const copyCommand = async (command: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(command);
    toast.success('Comando copiado.');
  } catch {
    toast.error('Nao foi possivel copiar o comando.');
  }
};

export const BuildSettingsModal = ({
  isOpen,
  onClose,
  project,
  workspace,
}: BuildSettingsModalProps) => {
  if (!isOpen) return null;

  const diagnostics = project ? createProjectDiagnostics(project, workspace) : null;
  const summary = diagnostics?.build ?? null;
  const primaryTarget = summary?.targets.find((target) => target.id === summary.primaryTarget);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-label="Close build settings"
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />

      <section className="relative flex h-[560px] w-[900px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <aside className="flex w-60 flex-col border-r border-border bg-sidebar-background p-3">
          <div className="flex items-center gap-2 px-3 py-2">
            <FileArchive className="size-4 text-primary" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">Build Settings</h2>
              <p className="truncate text-[11px] text-muted-foreground">{project?.name ?? 'No project'}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-[var(--editor-panel-sunken)] p-3">
            <span className="text-[11px] font-medium text-muted-foreground">Active Runtime</span>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 className="size-4 text-primary" />
              {summary?.runtimeLabel ?? 'Unknown'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Scene: {summary?.sceneKind ?? '-'}
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-[var(--editor-panel-sunken)] p-3">
            <span className="text-[11px] font-medium text-muted-foreground">Project File</span>
            <code className="break-all rounded-sm bg-background px-2 py-1 text-[11px] text-foreground">
              {summary?.projectPath ?? 'project.pixlproject.json'}
            </code>
          </div>

          {diagnostics && <ReadinessSummary diagnostics={diagnostics} />}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center justify-between border-b border-border bg-background px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Targets</span>
              {primaryTarget && (
                <span className="rounded-sm border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  Primary: {primaryTarget.label}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="editor-command-chip flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
              title="Close"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {summary?.targets.map((target) => (
              <BuildTargetRow
                key={target.id}
                target={target}
                primary={target.id === summary.primaryTarget || target.id === 'pixlland'}
                buildBlocked={diagnostics?.status === 'blocked'}
              />
            ))}
          </div>

          <footer className="flex items-center justify-between border-t border-border bg-background/60 px-4 py-3">
            <div className="text-[11px] text-muted-foreground">
              Outputs land in <span className="font-mono text-foreground">Builds/</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Done
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
};

interface BuildTargetRowProps {
  target: BuildTarget;
  primary: boolean;
  buildBlocked: boolean;
}

const BuildTargetRow = ({ target, primary, buildBlocked }: BuildTargetRowProps) => {
  const Icon = targetIcons[target.id];
  const disabled = target.availability !== 'ready' || buildBlocked;

  return (
    <article
      className={cn(
        'rounded-md border border-border bg-[var(--editor-panel-sunken)] p-3',
        disabled && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('flex size-9 items-center justify-center rounded-md border', targetTone[target.id])}>
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{target.label}</h3>
              {primary && !buildBlocked && (
                <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Ready
                </span>
              )}
              {primary && buildBlocked && (
                <span className="rounded-sm border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                  Blocked
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{target.outputLabel}</p>
          </div>
        </div>

        <button
          disabled={disabled}
          onClick={() => copyCommand(target.command)}
          className={cn(
            'editor-command-chip flex h-7 items-center gap-1.5 px-2 text-xs font-semibold',
            disabled
              ? 'cursor-not-allowed text-muted-foreground/45'
              : 'text-foreground hover:text-primary',
          )}
        >
          <Clipboard className="size-3.5" />
          Copy
        </button>
      </div>

      <div className="mt-3 rounded-sm border border-border bg-background p-2">
        <code className="block break-all text-[11px] leading-5 text-foreground">{target.command}</code>
      </div>
    </article>
  );
};

interface ReadinessSummaryProps {
  diagnostics: ProjectDiagnosticsSummary;
}

const readinessIcon = {
  blocked: AlertTriangle,
  warning: Info,
  ready: CheckCircle2,
};

const readinessCopy = {
  blocked: 'Build Blocked',
  warning: 'Warnings',
  ready: 'Ready',
};

const readinessTone = {
  blocked: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  ready: 'border-primary/25 bg-primary/10 text-primary',
};

const sourceLabels: Record<ProjectDiagnosticIssue['source'], string> = {
  runtime: 'Runtime',
  scene: 'Scene',
  assets: 'Assets',
  schema: 'Schema',
  project: 'Project',
};

const ReadinessSummary = ({ diagnostics }: ReadinessSummaryProps) => {
  const Icon = readinessIcon[diagnostics.status];
  const visibleIssues = diagnostics.issues.slice(0, 4);

  return (
    <div className="mt-3 flex min-h-0 flex-col gap-2 rounded-md border border-border bg-[var(--editor-panel-sunken)] p-3">
      <span className="text-[11px] font-medium text-muted-foreground">Engine Diagnostics</span>
      <div className={cn('flex items-center gap-2 rounded-sm border px-2 py-1.5 text-xs font-semibold', readinessTone[diagnostics.status])}>
        <Icon className="size-3.5" />
        {readinessCopy[diagnostics.status as ProjectDiagnosticStatus]}
      </div>

      {visibleIssues.length ? (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {visibleIssues.map((issue) => (
            <div key={issue.id} className="rounded-sm bg-background px-2 py-1">
              <div className="text-[11px] font-medium text-foreground">{issue.message}</div>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="font-semibold">{sourceLabels[issue.source]}</span>
                <span className="truncate font-mono">{issue.path}</span>
              </div>
            </div>
          ))}
          {diagnostics.issues.length > visibleIssues.length && (
            <div className="text-[11px] text-muted-foreground">
              +{diagnostics.issues.length - visibleIssues.length} more
            </div>
          )}
        </div>
      ) : (
        <div className="text-[11px] leading-4 text-muted-foreground">
          Active scene, runtime, components and declared assets line up for build.
        </div>
      )}
    </div>
  );
};
