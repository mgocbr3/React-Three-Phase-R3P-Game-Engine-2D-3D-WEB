import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, Square, SkipBack, SkipForward, Plus, Trash2,
  Lock, Unlock, Eye, EyeOff, ChevronDown, ChevronRight,
  Magnet, ZoomIn, ZoomOut, MoreHorizontal, Clock, Repeat,
  Move, RotateCw, Maximize2, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTimelineStore, AnimationTrack, Keyframe, EasingType, AnimatableProperty } from '@/stores/timelineStore';
import { useEditorStore } from '@/stores/editorStore';

// Property icons and colors
const PROPERTY_CONFIG: Record<string, { icon: typeof Move; color: string; label: string }> = {
  'position.x': { icon: Move, color: 'text-muted-foreground', label: 'Pos X' },
  'position.y': { icon: Move, color: 'text-muted-foreground', label: 'Pos Y' },
  'position.z': { icon: Move, color: 'text-muted-foreground', label: 'Pos Z' },
  'rotation.x': { icon: RotateCw, color: 'text-muted-foreground', label: 'Rot X' },
  'rotation.y': { icon: RotateCw, color: 'text-muted-foreground', label: 'Rot Y' },
  'rotation.z': { icon: RotateCw, color: 'text-muted-foreground', label: 'Rot Z' },
  'scale.x': { icon: Maximize2, color: 'text-muted-foreground', label: 'Scale X' },
  'scale.y': { icon: Maximize2, color: 'text-muted-foreground', label: 'Scale Y' },
  'scale.z': { icon: Maximize2, color: 'text-muted-foreground', label: 'Scale Z' },
  'opacity': { icon: Eye, color: 'text-muted-foreground', label: 'Opacity' },
};

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeIn', label: 'Ease In' },
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'easeInOut', label: 'Ease In/Out' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'elastic', label: 'Elastic' },
  { value: 'back', label: 'Back' },
];

