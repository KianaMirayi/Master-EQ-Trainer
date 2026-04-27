import { EQNodeData } from './utils';

// Helps generate realistic targets
export function generateTargetForLevel(level: number): EQNodeData[] {
  // Simple progression:
  // Lvl 1-3: 1 band (boost or cut)
  // Lvl 4-7: 2 bands 
  // Lvl 8-10: 3 bands
  
  const bandCount = level <= 3 ? 1 : level <= 7 ? 2 : 3;
  const nodes: EQNodeData[] = [];
  
  for(let i = 0; i < bandCount; i++) {
    // Generate realistic ranges
    // e.g. 100 - 10000 Hz
    const fLogMin = Math.log10(100);
    const fLogMax = Math.log10(10000);
    const fRandomLog = fLogMin + Math.random() * (fLogMax - fLogMin);
    const freq = Math.pow(10, fRandomLog);
    
    // Gain +/- 3 to 12
    const sign = Math.random() > 0.5 ? 1 : -1;
    const gain = sign * (3 + Math.floor(Math.random() * 6)); 
    
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
  // Same length as targets
  return targets.map((t, idx) => {
    // Determine random offset based on level
    // High level = random freq, Low level = exact match frequency
    
    let freqOffset = 0;
    if (level === 1) freqOffset = 0; // exact
    else if (level < 5) freqOffset = (Math.random() - 0.5) * 0.2; // slight log offset +/- 0.1 decade
    else freqOffset = (Math.random() - 0.5) * 0.6; // wider offset
    
    let startFreq = Math.pow(10, Math.log10(t.freq) + freqOffset);
    // clamp bounds
    startFreq = Math.max(20, Math.min(30000, startFreq));

    return {
      id: `user_b${idx}`,
      type: t.type,
      freq: startFreq,
      gain: 0, // Starts flat
      q: t.q // Currently Q is copied, or can be offset
    };
  });
}
