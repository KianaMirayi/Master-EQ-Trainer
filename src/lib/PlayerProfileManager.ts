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
    };
    this.saveStats(merged);
    return merged;
  }

  static resetStats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATS));
  }

  static calculateRadarMap(stats: PlayerStats) {
    const radarData = [
      { subject: '听音辨位\nPerception', A: 0, fullMark: 100, desc: '代表耳朵对频率的敏感度。初始放置节点的频率与目标频率的平均误差，误差越小，此项得分越高' },
      { subject: '听觉精度\nPrecision', A: 0, fullMark: 100, desc: '代表最终调音的细腻程度。最终提交时的匹配度（通关星级/总得分的综合体现）' },
      { subject: '决策效率\nEfficiency', A: 0, fullMark: 100, desc: '从进入关卡到点击 Submit 的平均耗时。时间越短得分越高' },
      { subject: '空间感知\nSpatial', A: 0, fullMark: 100, desc: '对 Q值（带宽）的把控精度，以及未来如果有左右声道操作时的准确度' },
      { subject: '稳定性\nConsistency', A: 0, fullMark: 100, desc: '连续获得高星评价的概率，以及重试（Retry）次数的少。（重试越少，越稳定）' },
      { subject: '操作克制\nRestraint', A: 0, fullMark: 100, desc: '使用 Gain 增益的幅度。经常把 Gain 拉到极限或距离目标的增益太远会导致此项降低' },
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

  static getPersonas(stats: PlayerStats) {
    if (stats.levelsPlayed < 1) return [];

    const personas = [];
    
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
      personas.push({ icon: '🔪', title: '外科医生 (The Surgeon)', desc: '偏好极小的Q值，喜欢做精准的频段切除' });
    } else if (avgQ > 3.0) {
      personas.push({ icon: '🎨', title: '氛围大师 (The Broadcaster)', desc: '偏好极大Q值，喜欢做大范围的音色平移' });
    }

    if (avgTime < 45) {
      personas.push({ icon: '⚡', title: '极速狂飙 (Speed Demon)', desc: '决策效率极高，平均几十秒就提交，干脆利落' });
    }

    if (sweepRatio > 200) {
      personas.push({ icon: '🔬', title: '扫频狂魔 (Sweep Addict)', desc: '经常按住鼠标在各个频段来回滑动扫频' });
    }

    if (extremeRatio >= 1.0) {
      personas.push({ icon: '🧨', title: '破坏之王 (The Over-cooker)', desc: '偏好极致的增益，属于“下重手”调音' });
    }
    
    if (personas.length === 0 && stats.levelsPlayed >= 1) {
      personas.push({ icon: '⚖️', title: '中庸之道 (The Balanced)', desc: '操作非常均衡，没有过于极端的偏好' });
    }

    return personas;
  }

  static getAchievements(stats: PlayerStats) {
    const ach = [];
    
    // 你可以直接访问 stats.XXX 原始数据进行数值判断
    // 也可以复用 stats.totalStars / stats.levelsPlayed 等二次计算的结果
    // 添加任何新成就只需要在此处补充一个 `if(条件) ach.push(...)` 即可
    
    if (stats.totalStars >= 3) {
      ach.push({ icon: '🌟', title: '初试啼声', desc: '累计获得3颗星' });
    }
    if (stats.totalStars >= 30) {
      ach.push({ icon: '⭐', title: '金牌混音师', desc: '累计获得30颗星' });
    }
    if (stats.totalStars >= 100) {
      ach.push({ icon: '💎', title: '钻石铂金耳', desc: '累计获得100颗星' });
    }
    if (stats.totalStars >= 300) {
      ach.push({ icon: '👑', title: '声学幻神', desc: '累计获得300颗星，音之主宰！' });
    }

    if (stats.levelsCompleted >= 5) {
      ach.push({ icon: '🎧', title: '渐入佳境', desc: '成功通关5个不同关卡' });
    }
    if (stats.levelsCompleted >= 50) {
      ach.push({ icon: '📻', title: '行业老兵', desc: '成功通关50个不同关卡' });
    }
    if (stats.levelsCompleted >= 100) {
      ach.push({ icon: '🏆', title: '大满贯', desc: '成功通关100个不同关卡' });
    }

    if (stats.retriesCount >= 10) {
      ach.push({ icon: '🔥', title: '百折不挠', desc: '累计重试10次，不言放弃' });
    }
    if (stats.retriesCount >= 50) {
      ach.push({ icon: '🦾', title: '千锤百炼', desc: '累计重试20次，毅力惊人' });
    }

    if (stats.totalSweepEvents >= 1000) {
      ach.push({ icon: '🌊', title: '冲浪达人', desc: '累计扫频操作超过1000次' });
    }
    if (stats.extremeGainCount >= 20) {
      ach.push({ icon: '💣', title: '重型装甲', desc: '累计使用极限增益超过20次' });
    }
    
    // Skill-based achievements based on averages
    if (stats.levelsPlayed >= 10 && (stats.totalTimeSpent / stats.levelsPlayed) < 25) {
      ach.push({ icon: '⚡', title: '闪电手', desc: '10关以上平均单关决策时间少于25秒' });
    }
    if (stats.levelsPlayed >= 10 && (stats.totalStars / stats.levelsPlayed) >= 2.8) {
      ach.push({ icon: '🎯', title: '绝对音感', desc: '10关以上保持场均2.8星以上的极高评价' });
    }

    return ach;
  }
}
