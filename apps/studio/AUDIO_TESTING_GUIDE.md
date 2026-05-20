# Audio System Testing Guide

## Overview
The RPG Maker 3D Builder now includes a complete spatial audio system with 3D positioning support. This guide walks you through testing the audio implementation.

## Audio System Architecture

### Components Implemented
1. **audioStore.ts** - Zustand store for audio state management
   - Manages Web Audio API context initialization
   - Tracks audio sources and their playback state
   - Provides master volume control
   - Handles 3D audio enablement/disablement

2. **AudioListener.tsx** - React component for camera-based audio listener
   - Initializes Web Audio API context on mount
   - Creates THREE.AudioListener attached to camera
   - Handles browser audio policy resume requirements

3. **AudioSource.tsx** - Positional audio component
   - Implements THREE.PositionalAudio for 3D spatial audio
   - Uses THREE.AudioLoader for async audio file loading
   - Supports volume synchronization with master volume
   - Configurable attenuation: distance, refDistance, rolloffFactor

4. **InspectorPanel.tsx** - Audio editing UI
   - AudioSection component with full configuration controls
   - URL input for audio file path
   - Volume slider (0-1)
   - Distance controls (max audio distance and reference distance)
   - Rolloff factor (attenuation curve)
   - Loop and autoplay toggles

5. **EngineSettingsModal.tsx** - Global audio settings
   - Master Volume control (0-1)
   - 3D Audio toggle for spatial audio enablement

6. **EditableObject.tsx** - Scene object audio integration
   - Spawns AudioSource components for objects with audioSettings
   - Works in both Edit mode (preview) and Play mode
   - Positioned within object's local coordinate system

## Testing Procedure

### Step 1: Prepare Audio Files
1. Create or obtain MP3/WAV/OGG audio files
2. Place them in the public folder or use external CORS-enabled URLs
3. Recommended test files:
   - Single ambient sound (loops well): `audio/ambient-loop.mp3`
   - Directional sound effect: `audio/bell-ring.mp3`
   - Voice sample: `audio/voice-sample.mp3`

Example public folder structure:
```
public/
├── audio/
│   ├── ambient-loop.mp3
│   ├── bell-ring.mp3
│   └── voice-sample.mp3
```

### Step 2: Test Global Audio Settings
1. Open Engine Settings (⚙️ icon)
2. Click on "Áudio" tab
3. Verify Master Volume slider works (0-100%)
4. Toggle "Áudio 3D" on/off
5. Confirm settings persist across toggles

Expected behavior:
- Volume slider updates in real-time
- 3D Audio toggle responsive
- No console errors

### Step 3: Create Audio Objects in Editor
1. Add a sphere or box to the scene
2. Select the object
3. In Inspector Panel, scroll to "Áudio" section
4. Enter audio URL: `/audio/ambient-loop.mp3`
5. Set Volume: 0.8 (80%)
6. Set Distance: 30m (max audible distance)
7. Set Ref Distance: 2m (distance at volume = 1.0)
8. Set Rolloff: 1.0 (natural attenuation)
9. Toggle Loop: ON
10. Toggle Autoplay: ON

### Step 4: Test Edit Mode Audio Preview
1. Ensure object is configured with audio
2. Audio should begin playing immediately in edit mode
3. Use Master Volume slider in Engine Settings to test volume control
4. Audio should stop/start when toggling autoplay
5. Moving camera position should NOT affect audio (listener not in edit mode)

### Step 5: Test Play Mode Audio
1. Enter Play Mode (switch Edit/Play toggle)
2. Navigate around the scene with WASD/mouse
3. Approach the audio-enabled object
4. As you approach:
   - Audio should increase in volume (spatial attenuation)
   - Sound should appear to come from object position
5. Move away from object:
   - Volume should decrease
   - At distance > 30m, should be inaudible

### Step 6: Test 3D Spatial Audio
1. Create multiple audio objects in different locations
2. Place one near origin [0, 1, 0]
3. Place another far away [50, 1, 50]
4. In Play Mode, move between objects
5. Verify:
   - Volume changes based on distance
   - Audio appears directional (stereo panning)
   - Rolloff curve is smooth

### Step 7: Test Master Volume Control
1. In Play Mode, keep audio object in hearing range
2. Open Engine Settings → Áudio
3. Adjust Master Volume slider
4. Confirm audio volume changes proportionally
5. Set to 0 - audio should be silent
6. Set to 1 - audio should be at max (0.8 * 1.0 in this case)

### Step 8: Test Autoplay and Loop
1. Create two objects:
   - Object A: Autoplay ON, Loop ON
   - Object B: Autoplay OFF, Loop OFF
