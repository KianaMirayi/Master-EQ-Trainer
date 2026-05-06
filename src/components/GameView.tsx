import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, FastForward, CheckCircle2, RotateCcw, Volume2, Ear, Upload, Music, Activity, Bug, X, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioEngine } from '../lib/AudioEngine';
import { EQNodeData, cn } from '../lib/utils';
import { calculateLevelScore, LevelScoreReport } from '../lib/ScoreCalculator';
import { LevelManager } from '../lib/LevelManager';
import { EQCanvas, BAND_COLORS } from './EQCanvas';
import { LevelMeter } from './LevelMeter';
import { WaveformPlayer } from './WaveformPlayer';
import { TrackManager, Track } from '../lib/TrackManager';

const bufferCache = new Map<string, Promise<AudioBuffer>>();

const getTrackBuffer = async (track: Track, ctx: AudioContext): Promise<AudioBuffer> => {
    if (bufferCache.has(track.id)) {
        return bufferCache.get(track.id)!;
    }

    const promise = (async () => {
        let arrayBuffer;
        if (track.file) {
            arrayBuffer = await track.file.arrayBuffer();
        } else if (track.url) {
            const res = await fetch(track.url);
            if (!res.ok) throw new Error(`Failed to fetch ${track.url}: ${res.statusText} (${res.status})`);
            
            // Check if Vercel or another host returned an HTML page (like SPA fallback) instead of an audio file
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
                throw new Error(`The server returned an HTML page instead of an audio file for ${track.url}. This usually happens if the file is missing and the server falls back to index.html.`);
            }
            
            arrayBuffer = await res.arrayBuffer();
        }
        if (arrayBuffer && arrayBuffer.byteLength > 0) {
            return await ctx.decodeAudioData(arrayBuffer);
        } else {
            throw new Error("Audio file is empty. Please upload a valid file.");
        }
    })();

    bufferCache.set(track.id, promise);
    return promise;
};

interface GameViewProps {
  level: number;
  selectedTrackId: string;
  onLevelComplete: (score: number, stars: number) => void;
  onRetry: (score: number, stars: number) => void;
  onBack: () => void;
  onLevelChange?: (level: number) => void;
}

import { CalibrationManager } from '../lib/CalibrationManager';

