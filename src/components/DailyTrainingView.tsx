import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Play, Square, Volume2, Ear, FastForward, RotateCcw, CheckCircle2, Power, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../lib/LanguageContext';
import { EQCanvas, DailyTrainingBand, BAND_COLORS } from './EQCanvas';
import { AudioEngine } from '../lib/AudioEngine';
import { TrackManager, Track } from '../lib/TrackManager';
import { WaveformPlayer } from './WaveformPlayer';
import { LevelMeter } from './LevelMeter';
import { EQNodeData, cn } from '../lib/utils';
import { LevelManager } from '../lib/LevelManager';
import { CalibrationManager } from '../lib/CalibrationManager';

interface DailyTrainingViewProps {
  onBack: () => void;
  selectedTrackId?: string;
  selectedRandomTags?: string[];
}

const BANDS: DailyTrainingBand[] = [
  { id: 'BA', label: '50-100Hz', startFreq: 50, endFreq: 100, color: 'rgba(34,197,94,1)' },
  { id: 'AB', label: '100-200Hz', startFreq: 100, endFreq: 200, color: 'rgba(59,130,246,1)' },
  { id: 'AA', label: '200-500Hz', startFreq: 200, endFreq: 500, color: 'rgba(168,85,247,1)' },
  { id: 'BD', label: '500-1000Hz', startFreq: 500, endFreq: 1000, color: 'rgba(236,72,153,1)' },
  { id: 'BB', label: '1000-2000Hz', startFreq: 1000, endFreq: 2000, color: 'rgba(239,68,68,1)' },
  { id: 'AC', label: '2000-3000Hz', startFreq: 2000, endFreq: 3000, color: 'rgba(249,115,22,1)' },
  { id: 'AE', label: '3000-4000Hz', startFreq: 3000, endFreq: 4000, color: 'rgba(234,179,8,1)' },
  { id: 'AD', label: '4000-6000Hz', startFreq: 4000, endFreq: 6000, color: 'rgba(6,182,212,1)' },
  { id: 'BC', label: '6000-8000Hz', startFreq: 6000, endFreq: 8000, color: 'rgba(34,197,94,1)' },
  { id: 'CA', label: '8k-10kHz', startFreq: 8000, endFreq: 10000, color: 'rgba(59,130,246,1)' },
  { id: 'CB', label: '10k-16kHz', startFreq: 10000, endFreq: 16000, color: 'rgba(168,85,247,1)' },
];

