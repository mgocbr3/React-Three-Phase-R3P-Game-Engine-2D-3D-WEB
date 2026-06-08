import type { LocalProjectWorkspace } from './localProjectFiles';
import {
  PIXL_2D_COMPONENT_TYPES,
  PIXL_3D_COMPONENT_TYPES,
  PIXL_SHARED_COMPONENT_TYPES,
  type PixlProjectDocument,
  type PixlSceneDocument,
  type PixlSceneKind,
  type PixlSceneObject,
} from '@/engine/project/schema';
import { findLegacyEditorObjectData } from '@/engine/project/documentInvariants';

export type BuildTargetId = 'three-web' | 'phaser-web' | 'pixlland';
export type BuildTargetAvailability = 'ready' | 'inactive-runtime';

export interface BuildTarget {
  id: BuildTargetId;
  label: string;
  outputLabel: string;
  command: string;
  availability: BuildTargetAvailability;
}

export interface BuildTargetSummary {
  projectPath: string;
  sceneKind: PixlSceneKind;
  runtimeLabel: string;
  primaryTarget: BuildTargetId;
  targets: BuildTarget[];
  readiness: BuildReadiness;
}

export type BuildReadinessSeverity = 'error' | 'warning' | 'info';

export interface BuildReadinessIssue {
  severity: BuildReadinessSeverity;
  message: string;
  path: string;
}

export interface BuildReadiness {
  status: 'blocked' | 'warning' | 'ready';
  errors: number;
  warnings: number;
  infos: number;
  issues: BuildReadinessIssue[];
}

const quotePath = (value: string): string => (
  /[\s()]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value
);

const slugify = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'pixl-project'
);

export const getActiveSceneKind = (project: PixlProjectDocument): PixlSceneKind => {
  const scene = project.scenes.find((item) => item.id === project.activeSceneId) ?? project.scenes[0];
  return scene?.kind ?? project.editor?.mode ?? '3d';
};

const COMPONENTS_2D = new Set<string>(PIXL_2D_COMPONENT_TYPES);
const COMPONENTS_3D = new Set<string>(PIXL_3D_COMPONENT_TYPES);
const COMPONENTS_SHARED = new Set<string>(PIXL_SHARED_COMPONENT_TYPES);

