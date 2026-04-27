import React, { useState, useEffect, useRef } from 'react';
import { GameView } from './components/GameView';
import { Headphones, Trophy, BarChart2, FolderDown, Lock, Music, Upload, Settings, X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './lib/utils';
import { TrackManager } from './lib/TrackManager';

interface LevelScore {
  level: number;
  score: number;
}

export default function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'game'>('dashboard');
  const [activeLevel, setActiveLevel] = useState<number>(1);
  const [scores, setScores] = useState<LevelScore[]>([]);
  const [tracks, setTracks] = useState({ builtIn: TrackManager.getBuiltInTracks(), custom: TrackManager.getCustomTracks() });
  const [selectedTrackId, setSelectedTrackId] = useState<string>('random-builtin');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'audio'>('main');

  // Load from local storage and initialize indexedDB
  useEffect(() => {
    TrackManager.init().then(() => {
      setTracks({ builtIn: TrackManager.getBuiltInTracks(), custom: TrackManager.getCustomTracks() });
    });
    const saved = localStorage.getItem('eq_trainer_scores');
    if (saved) {
      try { setScores(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      let lastTrack = null;
      for (let i = 0; i < files.length; i++) {
        lastTrack = await TrackManager.addCustomTrack(files[i]);
      }
      setTracks({ builtIn: TrackManager.getBuiltInTracks(), custom: TrackManager.getCustomTracks() });
      if (lastTrack) setSelectedTrackId(lastTrack.id);
    } catch (err) {
      console.error('Failed to load track', err);
      alert('Failed to load audio file.');
    }
    
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
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
  const saveScore = (level: number, score: number) => {
    setScores(prev => {
      const existing = prev.find(s => s.level === level);
      let newScores;
      if (existing) {
        newScores = prev.map(s => s.level === level ? { ...s, score: Math.max(s.score, score) } : s);
      } else {
        newScores = [...prev, { level, score }];
      }
      localStorage.setItem('eq_trainer_scores', JSON.stringify(newScores));
      return newScores;
    });
  };

  const highestUnlocked = Math.max(1, ...scores.filter(s => s.score >= 72).map(s => s.level + 1));
  const masteryScore = scores.reduce((sum, s) => sum + s.score, 0);

  const handleLevelSelect = (level: number) => {
    setActiveLevel(level);
    setCurrentView('game');
  };

  const handleLevelComplete = (score: number) => {
    saveScore(activeLevel, score);
    if (score >= 72) {
      // Go to next level magically
      setActiveLevel(prev => prev + 1);
    } else {
      // Just go back to dashboard if they didn't want to retry immediately
      setCurrentView('dashboard');
    }
  };

  if (currentView === 'game') {
    return (
      <GameView 
        level={activeLevel} 
        selectedTrackId={selectedTrackId} 
        onLevelComplete={handleLevelComplete} 
        onRetry={(score) => saveScore(activeLevel, score)}
        onBack={() => setCurrentView('dashboard')} 
      />
    );
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
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">

            <Trophy className="w-5 h-5 text-amber-400" />
            Journey
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-4">
            {levelsParams.map(level => {
              const isUnlocked = level <= highestUnlocked;
              const levelScore = scores.find(s => s.level === level)?.score;
              const isPassed = (levelScore ?? 0) >= 72;
              
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
                    isPassed && "border-emerald-500/30 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                  )}
                >
                  {isUnlocked ? (
                    <span className={cn(
                      "text-2xl font-bold font-mono tracking-tighter",
                      isPassed ? "text-emerald-400" : "text-slate-200"
                    )}>{level}</span>
                  ) : (
                    <Lock className="w-6 h-6 text-slate-600 mb-1" />
                  )}
                  
                  {isUnlocked && (
                    <div className="mt-1 text-[10px] font-medium tracking-widest uppercase">
                      {levelScore !== undefined ? (
                        <span className={isPassed ? "text-emerald-500" : "text-amber-500"}>
                          {levelScore}%
                        </span>
                      ) : (
                        <span className="text-slate-500">NEW</span>
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
                        className={cn("w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer break-words", selectedTrackId === t.id ? "bg-cyan-500/20 text-cyan-400 font-medium" : "hover:bg-slate-800 text-slate-300")}
                      >
                        {t.name.replace(/\.[^/.]+$/, "")}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center justify-between text-sm text-slate-400 mb-2">
                    <span>Custom Tracks</span>
                  </label>
                  <div className="max-h-48 overflow-y-auto bg-slate-950/50 border border-slate-800 rounded-lg p-1.5 space-y-1 custom-scrollbar mb-3">
                    {tracks.custom.length > 0 ? tracks.custom.map(t => (
                      <div 
                        key={t.id} 
                        onClick={() => setSelectedTrackId(t.id)}
                        className={cn("group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer", selectedTrackId === t.id ? "bg-cyan-500/20 text-cyan-400 font-medium whitespace-normal" : "hover:bg-slate-800 text-slate-300 whitespace-normal")}
                      >
                        <span className="flex-1 text-left break-words pr-2">
                          {t.name.replace(/\.[^/.]+$/, "")}
                        </span>
                        <button 
                          onClick={(e) => handleDeleteCustomTrack(t.id, e)}
                          className="text-slate-500 hover:text-red-400 p-1.5 -mr-1.5 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 focus:opacity-100"
                          title="Delete track"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )) : (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full px-3 py-8 text-center text-sm text-slate-500 hover:text-slate-400 bg-slate-900/30 hover:bg-slate-900/50 rounded-lg border border-dashed border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
                      >
                        No custom tracks uploaded yet. Click to upload.
                      </button>
                    )}
                  </div>
                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg transition shadow-sm"
                      title="Supported formats: MP3, WAV, AAC, OGG, FLAC"
                  >
                      <Upload className="w-4 h-4" />
                      Upload Tracks
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
