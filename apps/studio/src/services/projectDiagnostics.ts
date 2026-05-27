import type { PixlProjectDocument, PixlSceneObject } from '@/engine/project/schema';
import {
  createBuildTargetSummary,
  type BuildReadinessIssue,
  type BuildReadinessSeverity,
  type BuildTargetSummary,
} from './buildTargets';
import {
  createActiveProjectDocumentSnapshot,
  type ActiveProjectDocumentSnapshot,
  type LocalProjectWorkspace,
} from './localProjectFiles';

export type ProjectDiagnosticSeverity = BuildReadinessSeverity;
export type ProjectDiagnosticStatus = 'blocked' | 'warning' | 'ready';
export type ProjectDiagnosticSource = 'runtime' | 'scene' | 'assets' | 'schema' | 'project';

export interface ProjectDiagnosticTarget {
  sceneId: string;
  sceneName: string;
  objectId?: string;
  objectName?: string;
}

export interface ProjectDiagnosticIssue extends BuildReadinessIssue {
  id: string;
  source: ProjectDiagnosticSource;
  target?: ProjectDiagnosticTarget;
}

export interface ProjectDiagnosticGroup {
  source: ProjectDiagnosticSource;
  label: string;
  errors: number;
  warnings: number;
  infos: number;
  issues: ProjectDiagnosticIssue[];
}

export interface ProjectDiagnosticsSummary {
  status: ProjectDiagnosticStatus;
  errors: number;
  warnings: number;
  infos: number;
  issues: ProjectDiagnosticIssue[];
  groups: ProjectDiagnosticGroup[];
  activeSceneId: string | null;
  activeSceneName: string | null;
  sceneKind: PixlProjectDocument['scenes'][number]['kind'] | null;
  runtimePrimary: string;
  build: BuildTargetSummary;
}

export interface ActiveProjectDiagnosticsSnapshot extends ActiveProjectDocumentSnapshot {
  diagnostics: ProjectDiagnosticsSummary;
}

export interface ProjectDiagnosticConsoleMessage {
  id: string;
  type: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  source: string;
  path: string;
  targetObjectId?: string;
  targetObjectName?: string;
  targetSceneId?: string;
  targetSceneName?: string;
}

const SOURCE_LABELS: Record<ProjectDiagnosticSource, string> = {
  runtime: 'Runtime',
  scene: 'Scene',
  assets: 'Assets',
  schema: 'Schema',
  project: 'Project',
};

const SOURCE_ORDER: ProjectDiagnosticSource[] = ['runtime', 'scene', 'assets', 'schema', 'project'];

const classifyIssueSource = (issue: BuildReadinessIssue): ProjectDiagnosticSource => {
  if (issue.path.startsWith('$.runtime')) return 'runtime';
  if (issue.path.startsWith('$.assets') || /asset/i.test(issue.message)) return 'assets';
  if (issue.path.includes('editorObject')) return 'schema';
  if (issue.path.includes('.components') || issue.path.includes('.rootObjects')) return 'scene';
  return 'project';
};

const createIssueId = (issue: BuildReadinessIssue, source: ProjectDiagnosticSource): string => (
  `${source}:${issue.severity}:${issue.path}:${issue.message}`
);

const countSeverity = (
  issues: Array<{ severity: ProjectDiagnosticSeverity }>,
  severity: ProjectDiagnosticSeverity,
): number => (
  issues.filter((issue) => issue.severity === severity).length
);

type SceneObjectWithChildren = PixlSceneObject & { children?: SceneObjectWithChildren[] };

const resolveObjectFromPath = (
  objects: PixlSceneObject[],
  objectPath: string,
): SceneObjectWithChildren | null => {
  const matches = [...objectPath.matchAll(/(?:rootObjects|children)\[(\d+)\]/g)];
  if (!matches.length) return null;

  let currentObjects = objects as SceneObjectWithChildren[];
  let currentObject: SceneObjectWithChildren | undefined;

  for (const match of matches) {
    const index = Number(match[1]);
    if (!Number.isInteger(index) || index < 0) return null;
    currentObject = currentObjects[index];
    if (!currentObject) return null;
    currentObjects = currentObject.children ?? [];
  }

  return currentObject ?? null;
};

