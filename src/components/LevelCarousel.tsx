import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { ProgressionManager } from '../lib/ProgressionManager';
import { getLevelInfo } from '../lib/LevelUtils';
import { useLanguage } from '../lib/LanguageContext';

/**
 * UI Parameters for the Level Information Display (Frosted Glass Effect)
 * You can adjust these parameters to change the appearance of the level details panel.
 */
const INFO_PANEL_PARAMS = {
  // Background color and opacity (Tailwind classes)
  background: "bg-slate-850/65",
  // Blur intensity: backdrop-blur-sm, backdrop-blur-md, backdrop-blur-lg, backdrop-blur-xl
  blur: "backdrop-blur-xl",
  // Border radius: rounded-lg, rounded-xl, rounded-2xl
  rounded: "rounded-xl",
  // Border color and opacity 
  border: "border border-white/10",
  // Shadow depth
  shadow: "shadow-lg",
  // Spacing and height
  padding: "p-3",
  maxHeight: "max-h-[160px]",
  spacing: "space-y-1.5"
};

const getBossUnlockTitle = (level: number, t: (key: string) => string) => {
  if (level === 10) return t('boss_10');
  if (level === 20) return t('boss_20');
  if (level === 30) return t('boss_30');
  if (level === 40) return t('boss_40');
  if (level === 50) return t('boss_50');
  if (level === 60) return t('boss_60');
  if (level === 70) return t('boss_70');
  if (level === 80) return t('boss_80');
  if (level === 90) return t('boss_90');
  if (level === 100) return t('boss_100');
  return null;
};

interface LevelCarouselProps {
  levels: number[];
  records: Record<number, { passed: boolean; score: number; stars: number; trackId?: string }>;
  onSelectLevel: (level: number) => void;
  tiltX?: number;
  tiltY?: number;
  tiltZ?: number;
  cardWidth?: number;
  cardHeight?: number;
  offsetY?: number; /* 控制卡片容器的垂直偏移 */
  indicatorOffsetY?: number; /* 控制关卡指示器的垂直偏移 */
}

