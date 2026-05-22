import { Box, Gamepad2, Maximize2, Minimize2, Square } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';
import { getRuntimeAdapterLabel } from '@/engine/runtime/runtimePreview';
import { stopRuntimePreview } from '@/engine/runtime/runtimePreviewControls';

export const RuntimePreviewOverlay = () => {
  const previewSession = useRuntimeGameStore((s) => s.previewSession);
  const previewDisplayMode = useRuntimeGameStore((s) => s.previewDisplayMode);
  const togglePreviewFullscreen = useRuntimeGameStore((s) => s.togglePreviewFullscreen);
  const objectCount = useEditorStore((s) => s.objects.length);

  if (!previewSession) return null;

  const isWebRuntime = previewSession.launchTarget.kind === 'web-runtime';
  const adapterLabel = isWebRuntime
    ? 'Runtime real'
    : `${getRuntimeAdapterLabel(previewSession.runtime)} · ${objectCount} objetos`;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-[70] flex justify-center">
      <div className="pointer-events-auto flex max-w-[calc(100%-24px)] items-center gap-3 rounded-md border border-[#343434] bg-[#181818]/92 px-3 py-2 text-xs text-foreground shadow-2xl backdrop-blur-md">
        <span className="flex items-center gap-1.5 font-semibold text-primary">
          <Gamepad2 className="h-3.5 w-3.5" />
          Play Mode
        </span>
        <span className="hidden h-4 w-px bg-border sm:block" />
        <span className="hidden min-w-0 max-w-[220px] truncate text-muted-foreground sm:inline">
          {previewSession.projectName}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Box className="h-3.5 w-3.5" />
          {adapterLabel}
        </span>
        <button
          type="button"
          onClick={togglePreviewFullscreen}
          className="ml-1 flex h-7 items-center gap-1.5 rounded-sm border border-[#3a3a3a] bg-[#242424] px-2 font-semibold text-foreground transition-colors hover:bg-[#303030]"
          aria-label={previewDisplayMode === 'fullscreen' ? 'Return runtime to frame' : 'Runtime Fullscreen'}
          title={previewDisplayMode === 'fullscreen' ? 'Return runtime to frame' : 'Runtime Fullscreen'}
        >
          {previewDisplayMode === 'fullscreen' ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
          {previewDisplayMode === 'fullscreen' ? 'In-frame' : 'Fullscreen'}
        </button>
        <button
          type="button"
          onClick={stopRuntimePreview}
          className="flex h-7 items-center gap-1.5 rounded-sm border border-[#3a3a3a] bg-[#242424] px-2 font-semibold text-foreground transition-colors hover:bg-[#303030]"
          aria-label="Stop Runtime Preview"
        >
          <Square className="h-3.5 w-3.5" />
          Stop
        </button>
      </div>
    </div>
  );
};
