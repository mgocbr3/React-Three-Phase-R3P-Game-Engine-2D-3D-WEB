import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { RuntimePreviewSession } from '@/engine/runtime/runtimePreview';

interface RuntimeGameFrameProps {
  session: RuntimePreviewSession;
}

interface RuntimeCameraPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  fov?: number;
}

declare global {
  interface Window {
    __PIXL_EDITOR_RUNTIME_PREVIEW_BRIDGE__?: {
      getCameraPose: () => RuntimeCameraPose | null;
    };
  }
}

const escapeHtmlAttribute = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
);

const escapeJsonScriptValue = (value: string) => (
  JSON.stringify(value).replace(/</g, '\\u003c')
);

const buildImportMap = () => `{
        "imports": {
          "three": "/node_modules/.vite/deps/three.js",
          "three/": "/node_modules/three/"
        }
      }`;

const getSiblingRuntimeStylesheetUrl = (scriptUrl: string) => (
  scriptUrl.replace(/[?#].*$/, '').replace(/[^/]+$/, 'styles.css')
);

export const buildRuntimeHtml = (session: RuntimePreviewSession) => {
  const target = session.launchTarget;
  if (target.kind !== 'web-runtime') return '';

  const title = escapeHtmlAttribute(session.projectName);
  const baseHref = escapeHtmlAttribute(target.documentBaseUrl);
  const scriptUrl = `${target.scriptUrl}${target.scriptUrl.includes('?') ? '&' : '?'}pixlRuntimePreview=${encodeURIComponent(session.id)}`;
  const stylesheetUrl = escapeHtmlAttribute(getSiblingRuntimeStylesheetUrl(target.scriptUrl));
  const sdkScript = target.sdkUrl
    ? `<script src="${escapeHtmlAttribute(target.sdkUrl)}" defer></script>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#4f7f3a" />
    <base href="${baseHref}" />
    <title>${title}</title>
    ${sdkScript}
    <link rel="stylesheet" href="${stylesheetUrl}" />
    <script type="importmap">${buildImportMap()}</script>
    <style>
      html,
      body,
      #app {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #0b1510;
      }

      body {
        overscroll-behavior: none;
      }
    </style>
  </head>
  <body>
    <main id="app" aria-label="${title}"></main>
    <script>
      window.__PIXL_EDITOR_PREVIEW__ = ${escapeJsonScriptValue(session.id)};
      window.__PIXL_EDITOR_RUNTIME_CAMERA_POSE__ = null;
    </script>
    <script type="module">
      import ${escapeJsonScriptValue(scriptUrl)};
    </script>
  </body>
</html>`;
};

export const RuntimeGameFrame = ({ session }: RuntimeGameFrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const latestCameraPoseRef = useRef<RuntimeCameraPose | null>(null);
  const runtimeHtml = useMemo(() => buildRuntimeHtml(session), [session]);

  useLayoutEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;

    latestCameraPoseRef.current = null;

    window.__PIXL_EDITOR_RUNTIME_PREVIEW_BRIDGE__ = {
      getCameraPose: () => {
        const frameWindow = frame.contentWindow as (Window & {
          __PIXL_EDITOR_GET_CAMERA_POSE__?: () => RuntimeCameraPose | null;
          __PIXL_EDITOR_RUNTIME_CAMERA_POSE__?: RuntimeCameraPose | null;
        }) | null;

        try {
          return latestCameraPoseRef.current
            ?? frameWindow?.__PIXL_EDITOR_GET_CAMERA_POSE__?.()
            ?? frameWindow?.__PIXL_EDITOR_RUNTIME_CAMERA_POSE__
            ?? null;
        } catch {
          return latestCameraPoseRef.current;
        }
      },
    };

    const handleRuntimeMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      const data = event.data as {
        type?: string;
        previewId?: string;
        pose?: RuntimeCameraPose;
      } | null;

      if (data?.type !== 'pixl-editor-runtime-camera-pose') return;
      if (data.previewId !== session.id) return;
      latestCameraPoseRef.current = data.pose ?? null;
    };

    const focusFrame = () => frame.contentWindow?.focus();
    window.addEventListener('message', handleRuntimeMessage);
    frame.addEventListener('load', focusFrame);
    return () => {
      window.removeEventListener('message', handleRuntimeMessage);
      frame.removeEventListener('load', focusFrame);
      if (window.__PIXL_EDITOR_RUNTIME_PREVIEW_BRIDGE__?.getCameraPose) {
        delete window.__PIXL_EDITOR_RUNTIME_PREVIEW_BRIDGE__;
      }
    };
  }, [session.id]);

  if (session.launchTarget.kind !== 'web-runtime') return null;

  return (
    <div className="absolute inset-0 z-40 bg-[#050807]">
      <iframe
        key={session.id}
        ref={iframeRef}
        title={`${session.projectName} Runtime Preview`}
        data-runtime-preview-frame="true"
        srcDoc={runtimeHtml}
        className="h-full w-full border-0 bg-[#050807]"
        allow="autoplay; fullscreen; gamepad; pointer-lock"
        allowFullScreen
      />
    </div>
  );
};
