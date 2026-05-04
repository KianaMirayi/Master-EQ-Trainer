import React, { useState, useEffect, useRef } from 'react';
import { GameView } from './components/GameView';
import { Headphones, Trophy, BarChart2, FolderDown, Lock, Music, Upload, Settings, X, Trash2, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { EQNodeData, cn } from './lib/utils';
import { TrackManager } from './lib/TrackManager';
import { ProgressionManager, LevelRecord } from './lib/ProgressionManager';

import { CalibrationSettings } from './components/CalibrationEditor';

interface LevelScore {
  level: number;
  score: number;
}

export default function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'game' | 'calibration'>('dashboard');
  const [activeLevel, setActiveLevel] = useState<number>(1);
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [records, setRecords] = useState<Record<number, LevelRecord>>({});
  const [tracks, setTracks] = useState({ builtIn: TrackManager.getBuiltInTracks(), custom: TrackManager.getCustomTracks() });
  const [selectedTrackId, setSelectedTrackId] = useState<string>('random-builtin');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'audio'>('main');

  // Load from local storage and initialize indexedDB
  useEffect(() => {
    TrackManager.init().then(() => {
      setTracks({ builtIn: TrackManager.getBuiltInTracks(), custom: TrackManager.getCustomTracks() });
    });
    setRecords(ProgressionManager.getRecords());
  }, []);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>, droppedFiles?: FileList) => {
    let files = droppedFiles || ('files' in e.target ? (e.target as HTMLInputElement).files : null);
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let lastTrack = null;
    let addedCount = 0;
    
    try {
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit per file

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (!file.type.startsWith('audio/')) {
          alert(`Skipped "${file.name}": Not a recognized audio file.`);
          continue;
        }
        
        if (file.size > MAX_FILE_SIZE) {
          alert(`Skipped "${file.name}": File is too large. Please upload files under 50MB.`);
          continue;
        }

        try {
          lastTrack = await TrackManager.addCustomTrack(file);
          addedCount++;
        } catch (err: any) {
          if (err.name === 'QuotaExceededError') {
             alert('Browser storage is full! Please delete some custom tracks before uploading more.');
             break;
          }
          throw err;
        }
      }
      
      if (addedCount > 0) {
        setTracks({ builtIn: TrackManager.getBuiltInTracks(), custom: TrackManager.getCustomTracks() });
        if (lastTrack) setSelectedTrackId(lastTrack.id);
      }
    } catch (err) {
      console.error('Failed to load track', err);
      alert('Failed to load audio file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAudioUpload(e, e.dataTransfer.files);
    }
  };

  const handleDeleteCustomTrack = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await TrackManager.deleteCustomTrack(id);
    const newCustomTracks = TrackManager.getCustomTracks();
    setTracks({ builtIn: TrackManager.getBuiltInTracks(), custom: newCustomTracks });
    if (selectedTrackId === id) {
        setSelectedTrackId('random-builtin');
    } else if (selectedTrackId === 'random-custom' && newCustomTracks.length === 0) {
        setSelectedTrackId('random-builtin');
    }
  };

  // Save to local storage
  const saveScore = (level: number, score: number, stars: number) => {
    ProgressionManager.saveRecord(level, score, stars);
    setRecords(ProgressionManager.getRecords());
  };

  const passedLevels = Object.keys(records).map(Number).filter((l) => records[l].passed);
  const highestUnlocked = Math.max(1, ...passedLevels.map((l) => l + 1));
  const masteryScore = Object.values(records).reduce((sum: number, r: any) => sum + (r.score || 0), 0);

  const handleLevelSelect = (level: number, testMode: boolean = false) => {
    if (!testMode) {
      const check = ProgressionManager.checkEnterLevel(level) as any;
      if (!check.allowed) {
        if (check.reason === 'STAR_GATE_LOCKED') {
          alert(`${check.message}\n建议优先挑战拿星较少的关卡以提高整体星数：第 ${check.suggestedReviewLevels?.join(', ') || '前几'} 关`);
        } else {
          alert(check.message || check.reason);
        }
        return;
      }
    }
    
    setIsTestMode(testMode);
    setActiveLevel(level);
    setCurrentView('game');
  };

  const handleLevelComplete = (score: number, stars: number) => {
    saveScore(activeLevel, score, stars);
    
    const nextLevel = activeLevel + 1;
    if (ProgressionManager.checkEnterLevel(nextLevel).allowed) {
      setActiveLevel(nextLevel);
    } else {
      setCurrentView('dashboard');
    }
  };

  if (currentView === 'game') {
    return (
      <GameView 
        level={activeLevel} 
        selectedTrackId={selectedTrackId} 
        onLevelComplete={handleLevelComplete} 
        onRetry={(score, stars) => saveScore(activeLevel, score, stars)}
        onBack={() => {
           setIsTestMode(false);
           setCurrentView('dashboard');
        }}
        onLevelChange={isTestMode ? (lvl) => setActiveLevel(lvl) : undefined}
      />
    );
  }

  if (currentView === 'calibration') {
    return <CalibrationSettings onBack={() => setCurrentView('dashboard')} />;
  }

  // Dashboard View
  const levelsParams = Array.from({ length: 20 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30">
      <input 
        type="file" 
        multiple
        accept="audio/mp3, audio/mpeg, audio/wav, audio/ogg, audio/aac, audio/flac, audio/x-m4a, audio/webm" 
        ref={fileInputRef} 
        onChange={handleAudioUpload} 
        className="hidden" 
      />
      <div className="max-w-6xl mx-auto p-6 md:p-12">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                <Headphones className="w-6 h-6 text-slate-900" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">EQ Web Trainer</h1>
            </div>
            <p className="text-slate-400 max-w-md">
              Train your ears to recognize frequency bands and EQ matching. 
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl">
              <div className="px-4 py-2 flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Mastery</span>
                <span className="text-xl font-mono font-bold text-cyan-400">{masteryScore}</span>
              </div>
              <div className="w-px h-8 bg-slate-800"></div>
              <div className="px-4 py-2 flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Global Rank</span>
                <span className="text-xl font-mono font-bold text-emerald-400">Top 5%</span> 
              </div>
            </div>
            
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition shadow-sm"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <section className="mb-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Journey
              </h2>
              
              <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-1.5 rounded-lg">
                <span className="text-sm text-slate-400 pl-2">Test Environment:</span>
                <select 
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-md px-2 py-1 outline-none focus:border-cyan-500"
                  onChange={(e) => {
                     const lvl = parseInt(e.target.value);
                     if (!isNaN(lvl)) {
                        handleLevelSelect(lvl, true);
                     }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Select Core Level (1-100)...</option>
                  {Array.from({ length: 100 }, (_, i) => i + 1).map(l => (
                     <option key={l} value={l}>Level {l}</option>
                  ))}
                </select>
              </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-4">
            {levelsParams.map(level => {
              const check = ProgressionManager.checkEnterLevel(level);
              const isUnlocked = check.allowed;
              const record = records[level];
              const isPassed = record?.passed;
              const isBoss = ProgressionManager.isBossLevel(level);
              
              return (
                <button
                  key={level}
                  disabled={!isUnlocked}
                  onClick={() => handleLevelSelect(level)}
                  className={cn(
                    "relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-300",
                    isUnlocked 
                      ? "bg-slate-900 hover:bg-slate-800 hover:-translate-y-1 shadow-lg border border-slate-700/50 cursor-pointer" 
                      : "bg-slate-900/40 border border-slate-800/50 opacity-60 cursor-not-allowed",
                    isPassed && "border-emerald-500/30 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
                    isBoss && "ring-2 ring-amber-500/50"
                  )}
                  title={!isUnlocked && !isPassed ? (check as any).message || (check as any).reason : ""}
                >
                  {isUnlocked ? (
                    <span className={cn(
                      "text-2xl font-bold font-mono tracking-tighter",
                      isPassed ? "text-emerald-400" : (isBoss ? "text-amber-400" : "text-slate-200")
                    )}>{level}</span>
                  ) : (
                    <Lock className="w-6 h-6 text-slate-600 mb-1" />
                  )}
                  
                  {isUnlocked && (
                    <div className="mt-0 flex flex-col items-center gap-1">
                      {record !== undefined ? (
                        <>
                          <div className={cn("text-[10px] font-bold", isPassed ? "text-emerald-500" : "text-amber-500")}>
                            {record.score} pts
                          </div>
                          <div className="flex items-center justify-center gap-0.5">
                            {[1, 2, 3].map(i => (
                              <svg key={i} className={cn("w-2.5 h-2.5", i <= record.stars ? "text-amber-400" : "text-slate-700")} fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                              </svg>
                            ))}
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] font-medium tracking-widest text-slate-500 uppercase mt-1">NEW</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-6">Unlockables</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex items-start gap-4 transition hover:bg-slate-900">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <BarChart2 className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-medium text-slate-200 mb-1">Advanced Stats</h3>
                <p className="text-sm text-slate-400 mb-3">Identify frequency zones where you tend to misjudge.</p>
                <div className="text-xs font-bold text-indigo-500 tracking-wider">UNLOCKS AT LVL 10</div>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-emerald-500/30 rounded-2xl p-6 flex items-start gap-4 transition shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <FolderDown className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-medium text-slate-200 mb-1">Import Audio</h3>
                <p className="text-sm text-slate-400 mb-3">Upload your own stems and reference tracks to train on.</p>
                <div className="text-xs font-bold text-emerald-400 tracking-wider flex items-center gap-2">
                  <span>UNLOCKED (DEV MODE)</span>
                  <span className="text-slate-500 line-through">LVL 20</span>
                </div>
              </div>
            </div>
            
          </div>
        </section>

      </div>

      {/* Settings Side Panel */}
      <div 
        className={cn(
          "fixed inset-0 z-50 flex justify-end transition-opacity duration-300",
          isSettingsOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" 
          onClick={() => setIsSettingsOpen(false)} 
        />
        
        {/* Panel */}
        <div 
          className={cn(
            "relative w-full max-w-sm bg-slate-900 border-l border-slate-800 h-full shadow-2xl flex flex-col transition-transform duration-300",
            isSettingsOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-800">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {settingsView === 'main' ? (
                <>
                  <Settings className="w-5 h-5 text-cyan-400"/>
                  Settings
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setSettingsView('main')} 
                    className="text-slate-400 hover:text-slate-200 transition -ml-2 p-1.5 rounded-lg hover:bg-slate-800"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <Music className="w-5 h-5 text-cyan-400 ml-1"/>
                  Audio Source
                </>
              )}
            </h2>
            <button onClick={() => { setIsSettingsOpen(false); setTimeout(() => setSettingsView('main'), 300); }} className="text-slate-400 hover:text-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto">
            {settingsView === 'main' ? (
              <div className="space-y-3">
                <button 
                  onClick={() => setSettingsView('audio')}
                  className="w-full flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                      <Music className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-200">Audio Source</h3>
                      <p className="text-sm text-slate-400 mt-0.5">Manage tracks and playback mode</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </button>

                <button 
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setCurrentView('calibration');
                  }}
                  className="w-full flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-colors">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-200">Headphone Calibration</h3>
                      <p className="text-sm text-slate-400 mt-0.5">Counteract headphone coloration with global EQ profiles</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Random Playback Mode</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => setSelectedTrackId('random')}
                      className={cn("px-4 py-2.5 rounded-lg border text-sm text-left transition-colors flex items-center gap-2", selectedTrackId === 'random' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80')}
                    >
                      <div className={cn("w-2 h-2 rounded-full", selectedTrackId === 'random' ? 'bg-cyan-400' : 'bg-transparent')} />
                      Random (All Tracks)
                    </button>
                    <button 
                      onClick={() => setSelectedTrackId('random-builtin')}
                      className={cn("px-4 py-2.5 rounded-lg border text-sm text-left transition-colors flex items-center gap-2", selectedTrackId === 'random-builtin' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80')}
                    >
                      <div className={cn("w-2 h-2 rounded-full", selectedTrackId === 'random-builtin' ? 'bg-cyan-400' : 'bg-transparent')} />
                      Random (Built-in)
                    </button>
                    <button 
                      onClick={() => tracks.custom.length > 0 && setSelectedTrackId('random-custom')}
                      disabled={tracks.custom.length === 0}
                      className={cn("px-4 py-2.5 rounded-lg border text-sm text-left transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed", selectedTrackId === 'random-custom' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80')}
                    >
                      <div className={cn("w-2 h-2 rounded-full", selectedTrackId === 'random-custom' ? 'bg-cyan-400' : 'bg-transparent')} />
                      Random (Custom)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Built-in Tracks</label>
                  <div className="max-h-48 overflow-y-auto bg-slate-950/50 border border-slate-800 rounded-lg p-1.5 space-y-1 custom-scrollbar">
                    {tracks.builtIn.map(t => (
                      <button 
                        key={t.id} 
                        onClick={() => setSelectedTrackId(t.id)} 
                        className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-left", selectedTrackId === t.id ? "bg-cyan-500/20 font-medium" : "hover:bg-slate-800 text-slate-300")}
                      >
                        <div className={cn("w-10 h-10 rounded flex items-center justify-center shrink-0", selectedTrackId === t.id ? "bg-cyan-500/20 ring-2 ring-cyan-500/50 text-cyan-400" : "bg-slate-800 text-slate-500")}>
                           <Music className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col min-w-0 pr-2">
                           <div className={cn("truncate text-sm", selectedTrackId === t.id ? "text-cyan-400" : "")}>{t.name}</div>
                           {t.artist && <div className={cn("text-xs truncate", selectedTrackId === t.id ? "text-cyan-500/80" : "text-slate-500")}>{t.artist}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center justify-between text-sm text-slate-400 mb-2">
                    <span>Custom Tracks</span>
                  </label>
                  <div 
                    className="max-h-48 overflow-y-auto bg-slate-950/50 border border-slate-800 rounded-lg p-1.5 space-y-1 custom-scrollbar mb-3 relative"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    {isUploading && (
                      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
                        <Activity className="w-5 h-5 text-cyan-400 animate-spin mb-2" />
                        <span className="text-xs font-medium text-cyan-400">Loading Tracks...</span>
                      </div>
                    )}
                    {tracks.custom.length > 0 ? tracks.custom.map(t => (
                      <div 
                        key={t.id} 
                        onClick={() => setSelectedTrackId(t.id)}
                        className={cn("group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer", selectedTrackId === t.id ? "bg-cyan-500/20 font-medium whitespace-normal" : "hover:bg-slate-800 text-slate-300 whitespace-normal")}
                      >
                        <div className="flex-1 flex items-center gap-3 overflow-hidden">
                          {t.coverArt ? (
                            <img src={t.coverArt} alt="Cover" className={cn("w-10 h-10 rounded shrink-0 object-cover", selectedTrackId === t.id ? "ring-2 ring-cyan-500/50" : "")} />
                          ) : (
                            <div className={cn("w-10 h-10 rounded flex items-center justify-center shrink-0", selectedTrackId === t.id ? "bg-cyan-500/20 ring-2 ring-cyan-500/50 text-cyan-400" : "bg-slate-800 text-slate-500")}>
                               <Music className="w-5 h-5" />
                            </div>
                          )}
                          <div className="flex flex-col flex-1 min-w-0 pr-2">
                             <div className={cn("truncate w-full", selectedTrackId === t.id ? "text-cyan-400" : "")}>{t.name}</div>
                             {t.artist && <div className={cn("text-xs truncate w-full", selectedTrackId === t.id ? "text-cyan-500/80" : "text-slate-500")}>{t.artist}</div>}
                          </div>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteCustomTrack(t.id, e)}
                          className="text-slate-500 hover:text-red-400 p-1.5 -mr-1.5 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 focus:opacity-100"
                          title="Delete track"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )) : (!isUploading && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-3 py-8 text-center text-sm text-slate-500 hover:text-slate-400 bg-slate-900/30 hover:bg-slate-900/50 rounded-lg border border-dashed border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
                      >
                        Drag & Drop or Click to Upload
                      </button>
                    ))}
                  </div>
                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg transition shadow-sm"
                      title="Supported formats: MP3, WAV, AAC, OGG, FLAC (Max 50MB)"
                  >
                      {isUploading ? <Activity className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {isUploading ? 'Uploading...' : 'Upload Tracks'}
                  </button>
                  <p className="text-xs text-center text-slate-500 mt-3">Supported formats: MP3, WAV, AAC, OGG, FLAC</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
