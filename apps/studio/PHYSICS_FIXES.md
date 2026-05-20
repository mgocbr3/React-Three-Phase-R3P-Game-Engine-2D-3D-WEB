# Physics System Error Fixes

## Problem Summary

When transitioning between **Play Mode** and **Edit Mode**, the application was throwing critical errors:

```
Error: recursive use of an object detected which would lead to unsafe aliasing in rust
Error: attempted to take ownership of Rust value while it was borrowed
RuntimeError: unreachable
```

### Root Causes

1. **Memory Safety Violations in Rapier WASM**
   - Script executor was calling methods on rigid bodies that were being destroyed
   - WebAssembly objects from Rapier were accessed after being freed
   - No validation of object state before operations

2. **Timing Issues During Mode Transitions**
   - React Three Fiber destroys RigidBody components during unmount
   - Script executor continues to reference these destroyed bodies
   - Physics world step operations interfered with body removal

3. **Missing Error Boundaries**
   - No try-catch blocks around Rapier method calls
   - Errors propagated uncaught, crashing the canvas

## Solutions Implemented

### 1. **Robust Error Handling in Executor** 
[File: `src/scripts/executor.ts`]

```typescript
// Safely check kinematic state with error handling
let isKinematic = false;
if (rigidBody) {
  try {
    isKinematic = Boolean(
      typeof rbAny?.isKinematic === 'function' && rbAny.isKinematic() ||
      typeof rbAny?.isKinematicPositionBased === 'function' && rbAny.isKinematicPositionBased() ||
      // ... other checks
    );
  } catch (e) {
    // Rigid body is likely invalid, treat as if it doesn't exist
    isKinematic = false;
  }
}
```

### 2. **Safe Rigid Body Operations**
All methods that access rigid body properties now wrap calls in try-catch:

```typescript
const getRbPosition = () => {
  if (!rigidBody) return null;
  try {
    const t = rigidBody.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  } catch (e) {
    // Rigid body is in an invalid state
    return null;
  }
};
```

This applies to:
- `translation()` - Get position
- `rotation()` - Get rotation quaternion  
- `setTranslation()` - Update position
- `setRotation()` - Update rotation
- `setLinvel()` - Set linear velocity
- `applyImpulse()` - Apply force

### 3. **Runtime State Cleanup**
[File: `src/scripts/executor.ts` - `executeFrame()` method]

Before executing frame, remove stale references to deleted objects:

```typescript
// Clean up runtime states for objects that no longer exist
const validObjectIds = new Set(objects.map(o => o.id));
for (const key of this.runtimeStates.keys()) {
  const objectId = key.split(':')[0];
  if (!validObjectIds.has(objectId)) {
    this.runtimeStates.delete(key);
  }
}
```

### 4. **Pre-Flight Rigid Body Validation**
[File: `src/components/canvas/EditableObject.tsx`]

Before registering a rigid body for script use, test if it's accessible:

```typescript
useEffect(() => {
  if (!rigidBodies?.current) return;
  if (isEditMode) {
    rigidBodies.current.delete(object.id);
    return;
  }

  const rb = rigidBodyRef.current;
  if (!rb) return;
  
  try {
    rb.translation(); // Test if the rigid body is accessible
    rigidBodies.current.set(object.id, rb);
  } catch (e) {
    // Rigid body is in an invalid state, don't register it
    return;
  }
  
  return () => {
    rigidBodies.current.delete(object.id);
  };
}, [rigidBodies, object.id, isEditMode]);
```

### 5. **Improved Script Runner Safety**
[File: `src/components/canvas/ScriptRunner.tsx`]

Wrap script execution with error handling and running state checks:

```typescript
useFrame((_, delta) => {
  if (isEditMode) return;

  if (!scriptExecutor.isRunning()) return;

  try {
    scriptExecutor.executeFrame(
      objects,
      delta,
      rigidBodies.current,
      groups.current
    );
  } catch (error) {
    console.error('[ScriptRunner] Error during script execution:', error);
  }
});
```

## Testing Recommendations

1. **Mode Transitions**
   - Switch between Play and Edit modes repeatedly
   - Verify no errors in browser console
   - Confirm physics bodies don't persist after mode switch

2. **Script Execution**
   - Add objects with movement scripts
   - Play and pause the scene multiple times
   - Check that kinematic bodies move correctly

3. **Error Scenarios**
   - Delete objects mid-playback
   - Add/remove scripts during play
   - Monitor browser DevTools console for warnings

## Performance Notes

The additional try-catch blocks have minimal performance impact:
- Only triggered during mode transitions (infrequent)
- Array cleanup is O(n) where n = number of active scripts (typically <100)
- Physics operations themselves unchanged, only wrapped in error handling

## Related Files Changed

- `src/scripts/executor.ts` - Main physics safety improvements
- `src/components/canvas/ScriptRunner.tsx` - Error handling wrapper
- `src/components/canvas/EditableObject.tsx` - Pre-flight validation

## Commit Information

```
[main 38d992a] fix: Add robust error handling for Rapier physics transitions
 3 files changed, 96 insertions(+), 30 deletions(-)
```
