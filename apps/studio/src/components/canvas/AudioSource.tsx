import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAudioStore } from '@/stores/audioStore';

interface AudioSourceProps {
  id: string;
  name: string;
  url: string;
  position: [number, number, number];
  volume?: number;
  loop?: boolean;
  autoplay?: boolean;
  distance?: number;
  refDistance?: number;
  rolloffFactor?: number;
  enabled?: boolean;
}

/**
 * AudioSource Component
 * Renderiza uma fonte de áudio 3D posicionada no espaço
 * Usa PositionalAudio do Three.js para áudio espacial
 */
export const AudioSource = ({
  id,
  name,
  url,
  position,
  volume = 0.8,
  loop = false,
  autoplay = false,
  distance = 50,
  refDistance = 1,
  rolloffFactor = 1,
  enabled = true,
}: AudioSourceProps) => {
  const audioListener = useAudioStore((s) => s.audioListener);
  const addAudioSource = useAudioStore((s) => s.addAudioSource);
  const removeAudioSource = useAudioStore((s) => s.removeAudioSource);
  const updateAudioSource = useAudioStore((s) => s.updateAudioSource);
  const masterVolume = useAudioStore((s) => s.settings.masterVolume);
  const enabled3DAudio = useAudioStore((s) => s.settings.enabled3DAudio);
  
  const audioRef = useRef<THREE.PositionalAudio>(null);
  const groupRef = useRef<THREE.Group>(null);
  const audioContextInitialized = useRef(false);

  // Create audio on mount - only run once per id
  useEffect(() => {
    // Initialize audio source in store
    addAudioSource({
      id,
      name,
      url,
      volume,
      loop,
      autoplay,
      distance,
      refDistance,
      rolloffFactor,
      isPlaying: false,
    });

    return () => {
      // Cleanup
      if (audioRef.current?.isPlaying) {
        audioRef.current.stop();
      }
      removeAudioSource(id);
    };
    // Only depend on id to avoid re-registering on every prop change
  }, [id, addAudioSource, removeAudioSource]);

  // Load and setup audio
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    const audioLoader = new THREE.AudioLoader();

    console.log(` Loading audio: "${name}" from ${url}`);

    audioLoader.load(
      url,
      (audioBuffer) => {
        console.log(` Audio loaded: "${name}"`);
        audio.setBuffer(audioBuffer);
        audio.setVolume(volume * masterVolume);
        audio.setRefDistance(refDistance);
        audio.setRolloffFactor(rolloffFactor);
        audio.setMaxDistance(distance);
        audio.setLoop(loop);

        if (autoplay && enabled) {
          audio.play();
          updateAudioSource(id, { isPlaying: true });
          console.log(`▶️ Playing audio: "${name}"`);
        }

        audioContextInitialized.current = true;
      },
      undefined,
      (error) => {
        console.error(` Failed to load audio "${name}":`, error);
      }
    );
  }, [url, volume, refDistance, rolloffFactor, distance, loop, autoplay, id, name, masterVolume, enabled, updateAudioSource]);

  // Update volume when master volume changes
  useEffect(() => {
    if (audioRef.current && audioContextInitialized.current) {
      audioRef.current.setVolume(volume * masterVolume);
    }
  }, [masterVolume, volume]);

  // Update playback based on enabled state
  useEffect(() => {
    if (!audioRef.current) return;

    if (enabled && autoplay && !audioRef.current.isPlaying) {
      audioRef.current.play();
      updateAudioSource(id, { isPlaying: true });
    } else if (!enabled && audioRef.current.isPlaying) {
      audioRef.current.stop();
      updateAudioSource(id, { isPlaying: false });
    }
  }, [enabled, autoplay, id, updateAudioSource]);

  // Update listener position (camera follows positional audio)
  useFrame(() => {
    if (audioRef.current && groupRef.current && enabled3DAudio) {
      // Position is already set by the group, no additional update needed
      // Three.js automatically handles spatial audio based on listener (camera) position
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/*
        IMPORTANT:
        PositionalAudio precisa receber o AudioListener via args, senão o Three tenta
        instanciar Audio/PositionalAudio com listener undefined e quebra em listener.context.
      */}
      {audioListener ? (
        <positionalAudio ref={audioRef} args={[audioListener]} />
      ) : null}
    </group>
  );
};
