import React, { useEffect } from 'react';
import { X, Plus, Minus, Hash, Activity, Layers, Sliders, Volume2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FreeTrainingConfig } from '../types/freeTraining';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/LanguageContext';

interface FreeTrainingControlPanelProps {
  config: FreeTrainingConfig;
  isOpen: boolean;
  onClose: () => void;
  onChange: (config: FreeTrainingConfig) => void;
}

const FREQ_BANDS_OPTIONS = [
  { id: 'AB', name: 'Low/Sub', range: '20-150' },
  { id: 'AC', name: 'Low Mids', range: '150-1k' },
  { id: 'AD', name: 'Mid Range', range: '1k-5k' },
  { id: 'AE', name: 'Treble/Air', range: '7k-9k' },
  { id: 'AF', name: 'LOW RANGE', range: '20-1k' },
  { id: 'AG', name: 'HIGH RANGE', range: '1k-12k' }
];

export const FreeTrainingControlPanel: React.FC<FreeTrainingControlPanelProps> = ({ config, isOpen, onClose, onChange }) => {
  const { t } = useLanguage();
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Background color and opacity matching the level info panel requested earlier
  const panelClasses = cn(
    "fixed top-20 left-6 z-[60] flex flex-col pointer-events-auto overflow-hidden",
    "bg-[#1a1c22]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl w-80"
  );

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleUpdate = (updates: Partial<FreeTrainingConfig>) => {
    const newConfig = { ...config, ...updates };
    
    // Ensure soundModeDist sum matches nodesCount
    if (updates.nodesCount !== undefined) {
      // Scale ms nodes proportionally or just cap if sum exceeded
      // Or better: maintain the ratio or just adjust one to match the new total
      const totalRequested = newConfig.soundModeDist.stereo + newConfig.soundModeDist.ms;
      if (totalRequested !== newConfig.nodesCount) {
          // Adjust MS to compensate
          newConfig.soundModeDist.ms = Math.max(0, newConfig.nodesCount - newConfig.soundModeDist.stereo);
          // If still not matching (meaning stereo was too high), adjust stereo
          if (newConfig.soundModeDist.stereo + newConfig.soundModeDist.ms !== newConfig.nodesCount) {
              newConfig.soundModeDist.stereo = newConfig.nodesCount - newConfig.soundModeDist.ms;
          }
      }
    }
    
    onChange(newConfig);
  };

  const handleGainChange = (idx: 0 | 1, val: string) => {
    const num = parseInt(val) || 0;
    const newRange = [...config.gainRange] as [number, number];
    newRange[idx] = num;
    handleUpdate({ gainRange: newRange });
  };

  const handleQChange = (idx: 0 | 1, val: string) => {
    const num = parseInt(val) || 0;
    const newRange = [...config.qRange] as [number, number];
    newRange[idx] = Math.max(1, Math.min(6, num));
    handleUpdate({ qRange: newRange });
  };

  const handleSoundModeChange = (mode: 'stereo' | 'ms', val: number) => {
    const newDist = { ...config.soundModeDist };
    newDist[mode] = val;
    
    // Link logic: maintain sum = nodesCount
    if (mode === 'stereo') {
        newDist.ms = Math.max(0, config.nodesCount - val);
    } else {
        newDist.stereo = Math.max(0, config.nodesCount - val);
    }
    
    handleUpdate({ soundModeDist: newDist });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.9, x: -20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.9, x: -20, filter: 'blur(10px)' }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={panelClasses}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-200">Free Training Control</span>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar">
            {/* Nodes Count */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-slate-500">
                <span className="flex items-center gap-2">
                  <Layers className="w-3 h-3" />
                  Nodes Count
                </span>
                <span className="text-cyan-400 font-mono text-sm">{config.nodesCount}</span>
              </div>
              <input 
                type="range"
                min="1"
                max="6"
                step="1"
                value={config.nodesCount}
                onChange={(e) => handleUpdate({ nodesCount: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Gain Range */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-slate-500">
                <span className="flex items-center gap-2">
                  <Sliders className="w-3 h-3" />
                  Gain Range (±dB)
                </span>
                <span className="text-cyan-400 font-mono text-sm">1 - 9</span>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="number"
                  min="1"
                  max={9}
                  value={config.gainRange[0]}
                  onChange={(e) => handleGainChange(0, e.target.value)}
                  className="flex-1 bg-slate-900 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all appearance-none"
                />
                <span className="text-slate-600 font-bold">-</span>
                <input 
                  type="number"
                  min="1"
                  max={9}
                  value={config.gainRange[1]}
                  onChange={(e) => handleGainChange(1, e.target.value)}
                  className="flex-1 bg-slate-900 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all appearance-none"
                />
              </div>
            </div>

            {/* Q Range */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-slate-500">
                <span className="flex items-center gap-2">
                  <Hash className="w-3 h-3" />
                  Q Value Range
                </span>
                <span className="text-cyan-400 font-mono text-sm">1 - 6</span>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="number"
                  min="1"
                  max="6"
                  value={config.qRange[0]}
                  onChange={(e) => handleQChange(0, e.target.value)}
                  className="flex-1 bg-slate-900 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all appearance-none"
                />
                <span className="text-slate-600 font-bold">-</span>
                <input 
                  type="number"
                  min="1"
                  max="6"
                  value={config.qRange[1]}
                  onChange={(e) => handleQChange(1, e.target.value)}
                  className="flex-1 bg-slate-900 border border-white/5 rounded-lg px-3 py-2 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all appearance-none"
                />
              </div>
            </div>

            {/* Freq Bands */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                <Activity className="w-3 h-3" />
                Frequency Bands
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FREQ_BANDS_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      const pools = config.freqPools.includes(opt.id) 
                        ? config.freqPools.filter(p => p !== opt.id)
                        : [...config.freqPools, opt.id];
                      handleUpdate({ freqPools: pools });
                    }}
                    className={cn(
                      "p-2.5 rounded-xl border text-left transition-all",
                      config.freqPools.includes(opt.id)
                        ? "bg-cyan-500/10 border-cyan-500/50"
                        : "bg-slate-900 border-white/5 hover:border-white/20"
                    )}
                  >
                    <div className={cn("text-[9px] font-black uppercase truncate", config.freqPools.includes(opt.id) ? "text-cyan-400" : "text-slate-500")}>
                      {opt.name}
                    </div>
                    <div className="text-[11px] font-mono font-bold text-slate-300">{opt.range}Hz</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sound Mode Distribution */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                <Volume2 className="w-3 h-3" />
                Mode Distribution ({config.nodesCount})
              </div>
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">Stereo</span>
                  <div className="flex items-center gap-3">
                    <button 
                       onClick={() => handleSoundModeChange('stereo', Math.max(0, config.soundModeDist.stereo - 1))}
                       className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg bg-white/5 transition text-slate-400"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-black font-mono text-cyan-400 w-4 text-center">{config.soundModeDist.stereo}</span>
                    <button 
                       onClick={() => handleSoundModeChange('stereo', Math.min(config.nodesCount, config.soundModeDist.stereo + 1))}
                       className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg bg-white/5 transition text-slate-400"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">M/S</span>
                  <div className="flex items-center gap-3">
                    <button 
                       onClick={() => handleSoundModeChange('ms', Math.max(0, config.soundModeDist.ms - 1))}
                       className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg bg-white/5 transition text-slate-400"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-black font-mono text-cyan-400 w-4 text-center">{config.soundModeDist.ms}</span>
                    <button 
                       onClick={() => handleSoundModeChange('ms', Math.min(config.nodesCount, config.soundModeDist.ms + 1))}
                       className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg bg-white/5 transition text-slate-400"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-3 pb-2">
              <button 
                onClick={() => handleUpdate({ enableFreqLimits: !config.enableFreqLimits })}
                className={cn(
                  "p-4 rounded-2xl border transition-all text-left space-y-1.5",
                  config.enableFreqLimits ? "bg-amber-500/10 border-amber-500/50" : "bg-slate-900 border-white/5"
                )}
              >
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-500">Freq Limit</div>
                <div className={cn("text-sm font-black", config.enableFreqLimits ? "text-amber-400" : "text-slate-400")}>
                  {config.enableFreqLimits ? 'ON' : 'OFF'}
                </div>
              </button>

              <button 
                onClick={() => handleUpdate({ enableGainHint: !config.enableGainHint })}
                className={cn(
                  "p-4 rounded-2xl border transition-all text-left space-y-1.5",
                  config.enableGainHint ? "bg-emerald-500/10 border-emerald-500/50" : "bg-slate-900 border-white/5"
                )}
              >
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-500">Gain Hint</div>
                <div className={cn("text-sm font-black", config.enableGainHint ? "text-emerald-400" : "text-slate-400")}>
                  {config.enableGainHint ? 'ON' : 'OFF'}
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
