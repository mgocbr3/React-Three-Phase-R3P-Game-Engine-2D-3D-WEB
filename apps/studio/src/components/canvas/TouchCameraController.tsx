/**
 * TouchCameraController - Professional touch camera for 3D editor
 * 
 * Uses PointerEvents for better precision and compatibility with TransformControls.
 * Only active in "Select" mode - in transform modes, touch is reserved for gizmos.
 */

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GizmoInteractionLock } from './TransformGizmo';
import { useEditorStore } from '@/stores/editorStore';

interface TouchCameraControllerProps {
  enabled?: boolean;
  minDistance?: number;
  maxDistance?: number;
  panSpeed?: number;
  rotateSpeed?: number;
  zoomSpeed?: number;
}

export const TouchCameraController = ({
  enabled = true,
  minDistance = 5,
  maxDistance = 100,
  panSpeed = 0.01,
  rotateSpeed = 0.005,
  zoomSpeed = 0.02,
}: TouchCameraControllerProps) => {
  const transformMode = useEditorStore(state => state.transformMode);
  
  // Touch camera rules:
  // - Orbit (1 finger) only in Select mode
  // - Pan/Zoom (2 fingers) in any mode (unless gizmo is actively dragging)
  const isOrbitEnabled = transformMode === 'select';
  const isCameraEnabled = enabled;
  const { camera, gl } = useThree();
  
  // Pointer state (supports multi-touch via pointer events)
  const pointers = useRef<
    Map<number, { x: number; y: number; startX: number; startY: number }>
  >(new Map());
  const cameraActive = useRef(false);
  const startDistance = useRef(0);
  const startCenter = useRef({ x: 0, y: 0 });
  
  // Camera state for orbit
  const cameraState = useRef({
    spherical: new THREE.Spherical(),
    target: new THREE.Vector3(0, 0, 0),
    initialized: false,
  });
  
  useEffect(() => {
    if (!isCameraEnabled) return;
    
    const canvas = gl.domElement;
    canvas.style.touchAction = 'none';
    
    // Initialize camera spherical coordinates
    if (!cameraState.current.initialized) {
      const offset = new THREE.Vector3().subVectors(camera.position, cameraState.current.target);
      cameraState.current.spherical.setFromVector3(offset);
      cameraState.current.initialized = true;
    }
    
    const getDistance = () => {
      const pts = Array.from(pointers.current.values());
      if (pts.length < 2) return 0;
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      return Math.sqrt(dx * dx + dy * dy);
    };
    
    const getCenter = () => {
      const pts = Array.from(pointers.current.values());
      if (pts.length === 0) return { x: 0, y: 0 };
      const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
      return { x: sum.x / pts.length, y: sum.y / pts.length };
    };
    
    const handlePointerDown = (e: PointerEvent) => {
      // CRITICAL: Don't start camera control if gizmo is active
      if (GizmoInteractionLock.isActive()) {
        return;
      }
      
      // Only handle touch pointers for camera (mouse is handled by FlyCamera)
      if (e.pointerType !== 'touch') {
        return;
      }

      // If the user moved the camera with mouse/keyboard (FlyCamera), our spherical state can be stale.
      // Sync to the current camera before starting a new touch gesture to avoid snapping.
      if (pointers.current.size === 0 && cameraState.current.initialized) {
        const offset = new THREE.Vector3().subVectors(camera.position, cameraState.current.target);
        cameraState.current.spherical.setFromVector3(offset);
      }
      
      pointers.current.set(e.pointerId, { 
        x: e.clientX, 
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
      });
      
      if (pointers.current.size === 2) {
        startDistance.current = getDistance();
        startCenter.current = getCenter();
      }
    };
    
    const handlePointerMove = (e: PointerEvent) => {
      // CRITICAL: Don't move camera if gizmo is active
      if (GizmoInteractionLock.isActive()) {
        pointers.current.clear();
        cameraActive.current = false;
        return;
      }
      
      if (e.pointerType !== 'touch') return;
      if (!pointers.current.has(e.pointerId)) return;
      
      const prev = pointers.current.get(e.pointerId)!;
      const prevX = prev.x;
      const prevY = prev.y;

      // Always update current pointer position (keep startX/startY stable)
      pointers.current.set(e.pointerId, { ...prev, x: e.clientX, y: e.clientY });

      const camState = cameraState.current;

      // 2 fingers: allow pan/zoom in ANY mode (unless gizmo lock is active)
      if (pointers.current.size === 2) {
        cameraActive.current = true;

        const currentDistance = getDistance();
        const currentCenter = getCenter();

        // Pinch zoom
        if (startDistance.current > 0) {
          const delta = startDistance.current - currentDistance;
          camState.spherical.radius += delta * zoomSpeed;
          camState.spherical.radius = Math.max(minDistance, Math.min(maxDistance, camState.spherical.radius));
          startDistance.current = currentDistance;
        }

        // Pan (two finger drag)
        const panDeltaX = currentCenter.x - startCenter.current.x;
        const panDeltaY = currentCenter.y - startCenter.current.y;

        // Get camera right and up vectors for panning
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        right.setFromMatrixColumn(camera.matrix, 0);
        up.setFromMatrixColumn(camera.matrix, 1);

        camState.target.addScaledVector(right, -panDeltaX * panSpeed);
        camState.target.addScaledVector(up, panDeltaY * panSpeed);

        startCenter.current = currentCenter;
        return;
      }
      
      // 1 finger: orbit ONLY in Select mode
      if (!isOrbitEnabled) {
        return;
      }

      // Drag threshold should be measured from gesture start (not from last frame),
      // otherwise slow drags never exceed the threshold.
      const DRAG_THRESHOLD = 8;
      const totalDelta = Math.abs(e.clientX - prev.startX) + Math.abs(e.clientY - prev.startY);

      if (!cameraActive.current) {
        if (totalDelta <= DRAG_THRESHOLD) return;
        cameraActive.current = true;
      }

      const deltaX = e.clientX - prevX;
      const deltaY = e.clientY - prevY;

      camState.spherical.theta -= deltaX * rotateSpeed;
      camState.spherical.phi -= deltaY * rotateSpeed;

      // Clamp phi to prevent flipping
      camState.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, camState.spherical.phi));
    };
    
    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      
      pointers.current.delete(e.pointerId);
      
      if (pointers.current.size === 0) {
        cameraActive.current = false;
      } else if (pointers.current.size === 1) {
        // Reset for single-finger mode
        startDistance.current = 0;

        // Reset remaining pointer's drag start so orbit threshold works correctly
        const [remainingId, remaining] = Array.from(pointers.current.entries())[0];
        pointers.current.set(remainingId, { ...remaining, startX: remaining.x, startY: remaining.y });
      }
    };
    
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);
    
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [isCameraEnabled, isOrbitEnabled, camera, gl, minDistance, maxDistance, panSpeed, rotateSpeed, zoomSpeed]);
  
  // Update camera position from spherical coordinates
  useFrame(() => {
    if (!isCameraEnabled || !cameraState.current.initialized) return;

    // CRITICAL: Only take control of the camera while a touch gesture is actively moving the camera.
    // Otherwise, on hybrid devices (iPad + mouse/keyboard), this would override FlyCamera every frame.
    if (!cameraActive.current) return;
    
    // Don't update camera while gizmo is being used
    if (GizmoInteractionLock.isActive()) {
      // Hard-cancel any in-progress camera gesture
      if (cameraActive.current) {
        cameraActive.current = false;
        pointers.current.clear();
      }
      return;
    }
    
    const camState = cameraState.current;
    const offset = new THREE.Vector3().setFromSpherical(camState.spherical);
    camera.position.copy(camState.target).add(offset);
    camera.lookAt(camState.target);
  });
  
  return null;
};
