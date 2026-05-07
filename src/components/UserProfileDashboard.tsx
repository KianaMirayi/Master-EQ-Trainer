import React, { useMemo, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { PlayerProfileManager, PlayerStats } from '../lib/PlayerProfileManager';
import { Trophy, Activity, Target, User, CloudUpload, ShieldCheck, ShieldAlert, Edit2, Check, X as CloseIcon, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FirebaseService } from '../lib/FirebaseService';
import { User as FirebaseUser } from 'firebase/auth';
import { cn } from '../lib/utils';

interface Props {
  stats: PlayerStats;
  user?: FirebaseUser | null;
  onLoginToggle?: () => void;
}

const CustomTick = ({ payload, x, y, textAnchor, stroke, radius, radarData }: any) => {
  const parts = payload.value.split('\n');
  const [zh, en] = parts;
  const dataNode = radarData.find((d: any) => d.subject === payload.value);
  const score = dataNode?.A ?? 0;
  const desc = dataNode?.desc ?? '';

  return (
    <g className="recharts-layer recharts-polar-angle-axis-tick">
      <title>{desc}</title>
      <text 
        x={x} 
        y={y} 
        className="recharts-text recharts-polar-angle-axis-tick-value cursor-help hover:fill-slate-100 transition-colors" 
        textAnchor={textAnchor}
        fill="#94a3b8"
      >
        <tspan x={x} dy="0em" fontSize={11}>{zh}</tspan>
        <tspan x={x} dy="1.2em" fontSize={10} fill="#64748b">{en}</tspan>
        <tspan x={x} dy="1.4em" fontSize={14} fill="#c7d2fe" fontWeight="bold">{score}</tspan>
      </text>
    </g>
  );
};

export function UserProfileDashboard({ stats, user, onLoginToggle }: Props) {
  const radarData = useMemo(() => PlayerProfileManager.calculateRadarMap(stats), [stats]);
  const personas = useMemo(() => PlayerProfileManager.getPersonas(stats), [stats]);
  const achievements = useMemo(() => PlayerProfileManager.getAchievements(stats), [stats]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleUpdateName = async () => {
    if (!newName.trim() || newName === user?.displayName) {
      setIsEditingName(false);
      return;
    }
    setIsUpdating(true);
    try {
      await FirebaseService.updateDisplayName(newName);
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const [verificationError, setVerificationError] = useState<string | null>(null);

  const handleSendVerification = async () => {
    if (verificationSent) return;
    setIsVerifying(true);
    setVerificationError(null);
    try {
      await FirebaseService.sendVerification();
      setVerificationSent(true);
      setTimeout(() => setVerificationSent(false), 8000);
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        setVerificationError('Too many requests. Please wait a few minutes and try again.');
      } else {
        setVerificationError('Failed to send verification email.');
      }
      setTimeout(() => setVerificationError(null), 5000);
      console.error('Failed to send verification', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRefreshUser = async () => {
    setIsVerifying(true);
    try {
      await FirebaseService.reloadUser();
    } finally {
      setIsVerifying(false);
    }
  };

  const isLoggedIn = !!user;

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-6 p-6 overflow-y-auto text-slate-100">
      {/* Central Column: Radar Chart */}
      <div className="flex-1 min-w-[300px] bg-slate-900/50 border border-slate-800 rounded-2xl relative overflow-hidden backdrop-blur-md p-6 flex flex-col items-center">
        <h2 className="text-xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          能力评测雷达图 (Hexagon Profile)
        </h2>
        <p className="text-sm text-slate-400 mb-6 text-center max-w-sm">基于你过往的闯关记录生成的能力模型</p>
        
        <div className="w-full h-[400px]" style={{ minWidth: 1, minHeight: 1 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={<CustomTick radarData={radarData} />}
              />

              <PolarRadiusAxis 
                angle={30} 
                domain={[0, 100]} 
                tick={false} 
                axisLine={false} 
              />
              <Radar
                name="Player"
                dataKey="A"
                stroke="#818cf8"
                strokeWidth={2}
                fill="#818cf8"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex gap-4 mt-4 w-full justify-center">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-indigo-400">{stats.levelsCompleted}</span>
            <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-1">通关数</span>
          </div>
          <div className="h-10 w-px bg-slate-800" />
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-amber-400">{stats.totalStars}</span>
            <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-1">总星数</span>
          </div>
        </div>
      </div>

      {/* Right Column: Personas & Achievements */}
      <div className="w-full md:w-80 flex flex-col gap-6 shrink-0">
        
        {/* User Profile & Cloud Sync Widget */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <CloudUpload className="w-4 h-4 text-cyan-400" />
              UserProfile & Sync
            </h2>
            {isLoggedIn && (
               <button 
                onClick={onLoginToggle}
                className="text-xs text-slate-500 hover:text-red-400 font-bold transition-colors"
              >
                Sign Out
              </button>
            )}
          </div>

          {isLoggedIn ? (
            <div className="flex flex-col gap-4">
              {/* Profile Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl overflow-hidden">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isEditingName ? (
                      <div className="flex items-center gap-1 w-full">
                        <input 
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="bg-slate-950 border border-cyan-500/50 rounded px-2 py-0.5 text-sm w-full outline-none"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
                        />
                        <button onClick={handleUpdateName} disabled={isUpdating} className="p-1 text-emerald-400">
                          {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        </button>
                        <button onClick={() => setIsEditingName(false)} className="p-1 text-slate-500">
                          <CloseIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-slate-200 truncate">{user?.displayName || 'Anonymous Player'}</span>
                        <button 
                          onClick={() => {
                            setNewName(user?.displayName || '');
                            setIsEditingName(true);
                          }}
                          className="p-1 text-slate-500 hover:text-cyan-400 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                </div>
              </div>

              {/* Verification & Sync Status */}
              <div className="space-y-2">
                {/* Email Verification */}
                {!user?.emailVerified && user?.providerData[0]?.providerId === 'password' && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-amber-200 mb-1">Email not verified</div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleSendVerification}
                          disabled={isVerifying || verificationSent}
                          className="text-[10px] font-bold text-amber-500 hover:text-amber-400 underline disabled:opacity-50"
                        >
                          {verificationSent ? 'Sent!' : 'Verify Now'}
                        </button>
                        <span className="text-[10px] text-slate-600">|</span>
                        <button 
                          onClick={handleRefreshUser}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-400 flex items-center gap-1"
                        >
                          <RefreshCw className={cn("w-2 h-2", isVerifying && "animate-spin")} />
                          Refresh
                        </button>
                      </div>
                      {verificationError && (
                        <div className="text-[9px] text-red-400 mt-1 font-medium animate-pulse">
                          {verificationError}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {user?.emailVerified && (
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-tighter">Verified Account</span>
                  </div>
                )}

                {/* Data Sync Status */}
                <div className="text-[10px] text-slate-500 flex items-center gap-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Cloud synchronization active
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Sign in to sync your progress across devices and join the global leaderboard.
              </p>
              <button 
                onClick={onLoginToggle}
                className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95"
              >
                <User className="w-4 h-4" />
                Sign In / Sign Up
              </button>
            </div>
          )}
        </div>

        {/* Personas Widget */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            操作偏好与画像
          </h2>
          {personas.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              数据不足以生成画像，请多完成几次调音闯关吧！
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-56 overflow-y-auto custom-scrollbar pr-2">
              {personas.map((p, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="bg-slate-800/50 rounded-xl p-3 flex gap-3 items-start"
                >
                  <div className="text-2xl mt-0.5">{p.icon}</div>
                  <div>
                    <div className="font-semibold text-slate-200 text-sm mb-0.5">{p.title}</div>
                    <div className="text-xs text-slate-400 leading-relaxed">{p.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Achievements Widget */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 backdrop-blur-md flex-1">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            职业生涯成就
          </h2>
          {achievements.length === 0 ? (
             <div className="py-6 text-center text-sm text-slate-500">
               还没有获得成就...
             </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto custom-scrollbar pr-2 pb-2">
              {achievements.map((ach, i) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col items-center text-center gap-2"
                >
                  <div className="text-2xl drop-shadow-md">{ach.icon}</div>
                  <div>
                    <div className="font-semibold text-amber-100 text-xs mb-0.5">{ach.title}</div>
                    <div className="text-[10px] text-amber-200/60 leading-tight">{ach.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
