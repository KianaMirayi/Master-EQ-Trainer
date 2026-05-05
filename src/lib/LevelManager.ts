import { EQNodeData } from './utils';
import levelsData from './levels.json';

export interface LevelConfig {
  nodeDistribution: { 
    stereo: number; 
    mid: number; 
    side: number; 
  };
  allowedFilters: string[];
  filterWeights: Record<string, number>;
  freqPools: string[];
  gainRange: [number, number];
  qRange: [number, number];
  showGainHint: boolean;
  constrainBounds: boolean;
  cbOverride?: {
    gainRange: [number, number];
    peakingQRange: [number, number];
    maxCutFreq: number;
  };
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
    const levelsArr = levelsData.levels;
    const configData = levelsArr.find(d => level >= d.levels[0] && level <= d.levels[1]) || levelsArr[levelsArr.length - 1];
    
    // Process node distribution (resolve -1 for random choice)
    let mid = configData.nodeDistribution.mid;
    let side = configData.nodeDistribution.side;
    if (mid === -1 && side === -1) {
        mid = Math.random() > 0.5 ? 1 : 0;
        side = 1 - mid;
    }
    
        return {
        nodeDistribution: {
            stereo: configData.nodeDistribution.stereo,
            mid,
            side
        },
        allowedFilters: configData.allowedFilters,
        filterWeights: configData.filterWeights,
        freqPools: configData.freqPools,
        gainRange: configData.gainRange as [number, number],
        qRange: configData.qRange as [number, number],
        showGainHint: configData.showGainHint,
        constrainBounds: configData.constrainBounds,
        cbOverride: (configData as any).cbOverride
    };
  }

  static generateLevelTargets(level: number): { targets: EQNodeData[], netGain: number } {
    const config = this.getLevelConfig(level);
    const nodes: EQNodeData[] = [];

    // Make a copy of allowed pools to draw from
    let availablePools = [...config.freqPools];
    if (availablePools.length === 0) availablePools = Object.keys(SUB_POOLS); // fallback

    const modesToGenerate: Array<'Stereo' | 'Mid' | 'Side'> = [
        ...Array(config.nodeDistribution.stereo).fill('Stereo'),
        ...Array(config.nodeDistribution.mid).fill('Mid'),
        ...Array(config.nodeDistribution.side).fill('Side')
    ];

    let tIdx = 0;
    for (const stereoMode of modesToGenerate) {
        // Determine filter type based on weights BEFORE generating frequency
        let typeCategory = 'bell';
        const randType = Math.random();
        let cumulative = 0;
        for (const [t, w] of Object.entries(config.filterWeights)) {
            cumulative += w;
            if (randType <= cumulative) {
                typeCategory = t;
                break;
            }
        }

        // Find a valid frequency that is at least 1 octave apart from existing nodes
        let freq = 1000;
        let pName = availablePools[0];
        let foundValid = false;
        let attempts = 0;
        
        // Determine sign of the gain early to use it in frequency bounds
        const sign = Math.random() > 0.5 ? 1 : -1;

        while (!foundValid && attempts < 50) {
            attempts++;
            let minF = 200, maxF = 500;

            if (stereoMode === 'Mid') {
                // Rule 2 for Mid: Force from 100-500Hz
                minF = 100;
                maxF = 500;
                pName = 'Mid';
            } else if (stereoMode === 'Side') {
                // Rule 2 for Side: Force from 6k-16kHz
                minF = 6000;
                if (typeCategory === 'shelf') {
                    maxF = 12000;
                } else {
                    maxF = 10000;
                }
                pName = 'Side';
            } else {
                // pick a random pool
                pName = availablePools[Math.floor(Math.random() * availablePools.length)];
                [minF, maxF] = SUB_POOLS[pName] || [200, 500];
                
                if (pName === 'CB') {
                    if (typeCategory === 'shelf') {
                        maxF = 12000;
                    } else { // bell/peaking
                        maxF = 10000;
                    }
                }
            }

            // random frequency in log scale within the pool
            const logMin = Math.log10(minF);
            const logMax = Math.log10(maxF);
            freq = Math.pow(10, logMin + Math.random() * (logMax - logMin));

            // check spacing (about 0.6 octaves)
            let tooClose = false;
            for (const n of nodes) {
                if (freq > n.freq / 1.5 && freq < n.freq * 1.5) {
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose || attempts > 45) {
                foundValid = true;
            }
        }

        let type: BiquadFilterType = 'peaking';
        if (typeCategory === 'shelf') {
            type = freq > 2000 ? 'highshelf' : 'lowshelf';
        } else if (typeCategory !== 'bell') {
            type = typeCategory as BiquadFilterType;
        }

        // Determine gain
        let gainMagnitude = config.gainRange[0] + Math.random() * (config.gainRange[1] - config.gainRange[0]);
        let gain = sign * gainMagnitude;

        // Rule 1: M/S Q Range override
        let q = 1.0;
        if (stereoMode === 'Mid' || stereoMode === 'Side') {
            q = 1.0 + Math.random() * 2.0;
        } else {
            q = config.qRange[0] + Math.random() * (config.qRange[1] - config.qRange[0]);
        }
        
        // Rule for CB/Side pool override for Gain and Q constraints
        if (pName === 'CB' || pName === 'Side') {
            const cbGainRange = config.cbOverride ? config.cbOverride.gainRange : [3, 6];
            gainMagnitude = cbGainRange[0] + Math.random() * (cbGainRange[1] - cbGainRange[0]);
            gain = sign * gainMagnitude;
            
            if (type === 'peaking') {
                const cbQRange = config.cbOverride ? config.cbOverride.peakingQRange : [1, 2];
                q = cbQRange[0] + Math.random() * (cbQRange[1] - cbQRange[0]);
            } else if (type === 'highshelf' || type === 'lowshelf') {
                q = 1.0;
            }
        }

        nodes.push({
            id: `target_lvl${level}_b${tIdx}`,
            type,
            freq,
            gain,
            q,
            stereoMode,
            pool: pName
        });
        tIdx++;
    }

    nodes.sort((a, b) => a.freq - b.freq);

    // Rule 3: SHELF physical lock
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.type === 'lowshelf' || n.type === 'highshelf') {
            if (i === 0) {
                n.type = 'lowshelf';
            } else if (i === nodes.length - 1) {
                n.type = 'highshelf';
            } else {
                n.type = 'peaking';
            }
        }
        
        // Force Q to 1.0 for any shelf filter
        if (n.type === 'lowshelf' || n.type === 'highshelf') {
            n.q = 1.0;
        }
    }

    let netGain = 0;
    for (const n of nodes) {
        netGain += n.gain;
    }

    return { targets: nodes, netGain };
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

              if (t.pool === 'CB' || t.pool === 'Side') {
                  if (t.type === 'peaking') {
                      startFreq = Math.min(10000, startFreq);
                      maxF = Math.min(12000, maxF);
                  } else {
                      startFreq = Math.min(12000, startFreq);
                  }
              }

              return {
                  id: `user_b${idx}`,
                  type: 'peaking' as BiquadFilterType,
                  freq: startFreq,
                  initialFreq: startFreq,
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
              
              let maxFreqLimit = undefined;
              if (t.pool === 'CB' || t.pool === 'Side') {
                  if (t.type === 'peaking') {
                      startFreq = Math.min(10000, startFreq);
                      maxFreqLimit = 12000;
                  } else {
                      startFreq = Math.min(12000, startFreq);
                  }
              }

              return {
                  id: `user_b${idx}`,
                  type: 'peaking' as BiquadFilterType,
                  freq: startFreq,
                  initialFreq: startFreq,
                  gain: 0,
                  q: 1.0,
                  minGain: -24,
                  maxGain: 24,
                  ...(maxFreqLimit ? { maxFreq: maxFreqLimit } : {})
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
      dist: number | {stereo: number, mid: number, side: number}, poolStr: string, filterStr: string, weightStr: string, 
      gainRange: [number, number], qRange: [number, number], showHint: boolean, constrain: boolean
  ): LevelConfig {
      const nodeDistribution = typeof dist === 'number' ? { stereo: dist, mid: 0, side: 0 } : dist;
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
          nodeDistribution,
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

