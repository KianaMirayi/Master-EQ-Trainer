import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Tailwind CSS class merge utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Global Audio Constants
export const MIN_FREQ = 20;
export const MAX_FREQ = 30000;
export const MAX_GAIN = 12; // visually allow up to +-12dB
export const TARGET_GAIN_LIMIT = 12;

export const MAX_SPILL_DB = 0.5;

export function calculateDynamicMinQ(freq: number, gain: number, minFreq?: number, maxFreq?: number, maxSpillDb = MAX_SPILL_DB): number {
  if (Math.abs(gain) <= maxSpillDb) return 0.1;

  const A2 = Math.pow(10, Math.abs(gain) / 20);
  const gSpill = Math.pow(10, maxSpillDb / 10);
  
  const numerator = A2 - (gSpill / A2);
  const denominator = gSpill - 1;
  const sqrtTerm = Math.sqrt(Math.max(0, numerator / denominator));
  
  let qLeft = 0.1;
  let qRight = 0.1;
  
  if (minFreq) {
    const W = minFreq / freq;
    const denomW = Math.abs(1 - W * W);
    qLeft = denomW < 0.0001 ? 40 : (W / denomW) * sqrtTerm;
  }
  
  if (maxFreq) {
    const W = maxFreq / freq;
    const denomW = Math.abs(1 - W * W);
    qRight = denomW < 0.0001 ? 40 : (W / denomW) * sqrtTerm;
  }
  
  return Math.min(40, Math.max(0.1, qLeft, qRight));
}

export function calculateFrequencyLimits(q: number, gain: number, minFreq: number = MIN_FREQ, maxFreq: number = MAX_FREQ, maxSpillDb = MAX_SPILL_DB) {
  if (Math.abs(gain) <= maxSpillDb) {
      return { min: minFreq, max: maxFreq };
  }

  const A2 = Math.pow(10, Math.abs(gain) / 20);
  const gSpill = Math.pow(10, maxSpillDb / 10);
  
  const numerator = A2 - (gSpill / A2);
  const denominator = gSpill - 1;
  
  if (numerator <= 0 || denominator <= 0) {
      return { min: minFreq, max: maxFreq };
  }
  
  const sqrtTerm = Math.sqrt(numerator / denominator);
  const K = q / sqrtTerm;
  
  const wHigh = (1 + Math.sqrt(1 + 4 * K * K)) / (2 * K);
  const maxAllowedFreq = maxFreq / wHigh;

  const wLow = (-1 + Math.sqrt(1 + 4 * K * K)) / (2 * K);
  const minAllowedFreq = minFreq / wLow;
  
  if (minAllowedFreq > maxAllowedFreq) {
      const mid = Math.sqrt(minFreq * maxFreq);
      return { min: mid, max: mid };
  }

  return { min: Math.max(minFreq, minAllowedFreq), max: Math.min(maxFreq, maxAllowedFreq) };
}

// Logarithmic Frequency Mapping
// x goes from 0.0 to 1.0
export function freqToX(freq: number): number {
  const minLog = Math.log10(MIN_FREQ);
  const maxLog = Math.log10(MAX_FREQ);
  const x = (Math.log10(freq) - minLog) / (maxLog - minLog);
  return Math.max(0, Math.min(1, x));
}

export function xToFreq(x: number): number {
  const minLog = Math.log10(MIN_FREQ);
  const maxLog = Math.log10(MAX_FREQ);
  return Math.pow(10, minLog + x * (maxLog - minLog));
}

// Linear Gain Mapping (-18 to +18 dB)
export function gainToY(gain: number): number {
  // map +18 to 0.0, 0 to 0.5, -18 to 1.0
  const y = 0.5 - (gain / MAX_GAIN) * 0.5;
  return Math.max(0, Math.min(1, y));
}

export function yToGain(y: number): number {
  return (0.5 - y) * 2 * MAX_GAIN;
}

// Types
export interface EQNodeData {
  id: string;
  type: BiquadFilterType;
  freq: number;
  gain: number;
  q: number;
  enabled?: boolean;
  minFreq?: number;
  maxFreq?: number;
  minGain?: number;
  maxGain?: number;
}

/**
 * Validates how close user EQ is to target EQ.
 * Returns percentage (0-100)
 */
export function calculateMatchScore(userNodes: EQNodeData[], targetNodes: EQNodeData[]): number {
  if (userNodes.length === 0) return 100;
  
  let totalScore = 0;
  // Match sorted by frequency
  const sortedUser = [...userNodes].sort((a, b) => a.freq - b.freq);
  const sortedTarget = [...targetNodes].sort((a, b) => a.freq - b.freq);

  for (let i = 0; i < sortedUser.length; i++) {
    const u = sortedUser[i];
    const t = sortedTarget[i];
    
    // Frequency error (logarithmic distance)
    const logF_u = Math.log10(u.freq);
    const logF_t = Math.log10(t.freq);
    const distF = Math.abs(logF_u - logF_t); // max distance like ~3 (20 to 20k)
    const scoreF = Math.max(0, 1 - distF / 0.5); // 0.5 decade is 0 points

    // Gain error
    const uGain = u.enabled === false ? 0 : u.gain;
    const distG = Math.abs(uGain - t.gain);
    const scoreG = Math.max(0, 1 - distG / 6); // 6dB off is 0 points

    // Q error
    // If bypassed, Q doesn't matter, but let's just use it
    const distQ = Math.abs(u.q - t.q);
    const scoreQ = Math.max(0, 1 - distQ / 2); // 2 Q-off is 0 points


    totalScore += (scoreF * 0.5 + scoreG * 0.35 + scoreQ * 0.15); // Weights
  }
  
  return Math.max(0, Math.round((totalScore / userNodes.length) * 100));
}
