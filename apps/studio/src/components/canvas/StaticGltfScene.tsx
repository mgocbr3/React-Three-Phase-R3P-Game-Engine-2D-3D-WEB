import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface StaticGltfSceneProps {
  url: string;
  sceneScale?: number;
  editorObjects?: StaticGltfEditorObject[];
  selectedObjectId?: string | null;
}

const EMPTY_STATIC_GLTF_EDITOR_OBJECTS: StaticGltfEditorObject[] = [];

export interface StaticGltfEditorObject {
  id: string;
  type: string;
  nodeName?: string;
  nodeIndex?: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible?: boolean;
  locked?: boolean;
  selectionRole?: string;
}

interface StaticGltfSceneInfo {
  meshes: number;
  triangles: number;
  materials: number;
}

interface StaticGltfNodeEntry {
  url: string;
  objectId: string;
  nodeName: string;
  nodeIndex?: number;
  node: THREE.Object3D;
}

const normalizeStaticGltfNodeName = (nodeName: string | undefined) => (
  (nodeName ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase()
);

const activeStaticScenesByUrl = new Map<string, THREE.Object3D>();
const activeStaticNodesByObjectId = new Map<string, StaticGltfNodeEntry>();
const activeStaticNodeEntryByNode = new WeakMap<THREE.Object3D, StaticGltfNodeEntry>();
const staticPickRaycaster = new THREE.Raycaster();
const staticPickPointer = new THREE.Vector2();
const staticWorldPosition = new THREE.Vector3();
const staticWorldQuaternion = new THREE.Quaternion();
const staticWorldScale = new THREE.Vector3();
const staticParentQuaternion = new THREE.Quaternion();
const staticParentScale = new THREE.Vector3();

export interface StaticGltfPickResult {
  url: string;
  nodeName: string;
  objectId: string;
  distance: number;
  object: THREE.Object3D;
}

export const hasStaticGltfScene = (url: string | undefined) => (
  Boolean(url && activeStaticScenesByUrl.has(url))
);

export const getStaticGltfObjectByEditorId = (objectId: string | null | undefined) => (
  objectId ? activeStaticNodesByObjectId.get(objectId)?.node ?? null : null
);

export const getStaticGltfObjectWorldTransform = (
  objectId: string,
  targetPosition: THREE.Vector3,
  targetRotation: THREE.Euler,
  targetScale: THREE.Vector3,
) => {
  const node = getStaticGltfObjectByEditorId(objectId);
  if (!node) return false;

  node.updateWorldMatrix(true, false);
  node.getWorldPosition(targetPosition);
  node.getWorldQuaternion(staticWorldQuaternion);
  targetRotation.setFromQuaternion(staticWorldQuaternion, 'XYZ');
  node.getWorldScale(targetScale);
  return true;
};

const objectIsVisibleInScene = (object: THREE.Object3D) => {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
};

const deleteStaticNodeEntry = (entry: StaticGltfNodeEntry) => {
  entry.node.traverse((child) => {
    if (activeStaticNodeEntryByNode.get(child) === entry) {
      activeStaticNodeEntryByNode.delete(child);
    }
  });
  if (activeStaticNodeEntryByNode.get(entry.node) === entry) {
    activeStaticNodeEntryByNode.delete(entry.node);
  }
};

const applyWorldTransformToNode = (
  node: THREE.Object3D,
  position: [number, number, number],
  rotation: [number, number, number],
  scale: [number, number, number],
) => {
  staticWorldPosition.fromArray(position);
  staticWorldQuaternion.setFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'));
  staticWorldScale.fromArray(scale);

  const parent = node.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    node.position.copy(staticWorldPosition);
    parent.worldToLocal(node.position);

    parent.getWorldQuaternion(staticParentQuaternion).invert();
    node.quaternion.copy(staticParentQuaternion).multiply(staticWorldQuaternion);

    parent.getWorldScale(staticParentScale);
    node.scale.set(
      staticParentScale.x ? staticWorldScale.x / staticParentScale.x : staticWorldScale.x,
      staticParentScale.y ? staticWorldScale.y / staticParentScale.y : staticWorldScale.y,
      staticParentScale.z ? staticWorldScale.z / staticParentScale.z : staticWorldScale.z,
    );
  } else {
    node.position.copy(staticWorldPosition);
    node.quaternion.copy(staticWorldQuaternion);
    node.scale.copy(staticWorldScale);
  }

  node.updateMatrix();
  node.updateWorldMatrix(false, true);
};