2. Enter Play Mode
3. Verify Object A audio starts automatically
4. Verify Object B audio is silent until triggered by script
5. Approach Object A - should loop continuously

## Expected Behaviors

✅ Audio plays in both Edit and Play modes
✅ Volume attenuates with distance in Play mode
✅ Master volume controls all audio
✅ 3D audio creates stereo panning effect
✅ Loop and autoplay toggles work correctly
✅ No console errors or memory leaks
✅ AudioContext initializes on first interaction (browser requirement)

## Troubleshooting

### Audio Not Playing
- **Cause**: Browser's autoplay policy
  - **Solution**: Click anywhere in the app first, then reload or enter Play mode again
- **Cause**: Audio URL is incorrect
  - **Solution**: Check browser console for 404 errors, verify file path
- **Cause**: CORS error on external URL
  - **Solution**: Use public folder files or CORS-enabled URLs

### Volume Not Changing with Distance
- **Cause**: Not in Play mode
  - **Solution**: Enable Play mode to activate spatial audio
- **Cause**: 3D Audio disabled in settings
  - **Solution**: Toggle "Áudio 3D" ON in EngineSettingsModal
- **Cause**: Reference distance set too high
  - **Solution**: Lower refDistance (should be < distance)

### Audio Stuttering/Crackling
- **Cause**: Multiple audio sources conflicting
  - **Solution**: Reduce number of simultaneous sources
- **Cause**: Browser performance issue
  - **Solution**: Check browser DevTools Performance tab

## Configuration Reference

### Audio Parameters

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| Volume | 0-1 | 0.8 | Relative volume (0 = mute, 1 = max) |
| Distance | 1-100 | 50 | Maximum distance audio is audible (meters) |
| RefDistance | 0.1-10 | 1 | Distance at which volume = 1.0 |
| Rolloff | 0-3 | 1.0 | Attenuation curve (0=no falloff, 3=steep) |
| Loop | - | false | Audio repeats after ending |
| Autoplay | - | false | Audio starts automatically |

### Master Volume Effect
- Final audio volume = objectVolume × masterVolume
- Example: 0.8 (object) × 0.5 (master) = 0.4 final volume

## Next Steps

After confirming audio works:
1. Test audio with behaviors (moving objects)
2. Test audio with scripts
3. Implement audio triggering via collision
4. Add audio bank management for multiple sources
5. Implement audio fade-in/fade-out

## Files Modified

- ✅ src/stores/audioStore.ts (NEW)
- ✅ src/components/canvas/AudioListener.tsx (NEW)
- ✅ src/components/canvas/AudioSource.tsx (NEW)
- ✅ src/components/canvas/EditorCanvas.tsx (MODIFIED - added AudioListener)
- ✅ src/components/editor/InspectorPanel.tsx (MODIFIED - added AudioSection)
- ✅ src/components/editor/EngineSettingsModal.tsx (MODIFIED - added Audio category)
- ✅ src/components/canvas/EditableObject.tsx (MODIFIED - added AudioSource spawning)
- ✅ src/stores/editorStore.ts (MODIFIED - added AudioSettings interface)

## API Reference

### useAudioStore()
```typescript
const {
  audioContext,           // Web Audio API context
  audioListener,          // THREE.AudioListener
  settings,               // { masterVolume, enabled3DAudio }
  audioSources,           // Map<id, AudioSource>
  
  initAudioContext,       // () => Promise<void>
  createAudioListener,    // (camera) => THREE.AudioListener
  addAudioSource,         // (source) => void
  removeAudioSource,      // (id) => void
  updateAudioSource,      // (id, updates) => void
  getAudioSource,         // (id) => AudioSource | undefined
  setMasterVolume,        // (volume) => void
  toggle3DAudio,          // (enabled) => void
  reset,                  // () => void
} = useAudioStore();
```

### AudioSource Component Props
```typescript
interface AudioSourceProps {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  url: string;                   // Audio file URL
  position: [number, number, number];  // World position
  volume?: number;               // 0-1 (default: 0.8)
  loop?: boolean;                // Auto-loop (default: false)
  autoplay?: boolean;            // Auto-start (default: false)
  distance?: number;             // Max distance (default: 50)
  refDistance?: number;          // Reference distance (default: 1)
  rolloffFactor?: number;        // Attenuation curve (default: 1)
  enabled?: boolean;             // Play control (default: true)
}
```

---
**Last Updated**: After Audio System Implementation v1.0
**Engine Version**: RPG Maker 3D Builder with React 19 + React Three Fiber 9
**Status**: ✅ Core audio system complete, ready for testing
