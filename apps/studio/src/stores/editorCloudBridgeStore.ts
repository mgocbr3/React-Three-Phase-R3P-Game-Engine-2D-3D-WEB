import { create } from 'zustand';

export interface EditorCloudSaveOptions {
  projectId?: string | null;
  title?: string;
}

type CloudBridgeResult = unknown | Promise<unknown> | void;

interface EditorCloudBridgeState {
  isReady: boolean;
  isEmbedded: boolean;
  currentProjectId: string | null;
  saveToPixlland: (options?: EditorCloudSaveOptions) => CloudBridgeResult;
  requestProjects: () => CloudBridgeResult;
  openProject: (projectId: string) => CloudBridgeResult;
  setCurrentProjectId: (projectId: string | null) => void;
  configureBridge: (bridge: Partial<Omit<EditorCloudBridgeState, 'configureBridge' | 'resetBridge'>>) => void;
  resetBridge: () => void;
}

const noop = () => undefined;

const createInitialBridgeState = (
  set?: (state: Partial<EditorCloudBridgeState>) => void,
): Omit<EditorCloudBridgeState, 'configureBridge' | 'resetBridge'> => ({
  isReady: false,
  isEmbedded: false,
  currentProjectId: null,
  saveToPixlland: noop,
  requestProjects: noop,
  openProject: noop,
  setCurrentProjectId: (projectId) => {
    set?.({ currentProjectId: projectId });
  },
});

export const useEditorCloudBridgeStore = create<EditorCloudBridgeState>((set) => ({
  ...createInitialBridgeState(set),
  configureBridge: (bridge) => set(bridge),
  resetBridge: () => set(createInitialBridgeState(set)),
}));

export const getEditorCloudBridge = () => useEditorCloudBridgeStore.getState();
