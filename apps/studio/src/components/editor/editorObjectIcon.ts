import {
  Box, Camera, Circle, Cone, Cylinder, Image as ImageIcon, Layers, Lightbulb,
  Mountain, Square, Sun, Type as TypeIcon, User, type LucideIcon,
} from 'lucide-react';
import type { ObjectType } from '@/stores/editorStore';

export const getEditorObjectIcon = (type: ObjectType): LucideIcon => {
  switch (type) {
    case 'box': return Box;
    case 'sphere':
    case 'circle':
    case 'ring': return Circle;
    case 'cylinder': return Cylinder;
    case 'light': return Lightbulb;
    case 'sunlight': return Sun;
    case 'spotlight': return Cone;
    case 'plane':
    case 'platform':
    case 'group': return Layers;
    case 'camera': return Camera;
    case 'player':
    case 'npc': return User;
    case 'terrain': return Mountain;
    case 'image':
    case 'sprite': return ImageIcon;
    case 'rectangle': return Square;
    case 'text': return TypeIcon;
    default: return Box;
  }
};
