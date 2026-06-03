import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Repeat, Music } from 'lucide-react';
import { AudioEngine } from '../lib/AudioEngine';
import { cn, getTagColor } from '../lib/utils';
import LoaderAnimation from './LoaderAnimation';

interface WaveformPlayerProps {
  engine: AudioEngine | null;
  isLoadingTrack?: boolean;
  trackName?: string;
  trackArtist?: string;
  trackCoverArt?: string;
  trackTags?: string[];
}

export const WaveformPlayer = React.memo(({ engine, isLoadingTrack, trackName, trackArtist, trackCoverArt, trackTags }: WaveformPlayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(engine?.isPlaying || false);
  const [isLooping, setIsLooping] = useState(engine?.isLooping || false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopStart, setLoopStart] = useState(engine?.loopStart || 0);
  const [loopEnd, setLoopEnd] = useState(engine?.loopEnd || 0);
  
  const [isDraggingLoop, setIsDraggingLoop] = useState(false);
  const [dragStartRatio, setDragStartRatio] = useState(0);
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null);

  // Shared Resize Observer
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setDimensions({ width: entries[0].contentRect.width, height: entries[0].contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Global Spacebar for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engine) return;
      // Don't intercept if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (engine.isPlaying) {
          engine.pause();
        } else {
          engine.play();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine]);

  // Poll for time and state updates
  useEffect(() => {
    if (!engine) return;
    let frameId: number;
    const update = () => {
      setIsPlaying(engine.isPlaying);
      setIsLooping(engine.isLooping);
      setCurrentTime(engine.getCurrentTime());
      if (engine.buffer) {
        setDuration(engine.buffer.duration);
        if (engine.loopEnd === 0) {
            setLoopEnd(engine.buffer.duration);
        } else {
            setLoopStart(engine.loopStart);
            setLoopEnd(engine.loopEnd);
        }
      }
      frameId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frameId);
  }, [engine]);

  // Refs for caching waveform path logic
  const waveformPathRef = useRef<Path2D | null>(null);

  // Draw Waveform (Static Only)
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || !engine || !engine.buffer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerRef.current.clientWidth;
    const height = 64; 
    
    // Use high DPI for waveform if possible, but keep it simple
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const rawData = engine.buffer.getChannelData(0);
    const samples = rawData.length;
    const step = Math.ceil(samples / width);

    const path = new Path2D();
    path.moveTo(0, height / 2);
    
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const idx = (i * step) + j;
            if (idx >= samples) break;
            const datum = rawData[idx];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        path.lineTo(i, (1 + min) * (height / 2));
        path.lineTo(i, (1 + max) * (height / 2));
    }
    waveformPathRef.current = path;
  }, [engine.buffer, dimensions.width]); // dimensions.width is derived from resize observer

  // Draw Loop Overlay & Playhead (Dynamic)
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = dimensions.width;
    const height = 64;
    if (width === 0) return;

    ctx.clearRect(0, 0, width, height);

    // Draw cached waveform
    if (waveformPathRef.current) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        ctx.stroke(waveformPathRef.current);
    }

    // Draw Loop region
    if (isLooping && duration > 0) {
        const startX = (loopStart / duration) * width;
        const endX = (loopEnd / duration) * width;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.fillRect(startX, 0, endX - startX, height);
        
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX, height);
        ctx.moveTo(endX, 0);
        ctx.lineTo(endX, height);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Draw playhead
    if (duration > 0) {
        const playheadX = (currentTime / duration) * width;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
  }, [currentTime, isLooping, loopStart, loopEnd, duration, dimensions.width]);

  const togglePlay = () => {
      if (!engine) return;
      if (engine.isPlaying) {
          engine.pause();
      } else {
          engine.play();
      }
  };

  const toggleLoop = () => {
      if (!engine) return;
      engine.toggleLoop(!isLooping);
  };

  const xToTime = (x: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !duration) return 0;
      const ratio = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      return ratio * duration;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      if (!engine || !duration) return;
      const time = xToTime(e.clientX);
      if (e.altKey || e.shiftKey) {
          // Alt/Shift drag to set loop
          setIsDraggingLoop(true);
          setDragStartRatio(time);
          engine.setLoopPoints(time, time);
          if (!isLooping) engine.toggleLoop(true);
      } else {
          // Click to seek
          engine.seek(time);
      }
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!engine || !duration) return;
      const time = xToTime(e.clientX);
      
      if (draggingHandle === 'start') {
          engine.setLoopPoints(Math.min(time, loopEnd - 0.05), loopEnd);
      } else if (draggingHandle === 'end') {
          engine.setLoopPoints(loopStart, Math.max(time, loopStart + 0.05));
      } else if (isDraggingLoop) {
          engine.setLoopPoints(dragStartRatio, time);
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      setIsDraggingLoop(false);
      setDraggingHandle(null);
      try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
  };

  const handleDragHandleDown = (e: React.PointerEvent, type: 'start' | 'end') => {
      e.stopPropagation();
      setDraggingHandle(type);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const formatTime = (time: number) => {
      const m = Math.floor(time / 60);
      const s = Math.floor(time % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-1 bg-slate-900/50 px-3 pb-3 pt-2 rounded-lg border border-slate-800">
      {trackName && (
          <div className="flex items-center gap-3 px-1 mb-1">
              {trackCoverArt ? (
                  <img src={trackCoverArt} alt="Cover" className="w-8 h-8 rounded shrink-0 object-cover" />
              ) : (
                  <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center shrink-0 text-slate-500">
                      <Music className="w-4 h-4" />
                  </div>
              )}
              <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                      <div className="text-sm font-sans font-bold italic tracking-wide text-slate-100 truncate">
                          {trackName}
                      </div>
                      {trackTags && trackTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                              {trackTags.map(tag => (
                                  <span key={tag} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/50 border border-slate-800 text-slate-300">
                                      <div className={cn("w-1.5 h-1.5 rounded-full", getTagColor(tag))} />
                                      {tag}
                                  </span>
                              ))}
                          </div>
                      )}
                  </div>
                  {trackArtist && (
                      <div className="text-xs text-slate-400 truncate">
                          {trackArtist}
                      </div>
                  )}
              </div>
          </div>
      )}
      <div className="flex items-center gap-4">
        <button 
            onClick={togglePlay}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 transition-colors"
        >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
        </button>
        
        <div className="flex-1 relative h-16 bg-slate-950 rounded overflow-hidden" ref={containerRef}>
            <canvas 
                ref={canvasRef}
                className="absolute inset-0 cursor-default touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            />
            {isLooping && duration > 0 && (
                <>
                    <div 
                        className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize hover:bg-sky-400 text-sky-400 hover:text-white flex items-center justify-center pointer-events-auto group mt-[0px]"
                        style={{ left: `${(loopStart / duration) * 100}%` }}
                        onPointerDown={(e) => handleDragHandleDown(e, 'start')}
                        onPointerMove={(e) => draggingHandle === 'start' && handlePointerMove(e)}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    >
                        <div className="h-4 w-1 bg-current rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    <div 
                        className="absolute top-0 bottom-0 w-3 -ml-1.5 cursor-ew-resize hover:bg-sky-400 text-sky-400 hover:text-white flex items-center justify-center pointer-events-auto group mt-[0px]"
                        style={{ left: `${(loopEnd / duration) * 100}%` }}
                        onPointerDown={(e) => handleDragHandleDown(e, 'end')}
                        onPointerMove={(e) => draggingHandle === 'end' && handlePointerMove(e)}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    >
                        <div className="h-4 w-1 bg-current rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                </>
            )}
            {isLoadingTrack ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10 pointer-events-none rounded-xl">
                    <LoaderAnimation />
                </div>
            ) : (duration === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs pointer-events-none">
                    Waiting for track...
                </div>
            ))}
        </div>

        <button 
            onClick={toggleLoop}
            className={cn(
                "p-2 rounded transition-colors",
                isLooping ? "text-cyan-400 bg-cyan-500/20" : "text-slate-500 hover:text-slate-300 bg-slate-800"
            )}
            title="Toggle Loop (Alt+Drag on waveform to set region)"
        >
            <Repeat size={20} />
        </button>
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 font-mono px-14">
          <span>{formatTime(currentTime)}</span>
          <span className="text-slate-400">Alt+Drag to loop region</span>
          <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
});
