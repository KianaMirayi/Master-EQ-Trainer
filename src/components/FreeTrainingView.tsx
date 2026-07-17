import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, FastForward, CheckCircle2, RotateCcw, Volume2, Ear, Upload, Music, Activity, Bug, X, Power, ChevronLeft, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioEngine } from '../lib/AudioEngine';
import { EQNodeData, cn } from '../lib/utils';
import { calculateLevelScore, LevelScoreReport } from '../lib/ScoreCalculator';
import { LevelManager } from '../lib/LevelManager';
import { EQCanvas, BAND_COLORS } from './EQCanvas';
import { LevelMeter } from './LevelMeter';
import { WaveformPlayer } from './WaveformPlayer';
import { TrackManager, Track } from '../lib/TrackManager';
import { PlayerProfileManager } from '../lib/PlayerProfileManager';
import { useLanguage } from '../lib/LanguageContext';
import { CalibrationManager } from '../lib/CalibrationManager';
import { FreeTrainingConfig, DEFAULT_FREE_TRAINING_CONFIG } from '../types/freeTraining';
import { FreeTrainingControlPanel } from './FreeTrainingControlPanel';

const bufferCache = new Map<string, Promise<AudioBuffer>>();

const getTrackBuffer = async (track: Track, ctx: AudioContext): Promise<AudioBuffer> => {
    if (bufferCache.has(track.id)) return bufferCache.get(track.id)!;
    const promise = (async () => {
        let arrayBuffer;
        if (track.file) arrayBuffer = await track.file.arrayBuffer();
        else if (track.url) {
            const res = await fetch(encodeURI(track.url));
            arrayBuffer = await res.arrayBuffer();
        }
        if (arrayBuffer) return await ctx.decodeAudioData(arrayBuffer);
        throw new Error("Empty buffer");
    })();
    bufferCache.set(track.id, promise);
    return promise;
};

interface FreeTrainingViewProps {
  onBack: () => void;
  selectedTrackId: string;
  selectedRandomTags?: string[];
}

