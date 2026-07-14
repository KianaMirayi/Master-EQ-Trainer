import progressionConfig from './progressionConfig.json';

const STORAGE_KEY = 'webeq_progression';

export interface LevelRecord {
  score: number;
  stars: number;
  passed: boolean;
}

export interface StarGateFailedReason {
  allowed: false;
  reason: 'STAR_GATE_LOCKED' | 'NOT_UNLOCKED';
  message?: string;
  requiredStars?: number;
  currentStars?: number;
  suggestedReviewLevels?: number[];
}

export type LevelCheckResult = { allowed: true } | StarGateFailedReason;

export class ProgressionManager {
  /**
   * Retrieves all stored level records from localStorage.
   */
  static getRecords(): Record<number, LevelRecord> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  /**
   * Saves a new record for a level. Only updates if the new score/stars are better.
   */
  static saveRecord(level: number, score: number, stars: number): boolean {
    const records = this.getRecords();
    const passed = stars > 0;
    
    const existing = records[level];
    let isNewBest = false;
    
    if (!existing) {
        records[level] = { score, stars, passed };
        isNewBest = true;
    } else {
        if (score > existing.score) isNewBest = true;
        records[level] = {
            score: Math.max(existing.score, score),
            stars: Math.max(existing.stars, stars),
            passed: existing.passed || passed
        };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return isNewBest;
  }

  static mergeRecords(cloudRecords: Record<number, LevelRecord>) {
    const local = this.getRecords();
    const merged = { ...local };
    
    Object.keys(cloudRecords).forEach(k => {
      const level = parseInt(k);
      const cloud = cloudRecords[level];
      const existing = merged[level];
      
      if (!existing || cloud.score > existing.score) {
        merged[level] = cloud;
      }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }

  /**
   * Gets the score required to pass a specific level.
   */
  static getPassThreshold(level: number): number {
    if (level === -999) return 50; 
    if (level % 10 === 0) {
        if (level <= 30) return progressionConfig.passScores.boss_10_to_30;
        if (level <= 70) return progressionConfig.passScores.boss_40_to_70;
        if (level === 80) return progressionConfig.passScores.boss_80;
        if (level === 90) return progressionConfig.passScores.boss_90;
        return progressionConfig.passScores.boss_100;
    } else {
        if (level < 40) return progressionConfig.passScores.normal_1_to_39;
        if (level < 70) return progressionConfig.passScores.normal_41_to_69;
        if (level < 80) return progressionConfig.passScores.normal_71_to_79;
        if (level < 90) return progressionConfig.passScores.normal_81_to_89;
        return progressionConfig.passScores.normal_91_to_99;
    }
  }

  static isBossLevel(level: number): boolean {
    return level > 0 && level % 10 === 0;
  }

  /**
   * Checks if the player is allowed to enter the specified level.
   */
  static checkEnterLevel(level: number): LevelCheckResult {
    if (level === 1) return { allowed: true };
    const records = this.getRecords();
    
    // 1. Must pass previous level
    const prevRecord = records[level - 1];
    if (!prevRecord || !prevRecord.passed) {
        return { allowed: false, reason: 'NOT_UNLOCKED', message: `需先通过关卡 ${level - 1}。` };
    }
    
    // 2. Boss Star Gate Check
    if (this.isBossLevel(level)) {
        let currentStars = 0;
        const startLevel = level - 9;
        const endLevel = level - 1;
        let suggestedReviewLevels: number[] = [];
        
        for (let l = startLevel; l <= endLevel; l++) {
            if (records[l]) {
                currentStars += records[l].stars;
                if (records[l].stars === 1) {
                    suggestedReviewLevels.push(l);
                }
            }
        }
        
        const requiredStars = level <= 70 ? progressionConfig.starGates.boss_10_to_70_req : progressionConfig.starGates.boss_80_to_100_req;
        
        if (currentStars < requiredStars) {
            return { 
                allowed: false, 
                reason: 'STAR_GATE_LOCKED',
                message: `Boss 关卡已锁定: 第 ${startLevel}-${endLevel} 关还需 ${requiredStars - currentStars} 颗星 (当前: ${currentStars}/${requiredStars})。`,
                requiredStars,
                currentStars,
                suggestedReviewLevels
            };
        }
    }
    
    return { allowed: true };
  }
}
