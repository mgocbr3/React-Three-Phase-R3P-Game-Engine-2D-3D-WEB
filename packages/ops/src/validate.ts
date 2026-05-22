// Schema + 2D/3D coherence validation. Mirrors engine-cli's validate logic but
// returns string[]s shaped for OpResult and throws OpValidationError on demand.
//
// GDD §6.1 requires: load → validate → mutate → re-validate → atomic write.
// `requireValid(doc)` is the helper that throws when a pre or post snapshot is
// invalid; runLocked catches it and surfaces validationErrors on OpResult.

import {
  PIXL_2D_COMPONENT_TYPES,
  PIXL_3D_COMPONENT_TYPES,
  PIXL_PROJECT_FORMAT,
  PIXL_PROJECT_VERSION,
  PIXL_SHARED_COMPONENT_TYPES,
  type PixlProjectShape,
  type PixlSceneObjectShape,
} from './schema.js';
import { OpValidationError } from './types.js';

const COMPONENTS_2D = new Set<string>(PIXL_2D_COMPONENT_TYPES);
const COMPONENTS_3D = new Set<string>(PIXL_3D_COMPONENT_TYPES);
const COMPONENTS_SHARED = new Set<string>(PIXL_SHARED_COMPONENT_TYPES);

export interface ValidationReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const walkObjects = (
  objects: PixlSceneObjectShape[] | undefined,
  visit: (object: PixlSceneObjectShape) => void,
): void => {
  if (!objects) return;
  for (const object of objects) {
    visit(object);
    if (object.children?.length) walkObjects(object.children, visit);
  }
};

export const validate = (doc: unknown): ValidationReport => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!doc || typeof doc !== 'object') {
    errors.push('Documento de projeto vazio ou invalido.');
    return { ok: false, errors, warnings };
  }
  const project = doc as Partial<PixlProjectShape>;

  if (project.format !== PIXL_PROJECT_FORMAT) {
    errors.push(`format inválido: esperado "${PIXL_PROJECT_FORMAT}", encontrado "${String(project.format)}".`);
  }
  if (typeof project.version !== 'number') {
    errors.push('version deve ser número.');
  } else if (project.version !== PIXL_PROJECT_VERSION) {
    warnings.push(
      `version ${project.version} difere do esperado (${PIXL_PROJECT_VERSION}). Considere migrar.`,
    );
  }
  if (typeof project.id !== 'string' || project.id.length === 0) {
    errors.push('id obrigatório.');
  }
  if (typeof project.name !== 'string' || project.name.length === 0) {
    errors.push('name obrigatório.');
  }
  if (typeof project.activeSceneId !== 'string' || project.activeSceneId.length === 0) {
    errors.push('activeSceneId obrigatório.');
  }

  if (!Array.isArray(project.scenes) || project.scenes.length === 0) {
    errors.push('O projeto precisa de pelo menos uma cena.');
    return { ok: errors.length === 0, errors, warnings };
  }

  const sceneIds = new Set<string>();
  const objectIds = new Set<string>();
  for (let i = 0; i < project.scenes.length; i += 1) {
    const scene = project.scenes[i];
    if (!scene || typeof scene !== 'object') {
      errors.push(`scenes[${i}] inválida.`);
      continue;
    }
    if (!scene.id) errors.push(`scenes[${i}].id obrigatório.`);
    if (sceneIds.has(scene.id)) errors.push(`scenes[${i}].id duplicado: ${scene.id}.`);
    sceneIds.add(scene.id);
    if (!scene.name) warnings.push(`scenes[${i}].name vazio.`);
    if (scene.kind !== '2d' && scene.kind !== '3d' && scene.kind !== 'hybrid') {
      errors.push(`scenes[${i}].kind inválido: ${String(scene.kind)}.`);
    }

    walkObjects(scene.rootObjects, (object) => {
      if (!object.id) {
        errors.push(`scenes[${scene.id}].objects[?].id obrigatório.`);
        return;
      }
      if (objectIds.has(object.id)) {
        errors.push(`Object id duplicado: ${object.id}.`);
      }
      objectIds.add(object.id);
      if (object.components) {
        for (const component of object.components) {
          if (!component.type) {
            errors.push(`Object ${object.id}: component.type vazio.`);
            continue;
          }
          if (scene.kind === '2d' && COMPONENTS_3D.has(component.type)) {
            errors.push(`Object ${object.id}: componente 3D "${component.type}" em cena 2D "${scene.id}".`);
          } else if (scene.kind === '3d' && COMPONENTS_2D.has(component.type)) {
            errors.push(`Object ${object.id}: componente 2D "${component.type}" em cena 3D "${scene.id}".`);
          } else if (
            !COMPONENTS_2D.has(component.type) &&
            !COMPONENTS_3D.has(component.type) &&
            !COMPONENTS_SHARED.has(component.type)
          ) {
            warnings.push(`Object ${object.id}: tipo de componente desconhecido "${component.type}".`);
          }
        }
      }
    });
  }

  if (typeof project.activeSceneId === 'string' && project.activeSceneId && !sceneIds.has(project.activeSceneId)) {
    errors.push(`activeSceneId "${project.activeSceneId}" não existe em scenes[].`);
  }

  return { ok: errors.length === 0, errors, warnings };
};

export const requireValid = (doc: unknown): PixlProjectShape => {
  const report = validate(doc);
  if (!report.ok) {
    throw new OpValidationError(report.errors, report.warnings);
  }
  return doc as PixlProjectShape;
};