export function FreeTrainingView({ onBack, selectedTrackId, selectedRandomTags }: FreeTrainingViewProps) {
  const { t } = useLanguage();
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetNodes, setTargetNodes] = useState<EQNodeData[]>([]);
  const [userNodes, setUserNodes] = useState<EQNodeData[]>([]);
  const [listenMode, setListenMode] = useState<'target' | 'user'>('user');
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  
  // Free Training Config
  const [config, setConfig] = useState<FreeTrainingConfig>(DEFAULT_FREE_TRAINING_CONFIG);
  const [isSettled, setIsSettled] = useState(false);
  const [scoreReport, setScoreReport] = useState<LevelScoreReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayStars, setDisplayStars] = useState(0);

  // Initialize Engine
  useEffect(() => {
    const newEngine = new AudioEngine();
    const activePreset = CalibrationManager.getActivePreset();
    if (activePreset) {
      newEngine.setCalibrationNodes(activePreset.nodes);
      if (activePreset.globalGain !== undefined) newEngine.setCalibrationGain(activePreset.globalGain);
    }
    setEngine(newEngine);
    return () => newEngine.dispose();
  }, []);

  // Sync isPlaying
  useEffect(() => {
    if (!engine) return;
    let frameId: number;
    let lastPlaying = engine.isPlaying;
    const syncState = () => {
      if (engine.isPlaying !== lastPlaying) {
          setIsPlaying(engine.isPlaying);
          lastPlaying = engine.isPlaying;
      }
      frameId = requestAnimationFrame(syncState);
    };
    syncState();
    return () => cancelAnimationFrame(frameId);
  }, [engine]);

  // Use a ref to track the latest regeneration request to avoid race conditions
  const regenRequestIdRef = useRef(0);

  const regenerateLevel = useCallback(async (currentConfig: FreeTrainingConfig) => {
    if (!engine) return;
    
    const requestId = ++regenRequestIdRef.current;
    
    // Stop and Reset
    engine.stop();
    setIsSettled(false);
    setScoreReport(null);
    setListenMode('user');

    // Generate
    const { targets: tNodes } = LevelManager.generateLevelTargets(-999, currentConfig); 
    const uNodes = LevelManager.generateUserInitial(tNodes, -999, currentConfig);
    
    // Check if this was the latest request
    if (requestId !== regenRequestIdRef.current) return;

    setTargetNodes(tNodes);
    setUserNodes(uNodes);
    engine.setTargetNodes(tNodes);
    engine.setUserNodes(uNodes);
    engine.setListenMode('user');

    // Reload Audio if needed
    let tToPlay: Track | null = null;
    if (selectedTrackId === 'random') tToPlay = TrackManager.getRandomTrack('all');
    else if (selectedTrackId === 'random-builtin') tToPlay = TrackManager.getRandomTrack('builtin');
    else if (selectedTrackId === 'random-custom') tToPlay = TrackManager.getRandomTrack('custom', selectedRandomTags);
    else tToPlay = TrackManager.getAllTracks().find(t => t.id === selectedTrackId) || TrackManager.getRandomTrack('builtin');

    if (tToPlay) {
      if (requestId !== regenRequestIdRef.current) return;
      setActiveTrack(tToPlay);
      try {
        setIsLoadingAudio(true);
        const dec = await getTrackBuffer(tToPlay, engine.ctx);
        if (requestId !== regenRequestIdRef.current) return;
        engine.setBuffer(dec);
        await engine.play();
      } catch (e) {
        console.error(e);
      } finally {
        if (requestId === regenRequestIdRef.current) {
          setIsLoadingAudio(false);
        }
      }
    }
  }, [engine, selectedTrackId]);

  // Initial generation
  useEffect(() => {
    if (engine) regenerateLevel(config);
  }, [engine, regenerateLevel]);

  const handleConfigChange = (newConfig: FreeTrainingConfig) => {
    setConfig(newConfig);
    // Instead of immediate regenerate, we'll let it happen on next turn or provide a button
    // But since the user wants it to feel real-time, let's at least ensure we don't have overlapping regens
  };

  // Explicitly trigger regen when config changes, but debounced or use a ref to track pending state
  const lastConfigRef = useRef(config);
  useEffect(() => {
    if (JSON.stringify(config) !== JSON.stringify(lastConfigRef.current)) {
      lastConfigRef.current = config;
      regenerateLevel(config);
    }
  }, [config, regenerateLevel]);

  const handleUserNodesChange = (nodes: EQNodeData[]) => {
    if (!engine) return;
    setUserNodes(nodes);
    engine.setUserNodes(nodes);
  };

  const handleModeChange = (mode: 'target' | 'user') => {
    if (!engine) return;
    engine.setListenMode(mode);
    setListenMode(mode);
  };

  const handleSubmit = () => {
    if (!engine || isScanning) return;
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const report = calculateLevelScore(targetNodes, userNodes, -999);
      setScoreReport(report);
      setIsSettled(true);
      handleModeChange('user');
    }, 1000);
  };

  const handleRetry = () => {
    regenerateLevel(config);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent rapid toggling if the key is held down
      if (e.repeat) return;
      
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      if (isInputFocused) return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleModeChange(listenMode === 'target' ? 'user' : 'target');
      }

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        const isAllBypassed = userNodes.every(n => n.enabled === false);
        const newNodes = userNodes.map(n => ({ ...n, enabled: isAllBypassed }));
        if (engine) {
          engine.setUserNodes(newNodes);
        }
        setUserNodes(newNodes);
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (!isSettled) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listenMode, engine, userNodes, isSettled, targetNodes, isScanning]);

  if (!engine) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          <span className="text-slate-500 font-medium tracking-widest uppercase text-xs">Initializing Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-950 text-slate-50 font-sans relative">
      {/* Control Panel (Frosted Glass) */}
      <FreeTrainingControlPanel 
        config={config} 
        isOpen={isControlPanelOpen}
        onChange={handleConfigChange} 
        onClose={() => setIsControlPanelOpen(false)}
      />

      {/* Top Bar */}
      <header className="flex-none h-16 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/40 backdrop-blur-md z-50">
        <div className="flex items-center gap-4 flex-1">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition group">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-medium text-sm">Dashboard</span>
          </button>
          
          <div className="w-px h-6 bg-white/10 mx-2"></div>
          
          <div id="level-indicator" className="flex items-center gap-3">
             <div className="px-3 py-1 bg-slate-800/80 rounded-md border border-white/5 flex items-center gap-2">
                <span className="text-xs font-black text-white uppercase tracking-wider">Free Training</span>
             </div>
             
             <div className="px-3 py-1 bg-slate-800/80 rounded-md border border-white/5 flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{config.nodesCount} Bands</span>
             </div>

             <button 
                onClick={() => setIsControlPanelOpen(true)}
                className="p-1 px-2.5 bg-slate-800/80 hover:bg-slate-700/80 rounded-md border border-white/5 flex items-center gap-2 transition-all active:scale-95 text-slate-400 hover:text-cyan-400 group"
             >
                <Settings className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Settings</span>
             </button>
          </div>
        </div>

        <div className="flex-none flex items-center justify-center gap-3">
          <div id="tutorial-listen-mode" className="h-8 bg-slate-800 p-1 rounded-md flex items-center gap-1 min-w-[200px]">
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

        <div className="flex flex-1 justify-end items-center gap-4">
          {!isSettled ? (
            <button 
              onClick={handleSubmit}
              disabled={isScanning}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isScanning ? 'CHECKING...' : t('submit_answer')}
            </button>
          ) : (
            <button 
              onClick={handleRetry}
              className="bg-indigo-500 hover:bg-indigo-400 text-white font-black px-6 py-2 rounded-xl shadow-lg transition flex items-center gap-2 active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              NEXT ROUND
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 p-4 md:p-6 relative flex flex-col gap-4">
        <div className="flex flex-col relative w-full items-center shrink-0">
          <div className="w-full relative">
            <WaveformPlayer 
              engine={engine} 
              isPlaying={isPlaying} 
              onTogglePlay={() => engine?.isPlaying ? engine.pause() : engine?.play()} 
              trackName={activeTrack?.name || 'Custom Track'}
              trackArtist={activeTrack?.artist}
              trackCoverArt={activeTrack?.coverArt}
              trackTags={activeTrack?.tags}
              isLoadingTrack={isLoadingAudio}
            />
          </div>
        </div>

        {/* Canvas Wrapper */}
        <div className="flex-1 min-h-0 relative rounded-xl border border-slate-800 shadow-2xl bg-[#14161a]/80 backdrop-blur-md mt-2 flex flex-col overflow-hidden">
          
          <div className="absolute top-4 left-4 z-10 text-xs text-slate-500 font-mono flex flex-col gap-1 pointer-events-none">
            <div>Drag: Frequency & Gain</div>
            <div>Alt + Drag: Q factor (Width)</div>
            <div>Double Click: Reset Gain to 0dB</div>
            <div>B: Bypass Selected Node</div>
            <div>Z: Toggle Global Bypass</div>
            <div>S or L: Listen to Selected Node</div>
          </div>

          <AnimatePresence>
            {isSettled && scoreReport && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
              >
                  <div className="bg-slate-900/90 border border-slate-700 px-6 py-3 rounded-full backdrop-blur-md flex items-center gap-3 shadow-2xl">
                    <span className="text-4xl font-black font-mono text-emerald-400 mr-2">
                      {Math.round(scoreReport.totalScore)}
                    </span>
                    <div className="flex gap-1 mr-4">
                      {[1, 2, 3].map(i => (
                        <motion.svg 
                          key={i} 
                          initial={{ scale: 0 }} 
                          animate={{ scale: 1 }} 
                          transition={{ delay: i * 0.1 }}
                          className={cn("w-6 h-6", i <= scoreReport.stars ? "text-amber-400" : "text-slate-800")}
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </motion.svg>
                      ))}
                    </div>
                    <span className="font-medium text-slate-200">
                        {scoreReport.stars >= 1 ? "Good job! Review the curves below." : "Not quite. Check the difference."}
                    </span>
                  </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* EQ Canvas Area */}
          <div className="flex-1 min-h-0 relative flex">
            <div className="flex-1 min-w-0 min-h-0 relative">
              <EQCanvas 
                engine={engine!}
                userNodes={userNodes} 
                targetNodes={targetNodes}
                listenMode={listenMode}
                onNodesChange={handleUserNodesChange}
                showTarget={isSettled || isScanning}
                isScanning={isScanning}
                showGainHint={config.enableGainHint}
                gainRange={config.gainRange}
              />
            </div>
            <LevelMeter engine={engine!} className="w-12 border-l border-slate-800/60 bg-slate-900/40" />
          </div>

          {/* Band Controls (Footer of Canvas) */}
          <div className="h-16 shrink-0 px-4 border-t border-slate-800/60 bg-slate-900/40 flex items-center gap-4 overflow-x-auto justify-between">
            <div className="flex items-center gap-4 flex-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest shrink-0">Bands:</span>
              
              <button
                onClick={() => {
                    const isAllBypassed = userNodes.every(n => n.enabled === false);
                    const newNodes = userNodes.map(n => ({ ...n, enabled: isAllBypassed }));
                    handleUserNodesChange(newNodes);
                }}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition shrink-0",
                    userNodes.every(n => n.enabled === false)
                        ? "bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300"
                        : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                )}
              >
                <Power className="w-4 h-4" />
                Global {userNodes.every(n => n.enabled === false) ? 'Bypassed' : 'ON'}
              </button>

              {userNodes.map((node, idx) => {
                const isBypassed = node.enabled === false;
                const activeColor = `rgba(${BAND_COLORS[idx % BAND_COLORS.length]}, 1)`;
                const bgColor = `rgba(${BAND_COLORS[idx % BAND_COLORS.length]}, 0.1)`;
                const borderColor = `rgba(${BAND_COLORS[idx % BAND_COLORS.length]}, 0.3)`;
                const hoverBgColor = `rgba(${BAND_COLORS[idx % BAND_COLORS.length]}, 0.2)`;

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
                            ? "" 
                            : "bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300"
                    )}
                    style={!isBypassed ? {
                        backgroundColor: bgColor,
                        borderColor: borderColor,
                        color: activeColor
                    } : {}}
                    onMouseEnter={(e) => {
                        if (!isBypassed) e.currentTarget.style.backgroundColor = hoverBgColor;
                    }}
                    onMouseLeave={(e) => {
                        if (!isBypassed) e.currentTarget.style.backgroundColor = bgColor;
                    }}
                  >
                    <div 
                      className={cn(
                          "w-2 h-2 rounded-full transition-colors",
                          isBypassed ? "bg-slate-600" : ""
                      )} 
                      style={!isBypassed ? {
                          backgroundColor: activeColor,
                          boxShadow: `0 0 8px rgba(${BAND_COLORS[idx % BAND_COLORS.length]}, 0.8)`
                      } : {}}
                    />
                    Band {idx + 1} {!isBypassed ? 'ON' : 'BYPASS'}
                  </button>
                );
              })}
            </div>
            
            <div className="flex items-center shrink-0 border-l border-white/5 pl-4">
               <button
                 className="p-2 rounded-md bg-slate-800 text-emerald-400"
               >
                 <Activity className="w-5 h-5" />
               </button>
            </div>
          </div>
        </div>


        {/* Scanning Overlay (Absolute) - Removed as per user request */}
      </main>
    </div>
  );
}