export function GameView({ level, selectedTrackId, onLevelComplete, onRetry, onBack, onLevelChange }: GameViewProps) {
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetNodes, setTargetNodes] = useState<EQNodeData[]>([]);
  const [userNodes, setUserNodes] = useState<EQNodeData[]>([]);
  const [listenMode, setListenMode] = useState<'target' | 'user'>('user');
  const [isSettled, setIsSettled] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showScoreDetails, setShowScoreDetails] = useState(false);
  const [showFeedbackMessage, setShowFeedbackMessage] = useState(false);
  const [scoreReport, setScoreReport] = useState<LevelScoreReport | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayStars, setDisplayStars] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [trackName, setTrackName] = useState<string>('');
  const [trackArtist, setTrackArtist] = useState<string>('');
  const [trackCoverArt, setTrackCoverArt] = useState<string>('');
  const [showMeter, setShowMeter] = useState(true);
  const [showTestModePanel, setShowTestModePanel] = useState(false);

  const config = LevelManager.getLevelConfig(level);
  
  // Engine lifecycle
  useEffect(() => {
    const newEngine = new AudioEngine();
    const activePreset = CalibrationManager.getActivePreset();
    if (activePreset) {
      newEngine.setCalibrationNodes(activePreset.nodes);
      if (activePreset.globalGain !== undefined) {
        newEngine.setCalibrationGain(activePreset.globalGain);
      }
    }
    setEngine(newEngine);
    return () => {
      newEngine.dispose();
    };
  }, []);

  // Preload built-in tracks in the background
  useEffect(() => {
    if (!engine) return;
    TrackManager.getBuiltInTracks().forEach(t => {
      // Background preload to enable near zero-latency toggling
      getTrackBuffer(t, engine.ctx).catch(e => console.warn("Preload failed", e));
    });
  }, [engine]);

  // Set randomized track per level if "random" is selected
  const activeTrackRef = useRef<Track | null>(null);

  // Initialize Level & Audio
  useEffect(() => {
    if (!engine) return;

    async function init() {
      // Decode or Generate audio based on selection
      let tToPlay: Track | null = null;
      if (selectedTrackId === 'random') {
          tToPlay = TrackManager.getRandomTrack('all');
      } else if (selectedTrackId === 'random-builtin') {
          tToPlay = TrackManager.getRandomTrack('builtin');
      } else if (selectedTrackId === 'random-custom') {
          tToPlay = TrackManager.getRandomTrack('custom');
      } else {
          tToPlay = TrackManager.getAllTracks().find(t => t.id === selectedTrackId) || null;
      }
      
      activeTrackRef.current = tToPlay;
      setTrackName(tToPlay ? tToPlay.name : '');
      setTrackArtist(tToPlay ? tToPlay.artist || '' : '');
      setTrackCoverArt(tToPlay ? tToPlay.coverArt || '' : '');

      // 1. Generate Nodes
      const { targets: tNodes } = LevelManager.generateLevelTargets(level);
      const uNodes = LevelManager.generateUserInitial(tNodes, level);
      
      setTargetNodes(tNodes);
      setUserNodes(uNodes);
      engine!.setTargetNodes(tNodes);
      engine!.setUserNodes(uNodes);
      engine!.setListenMode('user');
      setListenMode('user');
      setIsSettled(false);
      setScoreReport(null);

      if (tToPlay) {
          try {
             setIsLoadingAudio(true);
             // Stop old track and clear buffer immediately
             engine!.stop();
             engine!.buffer = null;
             
             const dec = await getTrackBuffer(tToPlay, engine!.ctx);
             engine!.setBuffer(dec);
             await engine!.play();
          } catch(e) {
             console.error("Failed to load track", e);
             alert("Failed to load audio: " + (e as Error).message + "\n\nIf you just created this file, it might be an empty 0-byte file. Please use the Upload button or drag a real audio file into the IDE.");
          } finally {
             setIsLoadingAudio(false);
          }
      }
    }
    init();

    return () => {
      engine!.stop();
    };
  }, [level, engine, selectedTrackId, retryTrigger]); // Re-init audio whenever track selection changes too

  useEffect(() => {
    if (!engine) return;
    let frameId: number;
    const syncState = () => {
      setIsPlaying(engine.isPlaying);
      frameId = requestAnimationFrame(syncState);
    };
    syncState();
    return () => cancelAnimationFrame(frameId);
  }, [engine]);

  const togglePlay = async () => {
    if (!engine) return;
    if (isPlaying) {
      engine.pause();
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent rapid toggling if the key is held down
      if (e.repeat) return;
      
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      if (isInputFocused) return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault(); // Prevent accidental default operations
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

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (isSettled && scoreReport && scoreReport.stars >= 1) {
          handleNext();
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listenMode, engine, userNodes, isSettled, scoreReport, onBack, targetNodes, level]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showFeedbackMessage) {
      timer = setTimeout(() => setShowFeedbackMessage(false), 4000);
    }
    return () => clearTimeout(timer);
  }, [showFeedbackMessage]);

  useEffect(() => {
    if (isSettled && scoreReport) {
      const duration = 1500;
      const startTime = performance.now();
      setDisplayScore(0);
      setDisplayStars(0);
      let rafId: number;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);

        setDisplayScore(Math.round(scoreReport.totalScore * easeOutQuart));

        // Light up stars sequentially
        if (scoreReport.stars > 0) {
           const timePerStar = duration / 4; // 1/4 of total time per star approx
           const expectedStars = Math.min(scoreReport.stars, Math.floor(elapsed / timePerStar));
           setDisplayStars(expectedStars);
        }

        if (progress < 1) {
          rafId = requestAnimationFrame(animate);
        } else {
          setDisplayScore(scoreReport.totalScore);
          setDisplayStars(scoreReport.stars);
        }
      };
      rafId = requestAnimationFrame(animate);

      return () => cancelAnimationFrame(rafId);
    } else {
      setDisplayScore(0);
      setDisplayStars(0);
    }
  }, [isSettled, scoreReport]);

  const handleUserNodesChange = (nodes: EQNodeData[]) => {
    if (!engine) return;
    setUserNodes(nodes);
    engine.setUserNodes(nodes);
  };

  const handleSubmit = () => {
    if (!engine || isScanning) return;
    setIsScanning(true);
    setScoreReport(null);
    setIsSettled(false);

    // Give visual animation time to complete before showing score details
    setTimeout(() => {
      setIsScanning(false);
      const report = calculateLevelScore(targetNodes, userNodes, level);
      setScoreReport(report);
      setIsSettled(true);
      setShowFeedbackMessage(true);
      handleModeChange('user');
    }, 1400);
  };

  const handleNext = () => {
    if (scoreReport !== null) {
      if (scoreReport.stars >= 1) { // 1 star is passing
        onLevelComplete(scoreReport.totalScore, scoreReport.stars);
      } else {
        onRetry(scoreReport.totalScore, scoreReport.stars);
        setRetryTrigger(r => r + 1);
      }
    }
  };

  if (!engine) {
     return <div className="h-full w-full bg-transparent"></div>;
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-transparent text-slate-50 font-sans">
      {/* Top Bar */}
      <header className="flex-none h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md relative z-[100]">
        <div className="flex items-center gap-4 flex-1">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition">
            ← Back
          </button>
          <div className="w-px h-6 bg-slate-800"></div>
          <h1 className="text-xl font-bold tracking-tight text-white/90">
            Level <span className="text-cyan-400">{level}</span>
          </h1>
          {onLevelChange && (
            <div className="flex items-center gap-2">
              <select 
                value={level}
                onChange={(e) => onLevelChange(parseInt(e.target.value))}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 outline-none focus:border-cyan-500 ml-2"
              >
                <option disabled>Test Level</option>
                {Array.from({ length: 100 }, (_, i) => i + 1).map(l => (
                  <option key={l} value={l}>Lvl {l}</option>
                ))}
              </select>
              <button 
                onClick={() => setShowTestModePanel(p => !p)}
                className={cn(
                  "p-1 rounded transition-colors border", 
                  showTestModePanel 
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50" 
                    : "bg-slate-800 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 border-slate-700"
                )}
                title="Toggle Debug Info"
              >
                <Bug className="w-4 h-4" />
              </button>
            </div>
          )}
          {!onLevelChange && (
            <span className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-400 ml-2 shadow-inner">
              {targetNodes.length} Band{targetNodes.length > 1 && 's'}
            </span>
          )}
        </div>

        <div className="flex-none flex items-center justify-center gap-3">
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

        <div className="flex flex-1 justify-end items-center">
          {!isSettled ? (
            <button 
              onClick={handleSubmit}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2 rounded-md shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
            >
              Submit Answer
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setShowScoreDetails(!showScoreDetails)}
                  className={cn(
                    "bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-md shadow-lg transition flex items-center gap-2 border",
                    showScoreDetails ? "border-cyan-500/50" : "border-slate-700/60"
                  )}
                >
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm">Score Report</span>
                </button>
                
                {/* Detailed Score Report */}
                <AnimatePresence>
                  {showScoreDetails && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      drag
                      dragMomentum={false}
                      className="absolute top-full mt-4 right-0 z-50 w-[300px] max-w-[calc(100vw-2rem)] bg-slate-900/95 border border-slate-700/60 rounded-xl p-4 backdrop-blur-md shadow-2xl overflow-y-auto max-h-[50vh] pointer-events-auto cursor-default [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                    >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        Score Report
                      </h3>
                      <button 
                        onClick={() => setShowScoreDetails(false)}
                        className="text-slate-400 hover:text-slate-200 transition-colors p-1 cursor-pointer"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-3 pointer-events-none">
                      {scoreReport!.nodeReports.map((r, i) => (
                          <div key={i} className="bg-slate-800/50 rounded-lg p-3 text-xs border border-slate-800">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-mono text-cyan-400 font-semibold">{Math.round(r.targetNode.freq)}Hz Target</span>
                                <span className={cn("font-bold px-1.5 py-0.5 rounded", r.isVetoed ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400")}>
                                  {r.isVetoed ? '0 pts (VETO)' : `${Math.round(r.baseScore)} pts`}
                                </span>
                              </div>
                              {r.isVetoed ? (
                                <div className="text-red-400/80 mb-1">{r.vetoReason}</div>
                              ) : (
                                <div className="text-slate-400 grid grid-cols-3 gap-1 mb-1 font-mono text-[10px]">
                                  <div>Sf: {Math.round(r.Sf)}</div>
                                  <div>Sg: {Math.round(r.Sg)}</div>
                                  <div>Sq: {Math.round(r.Sq)}</div>
                                </div>
                              )}
                              <div className="text-slate-500 mt-1.5 flex justify-between items-center pt-1.5 border-t border-slate-800/60">
                                <span>Weight: x{r.weight}</span>
                                {r.userNode && <span>User: {Math.round(r.userNode.freq)}Hz</span>}
                              </div>
                          </div>
                      ))}
                      <div className="pt-3 border-t border-slate-700 font-bold flex justify-between items-center text-sm">
                          <span className="text-slate-300">Weighted Total</span>
                          <span className={cn(
                            "text-lg",
                            scoreReport!.stars >= 1 ? "text-emerald-400" : "text-amber-400"
                          )}>{displayScore}</span>
                      </div>
                    </div>
                  </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-md">
                <span className="text-slate-400 text-sm">Match:</span>
                <span className={cn(
                  "font-mono font-bold text-lg",
                  scoreReport!.stars >= 1 ? "text-emerald-400" : "text-red-400"
                )}>{displayScore}</span>
                <div className="flex">
                  {[1, 2, 3].map(i => (
                    <motion.svg 
                      key={i} 
                      className={cn("w-4 h-4", i <= displayStars ? "text-amber-400" : "text-slate-600")} 
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: i <= displayStars ? 1.2 : 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 10 }}
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </motion.svg>
                  ))}
                </div>
              </div>
              <button 
                onClick={handleNext}
                className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-6 py-2 rounded-md shadow-lg transition flex items-center gap-2"
              >
                {scoreReport!.stars >= 1 ? 'Next Level' : 'Retry'}
                {scoreReport!.stars >= 1 ? <FastForward className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 min-h-0 p-4 md:p-6 relative flex flex-col gap-4">
          <div className="flex flex-col relative w-full items-center shrink-0">
              <div className="w-full relative">
                  <WaveformPlayer engine={engine} isLoadingTrack={isLoadingAudio} trackName={trackName} trackArtist={trackArtist} trackCoverArt={trackCoverArt} />
              </div>
          </div>
          
          {/* Settled Feedback Overlay */}
          <AnimatePresence>
            {isSettled && showFeedbackMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute -top-6 md:-top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
              >
                  <div className="bg-slate-900/90 border border-slate-700 px-6 py-3 rounded-full backdrop-blur-md flex items-center gap-3 shadow-2xl">
                    {scoreReport!.stars >= 1 ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <RotateCcw className="w-5 h-5 text-rose-400" />}
                    <span className="font-medium text-slate-200">
                        {scoreReport!.stars >= 1 ? "Good job! Review the curves below." : "Not quite. Check the difference."}
                    </span>
                  </div>
              </motion.div>
            )}
          </AnimatePresence>

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
            
            <div className="flex-1 min-h-0 relative flex">
                <div className="flex-1 min-w-0 min-h-0 relative">
                    <EQCanvas 
                        engine={engine}
                        userNodes={userNodes}
                        targetNodes={targetNodes}
                        onNodesChange={handleUserNodesChange}
                        showTarget={isSettled || isScanning}
                        isScanning={isScanning}
                        listenMode={listenMode}
                        onListenModeChange={handleModeChange}
                        showGainHint={config.showGainHint}
                        gainRange={config.gainRange}
                    />
                </div>
                <LevelMeter engine={engine} isVisible={showMeter} className="w-12 border-l border-slate-800/60 bg-slate-900/40" />
            </div>
            
            {/* Band Controls */}
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
                  title="Global Bypass (Z)"
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
                              ? "" // Colors applied via style
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

              <div className="flex items-center shrink-0 border-l border-slate-800/60 pl-4">
                 <button
                   onClick={() => setShowMeter(m => !m)}
                   title="Toggle Level Meter"
                   className={cn(
                     "p-2 rounded-md transition-colors",
                     showMeter ? "bg-slate-800 text-emerald-400" : "bg-slate-900/50 text-slate-500 hover:text-slate-300"
                   )}
                 >
                   <Activity className="w-5 h-5" />
                 </button>
              </div>
            </div>
          </div>
          
          {onLevelChange && showTestModePanel && (
            <div className="absolute top-16 left-4 z-[100] bg-slate-900 border border-slate-700 shadow-2xl p-4 rounded-xl mt-4 shrink-0 overflow-x-auto min-w-[500px]">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <h3 className="text-cyan-400 font-bold text-sm">Test Mode: Level {level} Output</h3>
                <button 
                  onClick={() => setShowTestModePanel(false)}
                  className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono text-slate-300 mb-4 whitespace-nowrap">
                <div>Nodes: <span className="text-emerald-400">{config.nodeDistribution.stereo + config.nodeDistribution.mid + config.nodeDistribution.side}</span></div>
                <div>Gain: <span className="text-amber-400">±{config.gainRange[0]}~{config.gainRange[1]}dB</span></div>
                <div>Q Range: <span className="text-violet-400">{config.qRange[0]}~{config.qRange[1]}</span></div>
                <div>Hint: <span className={config.showGainHint ? "text-emerald-400" : "text-rose-400"}>{config.showGainHint ? 'Y' : 'N'}</span> | Limit: <span className={config.constrainBounds ? "text-emerald-400" : "text-rose-400"}>{config.constrainBounds ? 'Y' : 'N'}</span></div>
              </div>
              <table className="w-full text-left text-xs whitespace-nowrap bg-slate-950/50 rounded-lg overflow-hidden">
                 <thead className="text-slate-500 uppercase tracking-wider">
                    <tr>
                       <th className="px-3 py-2 font-medium">Band</th>
                       <th className="px-3 py-2 font-medium">Type</th>
                       <th className="px-3 py-2 font-medium">Mode</th>
                       <th className="px-3 py-2 font-medium">Freq (Hz)</th>
                       <th className="px-3 py-2 font-medium">Gain (dB)</th>
                       <th className="px-3 py-2 font-medium">Q-Factor</th>
                    </tr>
                 </thead>
                 <tbody className="text-slate-300 font-mono">
                    {targetNodes.map((n, i) => (
                       <tr key={n.id} className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-3 py-2 text-slate-500">#{i + 1}</td>
                          <td className="px-3 py-2 text-indigo-300">{n.type}</td>
                          <td className="px-3 py-2 text-sky-300">{n.stereoMode}</td>
                          <td className="px-3 py-2 text-amber-300">{n.freq.toFixed(0)}</td>
                          <td className="px-3 py-2 text-emerald-300">{(n.gain > 0 ? '+' : '')}{n.gain.toFixed(2)}</td>
                          <td className="px-3 py-2 text-violet-300">{n.q.toFixed(2)}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
            </div>
          )}
      </main>
    </div>
  );
}
