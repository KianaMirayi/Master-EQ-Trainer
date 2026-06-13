import { ProgressionManager } from './ProgressionManager';

export interface PlayerStats {
  // === 基础进度参数 / Basic Progress ===
  levelsPlayed: number;      // 玩家开始过的总关卡数
  levelsCompleted: number;   // 成功过关（至少获得1星）的关卡总数
  totalStars: number;        // 累计获得的总星数
  totalTimeSpent: number;    // 累计游戏时长（秒），用于计算决策速度
  retriesCount: number;      // 累计重试次数，反映玩家的耐心和受挫能力
  
  // === 调音能力参数 / EQ Skills ===
  totalFreqError: number;    // 寻找目标频率的误差总和（用于计算听觉精度）
  totalQError: number;       // Q值设定的误差总和（用于计算频宽感知）
  totalGainError: number;    // 增益大小的误差总和（用于计算操作克制度）
  
  // === 操作习惯参数 / Behavior Analytics ===
  extremeGainCount: number;  // 极限增益（大于10dB或小于-10dB）的使用次数
  totalUserQSum: number;     // 玩家设定的Q值总和（用于计算玩家偏好的Q值大小，粗/细）
  totalSweepEvents: number;  // 频率扫频（鼠标拖拽寻找频率）的累计触发次数

  // === 每日训练 / Daily Training ===
  dailyTrainingStreak: number;
  lastDailyTrainingDate: string | null;
}

export const DEFAULT_STATS: PlayerStats = {
  levelsPlayed: 0,
  levelsCompleted: 0,
  totalStars: 0,
  totalTimeSpent: 0,
  retriesCount: 0,
  totalFreqError: 0,
  totalQError: 0,
  totalGainError: 0,
  extremeGainCount: 0,
  totalUserQSum: 0,
  totalSweepEvents: 0,
  dailyTrainingStreak: 0,
  lastDailyTrainingDate: null,
};

const STORAGE_KEY = 'eq_master_player_stats';

