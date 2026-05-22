export const ENGINE_CLOUD_ENABLED =
  import.meta.env.VITE_ENGINE_CLOUD === 'true' ||
  import.meta.env.VITE_ENGINE_LOCAL_ONLY === 'false';

export const ENGINE_LOCAL_ONLY = !ENGINE_CLOUD_ENABLED;

export const isDesktopLikeFileSystemAvailable = () => (
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'showDirectoryPicker' in window
);
