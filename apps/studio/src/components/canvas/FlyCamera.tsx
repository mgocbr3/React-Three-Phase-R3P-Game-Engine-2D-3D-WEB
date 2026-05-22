import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEditorStore } from '@/stores/editorStore';

interface FlyCameraProps {
  speed?: number;
  fastSpeed?: number;
  lookSpeed?: number;
  collisionDistance?: number; // Distance to keep from objects
}

export const FlyCamera = ({ 
  speed = 10, 
  fastSpeed = 25, 
  lookSpeed = 0.003,
  collisionDistance = 0
}: FlyCameraProps) => {
  const { camera, gl, scene } = useThree();
  const focusTarget = useEditorStore((s) => s.focusTarget);
  
  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    q: false,
    e: false,
    shift: false,
  });
  
  const isRightMouseDown = useRef(false);
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const direction = useRef(new THREE.Vector3());
  const velocity = useRef(new THREE.Vector3());
  const initialized = useRef(false);
  const currentSpeed = useRef(speed);
  const minSpeed = 2;
  const maxSpeed = 100;
  
  // Focus animation state
  const focusState = useRef<{
    active: boolean;
    targetPos: THREE.Vector3;
    cameraTargetPos: THREE.Vector3;
    progress: number;
    lastTimestamp: number;
  }>({
    active: false,
    targetPos: new THREE.Vector3(),
    cameraTargetPos: new THREE.Vector3(),
    progress: 0,
    lastTimestamp: 0,
  });

  useEffect(() => {
    // Initialize euler from camera only once
    if (!initialized.current) {
      euler.current.setFromQuaternion(camera.quaternion);
      initialized.current = true;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      
      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] = true;
      }
      if (e.shiftKey) keys.current.shift = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] = false;
      }
      if (!e.shiftKey) keys.current.shift = false;
    };

    const handleMouseDown = (e: MouseEvent | PointerEvent) => {
      // Only right-click (button 2) OR ctrl+click on canvas activates camera look
      // For iPad: also accept two-finger tap which may come as button 2
      const isCanvasTarget = e.target === gl.domElement || 
                             (e.target as HTMLElement)?.closest('canvas') !== null;
      
      if ((e.button === 2 || (e.button === 0 && e.ctrlKey)) && isCanvasTarget) {
        e.preventDefault();
        isRightMouseDown.current = true;
        gl.domElement.style.cursor = 'grabbing';
      }
    };

    const handleMouseUp = (e: MouseEvent | PointerEvent) => {
      if (e.button === 2 || (e.button === 0 && e.ctrlKey)) {
        isRightMouseDown.current = false;
        gl.domElement.style.cursor = 'auto';
      }
    };

    const handlePointerLeave = () => {
      isRightMouseDown.current = false;
      gl.domElement.style.cursor = 'auto';
      gl.domElement.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    };

    const handleMouseMove = (e: MouseEvent | PointerEvent) => {
      if (!isRightMouseDown.current) return;

      euler.current.y -= e.movementX * lookSpeed;
      euler.current.x -= e.movementY * lookSpeed;
      
      // Clamp vertical rotation
      euler.current.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, euler.current.x));
      
      camera.quaternion.setFromEuler(euler.current);
    };

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    const handleWheel = (e: WheelEvent) => {
      // Only handle wheel on canvas
      if (e.target !== gl.domElement) return;
      
      e.preventDefault();
      // Scroll up = increase speed, scroll down = decrease speed
      const delta = e.deltaY > 0 ? -2 : 2;
      currentSpeed.current = Math.max(minSpeed, Math.min(maxSpeed, currentSpeed.current + delta));
      
      // Emit custom event for CameraSpeedIndicator
      window.dispatchEvent(new CustomEvent('camera-speed-change', { 
        detail: { speed: currentSpeed.current, minSpeed, maxSpeed } 
      }));
    };

    const canvas = gl.domElement;
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // Use pointer events for better iPad/touch device support
    canvas.addEventListener('pointerdown', handleMouseDown);
    window.addEventListener('pointerup', handleMouseUp);
    window.addEventListener('pointermove', handleMouseMove);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('pointerdown', handleMouseDown);
      window.removeEventListener('pointerup', handleMouseUp);
      window.removeEventListener('pointermove', handleMouseMove);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [camera, gl, lookSpeed]);

  // Handle focus target changes
  useEffect(() => {
    if (focusTarget && focusTarget.timestamp !== focusState.current.lastTimestamp) {
      const targetPos = new THREE.Vector3(...focusTarget.position);
      
      // Calculate camera position: offset from target (behind and above)
      const focusDistance = focusTarget.distance ?? 10;
      const offset = new THREE.Vector3(5, 4, 8).normalize().multiplyScalar(focusDistance);
      const cameraTargetPos = targetPos.clone().add(offset);
      
      focusState.current = {
        active: true,
        targetPos,
        cameraTargetPos,
        progress: 0,
        lastTimestamp: focusTarget.timestamp,
      };
    }
  }, [focusTarget]);

  useFrame((_, delta) => {
    // Handle focus animation
    if (focusState.current.active) {
      focusState.current.progress += delta * 3; // Speed of animation
      const t = Math.min(focusState.current.progress, 1);
      const easeT = 1 - Math.pow(1 - t, 3); // Ease out cubic
      
      // Lerp camera position
      camera.position.lerp(focusState.current.cameraTargetPos, easeT * 0.15);
      
      // Make camera look at target
      const lookAtPos = camera.position.clone().lerp(focusState.current.targetPos, 0.1);
      const lookDir = focusState.current.targetPos.clone().sub(camera.position).normalize();
      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(camera.position, focusState.current.targetPos, new THREE.Vector3(0, 1, 0))
      );
      camera.quaternion.slerp(targetQuat, easeT * 0.1);
      
      // Update euler to match new camera rotation
      euler.current.setFromQuaternion(camera.quaternion);
      
      // End animation when close enough
      if (t >= 1 && camera.position.distanceTo(focusState.current.cameraTargetPos) < 0.5) {
        focusState.current.active = false;
      }
      
      return; // Skip normal movement during focus
    }
    
    const activeSpeed = keys.current.shift ? currentSpeed.current * 2.5 : currentSpeed.current;
    
    // Calculate movement direction
    direction.current.set(0, 0, 0);
    
    // WASD always works for horizontal movement
    if (keys.current.w) direction.current.z -= 1;
    if (keys.current.s) direction.current.z += 1;
    if (keys.current.a) direction.current.x -= 1;
    if (keys.current.d) direction.current.x += 1;
    
    // Q/E for vertical movement ONLY when right mouse is held
    // (otherwise Q/E are transform mode shortcuts)
    if (isRightMouseDown.current) {
      if (keys.current.e) direction.current.y += 1;
      if (keys.current.q) direction.current.y -= 1;
    }
    
    if (direction.current.length() > 0) {
      direction.current.normalize();
      
      // Cancel focus animation if user moves manually
      if (focusState.current.active) {
        focusState.current.active = false;
      }
      
      // Get camera forward and right vectors
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0);
      
      // Calculate velocity
      velocity.current.set(0, 0, 0);
      velocity.current.addScaledVector(forward, -direction.current.z);
      velocity.current.addScaledVector(right, direction.current.x);
      velocity.current.addScaledVector(up, direction.current.y);
      
      // Calculate new position
      const newPosition = camera.position.clone().addScaledVector(velocity.current, activeSpeed * delta);

      if (collisionDistance <= 0) {
        camera.position.copy(newPosition);
        return;
      }
      
      //  COLLISION DETECTION: Check for obstacles in movement direction
      const raycaster = new THREE.Raycaster();
      raycaster.ray.origin.copy(camera.position);
      raycaster.ray.direction.copy(velocity.current).normalize();
      
      // Find all collidable objects (exclude camera and lights)
      const collidables = scene.children.filter(obj => {
        return obj.type === 'Mesh' && obj !== camera && !obj.name.includes('Camera');
      });
      
      const intersections = raycaster.intersectObjects(collidables, true);
      
      // If there's a collision closer than our collision distance, block movement
      if (intersections.length > 0 && intersections[0].distance < collisionDistance) {
        // Block this movement - camera stays at current position
      } else {
        // No collision - apply movement
        camera.position.copy(newPosition);
      }
    }
  });

  return null;
};
