import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useAssetStore } from '@/stores/assetStore';

export interface PBRTextureSet {
  albedo?: string;      // Base color / diffuse
  normal?: string;      // Normal map
  roughness?: string;   // Roughness map
  metalness?: string;   // Metalness map
  ao?: string;          // Ambient occlusion
  emissive?: string;    // Emissive map
  height?: string;      // Height/displacement map
  alpha?: string;       // Alpha/opacity map
}

export interface TexturedMaterialProps {
  textures: PBRTextureSet;
  // Material properties
  color?: string;
  metalness?: number;
  roughness?: number;
  emissiveColor?: string;
  emissiveIntensity?: number;
  opacity?: number;
  transparent?: boolean;
  // Texture settings
  repeat?: [number, number];
  offset?: [number, number];
  rotation?: number;
  flipY?: boolean;
  // Normal map settings
  normalScale?: [number, number];
  // Displacement settings
  displacementScale?: number;
  displacementBias?: number;
  // AO settings
  aoMapIntensity?: number;
  // Side
  side?: THREE.Side;
  // Wireframe
  wireframe?: boolean;
}

// Helper to configure texture settings
const configureTexture = (
  texture: THREE.Texture,
  repeat?: [number, number],
  offset?: [number, number],
  rotation?: number,
  flipY?: boolean
) => {
  if (repeat) {
    texture.repeat.set(repeat[0], repeat[1]);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  if (offset) {
    texture.offset.set(offset[0], offset[1]);
  }
  if (rotation !== undefined) {
    texture.rotation = rotation;
  }
  if (flipY !== undefined) {
    texture.flipY = flipY;
  }
  return texture;
};

export const TexturedMaterial = ({
  textures,
  color = '#ffffff',
  metalness = 0,
  roughness = 1,
  emissiveColor = '#000000',
  emissiveIntensity = 0,
  opacity = 1,
  transparent = false,
  repeat,
  offset,
  rotation,
  flipY,
  normalScale = [1, 1],
  displacementScale = 0,
  displacementBias = 0,
  aoMapIntensity = 1,
  side = THREE.FrontSide,
  wireframe = false,
}: TexturedMaterialProps) => {
  const { addTextureToCache } = useAssetStore();
  
  // Build array of texture URLs to load
  const textureUrls = useMemo(() => {
    const urls: string[] = [];
    if (textures.albedo) urls.push(textures.albedo);
    if (textures.normal) urls.push(textures.normal);
    if (textures.roughness) urls.push(textures.roughness);
    if (textures.metalness) urls.push(textures.metalness);
    if (textures.ao) urls.push(textures.ao);
    if (textures.emissive) urls.push(textures.emissive);
    if (textures.height) urls.push(textures.height);
    if (textures.alpha) urls.push(textures.alpha);
    return urls;
  }, [textures]);
  
  // Load all textures at once
  const loadedTextures = useTexture(
    textureUrls.length > 0 ? textureUrls : ['/placeholder.svg']
  );
  
  // Map loaded textures back to their types
  const textureMap = useMemo(() => {
    const map: Partial<Record<keyof PBRTextureSet, THREE.Texture>> = {};
    let index = 0;
    
    const texArray = Array.isArray(loadedTextures) ? loadedTextures : [loadedTextures];
    
    if (textures.albedo && texArray[index]) {
      map.albedo = configureTexture(texArray[index].clone(), repeat, offset, rotation, flipY);
      index++;
    }
    if (textures.normal && texArray[index]) {
      map.normal = configureTexture(texArray[index].clone(), repeat, offset, rotation, flipY);
      index++;
    }
    if (textures.roughness && texArray[index]) {
      map.roughness = configureTexture(texArray[index].clone(), repeat, offset, rotation, flipY);
      index++;
    }
    if (textures.metalness && texArray[index]) {
      map.metalness = configureTexture(texArray[index].clone(), repeat, offset, rotation, flipY);
      index++;
    }
    if (textures.ao && texArray[index]) {
      map.ao = configureTexture(texArray[index].clone(), repeat, offset, rotation, flipY);
      index++;
    }
    if (textures.emissive && texArray[index]) {
      map.emissive = configureTexture(texArray[index].clone(), repeat, offset, rotation, flipY);
      index++;
    }
    if (textures.height && texArray[index]) {
      map.height = configureTexture(texArray[index].clone(), repeat, offset, rotation, flipY);
      index++;
    }
    if (textures.alpha && texArray[index]) {
      map.alpha = configureTexture(texArray[index].clone(), repeat, offset, rotation, flipY);
      index++;
    }
    
    return map;
  }, [loadedTextures, textures, repeat, offset, rotation, flipY]);
  
  // Cache textures
  useEffect(() => {
    Object.entries(textureMap).forEach(([type, texture]) => {
      if (texture) {
        const url = textures[type as keyof PBRTextureSet];
        if (url) {
          addTextureToCache({
            id: Math.random().toString(36).substring(2, 9),
            name: url.split('/').pop() || type,
            url,
            texture,
            type: type as LoadedTexture['type'],
            loadedAt: Date.now(),
          });
        }
      }
    });
  }, [textureMap]);
  
  return (
    <meshStandardMaterial
      color={color}
      metalness={metalness}
      roughness={roughness}
      emissive={emissiveColor}
      emissiveIntensity={emissiveIntensity}
      opacity={opacity}
      transparent={transparent || opacity < 1}
      side={side}
      wireframe={wireframe}
      // Texture maps
      map={textureMap.albedo || null}
      normalMap={textureMap.normal || null}
      normalScale={new THREE.Vector2(normalScale[0], normalScale[1])}
      roughnessMap={textureMap.roughness || null}
      metalnessMap={textureMap.metalness || null}
      aoMap={textureMap.ao || null}
      aoMapIntensity={aoMapIntensity}
      emissiveMap={textureMap.emissive || null}
      displacementMap={textureMap.height || null}
      displacementScale={displacementScale}
      displacementBias={displacementBias}
      alphaMap={textureMap.alpha || null}
    />
  );
};

// Type fix
type LoadedTexture = {
  type: 'albedo' | 'normal' | 'roughness' | 'metalness' | 'ao' | 'emissive' | 'height';
};

// Preload textures utility
export const preloadTextures = (urls: string[]) => {
  urls.forEach(url => {
    useTexture.preload(url);
  });
};

// Hook for using textures with caching
export const usePBRTextures = (textures: PBRTextureSet) => {
  const { getTextureFromCache } = useAssetStore();
  
  const cachedTextures = useMemo(() => {
    const result: Partial<Record<keyof PBRTextureSet, THREE.Texture>> = {};
    
    Object.entries(textures).forEach(([key, url]) => {
      if (url) {
        const cached = getTextureFromCache(url);
        if (cached) {
          result[key as keyof PBRTextureSet] = cached.texture;
        }
      }
    });
    
    return result;
  }, [textures, getTextureFromCache]);
  
  return cachedTextures;
};
