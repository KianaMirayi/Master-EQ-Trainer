import { EQNodeData } from './utils';
import { ProgressionManager } from './ProgressionManager';

export interface NodeScoreReport {
  targetNode: EQNodeData;
  userNode: EQNodeData | null;
  isVetoed: boolean;
  vetoReason?: string;
  penaltyReason?: string;
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
  
  const remainingTargets = [...targetNodes];
  const remainingUserNodes = [...userNodes];
  const matchedPairs: { target: EQNodeData; user: EQNodeData }[] = [];

  // Phase 1: Match by SAME type globally, greedily taking smallest distance
  while (true) {
      let bestDist = Infinity;
      let bestTIdx = -1;
      let bestUIdx = -1;

      for (let t = 0; t < remainingTargets.length; t++) {
          for (let u = 0; u < remainingUserNodes.length; u++) {
              if (remainingTargets[t].type === remainingUserNodes[u].type) {
                  const dist = Math.abs(Math.log2(remainingUserNodes[u].freq / remainingTargets[t].freq));
                  if (dist < bestDist) {
                      bestDist = dist;
                      bestTIdx = t;
                      bestUIdx = u;
                  }
              }
          }
      }

      if (bestTIdx === -1) break; // No more same-type matches possible

      matchedPairs.push({ target: remainingTargets[bestTIdx], user: remainingUserNodes[bestUIdx] });
      remainingTargets.splice(bestTIdx, 1);
      remainingUserNodes.splice(bestUIdx, 1);
  }

  // Phase 2: Match remaining targets to any remaining user nodes greedily by distance
  while (true) {
      let bestDist = Infinity;
      let bestTIdx = -1;
      let bestUIdx = -1;

      for (let t = 0; t < remainingTargets.length; t++) {
          for (let u = 0; u < remainingUserNodes.length; u++) {
              const dist = Math.abs(Math.log2(remainingUserNodes[u].freq / remainingTargets[t].freq));
              if (dist < bestDist) {
                  bestDist = dist;
                  bestTIdx = t;
                  bestUIdx = u;
              }
          }
      }

      if (bestTIdx === -1) break; // No more user nodes to match

      matchedPairs.push({ target: remainingTargets[bestTIdx], user: remainingUserNodes[bestUIdx] });
      remainingTargets.splice(bestTIdx, 1);
      remainingUserNodes.splice(bestUIdx, 1);
  }

  // Any left-over targets couldn't be matched
  for (const target of remainingTargets) {
      const weight = getFletcherMunsonWeight(target.freq);
      reports.push({
          targetNode: target,
          userNode: null,
          isVetoed: true,
          vetoReason: 'Missing matching node',
          Sf: 0, Sg: 0, Sq: 0, baseScore: 0, weight
      });
  }
  
  // Now evaluate matched pairs
  for (const pair of matchedPairs) {
    const target = pair.target;
    const userMatched = pair.user;
    const weight = getFletcherMunsonWeight(target.freq);
    
    // 2. Veto Checks (一票否决) & Penalties
    let isVetoed = false;
    let vetoReason = '';
    let isTypeMismatch = false;
    let penaltyReason = '';
    
    const targetMode = target.stereoMode || 'Stereo';
    const userMode = userMatched.stereoMode || 'Stereo';
    
    let isModeMismatch = false;

    // Type mismatch is no longer an absolute veto, but a harsh penalty (Max 10 pts)
    if (target.type !== userMatched.type) {
        isTypeMismatch = true;
        penaltyReason = `Type Mismatch (${target.type} vs ${userMatched.type})`;
    } 
    
    if (targetMode !== userMode) {
        isModeMismatch = true;
        const msg = `M/S Strategy Mismatch (${targetMode} vs ${userMode})`;
        penaltyReason = penaltyReason ? `${penaltyReason}, ${msg}` : msg;
    }
    
    if (target.gain * userMatched.gain < 0) {
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
            penaltyReason: (isVetoed && !vetoReason) ? penaltyReason : vetoReason,
            Sf: 0, Sg: 0, Sq: 0, baseScore: 0, weight
        });
        continue;
    }
    
    // 3. Calculate Component Scores
    // Sf: Frequency error in octaves. Deadzone 0.1 octaves. Max 1.0 error.
    const octaveErr = Math.abs(Math.log2(userMatched.freq / target.freq));
    let Sf = 0;
    if (octaveErr <= 0.1) {
        Sf = 50;
    } else {
        const effectiveErr = octaveErr - 0.1;
        Sf = Math.max(0, 50 * (1 - effectiveErr / 0.9));
    }
    
    // Sg: Gain error in dB. Deadzone 0.5dB. Max 6.0 error.
    const gainErr = Math.abs(target.gain - userMatched.gain);
    let Sg = 0;
    if (gainErr <= 0.5) {
        Sg = 30;
    } else {
        const effectiveGainErr = gainErr - 0.5;
        Sg = Math.max(0, 30 * (1 - effectiveGainErr / 5.5));
    }
    
    // Sq: Q error. Uses ratio for logarithmic perception.
    let Sq = 0;
    if (target.type === 'peaking') {
        const targetQ = target.q || 1;
        const userQ = userMatched.q || 1;
        const qRatio = Math.max(targetQ / userQ, userQ / targetQ);
        // A ratio of 1 gets 20 pts. A ratio of >=3 gets 0 pts.
        Sq = Math.max(0, 20 * (1 - (qRatio - 1) / 2.0));
    } else {
        // Highshelf/Lowshelf usually have fixed Q or less important Q in this context
        Sq = 20; 
    }
    
    // Apply type mismatch penalty (Scale down to 10% -> Max 10 pts total)
    if (isTypeMismatch) {
        Sf *= 0.1;
        Sg *= 0.1;
        Sq *= 0.1;
    }
    
    // Apply mode mismatch penalty (Half score)
    if (isModeMismatch) {
        Sf *= 0.5;
        Sg *= 0.5;
        Sq *= 0.5;
    }

    const baseScore = Sf + Sg + Sq;
    
    reports.push({
        targetNode: target,
        userNode: userMatched,
        isVetoed: false,
        penaltyReason: (isTypeMismatch || isModeMismatch) ? penaltyReason : undefined,
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
      const twoStarOffset = levelId <= 60 ? 10 : 8;
      const threeStarOffset = levelId <= 60 ? 15 : 11;
      
      if (totalScore >= passThreshold + threeStarOffset) {
          stars = 3;
      } else if (totalScore >= passThreshold + twoStarOffset) {
          stars = 2;
      } else {
          stars = 1;
      }
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
