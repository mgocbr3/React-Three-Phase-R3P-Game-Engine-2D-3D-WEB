import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useEditorStore } from '@/stores/editorStore';
import { scriptExecutor } from '@/scripts/executor';
import '@/scripts/built-in';

interface ScriptRunnerProps {
  rigidBodies: React.MutableRefObject<Map<string, RapierRigidBody>>;
  groups: React.MutableRefObject<Map<string, THREE.Group>>;
}

/**
 * ScriptRunner component that executes scripts on all objects during Play Mode.
 * This follows R3F best practices by using useFrame for per-frame updates
 * and direct mutation instead of setState.
 */
export const ScriptRunner = ({ rigidBodies, groups }: ScriptRunnerProps) => {
  const { objects, isEditMode } = useEditorStore();
  const wasEditMode = useRef(isEditMode);

  // Handle mode transitions
  useEffect(() => {
    if (wasEditMode.current && !isEditMode) {
      // Entering Play Mode - start executor
      scriptExecutor.start();
      console.log('[ScriptRunner] Play mode started, executor running');
    } else if (!wasEditMode.current && isEditMode) {
      // Entering Edit Mode - stop executor
      scriptExecutor.stop();
      console.log('[ScriptRunner] Edit mode started, executor stopped');
    }
    wasEditMode.current = isEditMode;

    return () => {
      scriptExecutor.stop();
    };
  }, [isEditMode]);

  // Reset executor when entering play mode
  useEffect(() => {
    if (!isEditMode) {
      scriptExecutor.reset();
      scriptExecutor.start();
    }
  }, [isEditMode]);

  // Execute scripts every frame in Play Mode
  useFrame((_, delta) => {
    if (isEditMode) return;

    // Additional safety check: only execute if executor is actually running
    if (!scriptExecutor.isRunning()) return;

    try {
      // Execute all scripts for all objects
      scriptExecutor.executeFrame(
        objects,
        delta,
        rigidBodies.current,
        groups.current
      );
    } catch (error) {
      // Log but don't crash on script execution errors
      console.error('[ScriptRunner] Error during script execution:', error);
    }
  });

  return null;
};
