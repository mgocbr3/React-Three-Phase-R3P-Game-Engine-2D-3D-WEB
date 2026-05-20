import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { useEngineSettings } from '@/stores/engineSettingsStore';
import { useEditorStore } from '@/stores/editorStore';

export const SceneFog = () => {
  const { scene } = useThree();
  const { fog, fogColor, fogNear, fogFar } = useEngineSettings();
  const isEditMode = useEditorStore((state) => state.isEditMode);

  useEffect(() => {
    if (!isEditMode) {
      scene.fog = null;
      return () => {
        scene.fog = null;
      };
    }

    if (fog) {
      scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
    } else {
      scene.fog = null;
    }
    
    return () => {
      scene.fog = null;
    };
  }, [scene, fog, fogColor, fogNear, fogFar, isEditMode]);

  return null;
};