export const pickStaticGltfNodes = (
  urls: Iterable<string>,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): StaticGltfPickResult[] => {
  const rect = canvas.getBoundingClientRect();
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return [];
  }

  staticPickPointer.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  );
  staticPickRaycaster.setFromCamera(staticPickPointer, camera);

  const hits: StaticGltfPickResult[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    const scene = activeStaticScenesByUrl.get(url);
    if (!scene) continue;

    const intersections = staticPickRaycaster.intersectObject(scene, true);
    for (const intersection of intersections) {
      let current: THREE.Object3D | null = intersection.object;
      while (current && current !== scene) {
        const entry = activeStaticNodeEntryByNode.get(current);
        if (entry && entry.url === url && objectIsVisibleInScene(entry.node)) {
          const key = `${url}:${entry.objectId}`;
          if (!seen.has(key)) {
            seen.add(key);
            hits.push({
              url,
              nodeName: entry.nodeName,
              objectId: entry.objectId,
              distance: intersection.distance,
              object: entry.node,
            });
          }
          break;
        }
        current = current.parent;
      }
    }
  }

  hits.sort((a, b) => a.distance - b.distance);
  return hits;
};

export const pickStaticGltfNode = (
  urls: Iterable<string>,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): StaticGltfPickResult | null => {
  return pickStaticGltfNodes(urls, camera, canvas, clientX, clientY)[0] ?? null;
};

const prepareStaticScene = (sourceScene: THREE.Object3D, sceneScale: number) => {
  const scene = sourceScene.clone(true);
  const materialIds = new Set<string>();
  const nodesByNormalizedName = new Map<string, THREE.Object3D[]>();
  const nodesByTraversalIndex: THREE.Object3D[] = [];
  const info: StaticGltfSceneInfo = {
    meshes: 0,
    triangles: 0,
    materials: 0,
  };

  scene.scale.setScalar(sceneScale);
  scene.updateWorldMatrix(true, true);
  scene.traverse((child) => {
    const traversalIndex = nodesByTraversalIndex.length;
    nodesByTraversalIndex.push(child);
    child.userData = {
      ...child.userData,
      staticGltfTraversalIndex: traversalIndex,
    };

    child.matrixAutoUpdate = false;
    child.updateMatrix();

    if (child.name) {
      const normalizedName = normalizeStaticGltfNodeName(child.name);
      const namedNodes = nodesByNormalizedName.get(normalizedName);
      if (namedNodes) {
        namedNodes.push(child);
      } else {
        nodesByNormalizedName.set(normalizedName, [child]);
      }
    }

    if (!(child instanceof THREE.Mesh)) return;

    info.meshes += 1;
    child.castShadow = false;
    child.receiveShadow = false;
    child.frustumCulled = true;
    child.userData = {
      ...child.userData,
      isStaticGltfVisual: true,
    };

    const geometry = child.geometry;
    if (geometry) {
      const position = geometry.getAttribute('position');
      const indexCount = geometry.index?.count ?? 0;
      info.triangles += Math.floor((indexCount || (position?.count ?? 0)) / 3);
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material) materialIds.add(material.uuid);
    });
  });

  info.materials = materialIds.size;

  return { scene, info, nodesByNormalizedName, nodesByTraversalIndex };
};

