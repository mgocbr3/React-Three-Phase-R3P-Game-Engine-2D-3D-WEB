import { useState, useEffect } from 'react';

/**
 * Detects if the current device supports touch input.
 * Works on mobile, tablets, iPads, and desktop with touchscreen.
 */
export function useIsTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => {
    // Initial check on mount (SSR-safe)
    if (typeof window === 'undefined') return false;
    
    return (
      'ontouchstart' in window || 
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore - for older browsers
      navigator.msMaxTouchPoints > 0 ||
      // Check for touch in media query (most reliable for modern browsers)
      window.matchMedia?.('(pointer: coarse)').matches ||
      window.matchMedia?.('(any-pointer: coarse)').matches
    );
  });

  useEffect(() => {
    const checkTouch = () => {
      const hasTouch = 
        'ontouchstart' in window || 
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - for older browsers
        navigator.msMaxTouchPoints > 0 ||
        window.matchMedia?.('(pointer: coarse)').matches ||
        window.matchMedia?.('(any-pointer: coarse)').matches;
      
      setIsTouchDevice(hasTouch);
    };

    checkTouch();

    // Also listen for first touch event as fallback (covers edge cases)
    const handleFirstTouch = () => {
      setIsTouchDevice(true);
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('pointerdown', handlePointerDown);
    };

    // PointerEvent fallback for hybrid devices
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        setIsTouchDevice(true);
        window.removeEventListener('touchstart', handleFirstTouch);
        window.removeEventListener('pointerdown', handlePointerDown);
      }
    };

    window.addEventListener('touchstart', handleFirstTouch, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return isTouchDevice;
}
