/**
 * TransformGizmo - Using official Three.js TransformControls via Drei
 * 
 * Features:
 * - Precise, battle-tested controls from Three.js core
 * - Full touch support with pointer capture
 * - World/Local space toggle
 * - Snap-to-grid with Shift key
 * - Proper pointer capture for reliable dragging on touch devices
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TransformControls as ThreeTransformControls } from 'three/addons/controls/TransformControls.js';
import { TransformSpace, useEditorStore } from '@/stores/editorStore';
import { useIsTouchDevice } from '@/hooks/use-touch-device';

// The mode type that TransformControls accepts (excludes 'select')
type GizmoMode = 'translate' | 'rotate' | 'scale';

interface TransformGizmoProps {
  targetRef: React.RefObject<THREE.Object3D>;
  mode: GizmoMode;
  space?: TransformSpace;
  onTransformStart?: () => void;
  onTransformEnd?: () => void;
  onChange?: (position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3) => void;
}

// Global state to prevent scene interactions while gizmo is active
export const GizmoInteractionLock = {
  isLocked: false,
  isDragging: false,
  isHoveringAxis: false,
  _pointerId: -1,
  _domElement: null as HTMLElement | null,
  _controlsRef: null as any,
  _raycaster: null as THREE.Raycaster | null,
  _camera: null as THREE.Camera | null,
  
  setControlsRef(ref: any) {
    this._controlsRef = ref;
  },
  
  setRaycaster(raycaster: THREE.Raycaster, camera: THREE.Camera) {
    this._raycaster = raycaster;
    this._camera = camera;
  },
  
  // Check if the pointer is currently over a gizmo axis (arrow, plane, etc.)
  checkAxisHover(): boolean {
    if (this._controlsRef?.axis) {
      this.isHoveringAxis = true;
      return true;
    }
    this.isHoveringAxis = false;
    return false;
  },
  
  // Raycast against gizmo picker meshes to check if pointer would hit gizmo
  raycastGizmo(pointer: THREE.Vector2): boolean {
    if (!this._controlsRef || !this._raycaster || !this._camera) return false;
    
    try {
      this._raycaster.setFromCamera(pointer, this._camera);
      
      // TransformControls has internal picker meshes for hit detection
      // They are children of the controls object
      const controls = this._controlsRef;
      
      // Three 0.184 stores pickers under _gizmo.picker[mode].
      // Older wrappers exposed _gizmo[mode], so keep both paths for compatibility.
      const gizmo = controls._gizmo;
      if (!gizmo) return false;
      
      const modePickers = gizmo.picker?.[controls.mode] ?? gizmo[controls.mode];
      if (!modePickers) return false;
      
      // Collect all pickable meshes
      const pickables: THREE.Object3D[] = [];
      modePickers.traverse((child: THREE.Object3D) => {
        if ((child as any).isMesh) {
          pickables.push(child);
        }
      });
      
      if (pickables.length === 0) return false;
      
      const intersects = this._raycaster.intersectObjects(pickables, false);
      return intersects.length > 0;
    } catch (e) {
      // Fallback to axis check
      return this.checkAxisHover();
    }
  },
  
  lock() {
    this.isLocked = true;
    if (typeof window !== 'undefined') (window as any).__gizmoLocked = true;
  },
  
  unlock() {
    this.isLocked = false;
    this.isDragging = false;
    this.isHoveringAxis = false;
    if (typeof window !== 'undefined') {
      (window as any).__gizmoLocked = false;
      (window as any).__gizmoDragging = false;
      (window as any).__gizmoHoveringAxis = false;
    }
    this._releasePointerCapture();
  },
  
  startDrag(pointerId?: number, domElement?: HTMLElement) {
    this.isDragging = true;
    this.isLocked = true;
    if (typeof window !== 'undefined') {
      (window as any).__gizmoDragging = true;
      (window as any).__gizmoLocked = true;
    }
    
    // Capture pointer to prevent other elements from receiving events
    if (pointerId !== undefined && pointerId >= 0 && domElement) {
      try {
        domElement.setPointerCapture(pointerId);
        this._pointerId = pointerId;
        this._domElement = domElement;
      } catch (e) {
        // Pointer capture may fail on some browsers
      }
    }
  },
  
  endDrag() {
    this.isDragging = false;
    if (typeof window !== 'undefined') (window as any).__gizmoDragging = false;
    this._releasePointerCapture();
  },
  
  _releasePointerCapture() {
    if (this._pointerId >= 0 && this._domElement) {
      try {
        if (this._domElement.hasPointerCapture(this._pointerId)) {
          this._domElement.releasePointerCapture(this._pointerId);
        }
      } catch (e) {
        // Pointer may already be released
      }
      this._pointerId = -1;
      this._domElement = null;
    }
  },
  
  isActive() {
    const w = typeof window !== 'undefined' ? (window as any) : ({} as any);
    
    // Also check if pointer is over a gizmo axis (real-time check)
    const axisHover = this.checkAxisHover();
    
    return Boolean(
      this.isLocked ||
        this.isDragging ||
        axisHover ||
        w.__gizmoLocked === true ||
        w.__gizmoDragging === true ||
        w.__gizmoHoveringAxis === true
    );
  },
  
  isCurrentlyDragging() {
    const w = typeof window !== 'undefined' ? (window as any) : ({} as any);
    return Boolean(this.isDragging || w.__gizmoDragging === true);
  }
};

export const TransformGizmo = ({
  targetRef,
  mode,
  space = 'world',
  onTransformStart,
  onTransformEnd,
  onChange,
}: TransformGizmoProps) => {
  const { gl, camera, raycaster, invalidate } = useThree();
  const activePointerId = useRef<number>(-1);
  const controls = useMemo(
    () => new ThreeTransformControls(camera, gl.domElement),
    [camera, gl.domElement],
  );
  const helper = useMemo(() => controls.getHelper(), [controls]);
  
  // Detect touch device for larger gizmo handles
  const isTouchDevice = useIsTouchDevice();
  
  // Gizmo size: larger on touch devices for easier interaction
  // Desktop: 1.0 (comfortable), Touch: 1.4 (bigger targets for fingers)
  const gizmoSize = isTouchDevice ? 1.4 : 1.0;
  
  // Get snap settings from store
  const { snapEnabled, snapTranslate, snapRotate, snapScale, transformSpace } = useEditorStore();
  
  // Use store space if not overridden
  const effectiveSpace = space || transformSpace;

  useEffect(() => {
    helper.userData = {
      ...helper.userData,
      isEditorInternal: true,
    };
    helper.traverse((child) => {
      child.userData = {
        ...child.userData,
        isEditorInternal: true,
      };
    });
  }, [helper]);

  useEffect(() => {
    return () => {
      controls.detach();
      controls.dispose();
      GizmoInteractionLock.setControlsRef(null);
      document.body.style.cursor = 'default';
    };
  }, [controls]);

  // Attach to target object — runs on mount and whenever the selected target changes.
  // IMPORTANT: We previously bundled attach + setMode/setSpace/setSize into a single
  // effect keyed on [mode, space, size]. That meant changing the gizmo mode forced a
  // full `controls.detach()` then `controls.attach()` cycle, which left the internal
  // helper picker meshes in an inconsistent state — the visual would stick on the
  // previous mode (e.g. translate arrows even after clicking Rotate). Three.js
  // `TransformControls.setMode/setSpace/setSize` are designed to be called on an
  // ALREADY-attached controls instance, so we keep attachment lifecycle separate
  // from the per-frame configuration writes below.
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    controls.attach(target);
    controls.showX = true;
    controls.showY = true;
    controls.showZ = true;
    invalidate();

    return () => {
      controls.detach();
      invalidate();
    };
  }, [controls, invalidate, targetRef]);

  // Mode change — no detach/attach, just swap the gizmo visual.
  useEffect(() => {
    if (!targetRef.current) return;
    controls.setMode(mode);
    invalidate();
  }, [controls, invalidate, mode, targetRef]);

  // Space change (world vs local).
  useEffect(() => {
    if (!targetRef.current) return;
    controls.setSpace(effectiveSpace);
    invalidate();
  }, [controls, effectiveSpace, invalidate, targetRef]);

  // Size change (touch vs mouse).
  useEffect(() => {
    if (!targetRef.current) return;
    controls.setSize(gizmoSize);
    invalidate();
  }, [controls, gizmoSize, invalidate, targetRef]);

  // Handle dragging state with pointer capture
  const handleDraggingChanged = useCallback((event: any) => {
    const isDragging = event.value;
    
    if (isDragging) {
      GizmoInteractionLock.startDrag(activePointerId.current, gl.domElement);
      onTransformStart?.();
    } else {
      GizmoInteractionLock.endDrag();
      GizmoInteractionLock.unlock();
      onTransformEnd?.();
    }
  }, [onTransformStart, onTransformEnd, gl.domElement]);

  // Handle object changes
  const handleObjectChange = useCallback(() => {
    if (!targetRef.current) return;
    
    const target = targetRef.current;
    onChange?.(
      target.position.clone(),
      target.rotation.clone(),
      target.scale.clone()
    );
  }, [targetRef, onChange]);

  // Handle hover state for cursor
  const handleMouseEnter = useCallback(() => {
    GizmoInteractionLock.lock();
    document.body.style.cursor = 'grab';
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!GizmoInteractionLock.isDragging) {
      GizmoInteractionLock.unlock();
      document.body.style.cursor = 'default';
    }
  }, []);

  const handleAxisChanged = useCallback((event: any) => {
    if (event.value) {
      handleMouseEnter();
      return;
    }
    handleMouseLeave();
  }, [handleMouseEnter, handleMouseLeave]);

  // Capture pointer ID on pointer down for later use in setPointerCapture
  useEffect(() => {
    const canvas = gl.domElement;
    
    const handlePointerDown = (e: PointerEvent) => {
      // Only capture if gizmo is hovered (locked)
      if (GizmoInteractionLock.isLocked) {
        activePointerId.current = e.pointerId;
      }
    };
    
    const handlePointerUp = () => {
      activePointerId.current = -1;
    };
    
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [gl.domElement]);

  // Safety net: make sure we never keep the editor "locked" if pointer events are interrupted
  // (common on iPad, trackpads, alt-tab, context menus, etc.).
  useEffect(() => {
    const canvas = gl.domElement;

    const resetCursorAndUnlock = () => {
      if (!GizmoInteractionLock.isActive()) return;
      GizmoInteractionLock.unlock();
      document.body.style.cursor = 'default';
    };

    const handleGlobalPointerUp = () => {
      // Only hard-unlock if we were dragging; hover lock is handled by mouseEnter/mouseLeave.
      if (GizmoInteractionLock.isCurrentlyDragging()) {
        resetCursorAndUnlock();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) resetCursorAndUnlock();
    };

    window.addEventListener('pointerup', handleGlobalPointerUp, true);
    window.addEventListener('pointercancel', handleGlobalPointerUp, true);
    window.addEventListener('blur', resetCursorAndUnlock);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    canvas.addEventListener('lostpointercapture', resetCursorAndUnlock as any);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp, true);
      window.removeEventListener('pointercancel', handleGlobalPointerUp, true);
      window.removeEventListener('blur', resetCursorAndUnlock);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas.removeEventListener('lostpointercapture', resetCursorAndUnlock as any);
    };
  }, [gl.domElement]);

  // Setup event listeners for TransformControls and register controls ref
  useEffect(() => {
    // Register controls ref for axis checking and raycasting
    GizmoInteractionLock.setControlsRef(controls);
    GizmoInteractionLock.setRaycaster(raycaster, camera);

    controls.addEventListener('dragging-changed', handleDraggingChanged);
    controls.addEventListener('objectChange', handleObjectChange);
    controls.addEventListener('axis-changed', handleAxisChanged);

    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
      controls.removeEventListener('objectChange', handleObjectChange);
      controls.removeEventListener('axis-changed', handleAxisChanged);
      // Clear controls ref on unmount
      GizmoInteractionLock.setControlsRef(null);
    };
  }, [controls, handleAxisChanged, handleDraggingChanged, handleObjectChange, raycaster, camera]);

  // Update snap settings on controls
  useEffect(() => {
    if (snapEnabled) {
      controls.setTranslationSnap(snapTranslate);
      controls.setRotationSnap(THREE.MathUtils.degToRad(snapRotate));
      controls.setScaleSnap(snapScale);
    } else {
      controls.setTranslationSnap(null);
      controls.setRotationSnap(null);
      controls.setScaleSnap(null);
    }
  }, [controls, snapEnabled, snapTranslate, snapRotate, snapScale]);

  // Shift key for temporary snap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !snapEnabled) {
        controls.setTranslationSnap(snapTranslate);
        controls.setRotationSnap(THREE.MathUtils.degToRad(snapRotate));
        controls.setScaleSnap(snapScale);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !snapEnabled) {
        controls.setTranslationSnap(null);
        controls.setRotationSnap(null);
        controls.setScaleSnap(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [controls, snapEnabled, snapTranslate, snapRotate, snapScale]);

  if (!targetRef.current) return null;

  return <primitive object={helper} />;
};

export default TransformGizmo;
