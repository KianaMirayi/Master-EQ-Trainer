
export interface FreeTrainingConfig {
  nodesCount: number;
  gainRange: [number, number]; // [min, max]
  qRange: [number, number];    // [min, max]
  freqPools: string[];         // e.g. ["AA", "AB"]
  enableFreqLimits: boolean;
  enableGainHint: boolean;
  soundModeDist: {
    stereo: number;
    ms: number;
  };
  allowedFilters: ('peaking' | 'highshelf' | 'lowshelf')[];
}

export const DEFAULT_FREE_TRAINING_CONFIG: FreeTrainingConfig = {
  nodesCount: 3,
  gainRange: [3, 6],
  qRange: [1, 3],
  freqPools: ['AA', 'AB', 'AC', 'AD', 'AE'],
  enableFreqLimits: false,
  enableGainHint: true,
  soundModeDist: {
    stereo: 3,
    ms: 0
  },
  allowedFilters: ['peaking']
};
