export const ENGINE_LOCAL_ONLY = import.meta.env.VITE_ENGINE_LOCAL_ONLY !== 'false';

export const isDesktopLikeFileSystemAvailable = () => (
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'showDirectoryPicker' in window
);
