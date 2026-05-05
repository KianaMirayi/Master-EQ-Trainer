import { EQNodeData } from './utils';
import { ProgressionManager } from './ProgressionManager';

export interface NodeScoreReport {
  targetNode: EQNodeData;
  userNode: EQNodeData | null;
  isVetoed: boolean;
  vetoReason?: string;
  Sf: number; // Frequency Score (Max 50)
  Sg: number; // Gain Score (Max 30)
  Sq: number; // Q/Bandwidth Score (Max 20)
  baseScore: number;
  weight: number;
}

export interface LevelScoreReport {
  nodeReports: NodeScoreReport[];
  totalScore: number;
  stars: number;
}

export function calculateLevelScore(targetNodes: EQNodeData[], userNodes: EQNodeData[], levelId: number): LevelScoreReport {
  const reports: NodeScoreReport[] = [];
  
  // 1. Copy user nodes for greedy matching
  const remainingUserNodes = [...userNodes];
  
  for (const target of targetNodes) {
    let bestDist = Infinity;
    let bestUserIdx = -1;
    
    // Match based on shortest octave distance
    for (let i = 0; i < remainingUserNodes.length; i++) {
        const user = remainingUserNodes[i];
        const dist = Math.abs(Math.log2(user.freq / target.freq));
        if (dist < bestDist) {
            bestDist = dist;
            bestUserIdx = i;
        }
    }
    
    let userMatched: EQNodeData | null = null;
    if (bestUserIdx !== -1) {
        userMatched = remainingUserNodes[bestUserIdx];
        remainingUserNodes.splice(bestUserIdx, 1);
    }
    
    const weight = getFletcherMunsonWeight(target.freq);
    
    if (!userMatched) {
        reports.push({
            targetNode: target,
            userNode: null,
            isVetoed: true,
            vetoReason: 'Missing matching node',
            Sf: 0, Sg: 0, Sq: 0, baseScore: 0, weight
        });
        continue;
    }
    
    // 2. Veto Checks (一票否决)
    let isVetoed = false;
    let vetoReason = '';
    
    const targetMode = target.stereoMode || 'Stereo';
    const userMode = userMatched.stereoMode || 'Stereo';
    
    if (target.type !== userMatched.type) {
        isVetoed = true;
        vetoReason = `Type Mismatch (${target.type} vs ${userMatched.type})`;
    } else if (targetMode !== userMode) {
        isVetoed = true;
        vetoReason = `M/S Strategy Mismatch (${targetMode} vs ${userMode})`;
    } else if (target.gain * userMatched.gain < 0) {
        // One is positive, one is negative
        isVetoed = true;
        vetoReason = 'Opposite Gain Direction';
    } else if (
        userMatched.initialFreq !== undefined && 
        userMatched.freq === userMatched.initialFreq && 
        (userMatched.gain === 0 || userMatched.q === 1.0)
    ) {
        isVetoed = true;
        vetoReason = 'Unoperated Node';
    }
    
    if (isVetoed) {
        reports.push({
            targetNode: target,
            userNode: userMatched,
            isVetoed,
            vetoReason,
            Sf: 0, Sg: 0, Sq: 0, baseScore: 0, weight
        });
        continue;
    }
    
    // 3. Calculate Component Scores
    // Sf: Frequency error in octaves. If off by 1 octave, 0 points.
    const octaveErr = Math.abs(Math.log2(userMatched.freq / target.freq));
    const Sf = Math.max(0, 50 * (1 - octaveErr / 1.0)); 
    
    // Sg: Gain error in dB. If off by >6dB, 0 points.
    const gainErr = Math.abs(target.gain - userMatched.gain);
    const Sg = Math.max(0, 30 * (1 - gainErr / 6.0));
    
    // Sq: Q error. If off by > 2.0, 0 points.
    let Sq = 0;
    if (target.type === 'peaking') {
        const qErr = Math.abs((target.q || 1) - (userMatched.q || 1));
        Sq = Math.max(0, 20 * (1 - qErr / 2.0));
    } else {
        // Highshelf/Lowshelf usually have fixed Q or less important Q in this context
        Sq = 20; 
    }
    
    const baseScore = Sf + Sg + Sq;
    
    reports.push({
        targetNode: target,
        userNode: userMatched,
        isVetoed: false,
        Sf, Sg, Sq, baseScore, weight
    });
  }
  
  // 4. Calculate Final Weighted Score
  let weightedSum = 0;
  let weightTotal = 0;
  
  for (const r of reports) {
      weightedSum += r.baseScore * r.weight;
      weightTotal += r.weight;
  }
  
  // 5. Finalize Score & Stars
  const totalScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;
  
  const passThreshold = ProgressionManager.getPassThreshold(levelId);
  
  let stars = 0;
  if (totalScore < passThreshold) {
      stars = 0; // Fail 
  } else {
      if (totalScore < 70) stars = 1;
      else if (totalScore < 90) stars = 2;
      else stars = 3;
  }
  
  return { nodeReports: reports, totalScore, stars };
}

// Fletcher-Munson Weights based on center frequency
function getFletcherMunsonWeight(freq: number): number {
    if (freq < 100) return 0.5;         // Sub Bass
    if (freq <= 500) return 1.0;        // Low Mids
    if (freq <= 4000) return 1.5;       // High Mids / Presence (Most sensitive)
    if (freq <= 8000) return 1.0;       // Highs
    return 0.5;                         // Air
}
