import { useCallback, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";

type AnyPointerEvent = PointerEvent | MouseEvent;

interface TapIntentOptions {
  onTap: (e: ThreeEvent<AnyPointerEvent>) => void;
  delayMs?: number;
}

/**
 * useTapIntent
 *
 * Uses a delayed selection approach:
 * - On pointerdown, schedules selection after a short delay
 * - On pointermove (significant), cancels the pending selection
 * - This prevents accidental selection when user starts dragging
 *
 * Fallback: if user clicks and releases without moving, selection happens
 * after the delay even if onPointerUp doesn't fire on the mesh.
 */
export function useTapIntent({
  onTap,
  delayMs = 100,
}: TapIntentOptions) {
  const pendingRef = useRef<{
    timeoutId: ReturnType<typeof setTimeout>;
    event: ThreeEvent<AnyPointerEvent>;
    startX: number;
    startY: number;
    cancelled: boolean;
  } | null>(null);

  const cancel = useCallback(() => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timeoutId);
      pendingRef.current.cancelled = true;
      pendingRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback((e: ThreeEvent<AnyPointerEvent>) => {
    const native = e.nativeEvent as any;
    const button = typeof native.button === "number" ? native.button : 0;

    // Only left-click / primary action
    if (button !== 0) return;

    // Cancel any previous pending selection
    cancel();

    const startX = native.clientX ?? 0;
    const startY = native.clientY ?? 0;

    // Schedule selection after delay
    const timeoutId = setTimeout(() => {
      if (pendingRef.current && !pendingRef.current.cancelled) {
        console.log(` [TapIntent] Delayed selection fired`);
        onTap(pendingRef.current.event);
        pendingRef.current = null;
      }
    }, delayMs);

    pendingRef.current = {
      timeoutId,
      event: e,
      startX,
      startY,
      cancelled: false,
    };
    
    console.log(` [TapIntent] pointerDown - scheduled selection in ${delayMs}ms`);
  }, [onTap, delayMs, cancel]);

  const onPointerMove = useCallback((e: ThreeEvent<AnyPointerEvent>) => {
    const pending = pendingRef.current;
    if (!pending || pending.cancelled) return;

    const native = e.nativeEvent as any;
    const x = native.clientX ?? 0;
    const y = native.clientY ?? 0;
    const dx = x - pending.startX;
    const dy = y - pending.startY;

    // If moved more than 4px, cancel the selection (it's a drag)
    const threshold = 4;
    if (dx * dx + dy * dy > threshold * threshold) {
      console.log(` [TapIntent] Movement detected - cancelling selection`);
      cancel();
    }
  }, [cancel]);

  // onPointerUp can optionally trigger immediate selection if still pending
  const onPointerUp = useCallback((e: ThreeEvent<AnyPointerEvent>) => {
    const pending = pendingRef.current;
    if (!pending || pending.cancelled) return;

    // Fire selection immediately on pointer up (before delay completes)
    clearTimeout(pending.timeoutId);
    console.log(` [TapIntent] pointerUp - immediate selection`);
    onTap(pending.event);
    pendingRef.current = null;
  }, [onTap]);

  return { onPointerDown, onPointerMove, onPointerUp, cancel };
}
