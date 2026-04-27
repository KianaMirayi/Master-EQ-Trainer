import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Repeat } from 'lucide-react';
import { AudioEngine } from '../lib/AudioEngine';
import { cn } from '../lib/utils';

interface WaveformPlayerProps {
  engine: AudioEngine;
  isLoadingTrack?: boolean;
}

export function WaveformPlayer({ engine, isLoadingTrack }: WaveformPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(engine.isPlaying);
  const [isLooping, setIsLooping] = useState(engine.isLooping);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopStart, setLoopStart] = useState(engine.loopStart);
  const [loopEnd, setLoopEnd] = useState(engine.loopEnd);
  
  const [isDraggingLoop, setIsDraggingLoop] = useState(false);
  const [dragStartRatio, setDragStartRatio] = useState(0);
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null);

  // Global Spacebar for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  // Draw Waveform and Loop Overlay
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || !engine.buffer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = containerRef.current.clientWidth;
    const height = 64; // fixed height
    canvas.width = width;
    canvas.height = height;

    const rawData = engine.buffer.getChannelData(0);
    const samples = rawData.length;
    const step = Math.ceil(samples / width);

    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = rawData[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        ctx.lineTo(i, (1 + min) * (height / 2));
        ctx.lineTo(i, (1 + max) * (height / 2));
    }
    ctx.strokeStyle = '#3b82f6'; // blue-500
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw playhead
    const playheadX = (currentTime / (duration || 1)) * width;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Loop region
    if (isLooping) {
        const startX = (loopStart / (duration || 1)) * width;
        const endX = (loopEnd / (duration || 1)) * width;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)'; // sky-400 transparent
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
  }, [engine.buffer, currentTime, duration, loopStart, loopEnd, isLooping]);

  const togglePlay = () => {
      if (engine.isPlaying) {
          engine.pause();
      } else {
          engine.play();
      }
  };

  const toggleLoop = () => {
      engine.toggleLoop(!isLooping);
  };

  const xToTime = (x: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !duration) return 0;
      const ratio = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      return ratio * duration;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      if (!duration) return;
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
      if (!duration) return;
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
    <div className="flex flex-col gap-2 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
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
                className="absolute inset-0 cursor-crosshair touch-none"
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
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-cyan-400 text-sm font-medium z-10 pointer-events-none gap-2">
                    <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading track...
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
}
