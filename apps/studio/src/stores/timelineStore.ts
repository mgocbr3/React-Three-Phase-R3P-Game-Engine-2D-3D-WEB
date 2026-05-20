import { create } from 'zustand';

// Easing function types
export type EasingType = 
  | 'linear' 
  | 'easeIn' 
  | 'easeOut' 
  | 'easeInOut' 
  | 'bounce' 
  | 'elastic'
  | 'back';

// Keyframe data
export interface Keyframe {
  id: string;
  time: number; // Time in seconds
  value: number | [number, number, number]; // Single value or vector3
  easing: EasingType;
}

// Animation property that can be animated
export type AnimatableProperty = 
  | 'position.x' | 'position.y' | 'position.z'
  | 'rotation.x' | 'rotation.y' | 'rotation.z'
  | 'scale.x' | 'scale.y' | 'scale.z'
  | 'opacity' | 'color';

// Track for a single property
export interface AnimationTrack {
  id: string;
  objectId: string;
  property: AnimatableProperty;
  keyframes: Keyframe[];
  enabled: boolean;
  locked: boolean;
}

// Animation clip containing multiple tracks
export interface AnimationClip {
  id: string;
  name: string;
  duration: number; // Total duration in seconds
  tracks: AnimationTrack[];
  loop: boolean;
  speed: number;
}

// Timeline state
interface TimelineState {
  // Clips
  clips: AnimationClip[];
  activeClipId: string | null;
  
  // Playback
  isPlaying: boolean;
  currentTime: number;
  
  // Selection
  selectedTrackId: string | null;
  selectedKeyframeIds: string[];
  
  // UI state
  zoom: number; // Pixels per second
  scrollX: number;
  snapToGrid: boolean;
  gridSize: number; // Seconds
  
  // Actions
  createClip: (name: string, objectId: string) => string;
  deleteClip: (clipId: string) => void;
  setActiveClip: (clipId: string | null) => void;
  updateClip: (clipId: string, updates: Partial<AnimationClip>) => void;
  
  // Track actions
  addTrack: (clipId: string, objectId: string, property: AnimatableProperty) => void;
  removeTrack: (clipId: string, trackId: string) => void;
  updateTrack: (clipId: string, trackId: string, updates: Partial<AnimationTrack>) => void;
  
  // Keyframe actions
  addKeyframe: (clipId: string, trackId: string, time: number, value: number | [number, number, number]) => void;
  removeKeyframe: (clipId: string, trackId: string, keyframeId: string) => void;
  updateKeyframe: (clipId: string, trackId: string, keyframeId: string, updates: Partial<Keyframe>) => void;
  moveKeyframe: (clipId: string, trackId: string, keyframeId: string, newTime: number) => void;
  
  // Playback actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  setCurrentTime: (time: number) => void;
  
  // Selection
  selectTrack: (trackId: string | null) => void;
  selectKeyframes: (keyframeIds: string[]) => void;
  
  // UI actions
  setZoom: (zoom: number) => void;
  setScrollX: (scrollX: number) => void;
  toggleSnapToGrid: () => void;
  
  // Utility
  getValueAtTime: (clipId: string, trackId: string, time: number) => number | [number, number, number] | null;
  getActiveClip: () => AnimationClip | null;
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Easing functions
const easingFunctions: Record<EasingType, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  bounce: (t) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
  elastic: (t) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  },
  back: (t) => {
    const s = 1.70158;
    return t * t * ((s + 1) * t - s);
  },
};

// Interpolate between values
const interpolateValue = (
  start: number | [number, number, number],
  end: number | [number, number, number],
  t: number,
  easing: EasingType
): number | [number, number, number] => {
  const easedT = easingFunctions[easing](t);
  
  if (typeof start === 'number' && typeof end === 'number') {
    return start + (end - start) * easedT;
  }
  
  if (Array.isArray(start) && Array.isArray(end)) {
    return [
      start[0] + (end[0] - start[0]) * easedT,
      start[1] + (end[1] - start[1]) * easedT,
      start[2] + (end[2] - start[2]) * easedT,
    ];
  }
  
  return start;
};

