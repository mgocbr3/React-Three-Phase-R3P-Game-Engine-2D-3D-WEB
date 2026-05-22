import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  PIXL_2D_COMPONENT_TYPES,
  PIXL_3D_COMPONENT_TYPES,
  PIXL_PROJECT_FORMAT,
  PIXL_PROJECT_VERSION,
  PIXL_SHARED_COMPONENT_TYPES,
  PixlProjectShape,
  PixlSceneObjectShape,
} from '../schema.js';

const COMPONENTS_2D = new Set<string>(PIXL_2D_COMPONENT_TYPES);
const COMPONENTS_3D = new Set<string>(PIXL_3D_COMPONENT_TYPES);
const COMPONENTS_SHARED = new Set<string>(PIXL_SHARED_COMPONENT_TYPES);

export interface ValidationIssue {
  level: 'error' | 'warning';
  path: string;
  message: string;
}

export interface ValidationReport {
  projectPath: string;
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    name: string;
    version: number;
    sceneCount: number;
    activeSceneId: string;
    objectCount: number;
    assetCount: number;
    componentTypes: string[];
  };
}

const walkObjects = (objects: PixlSceneObjectShape[] | undefined, visit: (object: PixlSceneObjectShape) => void) => {
  if (!objects) return;
  for (const object of objects) visit(object);
};

const emptySummary = (): ValidationReport['summary'] => ({
  name: '(sem nome)',
  version: 0,
  sceneCount: 0,
  activeSceneId: '',
  objectCount: 0,
  assetCount: 0,
  componentTypes: [],
});

export const validateProjectDocument = (document: unknown, projectPath: string): ValidationReport => {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const componentTypes = new Set<string>();

  const doc = document as Partial<PixlProjectShape> | null;
  let objectCount = 0;
  let assetCount = 0;

  if (!doc || typeof doc !== 'object') {
    errors.push({ level: 'error', path: '$', message: 'Documento de projeto vazio ou invalido.' });
    return { projectPath, ok: false, errors, warnings, summary: emptySummary() };
  }

  if (doc.format !== PIXL_PROJECT_FORMAT) {
    errors.push({
      level: 'error',
      path: '$.format',
      message: `Esperado "${PIXL_PROJECT_FORMAT}", encontrado "${String(doc.format)}".`,
    });
  }

  if (typeof doc.version !== 'number') {
    errors.push({ level: 'error', path: '$.version', message: 'version deve ser numero.' });
  } else if (doc.version !== PIXL_PROJECT_VERSION) {
    warnings.push({
      level: 'warning',
      path: '$.version',
      message: `version ${doc.version} difere do CLI (${PIXL_PROJECT_VERSION}). Considere rodar migrate.`,
    });
  }

  if (typeof doc.id !== 'string' || !doc.id) errors.push({ level: 'error', path: '$.id', message: 'id obrigatorio.' });
  if (typeof doc.name !== 'string' || !doc.name) errors.push({ level: 'error', path: '$.name', message: 'name obrigatorio.' });
  if (typeof doc.activeSceneId !== 'string') errors.push({ level: 'error', path: '$.activeSceneId', message: 'activeSceneId obrigatorio.' });

  if (!Array.isArray(doc.scenes) || doc.scenes.length === 0) {
    errors.push({ level: 'error', path: '$.scenes', message: 'O projeto precisa de pelo menos uma cena.' });
  } else {
    const sceneIds = new Set<string>();
    doc.scenes.forEach((scene, sceneIndex) => {
      if (!scene || typeof scene !== 'object') {
        errors.push({ level: 'error', path: `$.scenes[${sceneIndex}]`, message: 'Cena invalida.' });
        return;
      }
      if (!scene.id) errors.push({ level: 'error', path: `$.scenes[${sceneIndex}].id`, message: 'id da cena obrigatorio.' });
      if (sceneIds.has(scene.id)) {
        errors.push({ level: 'error', path: `$.scenes[${sceneIndex}].id`, message: `id de cena duplicado: ${scene.id}.` });
      }
      sceneIds.add(scene.id);

      walkObjects(scene.rootObjects, (object) => {
        objectCount += 1;
        if (object.components) {
          for (const component of object.components) {
            componentTypes.add(component.type);
            if (scene.kind === '2d' && COMPONENTS_3D.has(component.type)) {
              errors.push({
                level: 'error',
                path: `$.scenes[${sceneIndex}].rootObjects[${object.id}].components[${component.type}]`,
                message: `Componente 3D "${component.type}" em cena 2D.`,
              });
            } else if (scene.kind === '3d' && COMPONENTS_2D.has(component.type)) {
              errors.push({
                level: 'error',
                path: `$.scenes[${sceneIndex}].rootObjects[${object.id}].components[${component.type}]`,
                message: `Componente 2D "${component.type}" em cena 3D.`,
              });
            } else if (
              !COMPONENTS_2D.has(component.type) &&
              !COMPONENTS_3D.has(component.type) &&
              !COMPONENTS_SHARED.has(component.type)
            ) {
              warnings.push({
                level: 'warning',
                path: `$.scenes[${sceneIndex}].rootObjects[${object.id}].components[${component.type}]`,
                message: `Tipo de componente desconhecido: "${component.type}".`,
              });
            }
          }
        }
        // Track the leaky-truth smell: the editor still dumps its legacy SceneObject
        // into `data.editorObject`. Once the refactor removes it, this warning goes
        // away by itself.
        if (object.data && 'editorObject' in object.data) {
          warnings.push({
            level: 'warning',
            path: `$.scenes[${sceneIndex}].rootObjects[${object.id}].data.editorObject`,
            message: 'Objeto carrega blob legacy editorObject (fonte-de-verdade duplicada).',
          });
        }
      });
    });

    if (doc.activeSceneId && !sceneIds.has(doc.activeSceneId)) {
      errors.push({
        level: 'error',
        path: '$.activeSceneId',
        message: `activeSceneId "${doc.activeSceneId}" nao existe em scenes[].`,
      });
    }
  }

  if (doc.assets?.entries) {
    assetCount = doc.assets.entries.length;
  }

  return {
    projectPath,
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      name: (doc.name as string) || '(sem nome)',
      version: (doc.version as number) || 0,
      sceneCount: doc.scenes?.length ?? 0,
      activeSceneId: (doc.activeSceneId as string) || '',
      objectCount,
      assetCount,
      componentTypes: [...componentTypes].sort(),
    },
  };
};

