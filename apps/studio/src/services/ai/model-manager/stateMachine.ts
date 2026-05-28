import type { ModelInstallState } from './contracts';

export type InstallEvent =
  | { type: 'QUEUE' }
  | { type: 'START_DOWNLOAD' }
  | { type: 'DOWNLOAD_COMPLETED' }
  | { type: 'VERIFY_START' }
  | { type: 'VERIFY_OK' }
  | { type: 'VERIFY_FAILED'; error: string }
  | { type: 'DOWNLOAD_FAILED'; error: string }
  | { type: 'REMOVE' }
  | { type: 'REMOVED' }
  | { type: 'RETRY' };

export interface InstallMachineContext {
  state: ModelInstallState;
  error?: string;
}

export function transitionInstallState(
  context: InstallMachineContext,
  event: InstallEvent,
): InstallMachineContext {
  const { state } = context;

  switch (state) {
    case 'not_installed': {
      if (event.type === 'QUEUE') return { state: 'queued' };
      return context;
    }

    case 'queued': {
      if (event.type === 'START_DOWNLOAD') return { state: 'downloading' };
      if (event.type === 'REMOVE') return { state: 'removing' };
      return context;
    }

    case 'downloading': {
      if (event.type === 'DOWNLOAD_COMPLETED') return { state: 'verifying' };
      if (event.type === 'DOWNLOAD_FAILED') return { state: 'failed', error: event.error };
      if (event.type === 'REMOVE') return { state: 'removing' };
      return context;
    }

    case 'verifying': {
      if (event.type === 'VERIFY_OK') return { state: 'ready' };
      if (event.type === 'VERIFY_FAILED') return { state: 'failed', error: event.error };
      if (event.type === 'REMOVE') return { state: 'removing' };
      return context;
    }

    case 'ready': {
      if (event.type === 'REMOVE') return { state: 'removing' };
      return context;
    }

    case 'failed': {
      if (event.type === 'RETRY') return { state: 'queued' };
      if (event.type === 'REMOVE') return { state: 'removing' };
      return context;
    }

    case 'removing': {
      if (event.type === 'REMOVED') return { state: 'not_installed' };
      return context;
    }

    default:
      return context;
  }
}
