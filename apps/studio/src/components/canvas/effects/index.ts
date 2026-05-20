/**
 * RTX-like Effects Index
 * 
 * Componentes para criar visuais próximos ao Minecraft RTX:
 * - Água com reflexões
 * - Iluminação volumétrica  
 * - Luzes emissivas (tochas, fogueiras, lanternas)
 * - Post-processing (bloom, vignette, color grading)
 * - Efeitos atmosféricos (aurora, lua)
 */

// Water effects
export { 
  RTXWater, 
  RTXWaterSimple, 
  MinecraftWater 
} from './RTXWater';

// Volumetric lighting effects
export { 
  GodRays, 
  AuroraEffect, 
  MoonGlow 
} from './VolumetricLighting';

// Emissive light sources
export { 
  MinecraftTorch, 
  MinecraftCampfire, 
  MinecraftLantern, 
  GlowBlock, 
  NetherPortal 
} from './EmissiveLights';

// Post-processing
export { 
  RTXPostProcessing, 
  RTXEffectsWithSettings 
} from './RTXPostProcessing';
