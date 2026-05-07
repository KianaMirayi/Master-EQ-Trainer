import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameView } from './components/GameView';
import { Headphones, Trophy, BarChart2, FolderDown, Lock, Music, Upload, Settings, X, Trash2, ChevronLeft, ChevronRight, Activity, LayoutGrid, StretchHorizontal, User, Bug } from 'lucide-react';
import { EQNodeData, cn } from './lib/utils';
import { TrackManager } from './lib/TrackManager';
import { ProgressionManager, LevelRecord } from './lib/ProgressionManager';
import StarsBackground from './components/StarsBackground';
import { LevelCarousel } from './components/LevelCarousel';
import { CalibrationSettings } from './components/CalibrationEditor';
import { LeaderboardModal } from './components/LeaderboardModal';
import { LoginModal } from './components/LoginModal';

import { UserProfileDashboard } from './components/UserProfileDashboard';
import { PlayerProfileManager } from './lib/PlayerProfileManager';
import { CalibrationManager } from './lib/CalibrationManager';
import { FirebaseService } from './lib/FirebaseService';
import { User as FirebaseUser } from 'firebase/auth';

interface LevelScore {
  level: number;
  score: number;
}

import { useLanguage } from './lib/LanguageContext';

export default function App() {
  const { t, language, setLanguage } = useLanguage();
  const [currentView, setCurrentView] = useState<'dashboard' | 'game' | 'calibration' | 'profile'>('dashboard');
  const [dashboardMode, setDashboardMode] = useState<'grid' | 'carousel'>('carousel');
  const [activeLevel, setActiveLevel] = useState<number>(1);
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [records, setRecords] = useState<Record<number, LevelRecord>>({});
  const [tracks, setTracks] = useState({ builtIn: TrackManager.getBuiltInTracks(), custom: TrackManager.getCustomTracks() });
  const [selectedTrackId, setSelectedTrackId] = useState<string>('random-builtin');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'audio'>('main');
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);

  const [showPeakCongratulation, setShowPeakCongratulation] = useState(false);
  const [showBossCongratulation, setShowBossCongratulation] = useState<number | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ text: string, type: 'error' | 'info' | 'success' } | null>(null);

  const displayUploadMessage = (text: string, type: 'error' | 'info' | 'success') => {
    setUploadMessage({ text, type });
    setTimeout(() => setUploadMessage(null), 3000);
  };

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = FirebaseService.onAuthChange(async (user) => {
      setUser(user);
      if (user) {
        const cloudData = await FirebaseService.getUserData(user.uid) as any;
        if (cloudData) {
          if (cloudData.stats) PlayerProfileManager.mergeStats(cloudData.stats);
          if (cloudData.records) {
            ProgressionManager.mergeRecords(cloudData.records);
            setRecords(ProgressionManager.getRecords());
          }
          if (cloudData.calibrationPresets) {
            CalibrationManager.mergePresets(cloudData.calibrationPresets);
          }
          
          // Re-sync back to cloud to ensure any local-only data is preserved and cloud is updated with combined state
          const updatedStats = PlayerProfileManager.loadStats();
          const updatedRecords = ProgressionManager.getRecords();
          const updatedPresets = CalibrationManager.getPresets();
          await FirebaseService.syncUserData(updatedStats, updatedRecords, updatedPresets);
        }
      }
    });
    return () => unsubscribe();
  }, []);

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
    let addedCount = 0;
    let newTracks: typeof tracks.custom = [];
    
    try {
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit per file

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (!file.type.startsWith('audio/')) {
          displayUploadMessage(`Skipped "${file.name}": Not a recognized audio file.`, 'error');
          continue;
        }
        
        if (file.size > MAX_FILE_SIZE) {
          displayUploadMessage(`Skipped "${file.name}": File is too large. Please upload files under 50MB.`, 'error');
          continue;
        }

        try {
          const prevCount = TrackManager.getCustomTracks().length;
          const track = await TrackManager.addCustomTrack(file);
          const currentCount = TrackManager.getCustomTracks().length;
          
          if (prevCount === currentCount) {
            displayUploadMessage(`Skipped "${file.name}": Track already exists.`, 'info');
          } else {
            newTracks.push(track);
            addedCount++;
          }
        } catch (err: any) {
          if (err.name === 'QuotaExceededError') {
             displayUploadMessage('Browser storage is full! Please delete some custom tracks before uploading more.', 'error');
             break;
          }
          throw err;
        }
      }
      
      if (addedCount > 0) {
        setTracks({ builtIn: TrackManager.getBuiltInTracks(), custom: TrackManager.getCustomTracks() });
        setSelectedTrackId(newTracks[newTracks.length - 1].id);
        displayUploadMessage(`Successfully added ${addedCount} track(s).`, 'success');
      }
    } catch (err) {
      console.error('Failed to load track', err);
      displayUploadMessage('Failed to load audio file.', 'error');
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
  const saveScore = async (level: number, score: number, stars: number) => {
    ProgressionManager.saveRecord(level, score, stars);
    setRecords(ProgressionManager.getRecords());
    
    // Sync to Firebase if logged in
    if (user) {
      const stats = PlayerProfileManager.loadStats();
      const records = ProgressionManager.getRecords();
      const presets = CalibrationManager.getPresets();
      try {
        await FirebaseService.syncUserData(stats, records, presets);
      } catch (err) {
        console.error("Critical: Leaderboard sync failed:", err);
      }
    }
  };

  const passedLevels = Object.keys(records).map(Number).filter((l) => records[l].passed);
  const highestUnlocked = Math.max(1, ...passedLevels.map((l) => l + 1));
  const masteryScore = Object.values(records).reduce((sum: number, r: any) => sum + (r.score || 0), 0);

  const handleLogin = async () => {
    setIsLoginOpen(true);
  };

  const handleLogout = async () => {
    await FirebaseService.logout();
  };

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
    if (activeLevel === 100 && !isTestMode) {
      setShowPeakCongratulation(true);
      return;
    }

    if (ProgressionManager.isBossLevel(activeLevel) && !isTestMode) {
      setShowBossCongratulation(activeLevel);
      return;
    }

    if (!isTestMode) {
      const nextLevel = activeLevel + 1;
      if (ProgressionManager.checkEnterLevel(nextLevel).allowed) {
        setActiveLevel(nextLevel);
      } else {
        setCurrentView('dashboard');
      }
    }
  };

  const renderModals = () => (
    <>
      <AnimatePresence>
        {isLeaderboardOpen && (
          <LeaderboardModal 
            onClose={() => setIsLeaderboardOpen(false)} 
            isLoggedIn={!!user} 
            onLogin={handleLogin} 
            masteryScore={masteryScore} 
          />
        )}
      </AnimatePresence>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      
      {showPeakCongratulation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(245,158,11,0.2)] animate-in fade-in zoom-in duration-300">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-4 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
            <h2 className="text-3xl font-black text-amber-400 tracking-tight mb-2 uppercase">
              You're THE PEAK !!!
            </h2>
            <p className="text-slate-300 mb-6 leading-relaxed">
              You have the Golden Ear now
            </p>
            <div className="mb-8 flex justify-center w-full min-h-[120px]">
               <img src="/bosses/PassTheLevel.jpeg" alt="Peak Reached" className="max-w-full h-auto rounded-lg shadow-lg object-contain max-h-48" onError={(e) => {
                 (e.target as HTMLImageElement).style.display = 'none';
               }} />
            </div>
            <button
              onClick={() => {
                setShowPeakCongratulation(false);
                setCurrentView('dashboard');
              }}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:shadow-[0_0_25px_rgba(245,158,11,0.6)] w-full active:scale-95"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {showBossCongratulation !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(34,211,238,0.2)] animate-in fade-in zoom-in duration-300 flex flex-col items-center">
            <Trophy className="w-16 h-16 text-cyan-400 mx-auto mb-4 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            <h2 className="text-3xl font-black text-cyan-400 tracking-tight mb-2 uppercase">
              Boss Defeated!
            </h2>
            <p className="text-slate-300 mb-6 leading-relaxed">
              You have conquered Level {showBossCongratulation}!
            </p>
            <div className="mb-8 flex justify-center w-full min-h-[120px]">
               <img src="/bosses/PassTheLevel.jpeg" alt={`Boss ${showBossCongratulation}`} className="max-w-full h-auto rounded-lg shadow-lg object-contain max-h-48" onError={(e) => {
                 (e.target as HTMLImageElement).style.display = 'none';
               }} />
            </div>
            <button
              onClick={() => {
                const blvl = showBossCongratulation;
                setShowBossCongratulation(null);
                const nextLevel = blvl + 1;
                if (ProgressionManager.checkEnterLevel(nextLevel).allowed) {
                  setActiveLevel(nextLevel);
                  setCurrentView('game');
                }
              }}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-cyan-950 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] w-full active:scale-95 mb-3"
            >
              Continue to Next Level
            </button>
            <button
              onClick={() => {
                 setShowBossCongratulation(null);
                 setCurrentView('dashboard');
              }}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all w-full active:scale-95"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </>
  );

  // Dashboard View
  const levelsParams = Array.from({ length: 100 }, (_, i) => i + 1);

  // Layout Offsets
  const carouselOffsetY = 15; // 控制旋转木马视图整体（卡片+指示器）的位置，向下偏移15vh
  const carouselIndicatorOffsetY = 8; // 单独控制旋转木马底部指示器的位置，正数向下，负数向上配合整体偏移
  const gridOffsetY = 2; // 控制网格视图的垂直偏移，正数向下，负数向上配合整体居中
  const gridMaxHeightVh = 45; // 控制网格视图的垂直显示范围(最大高度vh单位)。在此框内进行滚动，减小该值可让框体变扁（例如40~45可正好显示5行）

  const maxPassedLevel = Math.max(0, ...passedLevels);
  let titleStr = t('title_0');
  let titleColor = "text-slate-400";
  let badgeColor = "bg-slate-800 border-slate-700";

  if (maxPassedLevel >= 100) { titleStr = t('title_100'); titleColor = "text-yellow-400"; badgeColor = "bg-yellow-500/20 border-yellow-500/50"; }
  else if (maxPassedLevel >= 90) { titleStr = t('title_90'); titleColor = "text-amber-400"; badgeColor = "bg-amber-500/20 border-amber-500/50"; }
  else if (maxPassedLevel >= 80) { titleStr = t('title_80'); titleColor = "text-orange-400"; badgeColor = "bg-orange-500/20 border-orange-500/50"; }
  else if (maxPassedLevel >= 70) { titleStr = t('title_70'); titleColor = "text-rose-400"; badgeColor = "bg-rose-500/20 border-rose-500/50"; }
  else if (maxPassedLevel >= 60) { titleStr = t('title_60'); titleColor = "text-pink-400"; badgeColor = "bg-pink-500/20 border-pink-500/50"; }
  else if (maxPassedLevel >= 50) { titleStr = t('title_50'); titleColor = "text-fuchsia-400"; badgeColor = "bg-fuchsia-500/20 border-fuchsia-500/50"; }
  else if (maxPassedLevel >= 40) { titleStr = t('title_40'); titleColor = "text-purple-400"; badgeColor = "bg-purple-500/20 border-purple-500/50"; }
  else if (maxPassedLevel >= 30) { titleStr = t('title_30'); titleColor = "text-violet-400"; badgeColor = "bg-violet-500/20 border-violet-500/50"; }
  else if (maxPassedLevel >= 20) { titleStr = t('title_20'); titleColor = "text-indigo-400"; badgeColor = "bg-indigo-500/20 border-indigo-500/50"; }
  else if (maxPassedLevel >= 10) { titleStr = t('title_10'); titleColor = "text-blue-400"; badgeColor = "bg-blue-500/20 border-blue-500/50"; }


  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col">
      <StarsBackground />
      <AnimatePresence mode="wait">
        {currentView === 'game' && (
          <motion.div
            key={`game-${activeLevel}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="absolute inset-0 z-20"
          >
            <GameView 
              level={activeLevel} 
              selectedTrackId={selectedTrackId} 
              isTestMode={isTestMode}
              onLevelComplete={handleLevelComplete} 
              onSaveRecord={(score, stars) => {
                if (!isTestMode) saveScore(activeLevel, score, stars);
              }}
              onRetry={(score, stars) => {
                // Progress is already saved in onSaveRecord during submission
              }}
              onBack={() => {
                 setIsTestMode(false);
                 setCurrentView('dashboard');
              }}
              onLevelChange={isTestMode ? (lvl) => setActiveLevel(lvl) : undefined}
            />
          </motion.div>
        )}

        {currentView === 'calibration' && (
          <motion.div
            key="calibration"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-0 z-20 overflow-y-auto bg-transparent backdrop-blur-sm"
          >
            <CalibrationSettings onBack={() => setCurrentView('dashboard')} />
          </motion.div>
        )}

        {currentView === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-md flex flex-col"
          >
            <div className="flex items-center p-6 border-b border-slate-800 bg-slate-900/50">
              <button 
                onClick={() => setCurrentView('dashboard')} 
                className="flex items-center gap-2 text-slate-400 hover:text-white transition"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="font-semibold tracking-wide">{t('back_to_dashboard')}</span>
              </button>
            </div>
            <div className="flex-1 w-full max-w-6xl mx-auto overflow-hidden">
              <UserProfileDashboard 
                stats={PlayerProfileManager.loadStats()} 
                user={user}
                onLoginToggle={() => user ? handleLogout() : handleLogin()}
              />
            </div>
          </motion.div>
        )}

        {currentView === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="absolute inset-0 z-10 bg-transparent text-slate-200 font-sans selection:bg-cyan-500/30 overflow-x-hidden overflow-y-auto"
          >
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
              <h1 className="text-3xl font-bold tracking-tight text-white">{t('app_name')}</h1>
            </div>
            <p className="text-slate-400 max-w-md">
              {t('app_tagline')}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsLeaderboardOpen(true)}
              className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer text-left"
              title={t('view_leaderboards')}
            >
              <div className="px-4 py-2 flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{t('mastery_score')}</span>
                <span className="text-xl font-mono font-bold text-cyan-400">{masteryScore}</span>
              </div>
              <div className="w-px h-8 bg-slate-800"></div>
              <div className="px-4 py-2 flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{t('acoustic_index')}</span>
                <span className="text-xl font-mono font-bold text-emerald-400">{user ? "9500" : "-"}</span> 
              </div>
            </button>
            
            <button 
              onClick={() => setCurrentView('profile')}
              className={cn("p-3.5 border rounded-xl transition shadow-sm", user ? "bg-cyan-900/20 border-cyan-800 text-cyan-400 hover:bg-cyan-900/40" : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800")}
              title={user ? t('player_profile') : t('signin_profile')}
            >
              {user ? (
                user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-5 h-5 rounded-full" />
                ) : (
                  <User className="w-5 h-5" />
                )
              ) : (
                <User className="w-5 h-5 opacity-50" />
              )}
            </button>
            
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition shadow-sm"
              title={t('settings')}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <section className="flex-1 flex flex-col min-h-0 mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  {t('journey')}
                </h2>
                <div className={cn("px-2.5 py-1 rounded-md text-xs font-medium border", badgeColor, titleColor)}>
                  {titleStr}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
                   <button 
                     onClick={() => setDashboardMode('carousel')}
                     className={cn("p-1.5 rounded-md transition-colors", dashboardMode === 'carousel' ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300")}
                     title={t('carousel_view')}
                   >
                     <StretchHorizontal className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={() => setDashboardMode('grid')}
                     className={cn("p-1.5 rounded-md transition-colors", dashboardMode === 'grid' ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-slate-300")}
                     title={t('grid_view')}
                   >
                     <LayoutGrid className="w-4 h-4" />
                   </button>
                </div>


              </div>
          </div>
          
          {dashboardMode === 'carousel' ? (
            <div className="flex-1 w-full bg-transparent p-4 relative flex items-center justify-center">
               <LevelCarousel 
                 levels={levelsParams} 
                 records={records} 
                 onSelectLevel={handleLevelSelect}
                 offsetY={carouselOffsetY}
                 indicatorOffsetY={carouselIndicatorOffsetY}
               />
            </div>
          ) : (
            <div className="flex-1 w-full flex flex-col items-center justify-center relative p-4">
               <div 
                 className="w-full overflow-y-auto custom-scrollbar pr-4 pb-16"
                 style={{ 
                   transform: `translateY(${gridOffsetY}vh)`,
                   maxHeight: `${gridMaxHeightVh}vh`
                 }}
               >
                 <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-4 py-3 px-2">
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
                          <span className="text-[10px] font-medium tracking-widest text-slate-500 uppercase mt-1">{t('new_level')}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
                 </div>
               </div>
            </div>
          )}

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
                  {t('settings')}
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
                  {t('audio_source')}
                </>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {settingsView === 'main' && (
                <button 
                  onClick={() => {
                    setIsSettingsOpen(false);
                    handleLevelSelect(1, true);
                  }}
                  className="p-2 text-slate-500 hover:text-cyan-400 transition rounded-lg hover:bg-slate-800"
                  title={t('enter_test_mode')}
                >
                  <Bug className="w-5 h-5" />
                </button>
              )}
              <button onClick={() => { setIsSettingsOpen(false); setTimeout(() => setSettingsView('main'), 300); }} className="text-slate-400 hover:text-slate-200 transition p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto">
            {settingsView === 'main' ? (
              <div className="space-y-4">
                {/* Language Switcher */}
                <div className="bg-slate-950/50 p-1.5 rounded-xl border border-slate-800 flex gap-1 mb-2">
                  {[
                    { id: 'en', name: 'English' },
                    { id: 'zh', name: '中文' }
                  ].map(lang => (
                    <button
                      key={lang.id}
                      onClick={() => setLanguage(lang.id as any)}
                      className={cn(
                        "flex-1 py-2 text-[10px] uppercase font-black tracking-widest rounded-lg transition-all",
                        language === lang.id ? "bg-slate-800 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)]" : "text-slate-600 hover:text-slate-400"
                      )}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => setSettingsView('audio')}
                  className="w-full flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                      <Music className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-200">{t('audio_source')}</h3>
                      <p className="text-sm text-slate-400 mt-0.5">{t('manage_tracks')}</p>
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
                      <h3 className="font-medium text-slate-200">{t('hp_calibration')}</h3>
                      <p className="text-sm text-slate-400 mt-0.5">{t('hp_calibration_desc')}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">{t('playback_mode')}</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => setSelectedTrackId('random')}
                      className={cn("px-4 py-2.5 rounded-lg border text-sm text-left transition-colors flex items-center gap-2", selectedTrackId === 'random' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80')}
                    >
                      <div className={cn("w-2 h-2 rounded-full", selectedTrackId === 'random' ? 'bg-cyan-400' : 'bg-transparent')} />
                      {t('random_all')}
                    </button>
                    <button 
                      onClick={() => setSelectedTrackId('random-builtin')}
                      className={cn("px-4 py-2.5 rounded-lg border text-sm text-left transition-colors flex items-center gap-2", selectedTrackId === 'random-builtin' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80')}
                    >
                      <div className={cn("w-2 h-2 rounded-full", selectedTrackId === 'random-builtin' ? 'bg-cyan-400' : 'bg-transparent')} />
                      {t('random_builtin')}
                    </button>
                    <button 
                      onClick={() => tracks.custom.length > 0 && setSelectedTrackId('random-custom')}
                      disabled={tracks.custom.length === 0}
                      className={cn("px-4 py-2.5 rounded-lg border text-sm text-left transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed", selectedTrackId === 'random-custom' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80')}
                    >
                      <div className={cn("w-2 h-2 rounded-full", selectedTrackId === 'random-custom' ? 'bg-cyan-400' : 'bg-transparent')} />
                      {t('random_custom')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">{t('builtin_tracks')}</label>
                  <div className="max-h-48 overflow-y-auto bg-slate-950/50 border border-slate-800 rounded-lg p-1.5 space-y-1 custom-scrollbar">
                    {tracks.builtIn.map(t => (
                      <button 
                        key={t.id} 
                        onClick={() => setSelectedTrackId(t.id)} 
                        className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-left", selectedTrackId === t.id ? "bg-cyan-500/20 font-medium" : "hover:bg-slate-800 text-slate-300")}
                      >
                        {t.coverArt ? (
                           <img src={t.coverArt} alt="Cover" className={cn("w-10 h-10 rounded shrink-0 object-cover", selectedTrackId === t.id ? "ring-2 ring-cyan-500/50" : "")} />
                        ) : (
                           <div className={cn("w-10 h-10 rounded flex items-center justify-center shrink-0", selectedTrackId === t.id ? "bg-cyan-500/20 ring-2 ring-cyan-500/50 text-cyan-400" : "bg-slate-800 text-slate-500")}>
                              <Music className="w-5 h-5" />
                           </div>
                        )}
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
                    <span>{t('custom_tracks')}</span>
                  </label>
                  <p className="text-xs text-slate-500 mb-3 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                    {t('custom_track_desc')}
                  </p>
                  <div 
                    className="max-h-48 overflow-y-auto bg-slate-950/50 border border-slate-800 rounded-lg p-1.5 space-y-1 custom-scrollbar mb-3 relative"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    {isUploading && (
                      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg">
                        <Activity className="w-5 h-5 text-cyan-400 animate-spin mb-2" />
                        <span className="text-xs font-medium text-cyan-400">{t('uploading_tracks')}</span>
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
                        {t('drag_drop_upload')}
                      </button>
                    ))}
                  </div>
                  {uploadMessage && (
                    <div className={`text-xs px-3 py-2 mb-3 rounded border ${
                      uploadMessage.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      uploadMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      'bg-sky-500/10 border-sky-500/20 text-sky-400'
                    }`}>
                      {uploadMessage.text}
                    </div>
                  )}
                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg transition shadow-sm"
                      title="Supported formats: MP3, WAV, AAC, OGG, FLAC (Max 50MB)"
                  >
                      {isUploading ? <Activity className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {isUploading ? t('uploading') : t('upload_tracks')}
                  </button>
                  <p className="text-xs text-center text-slate-500 mt-3">Supported formats: MP3, WAV, AAC, OGG, FLAC</p>
                </div>
              </div>
            )}
          </div>
          {settingsView === 'main' && (
            <div className="p-6 border-t border-slate-800 bg-slate-900/50">
              <AnimatePresence mode="wait">
                {isSupportOpen ? (
                  <motion.div 
                    key="support-msg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 text-center flex flex-col items-center gap-4">
                       <div className="text-2xl">🧋</div>
                       <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
                         {t('support_message')}
                       </p>
                       <div className="bg-white p-1.5 rounded-lg shadow-xl shadow-amber-500/10">
                         <img 
                           src="/assets/donations/wechat_qr.png" 
                           alt="WeChat Support" 
                           className="w-32 h-32 object-contain rounded-sm"
                           referrerPolicy="no-referrer"
                         />
                       </div>
                    </div>
                    <button 
                      onClick={() => setIsSupportOpen(false)}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all border border-slate-700 active:scale-95"
                    >
                      {t('back_game')}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="standard-footer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-slate-600">
                      <span>Acoustic Mastery Lab</span>
                      <span>v1.2.0</span>
                    </div>
                    <div className="bg-slate-950/30 p-3 rounded-lg border border-slate-800/50">
                      <p className="text-[11px] text-slate-500 leading-relaxed italic">
                        {t('about_disclaimer')}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-center">
                        <button 
                          onClick={() => setIsSupportOpen(true)}
                          className="px-6 py-1.5 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-500/80 text-[10px] uppercase font-bold tracking-widest transition-all active:scale-95"
                        >
                          {t('support_project')}
                        </button>
                      </div>
                      <div className="text-[9px] text-center text-slate-600 opacity-50 italic">
                        Keep the bits flowing. Stay focused.
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
      </motion.div>
    )}
    </AnimatePresence>
    {renderModals()}
    </div>
  );
}
