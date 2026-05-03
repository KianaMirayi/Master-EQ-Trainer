import { EQNodeData } from './utils';

export interface LevelConfig {
  nodesCount: number;
  allowedFilters: string[];
  filterWeights: Record<string, number>;
  freqPools: string[];
  gainRange: [number, number];
  qRange: [number, number];
  showGainHint: boolean;
  constrainBounds: boolean;
}

// Map logical sub-pools to their frequency ranges [min, max]
export const SUB_POOLS: Record<string, [number, number]> = {
  AA: [200, 500],
  AB: [100, 200],
  AC: [2000, 3000],
  AD: [4000, 6000],
  AE: [3000, 4000],
  BA: [50, 100],
  BB: [1000, 2000],
  BC: [6000, 8000],
  BD: [500, 1000],
  CA: [8000, 10000],
  CB: [10000, 16000]
};

// Map group names to their sub-pools
export const GROUP_POOLS: Record<string, string[]> = {
  A: ['AA', 'AB', 'AC', 'AD', 'AE'],
  B: ['BA', 'BB', 'BC', 'BD'],
  C: ['CA', 'CB']
};

export class LevelManager {
  
  static getLevelConfig(level: number): LevelConfig {
    if (level <= 9) return this.createConfig(1, 'AA,AB,AC', 'BELL', '100%BELL', [6, 9], [0.7, 1], true, true);
    if (level === 10) return this.createConfig(1, 'AA,AB,AC', 'BELL', '100%BELL', [6, 9], [0.7, 1], false, true);
    if (level <= 19) return this.createConfig(2, 'A', 'BELL', '100%BELL', [6, 9], [2, 3], true, true);
    if (level === 20) return this.createConfig(2, 'A', 'BELL', '100%BELL', [3, 6], [2, 3], true, true);
    if (level <= 29) return this.createConfig(2, 'A', 'BELL', '100%BELL', [6, 9], [1, 3], true, true);
    if (level === 30) return this.createConfig(3, 'A', 'BELL', '100%BELL', [6, 9], [1, 3], true, true);
    if (level <= 39) return this.createConfig(3, 'AA,AD,BD,BB', 'BELL', '100%BELL', [6, 9], [1.5, 3], true, true);
    if (level === 40) return this.createConfig(3, 'AA,AD,BD,BB', 'BELL', '100%BELL', [3, 6], [1, 2], true, true);
    if (level <= 49) return this.createConfig(3, 'A,B', 'BELL', '100%BELL', [3, 6], [1.5, 3], true, true);
    if (level === 50) return this.createConfig(3, 'A,B', 'BELL', '100%BELL', [3, 6], [1, 2], false, true);
    if (level <= 59) return this.createConfig(3, 'AA,BA,BC,CA', 'BELL,SHELF', '70%BELL,30%SHELF', [3, 6], [0.7, 3], true, true);
    if (level === 60) return this.createConfig(3, 'BA,BC,CA,AA', 'BELL', '100%BELL', [1, 3], [0.7, 3], true, true); // table says BELL,,1-3 for level 60
    if (level <= 69) return this.createConfig(4, 'A,B,C', 'BELL,SHELF', '70%BELL,30%SHELF', [3, 6], [3, 5], true, true);
    if (level === 70) return this.createConfig(4, 'A,B,C', 'BELL', '100%BELL', [3, 6], [3, 5], false, true);
    if (level <= 79) return this.createConfig(4, 'A,B,C', 'BELL,SHELF', '70%BELL,30%SHELF', [3, 6], [5, 8], true, true);
    if (level === 80) return this.createConfig(4, 'A,B,C', 'BELL', '100%BELL', [1, 3], [5, 8], true, false);
    if (level <= 89) return this.createConfig(4, 'A,B,C', 'BELL,SHELF', '70%BELL,30%SHELF', [3, 6], [4, 8], true, false);
    if (level === 90) return this.createConfig(5, 'A,B,C', 'BELL,SHELF', '70%BELL,30%SHELF', [3, 6], [4, 8], false, false);
    if (level <= 99) return this.createConfig(6, 'A,B,C', 'BELL,SHELF', '70%BELL,30%SHELF', [1, 3], [4, 8], true, false);
    // 100 fallback
    return this.createConfig(6, 'A,B,C', 'BELL,SHELF', '70%BELL,30%SHELF', [1, 3], [3, 8], false, false);
  }

