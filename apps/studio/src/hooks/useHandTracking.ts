import { useRef, useEffect, useState, useCallback } from 'react';

export interface HandLandmarks {
  // 21 landmarks per hand
  landmarks: { x: number; y: number; z: number }[];
  handedness: 'Left' | 'Right';
}

export interface HandTrackingState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  hands: HandLandmarks[];
  // Normalized positions (-1 to 1)
  primaryHand: {
    position: { x: number; y: number };
    indexTip: { x: number; y: number; z: number };
    thumbTip: { x: number; y: number; z: number };
    isPinching: boolean;
    isPointing: boolean;
    isFist: boolean;
    isOpen: boolean;
  } | null;
}

const LANDMARK_INDICES = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_TIP: 8,
  MIDDLE_TIP: 12,
  RING_TIP: 16,
  PINKY_TIP: 20,
  INDEX_MCP: 5,
  MIDDLE_MCP: 9,
};

// Calculate distance between two points
const distance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

export const useHandTracking = () => {
  const [state, setState] = useState<HandTrackingState>({
    isActive: false,
    isLoading: false,
    error: null,
    hands: [],
    primaryHand: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  const processResults = useCallback((results: any) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      setState(prev => ({ ...prev, hands: [], primaryHand: null }));
      return;
    }

    const hands: HandLandmarks[] = results.multiHandLandmarks.map((landmarks: any[], idx: number) => ({
      landmarks: landmarks.map((l: any) => ({ x: l.x, y: l.y, z: l.z })),
      handedness: results.multiHandedness?.[idx]?.label || 'Right',
    }));

    // Process primary hand (first detected)
    const primaryLandmarks = hands[0]?.landmarks;
    if (primaryLandmarks) {
      const indexTip = primaryLandmarks[LANDMARK_INDICES.INDEX_TIP];
      const thumbTip = primaryLandmarks[LANDMARK_INDICES.THUMB_TIP];
      const wrist = primaryLandmarks[LANDMARK_INDICES.WRIST];
      const indexMcp = primaryLandmarks[LANDMARK_INDICES.INDEX_MCP];
      const middleTip = primaryLandmarks[LANDMARK_INDICES.MIDDLE_TIP];

      // Normalize position to -1 to 1 range (centered)
      const normalizedX = (indexTip.x - 0.5) * -2; // Flip X for natural control
      const normalizedY = (indexTip.y - 0.5) * -2;

      // Detect gestures
      const pinchDistance = distance(indexTip, thumbTip);
      const isPinching = pinchDistance < 0.05;

      // Is pointing (index extended, others curled)
      const indexExtended = distance(indexTip, wrist) > distance(indexMcp, wrist) * 1.5;
      const middleCurled = distance(middleTip, wrist) < distance(indexMcp, wrist) * 1.3;
      const isPointing = indexExtended && middleCurled;

      // Is fist (all fingers curled)
      const allFingersCurled = [8, 12, 16, 20].every(idx => {
        const tip = primaryLandmarks[idx];
        return distance(tip, wrist) < distance(indexMcp, wrist) * 1.2;
      });
      const isFist = allFingersCurled;

      // Is open hand
      const allFingersExtended = [8, 12, 16, 20].every(idx => {
        const tip = primaryLandmarks[idx];
        return distance(tip, wrist) > distance(indexMcp, wrist) * 1.4;
      });
      const isOpen = allFingersExtended;

      setState(prev => ({
        ...prev,
        hands,
        primaryHand: {
          position: { x: normalizedX, y: normalizedY },
          indexTip,
          thumbTip,
          isPinching,
          isPointing,
          isFist,
          isOpen,
        },
      }));
    }
  }, []);

  const startTracking = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Dynamically import MediaPipe
      const { Hands } = await import('@mediapipe/hands');
      const { Camera } = await import('@mediapipe/camera_utils');

      // Create video element
      const video = document.createElement('video');
      video.style.display = 'none';
      video.setAttribute('playsinline', 'true');
      document.body.appendChild(video);
      videoRef.current = video;

      // Initialize Hands
      const hands = new Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        },
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });

      hands.onResults(processResults);
      handsRef.current = hands;

      // Start camera
      const camera = new Camera(video, {
        onFrame: async () => {
          if (handsRef.current && videoRef.current) {
            await handsRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });

      await camera.start();
      cameraRef.current = camera;

      setState(prev => ({ ...prev, isActive: true, isLoading: false }));
    } catch (error) {
      console.error('Failed to start hand tracking:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start camera',
      }));
    }
  }, [processResults]);

  const stopTracking = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }

    if (handsRef.current) {
      handsRef.current.close();
      handsRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.remove();
      videoRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setState({
      isActive: false,
      isLoading: false,
      error: null,
      hands: [],
      primaryHand: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    ...state,
    startTracking,
    stopTracking,
  };
};
