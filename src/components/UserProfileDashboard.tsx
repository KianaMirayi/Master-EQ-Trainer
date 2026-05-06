import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { PlayerProfileManager, PlayerStats } from '../lib/PlayerProfileManager';
import { Trophy, Activity, Target } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  stats: PlayerStats;
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

export function UserProfileDashboard({ stats }: Props) {
  const radarData = useMemo(() => PlayerProfileManager.calculateRadarMap(stats), [stats]);
  const personas = useMemo(() => PlayerProfileManager.getPersonas(stats), [stats]);
  const achievements = useMemo(() => PlayerProfileManager.getAchievements(stats), [stats]);

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
            <div className="flex flex-col gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