export const DailyTrainingView: React.FC<DailyTrainingViewProps> = ({ 
  onBack,
  selectedTrackId = 'random-builtin',
  selectedRandomTags = []
}) => {
  const { t } = useLanguage();
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [listenMode, setListenMode] = useState<'target' | 'user'>('user');
  const [targetBands, setTargetBands] = useState<DailyTrainingBand[]>([]);
  const [targetNodes, setTargetNodes] = useState<EQNodeData[]>([]);
  const [userNodes, setUserNodes] = useState<EQNodeData[]>([]);
  const [selectedBandIds, setSelectedBandIds] = useState<string[]>([]);
  const [currentRound, setCurrentRound] = useState(() => {
    const saved = localStorage.getItem('daily_training_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            const today = new Date().toLocaleDateString();
            if (parsed.date === today && typeof parsed.round === 'number') {
                return parsed.round;
            }
        } catch (e) {
            // ignore
        }
    }
    // Backward compatibility with previous version
    const legacySaved = localStorage.getItem('daily_training_round');
    if (legacySaved) {
        localStorage.removeItem('daily_training_round');
    }
    return 1;
  });
  const [isSettled, setIsSettled] = useState(false);
  
  useEffect(() => {
    const today = new Date().toLocaleDateString();
    localStorage.setItem('daily_training_state', JSON.stringify({ date: today, round: currentRound }));
  }, [currentRound]);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [heartState, setHeartState] = useState<'red' | 'yellow' | 'empty'>('red');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [isToastVisible, setIsToastVisible] = useState(false);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const clearFeedbackTimeout = () => {
      if (feedbackTimeoutRef.current) {
          window.clearTimeout(feedbackTimeoutRef.current);
          feedbackTimeoutRef.current = null;
      }
  };

  const showToast = (msg: string | null = null, duration: number = 3000) => {
      clearFeedbackTimeout();
      if (msg) setFeedbackMsg(msg);
      setIsToastVisible(true);
      feedbackTimeoutRef.current = window.setTimeout(() => {
          setIsToastVisible(false);
          setFeedbackMsg(null);
      }, duration);
  };

  const [trackName, setTrackName] = useState<string>('');
  const [trackArtist, setTrackArtist] = useState<string>('');
  const [trackCoverArt, setTrackCoverArt] = useState<string>('');
  const [trackTags, setTrackTags] = useState<string[]>([]);

  const initRound = async (eng: AudioEngine, roundNum: number) => {
    clearFeedbackTimeout();
    setIsToastVisible(false);
    setIsSettled(false);
    setSelectedBandIds([]);
    setIsCorrect(false);
    setHeartState('red');
    setFeedbackMsg(null);
    setListenMode('user');
    eng.setListenMode('user');

    const numNodes = roundNum <= 3 ? 1 : 2;
    
    // Select unique bands
    let availableBands = [...BANDS];
    let selectedBandsForTargets: DailyTrainingBand[] = [];
    for (let i = 0; i < numNodes; i++) {
        const idx = Math.floor(Math.random() * availableBands.length);
        selectedBandsForTargets.push(availableBands[idx]);
        availableBands.splice(idx, 1);
    }
    
    const newTargetNodes: EQNodeData[] = selectedBandsForTargets.map((band, idx) => {
        const logStart = Math.log10(band.startFreq);
        const logEnd = Math.log10(band.endFreq);
        const logRange = logEnd - logStart;
        const safeLogFreq = logStart + logRange * (0.2 + Math.random() * 0.6);
        const freq = Math.round(Math.pow(10, safeLogFreq));
        
        let gain, q;
        if (roundNum <= 3) {
            const gainAbs = 6 + Math.random() * 3;
            gain = Math.random() > 0.5 ? gainAbs : -gainAbs;
            q = 2 + Math.random() * 1;
        } else {
            const gainAbs = 3 + Math.random() * 3;
            gain = Math.random() > 0.5 ? gainAbs : -gainAbs;
            q = 1 + Math.random() * 2;
        }
        
        return {
            id: `target-${idx}`,
            freq,
            gain,
            q,
            type: 'peaking',
            enabled: true
        };
    });

    setTargetBands(selectedBandsForTargets);
    setTargetNodes(newTargetNodes);
    setUserNodes([]);

    eng.setTargetNodes(newTargetNodes);
    eng.setUserNodes([]);

    let tToPlay = null;
    if (selectedTrackId === 'random') {
        tToPlay = TrackManager.getRandomTrack('all');
    } else if (selectedTrackId === 'random-builtin') {
        tToPlay = TrackManager.getRandomTrack('builtin');
    } else if (selectedTrackId === 'random-custom') {
        tToPlay = TrackManager.getRandomTrack('custom', selectedRandomTags);
    } else {
        tToPlay = TrackManager.getAllTracks().find(t => t.id === selectedTrackId) || null;
    }
    
    if (tToPlay) {
      setTrackName(tToPlay.name);
      setTrackArtist(tToPlay.artist || '');
      setTrackCoverArt(tToPlay.coverArt || '');
      setTrackTags(tToPlay.tags || []);
      try {
        setIsLoadingAudio(true);
        eng.stop();
        eng.buffer = null;
        let arrayBuffer;
        if (tToPlay.file) {
          arrayBuffer = await tToPlay.file.arrayBuffer();
        } else if (tToPlay.url) {
          const res = await fetch(tToPlay.url);
          arrayBuffer = await res.arrayBuffer();
        }
        if (arrayBuffer) {
          const dec = await eng.ctx.decodeAudioData(arrayBuffer);
          eng.setBuffer(dec);
          eng.play();
        }
      } catch (e) {
        console.error("Failed to load track", e);
      } finally {
        setIsLoadingAudio(false);
      }
    }
  };

  useEffect(() => {
    const audioEng = new AudioEngine();
    const activePreset = CalibrationManager.getActivePreset();
    if (activePreset) {
      audioEng.setCalibrationNodes(activePreset.nodes);
      if (activePreset.globalGain !== undefined) audioEng.setCalibrationGain(activePreset.globalGain);
    }
    setEngine(audioEng);
    initRound(audioEng, currentRound);
    return () => {
      clearFeedbackTimeout();
      audioEng.dispose();
    };
  }, []);

  const handleBandSelect = (bandId: string) => {
    if (isSettled) return;
    const numNodes = currentRound <= 3 ? 1 : 2;
    setSelectedBandIds(prev => {
        if (prev.includes(bandId)) {
            return prev.filter(id => id !== bandId);
        } else {
            if (prev.length >= numNodes) {
                if (numNodes === 1) {
                    return [bandId];
                } else {
                    const targetIndex = BANDS.findIndex(b => b.id === bandId);
                    let minDistance = Infinity;
                    let replaceIdx = 0;
                    
                    prev.forEach((existingId, idx) => {
                        const exIdx = BANDS.findIndex(b => b.id === existingId);
                        const dist = Math.abs(exIdx - targetIndex);
                        if (dist < minDistance) {
                            minDistance = dist;
                            replaceIdx = idx;
                        }
                    });
                    
                    const newBands = [...prev];
                    newBands[replaceIdx] = bandId;
                    return newBands;
                }
            } else {
                return [...prev, bandId];
            }
        }
    });
  };

  const handleUserNodesChange = (newNodes: EQNodeData[]) => {
    setUserNodes(newNodes);
    if (engine) engine.setUserNodes(newNodes);
  };

  const handleModeChange = (mode: 'target' | 'user') => {
    if (!engine) return;
    engine.setListenMode(mode);
    setListenMode(mode);
  };

  const handleSubmit = () => {
    const numNodes = currentRound <= 3 ? 1 : 2;
    if (selectedBandIds.length !== numNodes || targetBands.length === 0 || isSettled || isScanning) return;
    
    const targetIndices = targetBands.map(b => BANDS.findIndex(fb => fb.id === b.id)).sort((a, b) => a - b);
    const selectedIndices = selectedBandIds.map(id => BANDS.findIndex(b => b.id === id)).sort((a, b) => a - b);
    
    // Find best matching of differences
    let diffs = [];
    if (numNodes === 1) {
        diffs = [Math.abs(targetIndices[0] - selectedIndices[0])];
    } else {
        const diff1 = [
            Math.abs(targetIndices[0] - selectedIndices[0]),
            Math.abs(targetIndices[1] - selectedIndices[1])
        ];
        const diff2 = [
            Math.abs(targetIndices[0] - selectedIndices[1]),
            Math.abs(targetIndices[1] - selectedIndices[0])
        ];
        const sum1 = diff1[0] + diff1[1];
        const sum2 = diff2[0] + diff2[1];
        diffs = sum1 <= sum2 ? diff1 : diff2;
    }
    
    const isExactMatch = diffs.every(d => d === 0);
    
    if (!isExactMatch && heartState === 'red') {
        setHeartState('yellow');
        
        let msg = "不太准确，请再试一次。";
        if (numNodes === 1) {
            if (diffs[0] === 1) msg = "很接近了，仅相差一个频段！再听一次。";
        } else {
            const hasExact = diffs.some(d => d === 0);
            const hasClose = diffs.some(d => d === 1);
            const allCloseOrExact = diffs.every(d => d <= 1);
            
            if (hasExact && hasClose) msg = "一个完全正确，另一个仅相差一个频段！";
            else if (hasExact) msg = "有一个频段完全正确，但另一个不太准确！";
            else if (allCloseOrExact) msg = "两个频段都很接近，请再精细感受一下！";
            else if (hasClose) msg = "有一个频段很接近了，但另一个相距较远。";
            else msg = "两个频段都不太准确，请再仔细听听。";
        }
        
        showToast(msg, 3000);
        // Do not clear selectedBandIds so user can adjust
    } else {
        setIsScanning(true);
        setIsToastVisible(false);
        setFeedbackMsg(null);
        
        setTimeout(() => {
            setIsScanning(false);
            if (isExactMatch) {
                setIsCorrect(true);
            } else {
                setHeartState('empty');
                setIsCorrect(false);
            }
            setIsSettled(true);
            showToast(null, 3000);
            handleModeChange('user');
            
            if (currentRound === 5) {
               import('../lib/PlayerProfileManager').then(m => {
                   m.PlayerProfileManager.recordDailyTraining();
                   
                   // Sync to Firebase
                   import('../lib/FirebaseService').then(f => {
                       const stats = m.PlayerProfileManager.loadStats();
                       import('../lib/ProgressionManager').then(root_p => {
                           const records = root_p.ProgressionManager.getRecords();
                           import('../lib/CalibrationManager').then(c => {
                               const presets = c.CalibrationManager.getPresets();
                               f.FirebaseService.syncUserData(stats, records, presets).catch(e => console.error("Sync failed:", e));
                           });
                       });
                   });
               });
            }
        }, 1500);
    }
  };

  const handleNext = () => {
    if (engine) {
       const nextRound = currentRound >= 5 ? 5 : currentRound + 1;
       setCurrentRound(nextRound);
       initRound(engine, nextRound);
    }
  };

  const selectedBandIdsRef = useRef(selectedBandIds);
  useEffect(() => { selectedBandIdsRef.current = selectedBandIds; }, [selectedBandIds]);

  const currentRoundRef = useRef(currentRound);
  useEffect(() => { currentRoundRef.current = currentRound; }, [currentRound]);

  const isSettledRef = useRef(isSettled);
  useEffect(() => { isSettledRef.current = isSettled; }, [isSettled]);

  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => { handleSubmitRef.current = handleSubmit; }, [handleSubmit]);

  const handleNextRef = useRef(handleNext);
  useEffect(() => { handleNextRef.current = handleNext; }, [handleNext]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent rapid toggling if the key is held down
      if (e.repeat) return;
      
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      if (isInputFocused) return;

      if (e.key === 'Enter') {
          e.preventDefault();
          if (isSettledRef.current) {
              handleNextRef.current();
          } else {
              const numNodes = currentRoundRef.current <= 3 ? 1 : 2;
              if (selectedBandIdsRef.current.length === numNodes) {
                  handleSubmitRef.current();
              }
          }
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault(); // Prevent accidental default operations
        setListenMode(prevMode => {
          const newMode = prevMode === 'target' ? 'user' : 'target';
          if (engine) engine.setListenMode(newMode);
          return newMode;
        });
      }

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        setUserNodes(prev => {
          const isAllBypassed = prev.every(n => n.enabled === false);
          const newNodes = prev.map(n => ({ ...n, enabled: isAllBypassed }));
          if (engine) engine.setUserNodes(newNodes);
          return newNodes;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine]);

  const targetNodesArr = targetNodes;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-50 font-sans">
      {/* Top Bar */}
      <header className="flex-none h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md relative z-[100]">
        <div className="flex items-center gap-4 flex-1">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition">
            ← Back
          </button>
          <div className="w-px h-6 bg-slate-800"></div>
          <h1 className="text-xl font-bold tracking-tight text-white/90">
            每日训练 (第 {currentRound}/5 关)
          </h1>
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
                Target EQ
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
          {!isSettled && (
             <div className="flex items-center gap-1.5 mr-2">
                <span className="text-sm font-medium text-slate-400 mr-2">
                  Target: {currentRound <= 3 ? 1 : 2} Band{currentRound > 3 ? 's' : ''}
                </span>
                {heartState !== 'empty' && (
                  <Heart className={cn("w-5 h-5 transition-colors", heartState === 'red' ? "fill-rose-500 text-rose-500" : "fill-amber-400 text-amber-400")} />
                )}
             </div>
          )}
          {!isSettled ? (
            <button 
              onClick={handleSubmit}
              disabled={selectedBandIds.length !== (currentRound <= 3 ? 1 : 2)}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold px-6 py-2 rounded-md shadow-lg shadow-emerald-500/20 transition flex items-center gap-2"
            >
              提交
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <span className={cn(
                "font-bold px-4 py-2 rounded",
                isCorrect ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
              )}>
                {isCorrect ? "Correct!" : "Incorrect"}
              </span>
              <button 
                onClick={handleNext}
                className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-6 py-2 rounded-md shadow-lg transition flex items-center gap-2"
              >
                {currentRound >= 5 ? "再次挑战第五关" : "Next Round"}
                <FastForward className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 p-4 md:p-6 relative flex flex-col gap-4">
        {engine && (
           <div className="flex flex-col relative w-full items-center shrink-0">
             <div className="w-full relative">
               <WaveformPlayer 
                 engine={engine} 
                 isLoadingTrack={isLoadingAudio} 
                 trackName={trackName} 
                 trackArtist={trackArtist} 
                 trackCoverArt={trackCoverArt} 
                 trackTags={trackTags} 
               />
             </div>
           </div>
        )}

        <div className="flex-1 min-h-0 relative flex flex-col">
          {/* Canvas Wrapper */}
          <div className="flex-1 min-h-0 relative rounded-xl border border-slate-800 shadow-2xl bg-[#14161a]/80 backdrop-blur-md flex flex-col overflow-hidden">
            
            <AnimatePresence>
              {isToastVisible && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                >
                    <div className="bg-slate-900/90 border border-slate-700 px-6 py-3 rounded-full backdrop-blur-md flex items-center gap-3 shadow-2xl">
                      {isSettled ? (
                         isCorrect ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <RotateCcw className="w-5 h-5 text-rose-400" />
                      ) : (
                         <span className="text-amber-400 text-lg">💡</span>
                      )}
                      <span className="font-medium text-slate-200">
                          {isSettled ? (isCorrect ? "Spot on!" : `The target was ${targetBands.map(b => b.label).join(' and ')}`) : feedbackMsg}
                      </span>
                    </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute top-4 left-4 z-10 text-xs text-slate-500 font-mono flex flex-col gap-1 pointer-events-none">
              {!isSettled ? (
                <>
                  <div>Click a frequency band that you think was modified.</div>
                  {selectedBandIds.length > 0 && <div>Selected: {selectedBandIds.map(id => BANDS.find(b => b.id === id)?.label).join(', ')}</div>}
                </>
              ) : (
                <>
                  <div>Review the answer. You can freely add/adjust nodes to practice.</div>
                  <div>Drag: Frequency & Gain</div>
                  <div>Alt + Drag: Q factor (Width)</div>
                  <div>B: Bypass Selected Node</div>
                  <div>Z: Toggle Global Bypass</div>
                </>
              )}
            </div>

            <div className="flex-1 min-h-0 relative flex">
              <div className="flex-1 min-h-0 min-w-0 relative">
                {engine && (
                  <EQCanvas 
                    engine={engine}
                    userNodes={isSettled ? userNodes : []} 
                    targetNodes={targetNodesArr}
                    onNodesChange={handleUserNodesChange}
                    listenMode={listenMode}
                    onListenModeChange={handleModeChange}
                    allowAddRemoveNodes={isSettled}
                    maxNodes={targetNodesArr.length}
                    showTarget={isSettled || isScanning}
                    isScanning={isScanning}
                    dailyTrainingBands={isSettled ? undefined : BANDS}
                    selectedDailyTrainingBandIds={selectedBandIds}
                    onDailyTrainingBandSelect={handleBandSelect}
                  />
                )}
              </div>
              {engine && (
                <LevelMeter engine={engine} isVisible={true} className="w-12 border-l border-slate-800/60 bg-slate-900/40" />
              )}
            </div>
            
            {/* Minimal controls below map */}
            <div className="h-16 shrink-0 px-4 border-t border-slate-800/60 bg-slate-900/40 flex items-center justify-start gap-4 overflow-x-auto">
              {!isSettled ? (
                 <div className="w-full text-center">
                   <span className="text-sm font-medium text-slate-400">
                     {selectedBandIds.length > 0 ? `Selected: ${selectedBandIds.map(id => BANDS.find(b => b.id === id)?.label).join(', ')}` : "Select a band above"}
                   </span>
                 </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const allBypassed = userNodes.every(n => n.enabled === false);
                      const newNodes = userNodes.map(n => ({ ...n, enabled: allBypassed }));
                      handleUserNodesChange(newNodes);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md border transition shrink-0 text-sm",
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
                  {userNodes.length === 0 && (
                     <div className="text-sm font-medium text-slate-500 italic">Double click anywhere on EQ to add a band</div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

