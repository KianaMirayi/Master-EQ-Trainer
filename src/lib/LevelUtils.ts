import levelsData from './levels.json';

export interface LevelInfo {
  nodes: number;
  frequency: string[];
  soundMode: string;
}

const FREQ_MAPPING: Record<string, string> = {
  "AA": "Low Mids / Mud",
  "AB": "Upper Bass",
  "AC": "Upper Mids / Presence",
  "AD": "Presence / Sibilance",
  "AE": "Harshness",
  "BA": "Sub Bass",
  "BB": "Midrange / Honk",
  "BC": "Highs / Sibilance",
  "BD": "Mids / Boxiness",
  "CA": "Highs / Brilliance",
  "CB": "Air"
};

export function getLevelInfo(level: number): LevelInfo | null {
  const levelConfig = levelsData.levels.find(l => level >= l.levels[0] && level <= l.levels[1]);
  if (!levelConfig) return null;

  // Calculate M/S count. If either mid or side is -1, it typically means 1 random node is chosen.
  // Otherwise, we sum the positive counts.
  const midConfig = levelConfig.nodeDistribution.mid || 0;
  const sideConfig = levelConfig.nodeDistribution.side || 0;
  const stereoCount = levelConfig.nodeDistribution.stereo || 0;
  
  let msTotalCount = 0;
  if (midConfig < 0 || sideConfig < 0) {
    // If there's a negative value, it usually represents a wildcard/random selection.
    // Based on user feedback for Level 80 (stereo:3, mid:-1, side:-1), total nodes = 4, so M/S = 1.
    msTotalCount = 1;
  } else {
    msTotalCount = midConfig + sideConfig;
  }
  
  const totalNodes = stereoCount + msTotalCount;

  const freqNames = levelConfig.freqPools.map(code => FREQ_MAPPING[code] || code);
  
  // Format SoundMode description: Combine Mid and Side into M/S
  const modes = [];
  if (stereoCount > 0) {
    modes.push(`Stereo(${stereoCount})`);
  }
  if (msTotalCount > 0) {
    modes.push(`M/S(${msTotalCount})`);
  }
  
  return {
    nodes: totalNodes,
    frequency: freqNames,
    soundMode: modes.join(' + ')
  };
}
