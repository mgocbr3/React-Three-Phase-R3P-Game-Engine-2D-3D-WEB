import type { PixlProjectShape, PixlSceneObjectShape } from './schema.js';

export interface ProjectInvariantIssue {
  path: string;
  message: string;
}

type SceneObjectWithChildren = PixlSceneObjectShape & { children?: SceneObjectWithChildren[] };

const walkObjects = (
  objects: PixlSceneObjectShape[] | undefined,
  visit: (object: SceneObjectWithChildren, path: string) => void,
  pathForObject: (index: number) => string,
): void => {
  if (!objects) return;

  objects.forEach((object, index) => {
    const objectWithChildren = object as SceneObjectWithChildren;
    const objectPath = pathForObject(index);
    visit(objectWithChildren, objectPath);
    if (objectWithChildren.children?.length) {
      walkObjects(objectWithChildren.children, visit, (childIndex) => `${objectPath}.children[${childIndex}]`);
    }
  });
};

export const findLegacyEditorObjectData = (project: Partial<PixlProjectShape>): ProjectInvariantIssue[] => {
  const issues: ProjectInvariantIssue[] = [];

  project.scenes?.forEach((scene, sceneIndex) => {
    walkObjects(scene.rootObjects, (object, objectPath) => {
      if (object.data && 'editorObject' in object.data) {
        issues.push({
          path: `${objectPath}.data.editorObject`,
          message: 'Objeto carrega blob legacy editorObject (fonte-de-verdade duplicada).',
        });
      }
    }, (objectIndex) => `$.scenes[${sceneIndex}].rootObjects[${objectIndex}]`);
  });

  return issues;
};
