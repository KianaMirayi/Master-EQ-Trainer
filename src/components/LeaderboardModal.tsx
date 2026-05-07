import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Activity, X, User, Info, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { FirebaseService, LeaderboardEntry } from '../lib/FirebaseService';
import { auth } from '../lib/firebase';

interface LeaderboardModalProps {
  onClose: () => void;
  // We'll pass mock user info for now
  isLoggedIn: boolean;
  onLogin: () => void;
  masteryScore: number;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ onClose, isLoggedIn, onLogin, masteryScore }) => {
  const [activeTab, setActiveTab] = useState<'mastery' | 'ami'>('ami');
  const [showAmiInfo, setShowAmiInfo] = useState(false);
  const [showMasteryInfo, setShowMasteryInfo] = useState(false);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    FirebaseService.fetchLeaderboard(activeTab).then(data => {
      if (isMounted) {
        setLeaderboard(data);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [activeTab]);

  const userRank = leaderboard.findIndex(e => e.uid === auth.currentUser?.uid) + 1;
  const userEntry = leaderboard.find(e => e.uid === auth.currentUser?.uid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={() => {
          setShowAmiInfo(false);
          setShowMasteryInfo(false);
        }}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Global Leaderboard
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 transition bg-slate-800/50 hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button 
            onClick={() => setActiveTab('ami')}
            className={cn("flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative", activeTab === 'ami' ? "text-cyan-400" : "text-slate-400 hover:text-slate-300")}
          >
            <Activity className="w-4 h-4" />
            Acoustic Master Index (AMI)
            <div className="relative -ml-1">
              <div 
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAmiInfo(!showAmiInfo);
                  setShowMasteryInfo(false);
                }}
                className="p-1 rounded-full hover:bg-slate-800 transition-colors focus:outline-none cursor-help"
              >
                <Info className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity" />
              </div>
              <AnimatePresence>
                {showAmiInfo && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-slate-950 border border-slate-700 rounded-lg shadow-xl text-xs font-normal text-slate-300 z-20 text-left leading-relaxed"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Calculated by algorithm based on 6 core skills (Sense, Precision, Accuracy, Restraint, Timbre, Panning). Filters apply to lower levels. Rewards rigorous, high-quality audio mastering.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {activeTab === 'ami' && (
              <motion.div layoutId="lb-tab" className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('mastery')}
            className={cn("flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative", activeTab === 'mastery' ? "text-cyan-400" : "text-slate-400 hover:text-slate-300")}
          >
            <Trophy className="w-4 h-4" />
            Mastery Score
            <div className="relative -ml-1">
              <div 
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMasteryInfo(!showMasteryInfo);
                  setShowAmiInfo(false);
                }}
                className="p-1 rounded-full hover:bg-slate-800 transition-colors focus:outline-none cursor-help"
              >
                <Info className="w-4 h-4 opacity-50 hover:opacity-100 transition-opacity" />
              </div>
              <AnimatePresence>
                {showMasteryInfo && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full right-0 mt-2 w-64 p-3 bg-slate-950 border border-slate-700 rounded-lg shadow-xl text-xs font-normal text-slate-300 z-20 text-left leading-relaxed"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Represents your total persistence and effort. Accumulate points across all levels by scoring well and collecting high-star rating rewards.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {activeTab === 'mastery' && (
              <motion.div layoutId="lb-tab" className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {!isLoggedIn ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-100">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">Join the Global Ranking</h3>
              <p className="text-slate-400 mb-6 max-w-sm text-sm">Sign in to upload your score and see how you rank against audio engineers worldwide.</p>
              <button 
                onClick={onLogin}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                Sign In
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* User Self Rank */}
              <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex items-center justify-between shadow-lg mb-6 shadow-cyan-500/5 border-cyan-500/20">
                 <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-cyan-500 text-slate-950 font-black rounded-lg flex items-center justify-center -rotate-3 overflow-hidden">
                      {auth.currentUser?.photoURL ? (
                        <img src={auth.currentUser.photoURL} alt="ME" className="w-full h-full object-cover" />
                      ) : (
                        'ME'
                      )}
                   </div>
                   <div>
                     <div className="font-bold text-slate-200">{auth.currentUser?.displayName || 'You'}</div>
                     <div className="text-xs text-slate-400">
                        Rank: {userRank > 0 ? `#${userRank}` : 'Unranked'}
                     </div>
                   </div>
                 </div>
                 <div className="text-right">
                   <div className="font-mono font-bold text-cyan-400 text-lg">
                      {userEntry ? (activeTab === 'ami' ? userEntry.ami : userEntry.masteryScore) : (activeTab === 'ami' ? '...' : masteryScore)}
                   </div>
                   <div className="text-[10px] uppercase tracking-wider text-slate-500">
                      {activeTab === 'ami' ? 'AMI Score' : 'Points'}
                   </div>
                 </div>
              </div>

              <div className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-4 px-2">Top Players</div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                  <span className="text-sm text-slate-400">Loading Leaderboard...</span>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm italic">
                  No scores yet. Be the first to rank!
                </div>
              ) : (
                leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const isUser = entry.uid === auth.currentUser?.uid;
                  
                  return (
                    <div key={entry.uid} className="relative">
                      <div 
                        className={cn("flex flex-col p-3 rounded-lg transition-colors relative", isUser ? "bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.05)]" : "hover:bg-slate-800/50")}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-8 h-8 font-black rounded-lg flex items-center justify-center shrink-0",
                              rank === 1 ? "bg-yellow-500/20 text-yellow-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]" :
                              rank === 2 ? "bg-slate-300/20 text-slate-300 shadow-[0_0_10px_rgba(203,213,225,0.15)]" :
                              rank === 3 ? "bg-amber-700/20 text-amber-600 shadow-[0_0_10px_rgba(180,83,9,0.15)]" :
                              "bg-slate-800 text-slate-500"
                            )}>
                              #{rank}
                            </div>
                            <div className="flex items-center gap-3 min-w-0">
                               <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                                  {entry.photoURL ? (
                                    <img src={entry.photoURL} alt={entry.displayName} className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-4 h-4 m-2 text-slate-600" />
                                  )}
                               </div>
                               <div className="truncate">
                                 <div className="font-bold text-slate-300 truncate">{entry.displayName}</div>
                                 <div className="text-[10px] uppercase font-bold tracking-tighter text-slate-500">
                                   Level {entry.levelsCompleted}
                                 </div>
                               </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-slate-300">
                              {activeTab === 'ami' ? entry.ami : entry.masteryScore}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
