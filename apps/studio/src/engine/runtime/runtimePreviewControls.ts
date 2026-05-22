import { useEditorStore } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import {
  createProjectDocumentFromEditor,
  prepareProjectDocumentForRuntimePreview,
} from '@/services/localProjectFiles';
import { RuntimePreviewSession } from './runtimePreview';
import { EditorCameraPoseTarget } from '@/stores/editorStore';

export type RuntimePreviewToggleResult =
  | { action: 'started'; session: RuntimePreviewSession }
  | { action: 'stopped' };

export const startRuntimePreviewFromEditor = (projectName?: string): RuntimePreviewSession => {
  const document = prepareProjectDocumentForRuntimePreview(createProjectDocumentFromEditor(projectName));
  const session = useRuntimeGameStore.getState().startPreview(document, { source: 'editor' });
  useEditorStore.getState().setEditMode(false);
  return session;
};

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isVec3 = (value: unknown): value is [number, number, number] => (
  Array.isArray(value) &&
  value.length === 3 &&
  value.every(isFiniteNumber)
);

const isQuaternion = (value: unknown): value is [number, number, number, number] => (
  Array.isArray(value) &&
  value.length === 4 &&
  value.every(isFiniteNumber)
);

type RuntimePreviewFrameWindow = Window & {
  __PIXL_EDITOR_GET_CAMERA_POSE__?: () => unknown;
  __PIXL_EDITOR_RUNTIME_CAMERA_POSE__?: unknown;
};

const getRuntimeFrameCameraPose = () => {
  const frame = document.querySelector<HTMLIFrameElement>('iframe[data-runtime-preview-frame="true"]');
  if (!frame?.contentWindow) return null;

  try {
    const frameWindow = frame.contentWindow as RuntimePreviewFrameWindow;
    return frameWindow.__PIXL_EDITOR_GET_CAMERA_POSE__?.()
      ?? frameWindow.__PIXL_EDITOR_RUNTIME_CAMERA_POSE__
      ?? null;
  } catch {
    return null;
  }
};

const getRuntimeCameraPose = (): Omit<EditorCameraPoseTarget, 'timestamp'> | null => {
  const pose = window.__PIXL_EDITOR_RUNTIME_PREVIEW_BRIDGE__?.getCameraPose?.()
    ?? getRuntimeFrameCameraPose();
  if (!isRecord(pose) || !isVec3(pose.position) || !isQuaternion(pose.quaternion)) return null;

  return {
    position: pose.position,
    quaternion: pose.quaternion,
    fov: isFiniteNumber(pose.fov) ? pose.fov : undefined,
  };
};

export const stopRuntimePreview = () => {
  const cameraPose = getRuntimeCameraPose();

  useRuntimeGameStore.getState().stopPreview();

  const editorStore = useEditorStore.getState();
  editorStore.setEditMode(true);
  if (cameraPose) {
    editorStore.setCameraPoseTarget(cameraPose);
  }
};

export const toggleRuntimePreviewFromEditor = (projectName?: string): RuntimePreviewToggleResult => {
  const runtimeState = useRuntimeGameStore.getState();
  const editorState = useEditorStore.getState();

  if (runtimeState.previewSession || !editorState.isEditMode) {
    stopRuntimePreview();
    return { action: 'stopped' };
  }

  return {
    action: 'started',
    session: startRuntimePreviewFromEditor(projectName),
  };
};
