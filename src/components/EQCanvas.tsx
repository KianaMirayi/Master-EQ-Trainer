import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Power, Headphones, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { EQNodeData, freqToX, xToFreq, gainToY, yToGain, cn } from '../lib/utils';
import { AudioEngine } from '../lib/AudioEngine';

interface EQCanvasProps {
  engine: AudioEngine;
  userNodes: EQNodeData[];
  targetNodes?: EQNodeData[];
  onNodesChange: (nodes: EQNodeData[]) => void;
  showTarget: boolean;
}

export const BAND_COLORS = [
  '239, 68, 68',   // Red
  '249, 115, 22',  // Orange
  '234, 179, 8',   // Yellow
  '34, 197, 94',   // Green
  '6, 182, 212',   // Cyan
  '59, 130, 246',  // Blue
  '168, 85, 247',  // Purple
  '236, 72, 153'   // Pink
];

export function EQCanvas({ engine, userNodes, targetNodes, onNodesChange, showTarget }: EQCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [activeNodeIdx, setActiveNodeIdx] = useState<number | null>(null);
  const [hoveredNodeIdx, setHoveredNodeIdx] = useState<number | null>(null);
  const [listeningNodeIdx, setListeningNodeIdx] = useState<number | null>(null);
  
  const [editingFreqNodeIdx, setEditingFreqNodeIdx] = useState<number | null>(null);
  const [editingFreqValue, setEditingFreqValue] = useState<string>('');
  const [freqErrorMsg, setFreqErrorMsg] = useState<string | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnterNode = (idx: number) => {
      if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
      }
      setHoveredNodeIdx(idx);
  };

  const handleMouseLeaveNode = () => {
      if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
      }
      hoverTimeoutRef.current = setTimeout(() => {
          setHoveredNodeIdx(null);
      }, 2000); // 2 second delay
  };

  const closeEdit = useCallback(() => {
      setEditingFreqNodeIdx(null);
      setFreqErrorMsg(null);
      if (errorTimeoutRef.current) {
          clearTimeout(errorTimeoutRef.current);
          errorTimeoutRef.current = null;
      }
  }, []);

  const clearFreqError = useCallback(() => {
      setFreqErrorMsg(null);
      if (errorTimeoutRef.current) {
          clearTimeout(errorTimeoutRef.current);
          errorTimeoutRef.current = null;
      }
  }, []);

  const handleFreqEditSubmit = (idx: number) => {
      const val = parseFloat(editingFreqValue);
      if (isNaN(val)) {
          closeEdit();
          return;
      }
      const node = userNodes[idx];
      const minF = node.minFreq !== undefined ? node.minFreq : 20;
      const maxF = node.maxFreq !== undefined ? node.maxFreq : 20000;
      
      if (val < minF || val > maxF) {
          setFreqErrorMsg("输入的频率超过了频段范围");
          if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
          errorTimeoutRef.current = setTimeout(() => {
              setFreqErrorMsg(null);
          }, 2000);
          return;
      }
      const newNodes = [...userNodes];
      newNodes[idx] = { ...newNodes[idx], freq: val };
      onNodesChange(newNodes);
      closeEdit();
  };

  // References for temporal envelope smoothing
  const targetEnvelopeRef = useRef<Float32Array | null>(null);
  const userEnvelopeRef = useRef<Float32Array | null>(null);
  const meterPeakRef = useRef<{ rms: number, peak: number, peakHold: number, peakHoldFrames: number }>({ rms: -100, peak: -100, peakHold: -100, peakHoldFrames: 0 });

  const userNodesRef = useRef(userNodes);
  useEffect(() => {
    userNodesRef.current = userNodes;
  }, [userNodes]);

  // Resize handling
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Animation Loop for Spectrum & EQ Curve
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    const draw = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // --- Draw Grid ---
      ctx.lineWidth = 1;
      ctx.font = '10px monospace';

      const FREQ_TICKS = [20, 30, 50, 70, 100, 200, 300, 500, 700, 1000, 2000, 3000, 5000, 7000, 10000, 20000, 30000];
      const FREQ_LABELS: Record<number, string> = {
        20: '20', 30: '30', 50: '50', 70: '70', 100: '100', 200: '200', 300: '300', 
        500: '500', 700: '700', 1000: '1k', 2000: '2k', 3000: '3k', 5000: '5k', 
        7000: '7k', 10000: '10k', 20000: '20k', 30000: '30k'
      };

      // Vertical lines (Frequencies)
      FREQ_TICKS.forEach(freq => {
        const isHighlight = [20, 200, 2000, 20000].includes(freq);
        const x = freqToX(freq) * dimensions.width;
        
        ctx.strokeStyle = isHighlight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = isHighlight ? 2 : 1;
        
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dimensions.height);
        ctx.stroke();

        ctx.fillStyle = isHighlight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)';
        if (isHighlight) {
            ctx.font = 'bold 11px monospace';
        } else {
            ctx.font = '10px monospace';
        }
        
        let textX = x;
        if (freq === 20) {
            ctx.textAlign = 'left';
            textX = x + 12; // Push far enough inward from left rounded corner
        } else if (freq === 30000 || (freq === 20000 && x > dimensions.width - 25)) {
            ctx.textAlign = 'right';
            textX = x - 25; // Push away from meter and right edge
        } else {
            ctx.textAlign = 'center';
        }

        ctx.textBaseline = 'bottom';
        ctx.fillText(FREQ_LABELS[freq], textX, dimensions.height - 8); // Push up from bottom edge
      });

      ctx.font = '10px monospace'; // Reset font for horizontal lines

      // Horizontal lines (Gain)
      ctx.textAlign = 'right';
      const GAIN_TICKS = [12, 9, 6, 3, 0, -3, -6, -9, -12];
      GAIN_TICKS.forEach(gain => {
        const y = gainToY(gain) * dimensions.height;
        if (gain === 0) {
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)'; // Bright yellow for 0dB
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 1;
        }
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.width, y);
        ctx.stroke();

        // Outer Gain Label
        let textY = y;
        if (gain === 12) {
            ctx.textBaseline = 'top';
            textY = y + 12; // Push down from top rounded corner
        } else if (gain === -12) {
            ctx.textBaseline = 'bottom';
            textY = y - 12; // Push up from bottom rounded corner
        } else {
            ctx.textBaseline = 'middle';
        }

        ctx.fillStyle = gain === 0 ? 'rgba(234, 179, 8, 0.8)' : 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(`${gain > 0 ? '+' : ''}${gain} dB`, dimensions.width - 22, textY);
      });

      // Spectrum Amplitude Labels
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const AMP_TICKS = [0, -10, -20, -30, -40, -50, -60, -70, -80, -90];
      AMP_TICKS.forEach(amp => {
        const normalizedDb = Math.max(0, Math.min(1, (amp - (-100)) / (0 - (-100))));
        let y = dimensions.height - normalizedDb * dimensions.height;
        
        if (amp === 0) {
            ctx.textBaseline = 'top';
            y = y + 12; // Push down from top edge
        } else if (amp === -90) {
            ctx.textBaseline = 'bottom';
            y = Math.min(y, dimensions.height - 18); // Push up from bottom edge, avoid frequency labels
        } else {
            ctx.textBaseline = 'middle';
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillText(`${amp}`, 12, y); // Push right from left edge
      });

      // --- Draw Global Gain Hints ---
      // The user hints at [3, 9] dB and [-9, -3] dB as where target might be
      const yTop1 = gainToY(9) * dimensions.height;
      const yTop2 = gainToY(3) * dimensions.height;
      const yBot1 = gainToY(-3) * dimensions.height;
      const yBot2 = gainToY(-9) * dimensions.height;
      
      ctx.fillStyle = 'rgba(234, 179, 8, 0.05)';
      ctx.fillRect(0, yTop1, dimensions.width, yTop2 - yTop1);
      
      ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.fillRect(0, yBot1, dimensions.width, yBot2 - yBot1);
      
      // Draw borders for the global gain hints
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeRect(0, yTop1, dimensions.width, yTop2 - yTop1);
      ctx.strokeRect(0, yBot1, dimensions.width, yBot2 - yBot1);

      // --- Draw Spectrum ---
      const drawSpectrum = (data: Float32Array, colorGr: string, envelopeRef: React.MutableRefObject<Float32Array | null>, strokeColor?: string) => {
        const binCount = data.length;
        const sampleRate = engine.ctx.sampleRate || 48000;
        
        // Use 1 point per 2 pixels for a high-res but smooth curve
        const POINT_COUNT = Math.max(100, Math.floor(dimensions.width / 2));
        
        // Initialize temporal envelope if needed
        if (!envelopeRef.current || envelopeRef.current.length !== POINT_COUNT) {
            envelopeRef.current = new Float32Array(POINT_COUNT).fill(-100);
        }
        const envelope = envelopeRef.current;
        
        const attackMultiplier = 0.08;  // Lower value = slower rise (less sensitive to sudden peaks)
        const releaseMultiplier = 0.98; // Higher value = slower fall (smoother decay)

        const rawPoints = new Float32Array(POINT_COUNT);
        
        for (let p = 0; p < POINT_COUNT; p++) {
           const xStart = p / POINT_COUNT;
           const xEnd = (p + 1) / POINT_COUNT;
           const xCenter = (xStart + xEnd) / 2;
           
           const freqStart = xToFreq(xStart);
           const freqEnd = xToFreq(xEnd);
           const freqCenter = xToFreq(xCenter);
           
           const binStart = freqStart * binCount / (sampleRate / 2);
           const binEnd = freqEnd * binCount / (sampleRate / 2);
           const binCenter = freqCenter * binCount / (sampleRate / 2);
           const binWidth = binEnd - binStart;
           
           let val = -100;

           if (binWidth < 1.0) {
               // Interpolate for low frequencies to avoid staircasing
               const idx = Math.max(0, Math.min(binCount - 2, binCenter));
               const idxLow = Math.floor(idx);
               const idxHigh = idxLow + 1;
               const frac = idx - idxLow;
               
               const vL = data[idxLow] === -Infinity ? -100 : data[idxLow];
               const vH = data[idxHigh] === -Infinity ? -100 : data[idxHigh];
               
               // Cosine interpolation for smoother curves
               const mu2 = (1 - Math.cos(frac * Math.PI)) / 2;
               val = (vL * (1 - mu2) + vH * mu2);
           } else {
               // Max hold for high frequencies to not miss peaks
               const iStart = Math.floor(binStart);
               const iEnd = Math.min(binCount - 1, Math.ceil(binEnd)); 
               
               for (let i = Math.max(0, iStart); i <= iEnd; i++) {
                   const v = data[i] === -Infinity ? -100 : data[i];
                   if (v > val) val = v;
               }
           }
           rawPoints[p] = val;
        }

        // Spatial Smoothing (Visual Log-Domain)
        // 1. Dilate (Max Hold) to widen thin peaks slightly
        const dilatedPoints = new Float32Array(POINT_COUNT);
        const dilateRadius = 1; 
        for (let p = 0; p < POINT_COUNT; p++) {
            let maxP = -100;
            for (let dp = -dilateRadius; dp <= dilateRadius; dp++) {
                const idx = p + dp;
                if (idx >= 0 && idx < POINT_COUNT && rawPoints[idx] > maxP) {
                    maxP = rawPoints[idx];
                }
            }
            dilatedPoints[p] = maxP;
        }

        // 2. Blur (Moving Average) to smooth edges heavily
        const smoothedPoints = new Float32Array(POINT_COUNT);
        const blurRadius = 6; // Increased visual smoothing window
        for (let p = 0; p < POINT_COUNT; p++) {
             let sum = 0;
             let weightSum = 0;
             for (let dp = -blurRadius; dp <= blurRadius; dp++) {
                 const idx = p + dp;
                 if (idx >= 0 && idx < POINT_COUNT) {
                     // Gaussian-like window function (smooth curve)
                     const weight = Math.exp(-(dp*dp) / ((blurRadius/2)*(blurRadius/2)));
                     sum += dilatedPoints[idx] * weight;
                     weightSum += weight;
                 }
             }
             smoothedPoints[p] = sum / weightSum;
        }

        const points: {x: number, y: number}[] = [];
        
        for (let p = 0; p < POINT_COUNT; p++) {
           // Temporal Envelope Smoothing
           const curr = smoothedPoints[p];
           const prev = envelope[p];
           
           if (curr > prev) {
               envelope[p] = curr * attackMultiplier + prev * (1 - attackMultiplier);
           } else {
               envelope[p] = curr * (1 - releaseMultiplier) + prev * releaseMultiplier;
           }

           const db = envelope[p];
           const maxDb = 0;
           const minDb = -100;
           const normalizedDb = Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)));
           const yPos = dimensions.height - normalizedDb * dimensions.height;
           const xPos = (p + 0.5) / POINT_COUNT * dimensions.width;
           
           points.push({ x: xPos, y: yPos });
        }

        if (points.length < 2) return;

        // Draw Filled Area
        ctx.beginPath();
        ctx.moveTo(0, dimensions.height);
        ctx.lineTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length - 2; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        if (points.length > 2) {
            ctx.quadraticCurveTo(
                points[points.length - 2].x, points[points.length - 2].y, 
                points[points.length - 1].x, points[points.length - 1].y
            );
        }
        
        const lastX = points[points.length - 1].x;
        ctx.lineTo(lastX, dimensions.height);
        ctx.lineTo(0, dimensions.height);
        ctx.closePath();
        ctx.fillStyle = colorGr;
        ctx.fill();

        // Draw Stroke (Line)
        if (strokeColor) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length - 2; i++) {
              const xc = (points[i].x + points[i + 1].x) / 2;
              const yc = (points[i].y + points[i + 1].y) / 2;
              ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }
            if (points.length > 2) {
                ctx.quadraticCurveTo(
                    points[points.length - 2].x, points[points.length - 2].y, 
                    points[points.length - 1].x, points[points.length - 1].y
                );
            }
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
      };

      if (showTarget && targetNodes) {
        const targetBinCount = engine.targetAnalyser.frequencyBinCount;
        const targetFftData = new Float32Array(targetBinCount);
        engine.targetAnalyser.getFloatFrequencyData(targetFftData);
        drawSpectrum(targetFftData, 'rgba(168, 85, 247, 0.4)', targetEnvelopeRef); // Target: Purple base
      }
      
      // User Spectrum
      const userBinCount = engine.userAnalyser.frequencyBinCount;
      const userFftData = new Float32Array(userBinCount);
      engine.userAnalyser.getFloatFrequencyData(userFftData);
      drawSpectrum(userFftData, 'rgba(6, 182, 212, 0.15)', userEnvelopeRef, 'rgba(6, 182, 212, 0.3)'); // User: Cyan

      // --- Draw EQ curves ---
      const drawCurve = (isTarget: boolean, color: string, dashes: number[] = []) => {
        const response = engine.getFrequencyResponse(isTarget, dimensions.width);
        const midY = dimensions.height / 2;

        if (!isTarget && userNodes) {
            const individualResponses = engine.getIndividualFrequencyResponses(false, dimensions.width);
            const BAND_COLORS = [
              '239, 68, 68',   // Red
              '249, 115, 22',  // Orange
              '234, 179, 8',   // Yellow
              '34, 197, 94',   // Green
              '6, 182, 212',   // Cyan
              '59, 130, 246',  // Blue
              '168, 85, 247',  // Purple
              '236, 72, 153'   // Pink
            ];

            // Draw individual band fills
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            individualResponses.forEach((indResponse, idx) => {
                const bandColor = BAND_COLORS[idx % BAND_COLORS.length];
                ctx.beginPath();
                for (let x = 0; x < dimensions.width; x++) {
                    const db = indResponse[x];
                    const y = gainToY(db) * dimensions.height;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.lineTo(dimensions.width, midY);
                ctx.lineTo(0, midY);
                ctx.closePath();
                
                // Determine if this band is mostly cutting or boosting to set fill color appropriately
                let isCut = false;
                if (userNodes[idx] && userNodes[idx].gain < 0) {
                    isCut = true;
                }
                
                ctx.fillStyle = `rgba(${bandColor}, ${isCut ? '0.15' : '0.25'})`;
                ctx.fill();
            });
            ctx.restore();
            
            // Draw global curve fill (subtle background to tie it all together, mostly visible where bands combine)
            ctx.save();
            ctx.beginPath();
            for (let x = 0; x < dimensions.width; x++) {
                const db = response[x];
                const y = gainToY(db) * dimensions.height;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.lineTo(dimensions.width, midY);
            ctx.lineTo(0, midY);
            ctx.closePath();
            ctx.clip();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(0, 0, dimensions.width, dimensions.height);
            ctx.restore();
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash(dashes);
        ctx.beginPath();
        
        for (let x = 0; x < dimensions.width; x++) {
            const db = response[x];
            const y = gainToY(db) * dimensions.height;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };

      if (showTarget) {
        drawCurve(true, '#a855f7', [6, 4]); // Purple dashed
      }
      drawCurve(false, '#eab308'); // Main curve yellow

      // --- Draw Master Level Meter ---
      const levels = engine.getMasterLevel();
      const meter = meterPeakRef.current;
      
      meter.rms = Math.max(levels.rms, meter.rms - 1.5);
      
      if (levels.peak > meter.peak) {
          meter.peak = levels.peak;
          meter.peakHold = levels.peak;
          meter.peakHoldFrames = 60; // 1 second hold
      } else {
          meter.peak = Math.max(levels.peak, meter.peak - 1.5);
          if (meter.peakHoldFrames > 0) {
              meter.peakHoldFrames--;
          } else {
              meter.peakHold = Math.max(levels.peak, meter.peakHold - 0.5);
          }
      }

      const meterWidth = 6;
      const meterX = dimensions.width - 12;
      const meterTop = 15;
      const meterHeight = dimensions.height - 30;
      
      const MIN_DB = -60;
      const MAX_DB = 0;
      const dbToMeterY = (db: number) => {
          const clamped = Math.max(MIN_DB, Math.min(MAX_DB, db));
          const normalized = (clamped - MIN_DB) / (MAX_DB - MIN_DB);
          return meterTop + meterHeight * (1 - normalized);
      };

      // Meter BG
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(meterX, meterTop, meterWidth, meterHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(meterX, meterTop, meterWidth, meterHeight);

      // Meter Fill (RMS)
      const rmsY = dbToMeterY(meter.rms);
      const gradient = ctx.createLinearGradient(0, meterTop + meterHeight, 0, meterTop);
      gradient.addColorStop(0, '#22c55e');
      gradient.addColorStop(0.75, '#eab308');
      gradient.addColorStop(1, '#ef4444');
      ctx.fillStyle = gradient;
      ctx.fillRect(meterX, rmsY, meterWidth, (meterTop + meterHeight) - rmsY);

      // Peak Hold Line
      const peakY = dbToMeterY(meter.peakHold);
      ctx.fillStyle = meter.peakHold >= -0.1 ? '#ef4444' : '#ffffff';
      ctx.fillRect(meterX, peakY - 1, meterWidth, 2);

      // Peak Value Text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = '9px monospace';
      ctx.fillStyle = meter.peakHold >= -0.1 ? '#ef4444' : 'rgba(255, 255, 255, 0.7)';
      const textPeak = Math.max(MIN_DB, meter.peakHold).toFixed(1);
      ctx.fillText(textPeak, meterX + meterWidth / 2, meterTop - 2);

      frameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameId);
  }, [dimensions, engine, showTarget, targetNodes]);

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent, idx: number) => {
    setActiveNodeIdx(idx);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (activeNodeIdx === null || !containerRef.current) return;
    
    requestAnimationFrame(() => {
        const rect = containerRef.current!.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        
        const newFreq = xToFreq(x);
        const newGain = yToGain(y);

        const newNodes = [...userNodes];
        
        // Handle Q scrolling with Alt + drag vertically
        if (e.altKey) {
            // Y delta changes Q
            const yDelta = e.movementY;
            const newNode = { ...newNodes[activeNodeIdx] };
            newNode.q = Math.max(0.1, Math.min(10, newNode.q - yDelta * 0.1));
            newNodes[activeNodeIdx] = newNode;
        } else {
            const newNode = { ...newNodes[activeNodeIdx] };
            let finalFreq = newFreq;
            if (newNode.minFreq !== undefined && newNode.maxFreq !== undefined) {
                finalFreq = Math.max(newNode.minFreq, Math.min(newNode.maxFreq, finalFreq));
            }
            newNode.freq = finalFreq;
            // Only update gain if it's not a highpass/lowpass (which usually fix gain at 0)
            if (newNode.type !== 'highpass' && newNode.type !== 'lowpass') {
              let finalGain = newGain;
              if (newNode.minGain !== undefined && newNode.maxGain !== undefined) {
                  finalGain = Math.max(newNode.minGain, Math.min(newNode.maxGain, finalGain));
              }
              newNode.gain = finalGain;
            }
            newNodes[activeNodeIdx] = newNode;
        }
        if (listeningNodeIdx !== null && listeningNodeIdx === activeNodeIdx) {
            engine.setSoloBand(newNodes[activeNodeIdx]);
        }
        
        onNodesChange(newNodes);
    });
  }, [activeNodeIdx, listeningNodeIdx, userNodes, onNodesChange, engine]);

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeNodeIdx !== null) {
      setActiveNodeIdx(null);
      if (listeningNodeIdx !== null) {
          setListeningNodeIdx(null);
          engine.setSoloBand(null);
      }
      try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  const handleListenPointerDown = (e: React.PointerEvent, idx: number) => {
      e.stopPropagation();
      setActiveNodeIdx(idx);
      setListeningNodeIdx(idx);
      engine.setSoloBand(userNodes[idx]);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDoubleClick = (idx: number) => {
      const newNodes = [...userNodes];
      const newNode = { ...newNodes[idx] };
      newNode.gain = 0;
      newNodes[idx] = newNode;
      onNodesChange(newNodes);
  }

  const handleWheel = (e: WheelEvent, idx: number) => {
      e.stopPropagation();
      e.preventDefault();
      const newNodes = [...userNodes];
      const newNode = { ...newNodes[idx] };
      newNode.q = Math.max(0.1, Math.min(10, newNode.q - Math.sign(e.deltaY) * 0.5));
      newNodes[idx] = newNode;
      onNodesChange(newNodes);
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full bg-slate-900 overflow-hidden rounded-xl", activeNodeIdx !== null && "cursor-grabbing")}
      onPointerMove={activeNodeIdx !== null ? handlePointerMove : undefined}
      onPointerUp={activeNodeIdx !== null ? handlePointerUp : undefined}
      onPointerLeave={activeNodeIdx !== null ? handlePointerUp : undefined}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0 pointer-events-none"
      />
      
      {userNodes.map((node, idx) => {
        const xPos = freqToX(node.freq) * dimensions.width;
        const yPos = gainToY(node.gain) * dimensions.height;
        
        // Approximate width parameter for visual feedback based on Q
        const visualWidth = Math.max(20, Math.min(200, 100 / (node.q || 1)));
        const isActive = activeNodeIdx === idx;
        const isBypassed = node.enabled === false;
        const isBoost = node.gain >= 0;

        return (
          <div
            key={node.id}
            style={{ 
              left: `${xPos}px`, 
              top: `${yPos}px`, 
              transform: 'translate(-50%, -50%)',
              touchAction: 'none',
              opacity: isBypassed && !isActive ? 0.4 : 1
            }}
            className="absolute z-10 w-8 h-8 flex items-center justify-center select-none pointer-events-auto"
            onPointerEnter={() => handleMouseEnterNode(idx)}
            onPointerLeave={handleMouseLeaveNode}
          >
            {/* The interactive node circle */}
            <div
                onPointerDown={(e) => handlePointerDown(e, idx)}
                onDoubleClick={() => handleDoubleClick(idx)}
                onWheel={(e: any) => handleWheel(e, idx)}
                className={cn(
                    "w-4 h-4 rounded-full border-2 cursor-grab transition-all",
                    isActive ? "border-white scale-125 z-20" : "border-slate-300"
                )}
                style={{
                  backgroundColor: `rgba(${BAND_COLORS[idx % BAND_COLORS.length]}, ${isBypassed ? 0.2 : 0.8})`,
                  borderColor: isBypassed ? 'rgba(148, 163, 184, 0.5)' : `rgba(${BAND_COLORS[idx % BAND_COLORS.length]}, 1)`,
                  boxShadow: isActive 
                    ? `0 0 20px rgba(${BAND_COLORS[idx % BAND_COLORS.length]}, 0.8)`
                    : (isBypassed ? 'none' : `0 0 10px rgba(${BAND_COLORS[idx % BAND_COLORS.length]}, 0.3)`)
                }}
            >
            </div>

            {/* Q-width indicator */}
            <div 
              className={cn(
                  "absolute h-[2px] rounded-full pointer-events-none transition-all hidden",
                  isActive && "block",
              )}
              style={{ 
                  width: `${visualWidth}px`,
                  backgroundColor: `rgba(${BAND_COLORS[idx % BAND_COLORS.length]}, 0.5)`
              }}
            />
            
            {/* Hover / Active Tooltip */}
            <div 
                onPointerDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                className={cn(
                    "absolute bottom-full mb-3 bg-[#2a2d36] text-slate-300 rounded-lg shadow-xl border border-slate-700/50 flex flex-col z-50 pointer-events-auto font-mono text-[11px] whitespace-nowrap transition-opacity",
                    (isActive || hoveredNodeIdx === idx) ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
            >
                <div className="flex flex-col p-2 gap-1.5 relative">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                const newNodes = [...userNodes];
                                newNodes[idx] = { ...node, enabled: isBypassed };
                                onNodesChange(newNodes);
                            }}
                            className={cn(
                                "p-1 rounded transition-colors", 
                                isBypassed ? "text-slate-500 hover:text-slate-400 bg-slate-800" : "text-cyan-400 hover:text-cyan-300 bg-cyan-400/10"
                            )}
                        >
                            <Power size={12} />
                        </button>
                        {editingFreqNodeIdx === idx ? (
                            <div className="flex-1 relative flex items-center justify-center">
                                <input
                                    type="number"
                                    autoFocus
                                    className="w-14 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:_textfield] bg-slate-800 text-white text-center rounded px-1 py-0.5 outline-none text-[11px] font-mono border border-cyan-500/50"
                                    value={editingFreqValue}
                                    onChange={(e) => setEditingFreqValue(e.target.value)}
                                    // Make sure it doesn't close edit immediately if they click the X button,
                                    // We can just rely on closeEdit from onBlur, but to allow clicking X, check relatedTarget
                                    onBlur={(e) => {
                                        if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.freq-error-close')) {
                                            return; // handled by onClick
                                        }
                                        closeEdit();
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleFreqEditSubmit(idx);
                                        if (e.key === 'Escape') closeEdit();
                                    }}
                                />
                                <AnimatePresence>
                                    {freqErrorMsg && (
                                        <motion.div 
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800/95 text-red-400 text-[10px] pl-2 pr-1 py-1 rounded flex items-center gap-1.5 shadow-lg pointer-events-auto z-[60] border border-red-500/30 whitespace-nowrap backdrop-blur-sm"
                                        >
                                            <span>{freqErrorMsg}</span>
                                            <button 
                                                className="freq-error-close hover:bg-red-500/20 text-red-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                                                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); closeEdit(); }}
                                            >
                                                <X size={10} />
                                            </button>
                                            <div className="absolute right-full top-1/2 -translate-y-1/2 border-solid border-r-slate-800 border-r-[4px] border-y-transparent border-y-[4px] border-l-0"></div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <span 
                                className="flex-1 text-center font-semibold text-[11px] tracking-wide cursor-text hover:text-white transition-colors px-1 rounded hover:bg-slate-700"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingFreqNodeIdx(idx);
                                    setEditingFreqValue(node.freq.toFixed(1));
                                    clearFreqError();
                                }}
                                title="Click to edit frequency"
                            >
                                {node.freq < 10000 ? node.freq.toFixed(1) : (node.freq/1000).toFixed(1) + 'k'} Hz
                            </span>
                        )}
                        <button
                            onPointerDown={(e) => handleListenPointerDown(e, idx)}
                            className={cn(
                                "p-1 rounded cursor-grab active:cursor-grabbing transition-colors",
                                listeningNodeIdx === idx ? "bg-cyan-500 text-white" : "text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                            )}
                        >
                            <Headphones size={12} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between px-1 gap-4 text-[10px] tracking-wider text-slate-400">
                        <span className={isBoost ? "text-yellow-400" : "text-sky-400"}>
                            {node.gain > 0 ? '+' : ''}{node.gain.toFixed(2)} dB
                        </span>
                        <span>
                            Q: {node.q.toFixed(2)}
                        </span>
                    </div>
                </div>
                {/* Triangle pointing down */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-solid border-t-[#2a2d36] border-t-[6px] border-x-transparent border-x-[6px] border-b-0"></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