export const runValidate = async (projectPath: string): Promise<ValidationReport> => {
  const absolute = resolve(process.cwd(), projectPath);
  const raw = await readFile(absolute, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      projectPath: absolute,
      ok: false,
      errors: [{ level: 'error', path: '$', message: `JSON invalido: ${(error as Error).message}` }],
      warnings: [],
      summary: { ...emptySummary(), name: '(JSON invalido)' },
    };
  }

  return validateProjectDocument(parsed, absolute);
};

const formatIssue = (issue: ValidationIssue) => `  [${issue.level}] ${issue.path}: ${issue.message}`;

export const printReport = (report: ValidationReport): void => {
  const { summary } = report;
  console.log(`pixl-engine validate ${report.projectPath}`);
  console.log(`  name:        ${summary.name}`);
  console.log(`  version:     ${summary.version}`);
  console.log(`  scenes:      ${summary.sceneCount} (active: ${summary.activeSceneId})`);
  console.log(`  objects:     ${summary.objectCount}`);
  console.log(`  assets:      ${summary.assetCount}`);
  console.log(`  components:  ${summary.componentTypes.length ? summary.componentTypes.join(', ') : '(nenhum)'}`);

  if (report.errors.length) {
    console.log('');
    console.log(`errors (${report.errors.length}):`);
    report.errors.forEach((issue) => console.log(formatIssue(issue)));
  }

  if (report.warnings.length) {
    console.log('');
    console.log(`warnings (${report.warnings.length}):`);
    report.warnings.forEach((issue) => console.log(formatIssue(issue)));
  }

  console.log('');
  console.log(report.ok ? 'OK' : 'FAIL');
};