export class PlayerProfileManager {
  static loadStats(): PlayerStats {
    let stats = { ...DEFAULT_STATS };
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        stats = { ...DEFAULT_STATS, ...JSON.parse(stored) };
      }
    } catch (e) {}
    
    // Sync critical stats from ProgressionManager
    const records = ProgressionManager.getRecords();
    let actualCompleted = 0;
    let actualStars = 0;
    Object.values(records).forEach(record => {
      if (record.passed) {
        actualCompleted++;
      }
      actualStars += record.stars;
    });

    stats.levelsCompleted = actualCompleted;
    stats.totalStars = actualStars;

    // If levelsPlayed is zero but we have completions (i.e. legacy missing data), 
    // mock levelsPlayed so radar chart doesn't crash to 0.
    if (stats.levelsPlayed === 0 && actualCompleted > 0) {
      stats.levelsPlayed = actualCompleted; 
      // Add some dummy base stats so division works gracefully
      stats.totalTimeSpent = actualCompleted * 30; // 30s per level
    }

    return stats;
  }

  static saveStats(stats: PlayerStats) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }

  static mergeStats(cloudStats: PlayerStats) {
    const local = this.loadStats();
    
    let latestStreak = local.dailyTrainingStreak;
    let latestDate = local.lastDailyTrainingDate;

    if (cloudStats.lastDailyTrainingDate) {
        if (!local.lastDailyTrainingDate || new Date(cloudStats.lastDailyTrainingDate) > new Date(local.lastDailyTrainingDate)) {
            latestStreak = cloudStats.dailyTrainingStreak;
            latestDate = cloudStats.lastDailyTrainingDate;
        } else if (local.lastDailyTrainingDate === cloudStats.lastDailyTrainingDate) {
            latestStreak = Math.max(local.dailyTrainingStreak, cloudStats.dailyTrainingStreak);
        }
    }

    const merged: PlayerStats = {
      ...local,
      levelsPlayed: Math.max(local.levelsPlayed, cloudStats.levelsPlayed),
      levelsCompleted: Math.max(local.levelsCompleted, cloudStats.levelsCompleted),
      totalStars: Math.max(local.totalStars, cloudStats.totalStars),
      totalTimeSpent: Math.max(local.totalTimeSpent, cloudStats.totalTimeSpent),
      retriesCount: Math.max(local.retriesCount, cloudStats.retriesCount),
      totalFreqError: cloudStats.levelsPlayed > local.levelsPlayed ? cloudStats.totalFreqError : local.totalFreqError,
      totalQError: cloudStats.levelsPlayed > local.levelsPlayed ? cloudStats.totalQError : local.totalQError,
      totalGainError: cloudStats.levelsPlayed > local.levelsPlayed ? cloudStats.totalGainError : local.totalGainError,
      totalUserQSum: cloudStats.levelsPlayed > local.levelsPlayed ? cloudStats.totalUserQSum : local.totalUserQSum,
      totalSweepEvents: cloudStats.levelsPlayed > local.levelsPlayed ? cloudStats.totalSweepEvents : local.totalSweepEvents,
      extremeGainCount: cloudStats.levelsPlayed > local.levelsPlayed ? cloudStats.extremeGainCount : local.extremeGainCount,
      dailyTrainingStreak: latestStreak,
      lastDailyTrainingDate: latestDate,
    };
    this.saveStats(merged);
    return merged;
  }

  static recordDailyTraining() {
    const stats = this.loadStats();
    
    // Use local date string (YYYY-MM-DD)
    const today = new Date().toLocaleDateString('en-CA'); // e.g. 2026-06-13
    
    if (stats.lastDailyTrainingDate === today) {
        // Already completed today, do nothing
        return stats;
    }
    
    if (!stats.lastDailyTrainingDate) {
        // First time
        stats.dailyTrainingStreak = 1;
    } else {
        const lastDate = new Date(stats.lastDailyTrainingDate);
        const currentDate = new Date(today);
        const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            // Consecutive day
            stats.dailyTrainingStreak += 1;
        } else if (diffDays > 1) {
            // Streak broken
            stats.dailyTrainingStreak = 1;
        }
    }
    
    stats.lastDailyTrainingDate = today;
    this.saveStats(stats);
    return stats;
  }

  static resetStats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATS));
  }

  static calculateRadarMap(stats: PlayerStats, t?: (key: string) => string) {
    const radarData = [
      { subject: t ? t('perception') : 'Perception', key: 'perception', A: 0, fullMark: 100, desc: t ? t('perception_desc') : '' },
      { subject: t ? t('precision') : 'Precision', key: 'precision', A: 0, fullMark: 100, desc: t ? t('precision_desc') : '' },
      { subject: t ? t('efficiency') : 'Efficiency', key: 'efficiency', A: 0, fullMark: 100, desc: t ? t('efficiency_desc') : '' },
      { subject: t ? t('spatial') : 'Spatial', key: 'spatial', A: 0, fullMark: 100, desc: t ? t('spatial_desc') : '' },
      { subject: t ? t('consistency') : 'Consistency', key: 'consistency', A: 0, fullMark: 100, desc: t ? t('consistency_desc') : '' },
      { subject: t ? t('restraint') : 'Restraint', key: 'restraint', A: 0, fullMark: 100, desc: t ? t('restraint_desc') : '' },
    ];
    
    if (stats.levelsPlayed === 0) {
      return radarData;
    }

    const { levelsPlayed } = stats;

    // 1. Perception (Initial/Final Freq matching). 
    // We max out if avg error is < 1 semitone, 0 if > 12 semitones
    const avgFreqError = stats.totalFreqError / levelsPlayed;
    let perception = Math.max(0, 100 - (avgFreqError / 12) * 100);

    // 2. Precision. Max 100 if average stars is 3.
    const avgStars = stats.totalStars / levelsPlayed;
    let precision = (avgStars / 3) * 100;

    // 3. Efficiency. Max 100 if < 30s per level, 0 if > 150s.
    const avgTime = stats.totalTimeSpent / levelsPlayed;
    let efficiency = Math.max(0, Math.min(100, 100 - ((avgTime - 30) / 120) * 100));
    if (avgTime <= 30) efficiency = 100;

    // 4. Spatial. Max 100 if avg Q error is small.
    const avgQError = stats.totalQError / levelsPlayed;
    let spatial = Math.max(0, 100 - (avgQError / 5) * 100);

    // 5. Consistency. Max 100 if retries are 0.
    const retryRatio = stats.retriesCount / levelsPlayed;
    let consistency = Math.max(0, 100 - retryRatio * 50);

    // 6. Restraint. Gain error and extreme gain use.
    const avgGainError = stats.totalGainError / levelsPlayed;
    const extremeRatio = stats.extremeGainCount / levelsPlayed;
    let restraint = Math.max(0, 100 - ((avgGainError / 6) * 50) - (extremeRatio * 50));

    radarData[0].A = Math.round(perception);
    radarData[1].A = Math.round(precision);
    radarData[2].A = Math.round(efficiency);
    radarData[3].A = Math.round(spatial);
    radarData[4].A = Math.round(consistency);
    radarData[5].A = Math.round(restraint);

    return radarData;
  }

  static getPersonas(stats: PlayerStats, t?: (key: string) => string) {
    if (stats.levelsPlayed < 1) return [];

    const personas = [];
    const _t = t || ((k: string) => k);
    
    // 你可以利用上面暴露的参数进行任意二次计算，得出平均值或比率
    // === 以下是一些常用的衍生运算参考 ===
    const avgQ = stats.totalUserQSum / stats.levelsPlayed;            // 场均玩家Q值偏好大小
    const avgTime = stats.totalTimeSpent / stats.levelsPlayed;        // 场均决策所用时间
    const extremeRatio = stats.extremeGainCount / stats.levelsPlayed; // 场均使用极限增益的频率
    const sweepRatio = stats.totalSweepEvents / stats.levelsPlayed;   // 场均鼠标拖拽扫频的频次
    // const avgFreqError = stats.totalFreqError / stats.levelsPlayed;// 场均频率误差（可以用作"金耳朵"指标）
    // const winRate = stats.levelsCompleted / stats.levelsPlayed;    // 过关胜率
    
    // 增加画像的方式： if (你的计算条件) { personas.push(...) }

    if (avgQ > 0 && avgQ < 1.2) {
      personas.push({ icon: '🔪', title: _t('surgeon'), desc: _t('surgeon_desc') });
    } else if (avgQ > 3.0) {
      personas.push({ icon: '🎨', title: _t('broadcaster'), desc: _t('broadcaster_desc') });
    }

    if (avgTime < 45) {
      personas.push({ icon: '⚡', title: _t('speed_demon'), desc: _t('speed_demon_desc') });
    }

    if (sweepRatio > 200) {
      personas.push({ icon: '🔬', title: _t('sweep_addict'), desc: _t('sweep_addict_desc') });
    }

    if (extremeRatio >= 1.0) {
      personas.push({ icon: '🧨', title: _t('over_cooker'), desc: _t('over_cooker_desc') });
    }
    
    if (personas.length === 0 && stats.levelsPlayed >= 1) {
      personas.push({ icon: '⚖️', title: _t('balanced'), desc: _t('balanced_desc') });
    }

    return personas;
  }

  static getAchievements(stats: PlayerStats, t?: (key: string) => string) {
    const ach = [];
    const _t = t || ((k: string) => k);
    
    // 你可以直接访问 stats.XXX 原始数据进行数值判断
    // 也可以复用 stats.totalStars / stats.levelsPlayed 等二次计算的结果
    // 添加任何新成就只需要在此处补充一个 `if(条件) ach.push(...)` 即可
    
    if (stats.totalStars >= 3) {
      ach.push({ icon: '🌟', title: _t('ach_3stars'), desc: _t('ach_3stars_desc') });
    }
    if (stats.totalStars >= 30) {
      ach.push({ icon: '⭐', title: _t('ach_30stars'), desc: _t('ach_30stars_desc') });
    }
    if (stats.totalStars >= 100) {
      ach.push({ icon: '💎', title: _t('ach_100stars'), desc: _t('ach_100stars_desc') });
    }
    if (stats.totalStars >= 300) {
      ach.push({ icon: '👑', title: _t('ach_300stars'), desc: _t('ach_300stars_desc') });
    }

    if (stats.levelsCompleted >= 5) {
      ach.push({ icon: '🎧', title: _t('ach_5levels'), desc: _t('ach_5levels_desc') });
    }
    if (stats.levelsCompleted >= 50) {
      ach.push({ icon: '📻', title: _t('ach_50levels'), desc: _t('ach_50levels_desc') });
    }
    if (stats.levelsCompleted >= 100) {
      ach.push({ icon: '🏆', title: _t('ach_100levels'), desc: _t('ach_100levels_desc') });
    }

    if (stats.retriesCount >= 10) {
      ach.push({ icon: '🔥', title: _t('ach_10retries'), desc: _t('ach_10retries_desc') });
    }
    if (stats.retriesCount >= 50) {
      ach.push({ icon: '🦾', title: _t('ach_50retries'), desc: _t('ach_50retries_desc') });
    }

    if (stats.totalSweepEvents >= 1000) {
      ach.push({ icon: '🌊', title: _t('ach_1000sweeps'), desc: _t('ach_1000sweeps_desc') });
    }
    if (stats.extremeGainCount >= 20) {
      ach.push({ icon: '💣', title: _t('ach_20extremes'), desc: _t('ach_20extremes_desc') });
    }
    
    // Skill-based achievements based on averages
    if (stats.levelsPlayed >= 10 && (stats.totalTimeSpent / stats.levelsPlayed) < 25) {
      ach.push({ icon: '⚡', title: _t('ach_fast_hands'), desc: _t('ach_fast_hands_desc') });
    }
    if (stats.levelsPlayed >= 10 && (stats.totalStars / stats.levelsPlayed) >= 2.8) {
      ach.push({ icon: '🎯', title: _t('ach_perfect_pitch'), desc: _t('ach_perfect_pitch_desc') });
    }

    return ach;
  }
}