export function LevelCarousel({ 
  levels, 
  records, 
  onSelectLevel,
  tiltX = 3,
  tiltY = 90,
  tiltZ = 13,
  cardWidth = 280,
  cardHeight = 366,
  offsetY = 0,
  indicatorOffsetY = 0
}: LevelCarouselProps) {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelAccumulator = useRef<number>(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const panAccumulator = useRef<number>(0);

  // Focus on the highest unlocked level by default
  useEffect(() => {
    let maxUnlocked = 0;
    for (let i = 0; i < levels.length; i++) {
        if (ProgressionManager.checkEnterLevel(levels[i]).allowed) {
            maxUnlocked = i;
        } else {
            break;
        }
    }
    // Set to the first unpassed level if possible
    let target = maxUnlocked;
    for (let i = 0; i <= maxUnlocked; i++) {
        if (!records[levels[i]]?.passed) {
            target = i;
            break;
        }
    }
    setCurrentIndex(target);
  }, []);

  const handlePan = (e: any, info: any) => {
    panAccumulator.current += info.delta.x;
    
    // Threshold determines how much drag distance equals one level move
    // Increased threshold for smoother/slower dragging
    const threshold = 180; 

    if (Math.abs(panAccumulator.current) >= threshold) {
      const steps = Math.trunc(panAccumulator.current / threshold);
      panAccumulator.current -= steps * threshold;

      // dragging left (negative delta) means next level (increase index)
      setCurrentIndex(prev => {
        const next = prev - steps;
        return Math.max(0, Math.min(levels.length - 1, next));
      });
    }
  };

  const handlePanEnd = () => {
    panAccumulator.current = 0;
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Accumulate scroll distance
    wheelAccumulator.current += e.deltaY;

    // Reset accumulator after user stops scrolling for a short time
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      wheelAccumulator.current = 0;
    }, 150);

    // Threshold determines how much "scroll" equals one level move
    // standard mouse usually fires 100 or 120 per click, trackpads fire smaller deltaY
    const threshold = 60;

    if (Math.abs(wheelAccumulator.current) >= threshold) {
      const steps = Math.trunc(wheelAccumulator.current / threshold);
      wheelAccumulator.current -= steps * threshold;

      setCurrentIndex(prev => {
        const next = prev + steps;
        return Math.max(0, Math.min(levels.length - 1, next));
      });
    }
  };

  const visibleItems = 5; // How many items to show 

  const firstUnpassedLevel = React.useMemo(() => {
    // Check levels 1 to 100 to find the first one that hasn't been passed
    for (let l = 1; l <= 100; l++) {
      const rec = records[l] || (records as any)[String(l)];
      const isPassed = rec?.passed === true || (rec && rec.stars > 0);
      if (!isPassed) return l;
    }
    return 101;
  }, [records]);

  return (
    <motion.div 
        className="relative w-full h-full min-h-[400px] flex flex-col items-center justify-center cursor-grab active:cursor-grabbing" 
        style={{ perspective: "1200px", touchAction: "pan-y" }}
        onWheel={handleWheel}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
    >
        {/* We can use a simpler approach: a flex container that is dragged, but we want the center item to be large and others smaller. 
            A common way is mapping through items and calculating their style/position based on (index - currentIndex).
        */}
        <div 
          className="relative w-full max-w-5xl h-full flex items-center justify-center pointer-events-none"
          style={{ transformStyle: "preserve-3d", transform: `translateY(${offsetY}vh)` }}
        >
            <AnimatePresence initial={false}>
                {levels.map((level, i) => {
                    const offset = i - currentIndex;
                    // Only render items close to the current index for performance
                    if (Math.abs(offset) > visibleItems) return null;

                    const check = ProgressionManager.checkEnterLevel(level);
                    const isUnlocked = check.allowed;
                    const record = records[level] || (records as any)[String(level)];
                    const isPassed = record?.passed === true || (record && record.stars > 0);
                    const isBoss = ProgressionManager.isBossLevel(level);

                    // Show info for:
                    // 1. All Boss levels permanently (regardless of pass status)
                    // 2. Level 100 explicitly
                    // 3. The next 3 unpassed levels relative to current progress
                    const isFutureThree = level >= firstUnpassedLevel && level < firstUnpassedLevel + 3;
                    const shouldShowInfo = isBoss || level === 100 || (!isPassed && isFutureThree);
                    const levelInfo = shouldShowInfo ? getLevelInfo(level) : null;

                    // 3D Carousel calculations
                    const isCenter = offset === 0;
                    
                    // Diagonal stacking effect
                    const x = offset * 180;
                    const y = offset * -40;
                    const z = offset * -300;
                    
                    // Consistent rotation for all cards except the center one
                    const rotateY = isCenter ? 0 : tiltY;
                    const rotateX = isCenter ? 0 : tiltX;
                    const rotateZ = isCenter ? 0 : tiltZ;
                    
                    // Emphasize the center card
                    const finalX = x + (isCenter ? -40 : 0);
                    const finalY = y + (isCenter ? -30 : 0);
                    const finalZ = z + (isCenter ? 150 : 0);
                    
                    const scale = 1;
                    
                    // Fade out distant items
                    let opacity = 1;
                    if (offset < -3) opacity = 0;
                    else if (offset === -3) opacity = 0;
                    else if (offset === -2) opacity = 0.4;
                    else if (offset === -1) opacity = 0.8;
                    else if (offset > 6) opacity = 0;
                    else opacity = 1 - (offset * 0.1);

                    const zIndex = 100 - offset;
                    const brightness = isCenter ? 1 : 1 - Math.abs(offset) * 0.15;

                    return (
                        <motion.button
                            key={level}
                            initial={false}
                            animate={{
                                x: finalX,
                                y: finalY,
                                z: finalZ,
                                rotateY,
                                rotateX,
                                rotateZ,
                                scale,
                                opacity,
                                filter: `brightness(${brightness})`,
                                zIndex,
                            }}
                            transformTemplate={({ x, y, z, rotateX, rotateY, rotateZ, scale }) => 
                                `translate3d(${x}, ${y}, ${z}) rotateY(${rotateY}) rotateX(${rotateX}) rotateZ(${rotateZ}) scale(${scale})`
                            }
                            transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.7 }}
                            style={{
                                width: `${cardWidth}px`,
                                height: `${cardHeight}px`,
                                transformStyle: "preserve-3d"
                            }}
                            disabled={false}
                            onClick={() => {
                                if (isCenter) {
                                    if (isUnlocked) {
                                        onSelectLevel(level);
                                    }
                                } else {
                                    setCurrentIndex(i);
                                }
                            }}
                            className={cn(
                                "absolute rounded-2xl flex flex-col items-center justify-center pointer-events-auto overflow-hidden",
                                "shadow-2xl transition-colors duration-300",
                                isCenter ? "backdrop-blur-md" : "backdrop-blur-[2px]",
                                isUnlocked 
                                  ? (isCenter ? "bg-slate-800/40 border-[1.5px] border-white/20 cursor-pointer hover:bg-slate-800/60" : "bg-slate-800/10 border-[1.5px] border-white/10 cursor-pointer hover:bg-slate-800/30")
                                  : "bg-slate-900/20 border-[1.5px] border-slate-800/30 opacity-60 cursor-pointer",
                                isPassed && "border-emerald-500/50 bg-emerald-900/10",
                                isBoss && "ring-2 ring-amber-500/50 bg-amber-900/5",
                                isCenter && isUnlocked && "border-cyan-400/60 shadow-[0_0_40px_rgba(34,211,238,0.25)] bg-cyan-950/40"
                            )}
                            title={!isUnlocked && !isPassed ? (check as any).message || (check as any).reason : ""}
                        >
                            {/* Card Background Art */}
                            <div 
                                className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none"
                                style={{
                                    backgroundImage: `radial-gradient(circle at 50% 0%, ${isPassed ? '#10b981' : isBoss ? '#f59e0b' : '#38bdf8'} 0%, transparent 60%),
                                                      repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 20px)`
                                }}
                            />
                            
                            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-4">
                                {isUnlocked ? (
                                    <span className={cn(
                                        "text-6xl font-black font-sans tracking-tighter drop-shadow-xl",
                                        isPassed ? "text-emerald-400" : (isBoss ? "text-amber-400" : "text-white")
                                    )}>
                                        {level}
                                    </span>
                                ) : (
                                    <Lock className="w-10 h-10 text-slate-500 mb-2 drop-shadow-md" />
                                )}
                                
                                {isBoss && !isPassed && (
                                    <div className="mt-3 text-center">
                                        <span className="text-amber-500/80 text-xs font-bold tracking-widest drop-shadow-md">
                                            {getBossUnlockTitle(level, t)}
                                        </span>
                                    </div>
                                )}
                                
                                {levelInfo && (
                                    <div className={cn(
                                        "mt-2 w-full flex-1 flex flex-col shrink-0 z-20",
                                        INFO_PANEL_PARAMS.maxHeight,
                                        INFO_PANEL_PARAMS.background,
                                        INFO_PANEL_PARAMS.blur,
                                        INFO_PANEL_PARAMS.padding,
                                        INFO_PANEL_PARAMS.rounded,
                                        INFO_PANEL_PARAMS.border,
                                        INFO_PANEL_PARAMS.shadow,
                                        INFO_PANEL_PARAMS.spacing
                                    )}>
                                        <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1">
                                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Nodes</span>
                                            <span className="text-xs font-mono text-cyan-400 font-bold">{levelInfo.nodes}</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Frequency</div>
                                            <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto custom-scrollbar">
                                                {levelInfo.frequency.map((f, idx) => (
                                                    <span key={idx} className="text-[8px] px-1.5 py-0.5 bg-slate-800/90 rounded text-slate-300 font-medium border border-white/5 whitespace-nowrap">
                                                        {f}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-1 border-t border-white/5 mt-1">
                                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">SoundMode</span>
                                            <span className="text-[8px] font-bold text-emerald-400 truncate ml-2 text-right flex-1">{levelInfo.soundMode}</span>
                                        </div>
                                    </div>
                                )}
                                
                                {isUnlocked && (
                                    <div className="mt-4 flex flex-col items-center gap-2 bg-slate-950/40 backdrop-blur-md py-2 px-4 rounded-xl border border-white/5">
                                        {record !== undefined ? (
                                            <>
                                                <div className={cn("text-xs font-bold uppercase tracking-widest", isPassed ? "text-emerald-400" : "text-amber-400")}>
                                                    {record.score} pts
                                                </div>
                                                <div className="flex items-center justify-center gap-1">
                                                    {[1, 2, 3].map(star => (
                                                        <svg key={star} className={cn("w-4 h-4", star <= record.stars ? "text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]" : "text-slate-700")} fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                                                        </svg>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-xs font-bold tracking-widest text-slate-300 uppercase py-1">{t('undiscovered')}</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Extra overlay for non-centered items to catch clicks to navigate */}
                            {offset !== 0 && (
                                <div className="absolute inset-0 bg-slate-950/20 rounded-3xl" />
                            )}
                        </motion.button>
                    );
                })}
            </AnimatePresence>
        </div>

        {/* Navigation Indicators / Controls */}
        <div 
            className="absolute left-0 right-0 flex justify-center gap-6 z-50 pointer-events-auto"
            style={{ 
                bottom: '1rem', // Default bottom-4
                transform: `translateY(${offsetY + indicatorOffsetY}vh)` 
            }}
        >
            <button 
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="p-2 rounded-full bg-slate-800/80 text-slate-300 disabled:opacity-30 hover:bg-slate-700 border border-slate-700 backdrop-blur-md transition-all"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <div className="flex items-center gap-1 font-mono text-sm text-slate-500">
                <span className="text-slate-300">{currentIndex + 1}</span> / {levels.length}
            </div>
            <button 
              onClick={() => setCurrentIndex(prev => Math.min(levels.length - 1, prev + 1))}
              disabled={currentIndex === levels.length - 1}
              className="p-2 rounded-full bg-slate-800/80 text-slate-300 disabled:opacity-30 hover:bg-slate-700 border border-slate-700 backdrop-blur-md transition-all"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    </motion.div>
  );
}
