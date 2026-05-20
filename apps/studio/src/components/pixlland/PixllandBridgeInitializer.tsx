import { usePixllandBridge } from "@/hooks/usePixllandBridge";

/**
 * Ensures the Pixlland bridge is initialized even on pages that don't
 * explicitly use it (e.g. dashboard), so SYNC_PROJECTS can arrive.
 */
export const PixllandBridgeInitializer = () => {
  usePixllandBridge();
  return null;
};
