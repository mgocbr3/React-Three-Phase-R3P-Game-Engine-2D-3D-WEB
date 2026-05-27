import type { PixlProjectDocument, PixlSceneObject } from './schema';

export interface ProjectInvariantIssue {
  path: string;
  message: string;
}

type SceneObjectWithChildren = PixlSceneObject & { children?: SceneObjectWithChildren[] };

const walkSceneObjects = (
  objects: PixlSceneObject[],
  visit: (object: SceneObjectWithChildren, path: string) => void,
  pathForObject: (index: number) => string,
): void => {
  objects.forEach((object, index) => {
    const objectWithChildren = object as SceneObjectWithChildren;
    const objectPath = pathForObject(index);
    visit(objectWithChildren, objectPath);
    if (objectWithChildren.children?.length) {
      walkSceneObjects(objectWithChildren.children, visit, (childIndex) => `${objectPath}.children[${childIndex}]`);
    }
  });
};

export const findLegacyEditorObjectData = (project: PixlProjectDocument): ProjectInvariantIssue[] => {
  const issues: ProjectInvariantIssue[] = [];

  project.scenes.forEach((scene, sceneIndex) => {
    walkSceneObjects(scene.rootObjects, (object, objectPath) => {
      if (object.data && 'editorObject' in object.data) {
        issues.push({
          path: `${objectPath}.data.editorObject`,
          message: `Object "${object.name}" still carries legacy editorObject data.`,
        });
      }
    }, (objectIndex) => `$.scenes[${sceneIndex}].rootObjects[${objectIndex}]`);
  });

  return issues;
};

export const hasLegacyEditorObjectData = (project: PixlProjectDocument): boolean => (
  findLegacyEditorObjectData(project).length > 0
);
