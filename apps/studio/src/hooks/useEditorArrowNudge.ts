/**
 * Arrow-key nudge for the editor's selected object.
 *
 * UX: when an object is selected AND the runtime isn't playing, pressing
 * the arrow keys moves the object by 1 logical unit. Holding Shift
 * accelerates to 10 units (coarse nudge); holding Alt downshifts to 0.1
 * (fine nudge). This mirrors Unity / Godot / PhaserEditor2D-v3 conventions.
 *
 * Why this hook exists: the user reported that arrow keys were moving the
 * player character even while in edit mode, because the loaded Phaser
 * runtime script polls `keys.isDown` and the Phaser keyboard plugin keeps
 * tracking key state regardless of the scene-pause state. The companion
 * fix in PhaserRuntimeMount disables `scene.input.keyboard.enabled` while
 * !isPlaying so the script's polls go silent. This hook then claims the
 * arrow keys at the React level for a NUDGE-the-selected-object behavior
 * that matches user expectation.
 *
 * Disabled while typing in an input/textarea/contentEditable so number
 * inputs in the Inspector keep working as expected.
 */
import { useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { useRuntimeGameStore } from '@/stores/runtimeGameStore';

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const isFormElement = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export const useEditorArrowNudge = (): void => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!ARROW_KEYS.has(event.key)) return;
      // Never steal arrows from form inputs (Inspector number fields,
      // search box, name renamer, etc.).
      if (isFormElement(event.target)) return;
      // In play mode, arrow keys belong to the game.
      if (useRuntimeGameStore.getState().isPlaying) return;

      const editor = useEditorStore.getState();
      const selectedId = editor.selectedObjectId;
      if (!selectedId) return;
      const obj = editor.objects.find((o) => o.id === selectedId);
      if (!obj) return;

      // Step size — Shift = 10× (coarse), Alt = 0.1× (fine), default = 1.
      const base = event.shiftKey ? 10 : (event.altKey ? 0.1 : 1);

      let dx = 0;
      let dy = 0;
      switch (event.key) {
        case 'ArrowUp':
          dy = -base;
          break;
        case 'ArrowDown':
          dy = base;
          break;
        case 'ArrowLeft':
          dx = -base;
          break;
        case 'ArrowRight':
          dx = base;
          break;
      }

      // Block default (page scroll, focus traversal) and Phaser capture.
      event.preventDefault();
      event.stopPropagation();

      const [x, y, z] = obj.position ?? [0, 0, 0];
      editor.updateObject(obj.id, {
        position: [x + dx, y + dy, z],
      });
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as EventListenerOptions);
    };
  }, []);
};
