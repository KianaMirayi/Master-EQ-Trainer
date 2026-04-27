import React, { useState, useEffect, useRef } from 'react';
import { GameView } from './components/GameView';
import { Headphones, Trophy, BarChart2, FolderDown, Lock, Music, Upload, Settings, X, Plus } from 'lucide-react';
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
              <Settings className="w-5 h-5 text-cyan-400"/>
              Settings
            </h2>
            <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto">
            {/* Audio Source Settings */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                <Music className="w-4 h-4" />
                Audio Source
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Select Track Pool</label>
                  <select
                      value={selectedTrackId}
                      onChange={(e) => setSelectedTrackId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-sm text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-cyan-500 transition-colors"
                  >
                      <option value="random">Random (All Tracks)</option>
                      <option value="random-builtin">Random (Built-in)</option>
                      {tracks.custom.length > 0 && (
                        <option value="random-custom">Random (Custom)</option>
                      )}
                      {tracks.builtIn.length > 0 && (
                          <optgroup label="Built-in Tracks">
                              {tracks.builtIn.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </optgroup>
                      )}
                      {tracks.custom.length > 0 && (
                          <optgroup label="Custom Audios">
                              {tracks.custom.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </optgroup>
                      )}
                  </select>
                </div>

                <div>
                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg transition"
                      title="Supported formats: MP3, WAV, AAC, OGG, FLAC"
                  >
                      <Upload className="w-4 h-4" />
                      Upload Tracks
                  </button>
                  <p className="text-xs text-center text-slate-500 mt-2">MP3, WAV, AAC, OGG, FLAC</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