const resolveIssueTarget = (
  project: PixlProjectDocument,
  issue: BuildReadinessIssue,
): ProjectDiagnosticTarget | undefined => {
  const sceneMatch = issue.path.match(/\$\.scenes\[(\d+)\]/);
  if (!sceneMatch) return undefined;

  const sceneIndex = Number(sceneMatch[1]);
  const scene = project.scenes[sceneIndex];
  if (!scene) return undefined;

  const target: ProjectDiagnosticTarget = {
    sceneId: scene.id,
    sceneName: scene.name,
  };
  const object = resolveObjectFromPath(scene.rootObjects, issue.path);

  if (!object) return target;
  return {
    ...target,
    objectId: object.id,
    objectName: object.name,
  };
};

export const createProjectDiagnostics = (
  project: PixlProjectDocument,
  workspace?: LocalProjectWorkspace | null,
): ProjectDiagnosticsSummary => {
  const build = createBuildTargetSummary(project, workspace);
  const activeScene = project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0] ?? null;
  const issues = build.readiness.issues.map((issue) => {
    const source = classifyIssueSource(issue);
    return {
      ...issue,
      source,
      id: createIssueId(issue, source),
      target: resolveIssueTarget(project, issue),
    };
  });

  const groups = SOURCE_ORDER
    .map((source) => {
      const sourceIssues = issues.filter((issue) => issue.source === source);
      return {
        source,
        label: SOURCE_LABELS[source],
        errors: countSeverity(sourceIssues, 'error'),
        warnings: countSeverity(sourceIssues, 'warning'),
        infos: countSeverity(sourceIssues, 'info'),
        issues: sourceIssues,
      };
    })
    .filter((group) => group.issues.length > 0);

  return {
    status: build.readiness.status,
    errors: build.readiness.errors,
    warnings: build.readiness.warnings,
    infos: build.readiness.infos,
    issues,
    groups,
    activeSceneId: activeScene?.id ?? null,
    activeSceneName: activeScene?.name ?? null,
    sceneKind: activeScene?.kind ?? null,
    runtimePrimary: project.runtime?.primary ?? 'unknown',
    build,
  };
};

export const createActiveProjectDiagnosticsSnapshot = (
  name = 'Untitled Project',
): ActiveProjectDiagnosticsSnapshot => {
  const snapshot = createActiveProjectDocumentSnapshot(name);
  return {
    ...snapshot,
    diagnostics: createProjectDiagnostics(snapshot.document, snapshot.workspace),
  };
};

const severityToConsoleType = (severity: ProjectDiagnosticSeverity): ProjectDiagnosticConsoleMessage['type'] => {
  if (severity === 'error') return 'error';
  if (severity === 'warning') return 'warn';
  return 'info';
};

export const createProjectDiagnosticConsoleMessages = (
  diagnostics: ProjectDiagnosticsSummary,
  timestamp = 'live',
): ProjectDiagnosticConsoleMessage[] => {
  if (diagnostics.issues.length === 0) {
    return [
      {
        id: `diagnostics-ready:${diagnostics.activeSceneId ?? 'project'}`,
        type: 'info',
        message: `Engine diagnostics ready: ${diagnostics.runtimePrimary} / ${diagnostics.sceneKind ?? 'no scene'}.`,
        timestamp,
        source: 'Engine',
        path: '$',
      },
    ];
  }

  return diagnostics.issues.map((issue) => ({
    id: issue.id,
    type: severityToConsoleType(issue.severity),
    message: issue.message,
    timestamp,
    source: SOURCE_LABELS[issue.source],
    path: issue.path,
    targetObjectId: issue.target?.objectId,
    targetObjectName: issue.target?.objectName,
    targetSceneId: issue.target?.sceneId,
    targetSceneName: issue.target?.sceneName,
  }));
};
