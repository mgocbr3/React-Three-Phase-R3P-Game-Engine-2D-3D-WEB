import { useEffect, useRef } from 'react';
import { useMotionControlStore } from '@/stores/motionControlStore';
import { useHandTracking } from '@/hooks/useHandTracking';
import { runtimeInput } from '@/engine/runtime/runtimeInput';

/**
 * Hook that bridges Motion Control gestures to game input.
 * When motion control is enabled, hand movements and gestures 
 * are translated to runtime input that player controllers read.
 */
export const useMotionControlInput = () => {
  const { 
    enabled, 
    mode, 
    mapping, 
    smoothedPosition 
  } = useMotionControlStore();
  
  const { primaryHand } = useHandTracking();
  
  // Track previous gesture states to detect "just pressed"
  const prevGestures = useRef({
    isPinching: false,
    isFist: false,
    isOpen: false,
    isPointing: false,
  });
  
  useEffect(() => {
    if (!enabled || mode === 'off') {
      // Reset movement when motion control is disabled
      if (runtimeInput.movement.x !== 0 || runtimeInput.movement.y !== 0) {
        runtimeInput.movement.x = 0;
        runtimeInput.movement.y = 0;
      }
      return;
    }
    
    if (!primaryHand) return;
    
    const { isPinching, isFist, isOpen, isPointing } = primaryHand;
    const { pinchAction, fistAction, openHandAction, pointAction, handMovement, movementSensitivity } = mapping;
    
    // ============ MOVEMENT ============
    if (mode === 'character' && handMovement === 'cursor') {
      // Hand position controls character movement
      // Map hand position (-1 to 1) to movement input
      const deadzone = 0.15;
      let moveX = smoothedPosition.x * movementSensitivity;
      let moveY = -smoothedPosition.y * movementSensitivity; // Invert Y for natural movement
      
      // Apply deadzone
      if (Math.abs(moveX) < deadzone) moveX = 0;
      if (Math.abs(moveY) < deadzone) moveY = 0;
      
      // Normalize to -1 to 1 range
      moveX = Math.max(-1, Math.min(1, moveX));
      moveY = Math.max(-1, Math.min(1, moveY));
      
      runtimeInput.movement.x = moveX;
      runtimeInput.movement.y = moveY;
    }
    
    // ============ GESTURE ACTIONS ============
    const executeAction = (action: string, justPressed: boolean) => {
      switch (action) {
        case 'jump':
          if (justPressed) {
            runtimeInput.jump = true;
          }
          break;
        case 'click':
        case 'attack':
          if (justPressed) {
            runtimeInput.action1 = true;
          }
          break;
        case 'shoot':
          if (justPressed) {
            runtimeInput.action2 = true;
          }
          break;
        case 'special':
          // Could be used for special abilities
          if (justPressed) {
            runtimeInput.action1 = true;
          }
          break;
        case 'interact':
          if (justPressed) {
            runtimeInput.action2 = true;
          }
          break;
      }
    };
    
    // Detect gesture state changes (just pressed)
    const pinchJustPressed = isPinching && !prevGestures.current.isPinching;
    const fistJustPressed = isFist && !prevGestures.current.isFist;
    const openJustPressed = isOpen && !prevGestures.current.isOpen;
    const pointJustPressed = isPointing && !prevGestures.current.isPointing;
    
    // Execute mapped actions
    if (pinchJustPressed) executeAction(pinchAction, true);
    if (fistJustPressed) executeAction(fistAction, true);
    if (openJustPressed) executeAction(openHandAction, true);
    if (pointJustPressed) executeAction(pointAction, true);
    
    // Update previous gesture states
    prevGestures.current = {
      isPinching,
      isFist,
      isOpen,
      isPointing,
    };
    
  }, [enabled, mode, mapping, smoothedPosition, primaryHand]);
  
  return { enabled, mode };
};