export const TimelinePanel = () => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isAddingTrack, setIsAddingTrack] = useState(false);
  
  const {
    clips, activeClipId, isPlaying, currentTime, zoom, scrollX, snapToGrid,
    selectedTrackId, selectedKeyframeIds,
    play, pause, stop, setCurrentTime, setZoom, setScrollX, toggleSnapToGrid,
    createClip, deleteClip, setActiveClip, updateClip,
    addTrack, removeTrack, updateTrack,
    addKeyframe, removeKeyframe, updateKeyframe, moveKeyframe,
    selectTrack, selectKeyframes,
    getActiveClip,
  } = useTimelineStore();
  
  const { selectedObjectId, objects } = useEditorStore();
  const activeClip = getActiveClip();
  const selectedObject = objects.find((o) => o.id === selectedObjectId);
  
  // Playback loop
  useEffect(() => {
    if (!isPlaying || !activeClip) return;
    
    const interval = setInterval(() => {
      setCurrentTime(currentTime + 0.016 * activeClip.speed); // ~60fps
      
      // Loop or stop at end
      if (currentTime >= activeClip.duration) {
        if (activeClip.loop) {
          setCurrentTime(0);
        } else {
          pause();
        }
      }
    }, 16);
    
    return () => clearInterval(interval);
  }, [isPlaying, currentTime, activeClip]);
  
  // Format time as MM:SS.ms
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  
  // Time to X position
  const timeToX = (time: number) => time * zoom - scrollX;
  const xToTime = (x: number) => (x + scrollX) / zoom;
  
  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, xToTime(x));
    setCurrentTime(time);
  };
  
  // Handle keyframe drag
  const handleKeyframeDrag = useCallback((
    clipId: string,
    trackId: string,
    keyframeId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const startX = e.clientX;
    const keyframe = activeClip?.tracks.find(t => t.id === trackId)?.keyframes.find(k => k.id === keyframeId);
    if (!keyframe) return;
    
    const startTime = keyframe.time;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / zoom;
      moveKeyframe(clipId, trackId, keyframeId, startTime + deltaTime);
    };
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [activeClip, zoom, moveKeyframe]);
  
  // Create new clip for selected object
  const handleCreateClip = () => {
    if (!selectedObjectId) return;
    createClip(`Animation ${clips.length + 1}`, selectedObjectId);
  };
  
  // Add track to active clip
  const handleAddTrack = (property: AnimatableProperty) => {
    if (!activeClipId || !selectedObjectId) return;
    addTrack(activeClipId, selectedObjectId, property);
    setIsAddingTrack(false);
  };
  
  // Add keyframe at current time
  const handleAddKeyframe = (trackId: string, property: AnimatableProperty) => {
    if (!activeClipId || !selectedObject) return;
    
    // Get current value from object
    let value: number | [number, number, number] = 0;
    if (property.startsWith('position.')) {
      const axis = property.split('.')[1] as 'x' | 'y' | 'z';
      value = selectedObject.position[['x', 'y', 'z'].indexOf(axis)];
    } else if (property.startsWith('rotation.')) {
      const axis = property.split('.')[1] as 'x' | 'y' | 'z';
      value = selectedObject.rotation[['x', 'y', 'z'].indexOf(axis)];
    } else if (property.startsWith('scale.')) {
      const axis = property.split('.')[1] as 'x' | 'y' | 'z';
      value = selectedObject.scale[['x', 'y', 'z'].indexOf(axis)];
    } else if (property === 'opacity') {
      value = selectedObject.visualSettings?.opacity ?? 1;
    }
    
    addKeyframe(activeClipId, trackId, currentTime, value);
  };
  
  // Render time ruler
  const renderRuler = () => {
    if (!activeClip) return null;
    
    const markers: React.ReactElement[] = [];
    const step = zoom < 50 ? 1 : zoom < 100 ? 0.5 : 0.1;
    const maxTime = Math.max(activeClip.duration, 10);
    
    for (let t = 0; t <= maxTime; t += step) {
      const x = timeToX(t);
      if (x < -50 || x > 2000) continue;
      
      const isMajor = t % 1 === 0;
      markers.push(
        <div
          key={t}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${x}px` }}
        >
          <div className={cn(
            "w-px bg-border",
            isMajor ? "h-4" : "h-2"
          )} />
          {isMajor && (
            <span className="text-[9px] text-muted-foreground mt-0.5">
              {t.toFixed(0)}s
            </span>
          )}
        </div>
      );
    }
    
    return markers;
  };
  
  // Render track rows
  const renderTracks = () => {
    if (!activeClip) return null;
    
    return activeClip.tracks.map((track) => {
      const config = PROPERTY_CONFIG[track.property] || { icon: Layers, color: 'text-muted-foreground', label: track.property };
      const Icon = config.icon;
      const obj = objects.find((o) => o.id === track.objectId);
      
      return (
        <div
          key={track.id}
          className={cn(
            "flex border-b border-border",
            selectedTrackId === track.id && "bg-primary/5"
          )}
        >
          {/* Track header */}
          <div
            className="w-48 flex-shrink-0 flex items-center gap-2 px-2 py-1.5 border-r border-border bg-secondary/30 cursor-pointer"
            onClick={() => selectTrack(track.id)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); updateTrack(activeClipId!, track.id, { enabled: !track.enabled }); }}
              className={cn("p-0.5 rounded", track.enabled ? "text-foreground" : "text-muted-foreground")}
            >
              {track.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); updateTrack(activeClipId!, track.id, { locked: !track.locked }); }}
              className={cn("p-0.5 rounded", track.locked ? "text-muted-foreground" : "text-muted-foreground")}
            >
              {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            </button>
            <Icon className={cn("w-3.5 h-3.5", config.color)} />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-medium truncate block">{obj?.name || 'Object'}</span>
              <span className="text-[9px] text-muted-foreground">{config.label}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); removeTrack(activeClipId!, track.id); }}
              className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          
          {/* Track timeline */}
          <div
            className="flex-1 relative h-8 bg-muted/30"
            onClick={() => !track.locked && handleAddKeyframe(track.id, track.property)}
          >
            {/* Keyframes */}
            {track.keyframes.map((kf) => (
              <div
                key={kf.id}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-sm rotate-45 cursor-pointer transition-all",
                  "border-2 hover:scale-125",
                  selectedKeyframeIds.includes(kf.id)
                    ? "bg-primary border-primary-foreground"
                    : "bg-secondary border-primary/50 hover:border-primary"
                )}
                style={{ left: `${timeToX(kf.time) - 6}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectKeyframes([kf.id]);
                }}
                onMouseDown={(e) => !track.locked && handleKeyframeDrag(activeClipId!, track.id, kf.id, e)}
                title={`${kf.time.toFixed(2)}s - ${kf.easing}`}
              />
            ))}
          </div>
        </div>
      );
    });
  };
  
  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          {/* Clip selector */}
          <select
            value={activeClipId || ''}
            onChange={(e) => setActiveClip(e.target.value || null)}
            className="bg-muted border-0 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Selecione um clip</option>
            {clips.map((clip) => (
              <option key={clip.id} value={clip.id}>{clip.name}</option>
            ))}
          </select>
          
          <button
            onClick={handleCreateClip}
            disabled={!selectedObjectId}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Novo Clip"
          >
            <Plus className="w-4 h-4" />
          </button>
          
          {activeClipId && (
            <button
              onClick={() => deleteClip(activeClipId)}
              className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
              title="Deletar Clip"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={stop}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentTime(Math.max(0, currentTime - 0.1))}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Frame anterior"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={() => isPlaying ? pause() : play()}
            className={cn(
              "p-2 rounded-full transition-colors",
              isPlaying ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
            )}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setCurrentTime(currentTime + 0.1)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Próximo frame"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          
          {/* Time display */}
          <div className="ml-2 px-2 py-1 bg-muted rounded text-xs font-mono">
            <Clock className="w-3 h-3 inline-block mr-1 opacity-50" />
            {formatTime(currentTime)}
          </div>
        </div>
        
        {/* View controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSnapToGrid}
            className={cn(
              "p-1.5 rounded transition-colors",
              snapToGrid ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary"
            )}
            title="Snap to Grid"
          >
            <Magnet className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setZoom(zoom - 20)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-muted-foreground w-10 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(zoom + 20)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          
          {activeClip && (
            <button
              onClick={() => updateClip(activeClipId!, { loop: !activeClip.loop })}
              className={cn(
                "p-1.5 rounded transition-colors",
                activeClip.loop ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary"
              )}
              title="Loop"
            >
              <Repeat className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Timeline content */}
      <div className="flex-1 flex overflow-hidden">
        {activeClip ? (
          <>
            {/* Track list + timeline */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Ruler */}
              <div className="h-6 flex border-b border-border">
                <div className="w-48 flex-shrink-0 border-r border-border bg-secondary/30" />
                <div
                  className="flex-1 relative overflow-hidden cursor-pointer"
                  onClick={handleTimelineClick}
                >
                  {renderRuler()}
                  {/* Playhead */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
                    style={{ left: `${timeToX(currentTime)}px` }}
                  >
                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rotate-45" />
                  </div>
                </div>
              </div>
              
              {/* Tracks */}
              <div className="flex-1 overflow-y-auto">
                {renderTracks()}
                
                {/* Add track button */}
                <div className="relative">
                  <button
                    onClick={() => setIsAddingTrack(!isAddingTrack)}
                    className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Track
                    <ChevronDown className={cn("w-3 h-3 transition-transform", isAddingTrack && "rotate-180")} />
                  </button>
                  
                  {/* Add track dropdown */}
                  {isAddingTrack && (
                    <div className="absolute left-48 right-0 top-full bg-card border border-border rounded-lg shadow-xl z-20 p-2 grid grid-cols-3 gap-1">
                      {Object.entries(PROPERTY_CONFIG).map(([prop, config]) => {
                        const Icon = config.icon;
                        return (
                          <button
                            key={prop}
                            onClick={() => handleAddTrack(prop as AnimatableProperty)}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded hover:bg-secondary transition-colors"
                          >
                            <Icon className={cn("w-3.5 h-3.5", config.color)} />
                            {config.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Clock className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhum clip selecionado</p>
            <p className="text-xs opacity-70 mt-1 max-w-[250px] text-center">
              Selecione um objeto e clique em "+" para criar um novo clip de animação
            </p>
            {selectedObjectId && (
              <button
                onClick={handleCreateClip}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Criar Clip para "{selectedObject?.name}"
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Keyframe properties panel */}
      {selectedKeyframeIds.length > 0 && activeClip && (
        <div className="h-20 border-t border-border bg-secondary/30 p-3 flex items-center gap-4">
          <div className="text-xs text-muted-foreground">
            {selectedKeyframeIds.length} keyframe(s) selecionado(s)
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Easing:</label>
            <select
              className="bg-muted border-0 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              onChange={(e) => {
                activeClip.tracks.forEach((track) => {
                  track.keyframes.forEach((kf) => {
                    if (selectedKeyframeIds.includes(kf.id)) {
                      updateKeyframe(activeClipId!, track.id, kf.id, { easing: e.target.value as EasingType });
                    }
                  });
                });
              }}
            >
              {EASING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => {
              activeClip.tracks.forEach((track) => {
                track.keyframes.forEach((kf) => {
                  if (selectedKeyframeIds.includes(kf.id)) {
                    removeKeyframe(activeClipId!, track.id, kf.id);
                  }
                });
              });
              selectKeyframes([]);
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-destructive/20 text-destructive rounded text-xs hover:bg-destructive/30"
          >
            <Trash2 className="w-3 h-3" />
            Deletar
          </button>
        </div>
      )}
    </div>
  );
};
