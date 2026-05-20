import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAudioStore } from '@/stores/audioStore';

/**
 * AudioListener Component
 * Renderiza o listener de áudio 3D posicionado na câmera
 * Deve ser usado uma única vez na cena, geralmente dentro do Canvas
 */
export const AudioListener = () => {
  const { camera } = useThree();
  const { audioListener, createAudioListener, initAudioContext } = useAudioStore();

  // Initialize AudioContext on first mount or user interaction
  useEffect(() => {
    const initAudio = async () => {
      try {
        await initAudioContext();
      } catch (error) {
        console.error('Failed to initialize audio:', error);
      }
    };

    // Try to initialize immediately
    initAudio();

    // Also try on first user interaction
    const handleUserInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [initAudioContext]);

  useEffect(() => {
    // Create and attach audio listener to camera if not exists
    if (!audioListener && camera) {
      createAudioListener(camera);
    }

    return () => {
      // Cleanup não necessário, listener persiste na câmera
    };
  }, [camera, audioListener, createAudioListener]);

  // Component doesn't render anything, just manages audio listener
  return null;
};
