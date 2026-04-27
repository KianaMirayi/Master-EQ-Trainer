import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, FastForward, CheckCircle2, RotateCcw, Volume2, Ear, Upload } from 'lucide-react';
import { AudioEngine } from '../lib/AudioEngine';
import { EQNodeData, calculateMatchScore, cn } from '../lib/utils';
import { generateDrumLoop } from '../lib/AudioLoopGen';
import { generateTargetForLevel, generateUserInitial } from '../lib/GameLogic';
import { EQCanvas } from './EQCanvas';

interface GameViewProps {
  level: number;
  onLevelComplete: (score: number) => void;
  onBack: () => void;
}

export function GameView({ level, onLevelComplete, onBack }: GameViewProps) {
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetNodes, setTargetNodes] = useState<EQNodeData[]>([]);
  const [userNodes, setUserNodes] = useState<EQNodeData[]>([]);
  const [listenMode, setListenMode] = useState<'target' | 'user'>('user');
  const [isSettled, setIsSettled] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Engine lifecycle
  useEffect(() => {
    const newEngine = new AudioEngine();
    setEngine(newEngine);
    return () => {
      newEngine.dispose();
    };
  }, []);

  // Initialize Level
  useEffect(() => {
    if (!engine) return;

    async function init() {
      // 1. Generate Audio if missing
      if (!engine!.buffer) {
        const buf = await generateDrumLoop(engine!.ctx);
        engine!.setBuffer(buf);
      }
      
      // 2. Generate Nodes
      const tNodes = generateTargetForLevel(level);
      const uNodes = generateUserInitial(tNodes, level);
      
      setTargetNodes(tNodes);
      setUserNodes(uNodes);
      engine!.setTargetNodes(tNodes);
      engine!.setUserNodes(uNodes);
      engine!.setListenMode('user');
      setListenMode('user');
      setIsSettled(false);
      setScore(null);
    }
    init();

    return () => {
      engine!.stop();
    };
  }, [level, engine]);

  const togglePlay = async () => {
    if (!engine) return;
    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
    } else {
      await engine.play();
      setIsPlaying(true);
    }
  };

  const handleModeChange = (mode: 'target' | 'user') => {
    if (!engine) return;
    engine.setListenMode(mode);
    setListenMode(mode);
  };

  const handleUserNodesChange = (nodes: EQNodeData[]) => {
    if (!engine) return;
    setUserNodes(nodes);
    engine.setUserNodes(nodes);
  };

  const handleSubmit = () => {
    if (!engine) return;
    const s = calculateMatchScore(userNodes, targetNodes);
    setScore(s);
    setIsSettled(true);
    // Switch to user mode upon settlement to let them tweak and compare
    handleModeChange('user');
  };

  const handleNext = () => {
    if (score !== null) {
      onLevelComplete(score);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!engine) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await engine.ctx.decodeAudioData(arrayBuffer);
      
      // Stop current playback if active
      if (isPlaying) {
        engine.stop();
        setIsPlaying(false);
      }
      
      engine.setBuffer(audioBuffer);
    } catch (err) {
      console.error('Failed to decode audio file', err);
      alert('Failed to load audio file. Please try another format like MP3, WAV or AAC.');
    }
    
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  if (!engine) {
     return <div className="h-screen w-screen bg-slate-950"></div>;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-50 font-sans">
      <input 
        type="file" 
        accept="audio/*" 
        ref={fileInputRef} 
        onChange={handleAudioUpload} 
        className="hidden" 
      />
      {/* Top Bar */}
      <header className="flex-none h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition">
            ← Back
          </button>
          <div className="w-px h-6 bg-slate-800"></div>
          <h1 className="text-xl font-bold tracking-tight text-white/90">
            Level <span className="text-cyan-400">{level}</span>
          </h1>
          <span className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-400 ml-2 shadow-inner">
            {targetNodes.length} Band{targetNodes.length > 1 && 's'}
          </span>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition ml-2"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Audio
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full transition shadow-lg",
              isPlaying ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-cyan-500 text-slate-900 hover:bg-cyan-400"
            )}
          >
            {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-[2px]" />}
          </button>
          
          <div className="h-8 bg-slate-800 p-1 rounded-md flex items-center gap-1 min-w-[200px]">
            <button
              onClick={() => handleModeChange('target')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 text-sm font-medium h-full rounded transition",
                listenMode === 'target' ? "bg-purple-500 text-white shadow-md shadow-purple-500/20" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Ear className="w-4 h-4" />
              Target
            </button>
            <button
              onClick={() => handleModeChange('user')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 text-sm font-medium h-full rounded transition",
                listenMode === 'user' ? "bg-cyan-500 text-slate-900 shadow-md shadow-cyan-500/20" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Volume2 className="w-4 h-4" />
              Your EQ
            </button>
          </div>
        </div>

        <div className="flex items-center">
          {!isSettled ? (
            <button 
              onClick={handleSubmit}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2 rounded-md shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
            >
              Submit Answer
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-md">
                <span className="text-slate-400 text-sm">Match:</span>
                <span className={cn(
                  "font-mono font-bold text-lg",
                  score! >= 72 ? "text-emerald-400" : "text-red-400"
                )}>{score}%</span>
              </div>
              <button 
                onClick={handleNext}
                className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-6 py-2 rounded-md shadow-lg transition flex items-center gap-2"
              >
                {score! >= 72 ? 'Next Level' : 'Retry'}
                {score! >= 72 ? <FastForward className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 p-6 relative flex flex-col">
          {/* Instructions Overlay */}
          {!isPlaying && !isSettled && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                  <div className="bg-slate-900/90 border border-slate-700 px-8 py-6 rounded-2xl flex flex-col items-center backdrop-blur-sm pointer-events-auto shadow-2xl">
                    <Play className="w-12 h-12 text-cyan-400 mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Press Play to Start</h2>
                    <p className="text-slate-400 text-center max-w-sm mb-6">
                        Listen to the <b>Target EQ</b>, then adjust your nodes to match it. A/B switch often.
                    </p>
                    <button 
                      onClick={togglePlay}
                      className="bg-cyan-500 text-slate-900 font-bold px-8 py-3 rounded-full hover:bg-cyan-400 transition"
                    >
                      Start Listening
                    </button>
                  </div>
              </div>
          )}

          {/* Settled Feedback Overlay */}
          {isSettled && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <div className="bg-slate-900/80 border border-slate-700 px-6 py-3 rounded-full backdrop-blur-md flex items-center gap-3 shadow-2xl">
                  {score! >= 72 ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <RotateCcw className="w-5 h-5 text-rose-400" />}
                  <span className="font-medium text-slate-200">
                      {score! >= 72 ? "Good job! Review the curves below." : "Not quite. Check the difference."}
                  </span>
                </div>
            </div>
          )}

          {/* Canvas Wrapper */}
          <div className="flex-1 relative rounded-xl border border-slate-800 shadow-2xl bg-[#14161a] mt-2 flex flex-col">
            <div className="absolute top-4 left-4 z-10 text-xs text-slate-500 font-mono flex flex-col gap-1 pointer-events-none">
              <div>Drag: Frequency & Gain</div>
              <div>Alt + Drag: Q factor (Width)</div>
              <div>Double Click: Reset Gain to 0dB</div>
            </div>
            
            <div className="flex-1 relative">
                <EQCanvas 
                    engine={engine}
                    userNodes={userNodes}
                    targetNodes={targetNodes}
                    onNodesChange={handleUserNodesChange}
                    showTarget={isSettled}
                />
            </div>
            
            {/* Band Controls */}
            <div className="h-16 px-4 border-t border-slate-800/60 bg-slate-900/40 flex items-center gap-4 overflow-x-auto">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest shrink-0">Bands:</span>
              {userNodes.map((node, idx) => {
                const isBypassed = node.enabled === false;
                return (
                  <button
                    key={node.id}
                    onClick={() => {
                        const newNodes = [...userNodes];
                        newNodes[idx] = { ...node, enabled: isBypassed };
                        handleUserNodesChange(newNodes);
                    }}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition shrink-0",
                        !isBypassed 
                            ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20" 
                            : "bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300"
                    )}
                  >
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        !isBypassed ? "bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" : "bg-slate-600"
                    )} />
                    Band {idx + 1} {!isBypassed ? 'ON' : 'BYPASS'}
                  </button>
                );
              })}
            </div>
          </div>
      </main>
    </div>
  );
}
