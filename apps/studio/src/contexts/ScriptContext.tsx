import { createContext, useContext, useRef, ReactNode } from 'react';
import { RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

interface ScriptRefsContextType {
  rigidBodies: React.MutableRefObject<Map<string, RapierRigidBody>>;
  groups: React.MutableRefObject<Map<string, THREE.Group>>;
  registerRigidBody: (id: string, body: RapierRigidBody) => void;
  unregisterRigidBody: (id: string) => void;
  registerGroup: (id: string, group: THREE.Group) => void;
  unregisterGroup: (id: string) => void;
}

const ScriptRefsContext = createContext<ScriptRefsContextType | null>(null);

export const useScriptRefs = () => {
  const context = useContext(ScriptRefsContext);
  if (!context) {
    throw new Error('useScriptRefs must be used within ScriptRefsProvider');
  }
  return context;
};

export const ScriptRefsProvider = ({ children }: { children: ReactNode }) => {
  const rigidBodies = useRef<Map<string, RapierRigidBody>>(new Map());
  const groups = useRef<Map<string, THREE.Group>>(new Map());

  const registerRigidBody = (id: string, body: RapierRigidBody) => {
    rigidBodies.current.set(id, body);
  };

  const unregisterRigidBody = (id: string) => {
    rigidBodies.current.delete(id);
  };

  const registerGroup = (id: string, group: THREE.Group) => {
    groups.current.set(id, group);
  };

  const unregisterGroup = (id: string) => {
    groups.current.delete(id);
  };

  return (
    <ScriptRefsContext.Provider value={{
      rigidBodies,
      groups,
      registerRigidBody,
      unregisterRigidBody,
      registerGroup,
      unregisterGroup,
    }}>
      {children}
    </ScriptRefsContext.Provider>
  );
};