export const useTimelineStore = create<TimelineState>((set, get) => ({
  clips: [],
  activeClipId: null,
  isPlaying: false,
  currentTime: 0,
  selectedTrackId: null,
  selectedKeyframeIds: [],
  zoom: 100, // 100 pixels per second
  scrollX: 0,
  snapToGrid: true,
  gridSize: 0.1, // 100ms

  createClip: (name, objectId) => {
    const id = generateId();
    const newClip: AnimationClip = {
      id,
      name,
      duration: 5,
      tracks: [],
      loop: true,
      speed: 1,
    };
    set((state) => ({
      clips: [...state.clips, newClip],
      activeClipId: id,
    }));
    return id;
  },

  deleteClip: (clipId) => {
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== clipId),
      activeClipId: state.activeClipId === clipId ? null : state.activeClipId,
    }));
  },

  setActiveClip: (clipId) => {
    set({ activeClipId: clipId, currentTime: 0, isPlaying: false });
  },

  updateClip: (clipId, updates) => {
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId ? { ...c, ...updates } : c
      ),
    }));
  },

  addTrack: (clipId, objectId, property) => {
    const trackId = generateId();
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              tracks: [
                ...c.tracks,
                {
                  id: trackId,
                  objectId,
                  property,
                  keyframes: [],
                  enabled: true,
                  locked: false,
                },
              ],
            }
          : c
      ),
    }));
  },

  removeTrack: (clipId, trackId) => {
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? { ...c, tracks: c.tracks.filter((t) => t.id !== trackId) }
          : c
      ),
    }));
  },

  updateTrack: (clipId, trackId, updates) => {
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              tracks: c.tracks.map((t) =>
                t.id === trackId ? { ...t, ...updates } : t
              ),
            }
          : c
      ),
    }));
  },

  addKeyframe: (clipId, trackId, time, value) => {
    const keyframeId = generateId();
    const { snapToGrid, gridSize } = get();
    const snappedTime = snapToGrid ? Math.round(time / gridSize) * gridSize : time;
    
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              tracks: c.tracks.map((t) =>
                t.id === trackId
                  ? {
                      ...t,
                      keyframes: [
                        ...t.keyframes.filter((k) => Math.abs(k.time - snappedTime) > 0.01),
                        { id: keyframeId, time: snappedTime, value, easing: 'easeInOut' as EasingType },
                      ].sort((a, b) => a.time - b.time),
                    }
                  : t
              ),
            }
          : c
      ),
    }));
  },

  removeKeyframe: (clipId, trackId, keyframeId) => {
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              tracks: c.tracks.map((t) =>
                t.id === trackId
                  ? { ...t, keyframes: t.keyframes.filter((k) => k.id !== keyframeId) }
                  : t
              ),
            }
          : c
      ),
    }));
  },

  updateKeyframe: (clipId, trackId, keyframeId, updates) => {
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              tracks: c.tracks.map((t) =>
                t.id === trackId
                  ? {
                      ...t,
                      keyframes: t.keyframes.map((k) =>
                        k.id === keyframeId ? { ...k, ...updates } : k
                      ),
                    }
                  : t
              ),
            }
          : c
      ),
    }));
  },

  moveKeyframe: (clipId, trackId, keyframeId, newTime) => {
    const { snapToGrid, gridSize } = get();
    const snappedTime = snapToGrid ? Math.round(newTime / gridSize) * gridSize : newTime;
    
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              tracks: c.tracks.map((t) =>
                t.id === trackId
                  ? {
                      ...t,
                      keyframes: t.keyframes
                        .map((k) => (k.id === keyframeId ? { ...k, time: Math.max(0, snappedTime) } : k))
                        .sort((a, b) => a.time - b.time),
                    }
                  : t
              ),
            }
          : c
      ),
    }));
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  stop: () => set({ isPlaying: false, currentTime: 0 }),
  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),

  selectTrack: (trackId) => set({ selectedTrackId: trackId }),
  selectKeyframes: (keyframeIds) => set({ selectedKeyframeIds: keyframeIds }),

  setZoom: (zoom) => set({ zoom: Math.max(20, Math.min(500, zoom)) }),
  setScrollX: (scrollX) => set({ scrollX: Math.max(0, scrollX) }),
  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

  getValueAtTime: (clipId, trackId, time) => {
    const clip = get().clips.find((c) => c.id === clipId);
    if (!clip) return null;
    
    const track = clip.tracks.find((t) => t.id === trackId);
    if (!track || track.keyframes.length === 0) return null;
    
    const keyframes = track.keyframes;
    
    // Before first keyframe
    if (time <= keyframes[0].time) return keyframes[0].value;
    
    // After last keyframe
    if (time >= keyframes[keyframes.length - 1].time) {
      return keyframes[keyframes.length - 1].value;
    }
    
    // Find surrounding keyframes
    for (let i = 0; i < keyframes.length - 1; i++) {
      const current = keyframes[i];
      const next = keyframes[i + 1];
      
      if (time >= current.time && time <= next.time) {
        const t = (time - current.time) / (next.time - current.time);
        return interpolateValue(current.value, next.value, t, current.easing);
      }
    }
    
    return null;
  },

  getActiveClip: () => {
    const { clips, activeClipId } = get();
    return clips.find((c) => c.id === activeClipId) || null;
  },
}));
