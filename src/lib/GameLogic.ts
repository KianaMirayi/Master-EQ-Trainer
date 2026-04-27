import { EQNodeData } from './utils';

// Helps generate realistic targets
export function generateTargetForLevel(level: number): EQNodeData[] {
  // Simple progression:
  // Lvl 1-3: 1 band (boost or cut)
  // Lvl 4-7: 2 bands 
  // Lvl 8-10: 3 bands
  
  const bandCount = level <= 3 ? 1 : level <= 7 ? 2 : 3;
  const nodes: EQNodeData[] = [];
  
  // Define discrete frequency bands to avoid overlap canceling target peaks
  let bounds: [number, number][] = [];
  if (bandCount === 1) {
      bounds = [[100, 10000]];
  } else if (bandCount === 2) {
      bounds = [[50, 500], [2000, 12000]];
  } else {
      bounds = [[50, 250], [600, 2500], [5000, 15000]];
  }
  
  for(let i = 0; i < bandCount; i++) {
    // Generate within specific bands
    const fLogMin = Math.log10(bounds[i][0]);
    const fLogMax = Math.log10(bounds[i][1]);
    const fRandomLog = fLogMin + Math.random() * (fLogMax - fLogMin);
    const freq = Math.pow(10, fRandomLog);
    
    // Gain +/- 4 to 8 (stays clearly within the 3 to 9 hint intervals)
    const sign = Math.random() > 0.5 ? 1 : -1;
    const gain = sign * (4 + Math.floor(Math.random() * 5)); 
    
    // Q
    const q = 0.5 + Math.random() * 2;
    
    nodes.push({
      id: `target_lvl${level}_b${i}`,
      type: 'peaking',
      freq,
      gain,
      q
    });
  }

  // Sort by frequency
  return nodes.sort((a,b) => a.freq - b.freq);
}

export function generateUserInitial(targets: EQNodeData[], level: number): EQNodeData[] {
  // First pass: generate initial ranges
  const userNodes = targets.map((t, idx) => {
    let freqOffset = 0;
    if (level === 1) freqOffset = 0; // exact
    else if (level < 5) freqOffset = (Math.random() - 0.5) * 0.2; // slight log offset +/- 0.1 decade
    else freqOffset = (Math.random() - 0.5) * 0.6; // wider offset
    
    let startFreq = Math.pow(10, Math.log10(t.freq) + freqOffset);
    startFreq = Math.max(20, Math.min(30000, startFreq));

    // The frequency range constraint: 
    // "区间的范围设置随频率的增高而减少" (Decreases as frequency increases).
    const freqFactor = Math.max(0.1, 1.0 - (Math.log10(t.freq) - 2) / 3); 
    const logSpan = freqFactor * 0.5; // +/- log distance
    
    let minF = Math.pow(10, Math.log10(t.freq) - logSpan);
    let maxF = Math.pow(10, Math.log10(t.freq) + logSpan);
    
    // Add some random shift so the target isn't exactly in the center
    const shift = (Math.random() - 0.5) * logSpan * 0.8;
    minF = Math.pow(10, Math.log10(minF) + shift);
    maxF = Math.pow(10, Math.log10(maxF) + shift);

    // Keep it within global bounds
    minF = Math.max(20, minF);
    maxF = Math.min(30000, maxF);

    return {
      id: `user_b${idx}`,
      type: t.type,
      freq: startFreq,
      gain: 0, 
      q: t.q,
      minFreq: minF,
      maxFreq: maxF,
      minGain: -9, // The max absolute gain to bound
      maxGain: 9
    };
  });

  // Second pass: resolve overlaps
  for (let i = 0; i < userNodes.length - 1; i++) {
    const cur = userNodes[i];
    const next = userNodes[i+1];
    if (cur.maxFreq !== undefined && next.minFreq !== undefined && cur.maxFreq > next.minFreq) {
       // Find logarithmic midpoint between their *target* frequencies to be safe
       const targetMidLog = (Math.log10(targets[i].freq) + Math.log10(targets[i+1].freq)) / 2;
       const midFreq = Math.pow(10, targetMidLog);
       cur.maxFreq = midFreq;
       next.minFreq = midFreq;
    }
  }

  // Third pass: clamp start frequencies to their final non-overlapping ranges
  for (const node of userNodes) {
      if (node.minFreq !== undefined && node.maxFreq !== undefined) {
          node.freq = Math.max(node.minFreq, Math.min(node.maxFreq, node.freq));
      }
  }

  return userNodes;
}