const ASSET_REF_RE = /\.(?:glb|gltf|fbx|obj|png|jpe?g|webp|svg|mp3|wav|ogg|opus|json|js|mjs|css)(?:[?#].*)?$/i;
const ASSET_REF_KEYS = new Set([
  'url',
  'src',
  'href',
  'modelUrl',
  'textureUrl',
  'imageUrl',
  'audioUrl',
  'texturePath',
  'tilemapPath',
  'sourceAsset',
]);

type SceneObjectWithChildren = PixlSceneObject & { children?: SceneObjectWithChildren[] };

const normalizeAssetRef = (value: string): string => (
  value.replace(/^public\//, '').replace(/^[./]+/, '')
);

const hasDeclaredAssetRef = (declaredAssetRefs: Set<string>, ref: string): boolean => {
  const normalized = normalizeAssetRef(ref);
  if (declaredAssetRefs.has(normalized)) return true;

  for (const declared of declaredAssetRefs) {
    if (!declared.includes('/')) continue;
    if (normalized.endsWith(`/${declared}`)) return true;
  }

  return false;
};

const isExternalAssetRef = (value: string): boolean => /^(?:https?:|data:|blob:)/i.test(value);

const pushIssue = (
  issues: BuildReadinessIssue[],
  severity: BuildReadinessSeverity,
  message: string,
  path: string,
): void => {
  issues.push({ severity, message, path });
};

const walkAssetRefs = (
  value: unknown,
  onRef: (ref: string, path: string) => void,
  path: string,
  key = '',
): void => {
  if (typeof value === 'string') {
    if (ASSET_REF_KEYS.has(key) && ASSET_REF_RE.test(value) && !isExternalAssetRef(value)) {
      onRef(value, path);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkAssetRefs(item, onRef, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([entryKey, entryValue]) => {
      walkAssetRefs(entryValue, onRef, `${path}.${entryKey}`, entryKey);
    });
  }
};

const walkSceneObjects = (
  objects: PixlSceneObject[],
  visit: (object: SceneObjectWithChildren, objectPath: string) => void,
  basePath: string,
): void => {
  objects.forEach((object, index) => {
    const objectWithChildren = object as SceneObjectWithChildren;
    const objectPath = `${basePath}.rootObjects[${index}]`;
    visit(objectWithChildren, objectPath);
    if (objectWithChildren.children?.length) {
      walkSceneObjects(objectWithChildren.children, visit, `${objectPath}.children`);
    }
  });
};

const expectedRuntimeForScene = (kind: PixlSceneKind): string => (
  kind === '3d' ? 'three-3d' : 'phaser-2d'
);

const runtimeMatchesScene = (runtime: string | undefined, kind: PixlSceneKind): boolean => {
  if (runtime === 'hybrid') return true;
  if (kind === '3d') return runtime === 'three-3d';
  return runtime === 'phaser-2d';
};

const getActiveScene = (project: PixlProjectDocument): PixlSceneDocument | undefined => (
  project.scenes.find((item) => item.id === project.activeSceneId) ?? project.scenes[0]
);

export const analyzeBuildReadiness = (project: PixlProjectDocument): BuildReadiness => {
  const issues: BuildReadinessIssue[] = [];
  const activeScene = getActiveScene(project);

  if (!activeScene) {
    pushIssue(issues, 'error', 'Project has no scenes to build.', '$.scenes');
  } else {
    const scenePath = `$.scenes[${project.scenes.findIndex((scene) => scene.id === activeScene.id)}]`;
    if (!runtimeMatchesScene(project.runtime?.primary, activeScene.kind)) {
      pushIssue(
        issues,
        'error',
        `Runtime "${project.runtime?.primary ?? 'unknown'}" does not match active ${activeScene.kind} scene. Expected ${expectedRuntimeForScene(activeScene.kind)}.`,
        '$.runtime.primary',
      );
    }
    if (!activeScene.rootObjects.length) {
      pushIssue(issues, 'warning', 'Active scene has no root objects.', `${scenePath}.rootObjects`);
    }

    const declaredAssetRefs = new Set<string>();
    for (const entry of project.assets?.entries ?? []) {
      if (!entry.path) {
        pushIssue(issues, 'error', `Asset "${entry.name}" has no path.`, '$.assets.entries');
        continue;
      }
      declaredAssetRefs.add(normalizeAssetRef(entry.path));
      if (entry.url) declaredAssetRefs.add(normalizeAssetRef(entry.url));
    }

    findLegacyEditorObjectData(project).forEach((issue) => {
      pushIssue(issues, 'warning', issue.message, issue.path);
    });

    walkSceneObjects(activeScene.rootObjects, (object, objectPath) => {
      for (const component of object.components ?? []) {
        const componentPath = `${objectPath}.components[${component.type}]`;
        const isSharedComponent = COMPONENTS_SHARED.has(component.type);
        if (!isSharedComponent && activeScene.kind === '2d' && COMPONENTS_3D.has(component.type)) {
          pushIssue(issues, 'error', `3D component "${component.type}" in 2D scene.`, componentPath);
        } else if (!isSharedComponent && activeScene.kind === '3d' && COMPONENTS_2D.has(component.type)) {
          pushIssue(issues, 'error', `2D component "${component.type}" in 3D scene.`, componentPath);
        } else if (
          !COMPONENTS_2D.has(component.type) &&
          !COMPONENTS_3D.has(component.type) &&
          !COMPONENTS_SHARED.has(component.type)
        ) {
          pushIssue(issues, 'warning', `Unknown component type "${component.type}".`, componentPath);
        }

        walkAssetRefs(component.data, (ref, refPath) => {
          if (!hasDeclaredAssetRef(declaredAssetRefs, ref)) {
            pushIssue(issues, 'warning', `Asset reference is not declared: ${ref}`, refPath);
          }
        }, `${componentPath}.data`);
      }

      walkAssetRefs(object.data, (ref, refPath) => {
        if (!hasDeclaredAssetRef(declaredAssetRefs, ref)) {
          pushIssue(issues, 'warning', `Asset reference is not declared: ${ref}`, refPath);
        }
      }, `${objectPath}.data`);
    }, scenePath);
  }

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  const infos = issues.filter((issue) => issue.severity === 'info').length;

  return {
    status: errors > 0 ? 'blocked' : warnings > 0 ? 'warning' : 'ready',
    errors,
    warnings,
    infos,
    issues,
  };
};

export const resolveProjectPathForBuild = (
  project: PixlProjectDocument,
  workspace?: LocalProjectWorkspace | null,
): string => {
  if (workspace?.directoryName) {
    return `${workspace.directoryName}/${workspace.projectFilePath || 'project.pixlproject.json'}`;
  }
  return `apps/studio/public/sample-projects/${project.slug}/project.pixlproject.json`;
};

const buildCommand = (
  command: 'export-three' | 'export-phaser' | 'export-pixlland',
  projectPath: string,
  outputPath: string,
): string => (
  `pixl-engine ${command} ${quotePath(projectPath)} ${quotePath(outputPath)}`
);

export const createBuildTargetSummary = (
  project: PixlProjectDocument,
  workspace?: LocalProjectWorkspace | null,
): BuildTargetSummary => {
  const sceneKind = getActiveSceneKind(project);
  const slug = project.slug || slugify(project.name);
  const projectPath = resolveProjectPathForBuild(project, workspace);
  const is2D = sceneKind === '2d' || sceneKind === 'hybrid';
  const is3D = sceneKind === '3d';
  const runtimeLabel = is2D ? 'Phaser 4' : 'Three.js';
  const primaryTarget: BuildTargetId = is2D ? 'phaser-web' : 'three-web';
  const readiness = analyzeBuildReadiness(project);

  return {
    projectPath,
    sceneKind,
    runtimeLabel,
    primaryTarget,
    readiness,
    targets: [
      {
        id: 'three-web',
        label: 'Three Web',
        outputLabel: `Builds/${slug}-three`,
        command: buildCommand('export-three', projectPath, `Builds/${slug}-three`),
        availability: is3D ? 'ready' : 'inactive-runtime',
      },
      {
        id: 'phaser-web',
        label: 'Phaser Web',
        outputLabel: `Builds/${slug}-phaser`,
        command: buildCommand('export-phaser', projectPath, `Builds/${slug}-phaser`),
        availability: is2D ? 'ready' : 'inactive-runtime',
      },
      {
        id: 'pixlland',
        label: 'Pixlland',
        outputLabel: `Builds/${slug}.pixlbuild`,
        command: buildCommand('export-pixlland', projectPath, `Builds/${slug}.pixlbuild`),
        availability: 'ready',
      },
    ],
  };
};
