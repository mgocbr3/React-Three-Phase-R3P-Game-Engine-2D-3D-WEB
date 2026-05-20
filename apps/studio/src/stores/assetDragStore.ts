import { create } from 'zustand';

export interface DraggedAsset {
  id: string;
  name: string;
  url: string;
  type: string;
  thumbnailUrl?: string;
}

interface AssetDragStore {
  // Currently dragged asset
  draggedAsset: DraggedAsset | null;
  isDragging: boolean;
  
  // Mouse position for preview
  mousePosition: { x: number; y: number };
  
  // Actions
  startDrag: (asset: DraggedAsset) => void;
  updateMousePosition: (x: number, y: number) => void;
  endDrag: () => void;
}

export const useAssetDragStore = create<AssetDragStore>((set) => ({
  draggedAsset: null,
  isDragging: false,
  mousePosition: { x: 0, y: 0 },
  
  startDrag: (asset) => set({ 
    draggedAsset: asset, 
    isDragging: true 
  }),
  
  updateMousePosition: (x, y) => set({ 
    mousePosition: { x, y } 
  }),
  
  endDrag: () => set({ 
    draggedAsset: null, 
    isDragging: false 
  }),
}));