export const StaticGltfScene = ({
  url,
  sceneScale = 1,
  editorObjects = EMPTY_STATIC_GLTF_EDITOR_OBJECTS,
  selectedObjectId = null,
}: StaticGltfSceneProps) => {
  const { scene: sourceScene } = useGLTF(url);
  const registeredObjectIdsRef = useRef<string[]>([]);
  const selectedObjectIdRef = useRef<string | null>(null);

  const { scene, info, nodesByNormalizedName, nodesByTraversalIndex } = useMemo(() => (
    prepareStaticScene(sourceScene, sceneScale)
  ), [sceneScale, sourceScene]);

  useEffect(() => {
    registeredObjectIdsRef.current.forEach((objectId) => {
      const entry = activeStaticNodesByObjectId.get(objectId);
      if (entry?.url === url) {
        activeStaticNodesByObjectId.delete(objectId);
        deleteStaticNodeEntry(entry);
      }
    });
    registeredObjectIdsRef.current = [];

    scene.traverse((node) => {
      node.visible = true;
      node.userData = {
        ...node.userData,
        editorObjectId: undefined,
        objectId: undefined,
        objectType: undefined,
        objectSelectionRole: undefined,
        isStaticGltfSelectable: undefined,
      };
    });

    editorObjects.forEach((object) => {
      if (!object.nodeName) return;

      const normalizedNodeName = normalizeStaticGltfNodeName(object.nodeName);
      const indexedNode = Number.isInteger(object.nodeIndex)
        ? nodesByTraversalIndex[object.nodeIndex as number] ?? null
        : null;
      const node = indexedNode && normalizeStaticGltfNodeName(indexedNode.name) === normalizedNodeName
        ? indexedNode
        : nodesByNormalizedName.get(normalizedNodeName)?.[0];
      if (!node) return;

      node.visible = object.visible !== false;
      node.matrixAutoUpdate = false;
      applyWorldTransformToNode(node, object.position, object.rotation, object.scale);

      const userData = {
        editorObjectId: object.id,
        objectId: object.id,
        objectType: object.type,
        objectSelectionRole: object.selectionRole ?? 'default',
        isEditable: true,
        isStaticGltfSelectable: true,
      };

      node.userData = {
        ...node.userData,
        ...userData,
      };

      const entry: StaticGltfNodeEntry = {
        url,
        objectId: object.id,
        nodeName: object.nodeName,
        nodeIndex: object.nodeIndex,
        node,
      };
      activeStaticNodesByObjectId.set(object.id, entry);
      activeStaticNodeEntryByNode.set(node, entry);
      registeredObjectIdsRef.current.push(object.id);
    });

    registeredObjectIdsRef.current.forEach((objectId) => {
      const entry = activeStaticNodesByObjectId.get(objectId);
      if (entry?.url !== url) return;

      entry.node.traverse((child) => {
        if (!activeStaticNodeEntryByNode.has(child)) {
          activeStaticNodeEntryByNode.set(child, entry);
        }
      });
    });

    selectedObjectIdRef.current = null;
    scene.updateWorldMatrix(true, true);

    return () => {
      registeredObjectIdsRef.current.forEach((objectId) => {
        const entry = activeStaticNodesByObjectId.get(objectId);
        if (entry?.url === url) {
          activeStaticNodesByObjectId.delete(objectId);
          deleteStaticNodeEntry(entry);
        }
      });
      registeredObjectIdsRef.current = [];
    };
  }, [editorObjects, nodesByNormalizedName, nodesByTraversalIndex, scene, url]);

  useEffect(() => {
    const previousId = selectedObjectIdRef.current;
    if (previousId && previousId !== selectedObjectId) {
      const previous = activeStaticNodesByObjectId.get(previousId);
      if (previous?.url === url) {
        previous.node.matrixAutoUpdate = false;
        previous.node.updateMatrix();
      }
    }

    selectedObjectIdRef.current = selectedObjectId;
    if (!selectedObjectId) return;

    const selected = activeStaticNodesByObjectId.get(selectedObjectId);
    if (selected?.url !== url) return;

    selected.node.matrixAutoUpdate = true;
    selected.node.updateWorldMatrix(true, true);
  }, [selectedObjectId, url]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const debugWindow = window as typeof window & {
      __PIXL_STATIC_GLTF_INFO__?: Record<string, unknown>;
    };
    const scenes = {
      ...((debugWindow.__PIXL_STATIC_GLTF_INFO__?.scenes as Record<string, unknown> | undefined) ?? {}),
      [url]: info,
    };
    debugWindow.__PIXL_STATIC_GLTF_INFO__ = { scenes };
  }, [info, url]);

  useEffect(() => {
    activeStaticScenesByUrl.set(url, scene);

    return () => {
      if (activeStaticScenesByUrl.get(url) === scene) {
        activeStaticScenesByUrl.delete(url);
      }
    };
  }, [scene, url]);

  return (
    <primitive
      object={scene}
      dispose={null}
      userData={{ isStaticGltfVisualRoot: true }}
    />
  );
};