  static generateLevelTargets(level: number): EQNodeData[] {
    const config = this.getLevelConfig(level);
    const nodes: EQNodeData[] = [];

    // Make a copy of allowed pools to draw from
    let availablePools = [...config.freqPools];
    if (availablePools.length === 0) availablePools = Object.keys(SUB_POOLS); // fallback

    for (let i = 0; i < config.nodesCount; i++) {
        // Find a valid frequency that is at least 1 octave apart from existing nodes
        let freq = 1000;
        let pName = availablePools[0];
        let foundValid = false;
        let attempts = 0;

        while (!foundValid && attempts < 50) {
            attempts++;
            // pick a random pool
            pName = availablePools[Math.floor(Math.random() * availablePools.length)];
            const [minF, maxF] = SUB_POOLS[pName] || [200, 500];

            // random frequency in log scale within the pool
            const logMin = Math.log10(minF);
            const logMax = Math.log10(maxF);
            freq = Math.pow(10, logMin + Math.random() * (logMax - logMin));

            // check octave spacing (f >= 1.5 * f_existing or f <= f_existing / 1.5)
            // 1 octave is 2x, but for 6 nodes it might be too tight, so we use 1.5x (about 0.6 octaves)
            let tooClose = false;
            for (const n of nodes) {
                if (freq > n.freq / 1.5 && freq < n.freq * 1.5) {
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose) {
                foundValid = true;
            }
        }

        // Determine filter type based on weights
        let type: BiquadFilterType = 'peaking';
        const randType = Math.random();
        let cumulative = 0;
        for (const [t, w] of Object.entries(config.filterWeights)) {
            cumulative += w;
            if (randType <= cumulative) {
                type = t === 'bell' ? 'peaking' : (t === 'shelf' ? (freq > 2000 ? 'highshelf' : 'lowshelf') : t as BiquadFilterType);
                break;
            }
        }

        // Determine gain
        const sign = Math.random() > 0.5 ? 1 : -1;
        const gainMagnitude = config.gainRange[0] + Math.random() * (config.gainRange[1] - config.gainRange[0]);
        const gain = sign * gainMagnitude;

        // Determine Q
        const q = config.qRange[0] + Math.random() * (config.qRange[1] - config.qRange[0]);

        nodes.push({
            id: `target_lvl${level}_b${i}`,
            type,
            freq,
            gain,
            q: type === 'lowshelf' || type === 'highshelf' ? 1.0 : q,
            stereoMode: 'Stereo'
        });
    }

    return nodes.sort((a, b) => a.freq - b.freq);
  }

  static generateUserInitial(targets: EQNodeData[], level: number): EQNodeData[] {
      const config = this.getLevelConfig(level);
      
      const userNodes = targets.map((t, idx) => {
          let minF = 20;
          let maxF = 20000;
          
          if (config.constrainBounds) {
              // Find the pool it belonged to, or just create a bounding box based on its frequency
              const logF = Math.log10(t.freq);
              const logSpan = 0.3; // ±0.3 decades
              minF = Math.pow(10, logF - logSpan);
              maxF = Math.pow(10, logF + logSpan);
              // clamp
              minF = Math.max(20, minF);
              maxF = Math.min(20000, maxF);
              
              // Shift the initial frequency randomly within the bounds so it's not the exact answer
              const shift = (Math.random() - 0.5) * logSpan * 1.5;
              let startFreq = Math.pow(10, Math.log10(t.freq) + shift);
              startFreq = Math.max(minF, Math.min(maxF, startFreq));

              return {
                  id: `user_b${idx}`,
                  type: 'peaking' as BiquadFilterType,
                  freq: startFreq,
                  gain: 0,
                  q: 1.0,
                  minFreq: minF,
                  maxFreq: maxF,
                  minGain: -12,
                  maxGain: 12
              };
          } else {
              // Unconstrained
              let startFreq = Math.pow(10, Math.log10(t.freq) + (Math.random() - 0.5) * 0.5);
              startFreq = Math.max(20, Math.min(20000, startFreq));

              return {
                  id: `user_b${idx}`,
                  type: 'peaking' as BiquadFilterType,
                  freq: startFreq,
                  gain: 0,
                  q: 1.0,
                  minGain: -24,
                  maxGain: 24
              };
          }
      });

      // Second pass: resolve overlap if constrained
      if (config.constrainBounds) {
          for (let i = 0; i < userNodes.length - 1; i++) {
              const cur = userNodes[i];
              const next = userNodes[i+1];
              if (cur.maxFreq && next.minFreq && cur.maxFreq > next.minFreq) {
                  const targetMidLog = (Math.log10(targets[i].freq) + Math.log10(targets[i+1].freq)) / 2;
                  const midFreq = Math.pow(10, targetMidLog);
                  cur.maxFreq = midFreq;
                  next.minFreq = midFreq;
              }
          }
          
          for (let i = 0; i < userNodes.length; i++) {
              const node = userNodes[i];
              if (node.minFreq && node.maxFreq) {
                  node.freq = Math.max(node.minFreq, Math.min(node.maxFreq, node.freq));
              }
          }
      }

      // Sync constraints to targets so the UI knows where the constraints are bounds
      for (let i = 0; i < userNodes.length; i++) {
          targets[i].minFreq = userNodes[i].minFreq;
          targets[i].maxFreq = userNodes[i].maxFreq;
      }

      return userNodes;
  }

  private static createConfig(
      nodesCount: number, poolStr: string, filterStr: string, weightStr: string, 
      gainRange: [number, number], qRange: [number, number], showHint: boolean, constrain: boolean
  ): LevelConfig {
      const pools = poolStr.split(',').flatMap(p => GROUP_POOLS[p] ? GROUP_POOLS[p] : [p]);
      const allowedFilters = filterStr.split(',').map(f => f.trim().toLowerCase());
      
      const filterWeights: Record<string, number> = {};
      if (weightStr) {
          const parts = weightStr.split(',');
          for (const p of parts) {
             const match = p.trim().match(/(\d+)%([A-Z]+)/);
             if (match) {
                 filterWeights[match[2].toLowerCase()] = parseInt(match[1]) / 100;
             }
          }
      } else {
          allowedFilters.forEach(f => filterWeights[f] = 1 / allowedFilters.length);
      }

      return {
          nodesCount,
          allowedFilters,
          filterWeights,
          freqPools: pools,
          gainRange,
          qRange,
          showGainHint: showHint,
          constrainBounds: constrain
      };
  }
}

