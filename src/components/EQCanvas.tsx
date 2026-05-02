import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Power, Headphones, X, Activity, Settings, ChevronLeft, ChevronRight, Scissors, ChevronDown, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { EQNodeData, freqToX, xToFreq, gainToY, yToGain, cn } from '../lib/utils';
import { AudioEngine } from '../lib/AudioEngine';
import { Knob } from './Knob';

const MIN_Q = 0.1;
const MAX_Q = 40.0;
const SCROLL_SENSITIVITY_NORMAL = 1.05;
const SCROLL_SENSITIVITY_FINE = 1.01;

// ==========================================
// DEFAULT PANEL POSITION SETTINGS
// - DEFAULT_PANEL_FREQ: The initial center position (in Hz) on the visualizer.
//   Change this value (e.g. 100, 600, 1000) to move the initial default position left or right.
// - You can also change the `bottom-6` class in the JSX (search for `w-[540px]`) 
//   to `bottom-12`, `bottom-[100px]`, etc. to adjust vertical padding.
// ==========================================
export const DEFAULT_PANEL_FREQ = 240;


interface EQCanvasProps {
  engine: AudioEngine;
  userNodes: EQNodeData[];
  targetNodes?: EQNodeData[];
  onNodesChange: (nodes: EQNodeData[]) => void;
  showTarget: boolean;
  allowAddRemoveNodes?: boolean;
  listenMode?: 'user' | 'target';
}

// ==========================================
// SPECTRUM COLOR SETTINGS
// Modify these to change the spectrum analyzer waveforms in blind test / main view
// ==========================================
export const USER_SPECTRUM_FILL_COLOR = 'rgba(255, 229, 185, 0.15)';   // Cyan transparent fill
export const USER_SPECTRUM_STROKE_COLOR = 'rgba(255, 229, 185, 0.3)';  // Cyan stroke

export const TARGET_SPECTRUM_FILL_COLOR = 'rgba(168, 85, 247, 0.4)'; // Purple transparent fill
export const TARGET_SPECTRUM_STROKE_COLOR = undefined;               // undefined means no stroke by default

// ==========================================
// TARGET GAIN RANGE HINTS COLORS
// The colors for the horizontal shaded background areas indicating target gain regions
// ==========================================
export const TARGET_HINT_GAIN_TOP_COLOR = 'rgba(79, 159, 186, 0.1)';  // Boost area (default: yellow)
export const TARGET_HINT_GAIN_BOT_COLOR = 'rgba(56, 189, 248, 0.1)'; // Cut area (default: blue)

// ==========================================
// EQ BAND COLORS
// Used for the gain/attenuation bounds (under the EQ curve) and nodes
// ==========================================
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

// SVG-based Icons for different Stereo modes
const StereoModeIcon = ({ mode, className }: { mode: 'Stereo' | 'Mid' | 'Side', className?: string }) => {
    // Exact paths for the arcs of two intersecting circles at cx=7 and cx=13 with r=4.5
    const paths = {
        lOuter: "M 10 2.646 A 4.5 4.5 0 1 0 10 9.354",
        lInner: "M 10 2.646 A 4.5 4.5 0 0 1 10 9.354",
        rOuter: "M 10 2.646 A 4.5 4.5 0 1 1 10 9.354",
        rInner: "M 10 2.646 A 4.5 4.5 0 0 0 10 9.354"
    };

    if (mode === 'Stereo') {
        return (
            <svg width="20" height="12" viewBox="0 0 20 12" className={className}>
                <circle cx="7" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="13" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
        );
    }
    if (mode === 'Mid') {
        return (
            <svg width="20" height="12" viewBox="0 0 20 12" className={className}>
                <g strokeOpacity="0.3">
                    <path d={paths.lOuter} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d={paths.rOuter} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </g>
                <g strokeOpacity="1">
                    <path d={paths.lInner} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d={paths.rInner} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </g>
            </svg>
        );
    }
    if (mode === 'Side') {
        return (
            <svg width="20" height="12" viewBox="0 0 20 12" className={className}>
                <g strokeOpacity="1">
                    <path d={paths.lOuter} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d={paths.rOuter} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </g>
                <g strokeOpacity="0.3">
                    <path d={paths.lInner} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d={paths.rInner} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </g>
            </svg>
        );
    }
    return null;
}

const FilterTypeIcon = ({ type, className }: { type: 'peaking' | 'lowshelf' | 'highshelf', className?: string }) => {
    if (type === 'peaking') {
        return (
            <svg width="20" height="12" viewBox="0 0 20 12" className={className}>
                <path d="M 2 10 Q 6 10, 7 7 T 10 2 T 13 7 T 18 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    if (type === 'lowshelf') {
        return (
            <svg width="20" height="12" viewBox="0 0 20 12" className={className}>
                <path d="M 2 3 L 7 3 C 10 3, 11 6.5, 14 6.5 L 18 6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 2 10 L 7 10 C 10 10, 11 6.5, 14 6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    if (type === 'highshelf') {
        return (
            <svg width="20" height="12" viewBox="0 0 20 12" className={className}>
                <path d="M 2 6.5 L 6 6.5 C 9 6.5, 10 3, 13 3 L 18 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 6 6.5 C 9 6.5, 10 10, 13 10 L 18 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    return null;
}

export function EQCanvas({ engine, userNodes, targetNodes, onNodesChange, showTarget, allowAddRemoveNodes, listenMode = 'user' }: EQCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [activeNodeIdx, setActiveNodeIdx] = useState<number | null>(null);
  const [selectedNodeIdx, setSelectedNodeIdx] = useState<number | null>(null);
  const [hoveredNodeIdx, setHoveredNodeIdx] = useState<number | null>(null);
  const [fillHoverNodeIdx, setFillHoverNodeIdx] = useState<number | null>(null);
  const [listeningNodeIdx, setListeningNodeIdx] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<'none' | 'type' | 'stereo' | 'tooltipType'>('none');
  
  const [panelOffsets, setPanelOffsets] = useState<Record<number, number>>({});
  const isDraggingPanel = useRef(false);

  const isHoldingListenKey = useRef(false);

  // Clear listen state when switching to target mode
  useEffect(() => {
    if (listenMode === 'target') {
      if (listeningNodeIdx !== null) {
        setListeningNodeIdx(null);
        engine.setSoloBand(null);
      }
      if (activeNodeIdx !== null) {
        setActiveNodeIdx(null);
      }
      isHoldingListenKey.current = false;
    }
  }, [listenMode, listeningNodeIdx, activeNodeIdx, engine]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key repeats for the listen key
      if (e.repeat && (e.key === 's' || e.key === 'S' || e.key === 'l' || e.key === 'L')) return;

      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      if (isInputFocused) return;
      
      const isListenKey = e.key === 's' || e.key === 'S' || e.key === 'l' || e.key === 'L';
      if (isListenKey) {
        if (listenMode !== 'target' && selectedNodeIdx !== null && userNodes[selectedNodeIdx]) {
           isHoldingListenKey.current = true;
           setListeningNodeIdx(selectedNodeIdx);
           engine.setSoloBand(userNodes[selectedNodeIdx]);
        }
        return;
      }

      const nNodes = userNodes.length;
      if (nNodes === 0) return;

      const sortedIndices = userNodes
        .map((node, i) => ({ index: i, freq: node.freq }))
        .sort((a, b) => a.freq - b.freq)
        .map(item => item.index);

      if (/^[1-9]$/.test(e.key)) {
        const num = parseInt(e.key, 10);
        if (num > 0 && num <= nNodes) {
          e.preventDefault();
          const targetIdx = num - 1;
          setSelectedNodeIdx(targetIdx);
          if (isHoldingListenKey.current && userNodes[targetIdx]) {
             setListeningNodeIdx(targetIdx);
             engine.setSoloBand(userNodes[targetIdx]);
          }
          return;
        }
      }

      const isPrev = e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey);
      const isNext = e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey);

      if (isPrev || isNext) {
         e.preventDefault();

         let nextSelection = sortedIndices[0];

         if (selectedNodeIdx === null) {
            nextSelection = isPrev ? sortedIndices[sortedIndices.length - 1] : sortedIndices[0];
         } else {
            const currentSortedPosition = sortedIndices.indexOf(selectedNodeIdx);
            if (currentSortedPosition !== -1) {
               let nextPosition;
               if (isPrev) {
                  nextPosition = currentSortedPosition - 1;
                  if (nextPosition < 0) nextPosition = sortedIndices.length - 1;
               } else {
                  nextPosition = currentSortedPosition + 1;
                  if (nextPosition >= sortedIndices.length) nextPosition = 0;
               }
               nextSelection = sortedIndices[nextPosition];
            } else {
               nextSelection = isPrev ? sortedIndices[sortedIndices.length - 1] : sortedIndices[0];
            }
         }
         
         setSelectedNodeIdx(nextSelection);
         if (isHoldingListenKey.current && userNodes[nextSelection]) {
             setListeningNodeIdx(nextSelection);
             engine.setSoloBand(userNodes[nextSelection]);
         }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isListenKey = e.key === 's' || e.key === 'S' || e.key === 'l' || e.key === 'L';
      if (isListenKey) {
        isHoldingListenKey.current = false;
        // Do not affect mouse hold if activeNodeIdx is active, though we handle that primarily below.
        setListeningNodeIdx(null);
        engine.setSoloBand(null);
      }
    };

    const handleBlur = () => {
      isHoldingListenKey.current = false;
      setListeningNodeIdx(null);
      engine.setSoloBand(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
       window.removeEventListener('keydown', handleKeyDown);
       window.removeEventListener('keyup', handleKeyUp);
       window.removeEventListener('blur', handleBlur);
    };
  }, [selectedNodeIdx, userNodes, engine, listenMode]);

  const handlePanelPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setOpenDropdown('none');
    
    // Ignore dragging if clicked on an actual interactive UI component
    if ((e.target as HTMLElement).closest('button, select, input, .knob-container, .interactive')) {
        return;
    }
    
    if (selectedNodeIdx === null) return;
    
    // Compute current bounds
    const node = userNodes[selectedNodeIdx];
    if (!node) return;
    const panelHalfWidth = 240;
    const minX = panelHalfWidth + 10;
    const maxX = dimensions.width > 0 ? dimensions.width - panelHalfWidth - 10 : panelHalfWidth + 10;
    
    // Default position
    let baseLeft = freqToX(DEFAULT_PANEL_FREQ) * dimensions.width;
    baseLeft = Math.max(minX, Math.min(baseLeft, maxX));
    if (dimensions.width === 0) baseLeft = 0;
    
    e.preventDefault();
    isDraggingPanel.current = true;
    const startX = e.clientX;
    const startOffset = panelOffsets[selectedNodeIdx] || 0;
    
    // We don't need pointer capture if we use window events, but we can do both just in case
    // For safer behavior across all browsers, window events work best.
    
    const onMove = (moveEv: PointerEvent) => {
        if (!isDraggingPanel.current) return;
        const requestedOffset = startOffset + (moveEv.clientX - startX);
        const requestedLeft = baseLeft + requestedOffset;
        let clampedLeft = Math.max(minX, Math.min(requestedLeft, maxX));
        if (dimensions.width === 0) clampedLeft = requestedLeft;
        
        setPanelOffsets(prev => ({
            ...prev,
            [selectedNodeIdx]: clampedLeft - baseLeft
        }));
    };
    
    const onUp = (upEv: PointerEvent) => {
        isDraggingPanel.current = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    };
    
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };
  
  const [editingFreqNodeIdx, setEditingFreqNodeIdx] = useState<number | null>(null);
  const [editingFreqValue, setEditingFreqValue] = useState<string>('');
  const [freqErrorMsg, setFreqErrorMsg] = useState<string | null>(null);
  const [editingGainNodeIdx, setEditingGainNodeIdx] = useState<number | null>(null);
  const [editingGainValue, setEditingGainValue] = useState<string>('');
  const [editingQNodeIdx, setEditingQNodeIdx] = useState<number | null>(null);
  const [editingQValue, setEditingQValue] = useState<string>('');
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fillHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnterNode = (idx: number) => {
      if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
      }
      setHoveredNodeIdx(idx);

      if (fillHoverTimeoutRef.current) {
          clearTimeout(fillHoverTimeoutRef.current);
      }
      fillHoverTimeoutRef.current = setTimeout(() => {
          setFillHoverNodeIdx(idx);
      }, 1000);
  };

  const handleMouseLeaveNode = () => {
      if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
      }
      hoverTimeoutRef.current = setTimeout(() => {
          setHoveredNodeIdx(null);
      }, 2000); // 2 second delay

      if (fillHoverTimeoutRef.current) {
          clearTimeout(fillHoverTimeoutRef.current);
      }
      setFillHoverNodeIdx(null);
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

  const userNodesRef = useRef(userNodes);
  useEffect(() => {
    userNodesRef.current = userNodes;
  }, [userNodes]);

  const listeningNodeIdxRef = useRef(listeningNodeIdx);
  useEffect(() => {
    listeningNodeIdxRef.current = listeningNodeIdx;
  }, [listeningNodeIdx]);

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

      const FREQ_TICKS = [
        20, 30, 40, 50, 60, 70, 80, 100, 
        200, 300, 400, 500, 600, 700, 800, 900, 1000, 
        2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 20000
      ];
      const FREQ_LABELS: Record<number, string> = {
        20: '20', 30: '30', 50: '50', 70: '70', 100: '100', 
        200: '200', 300: '300', 500: '500', 700: '700', 1000: '1k', 
        2000: '2k', 3000: '3k', 5000: '5k', 7000: '7k', 10000: '10k', 20000: '20k'
      };

      // Vertical lines (Frequencies)
      FREQ_TICKS.forEach(freq => {
        const isMajorHighlight = [20, 200, 2000, 20000].includes(freq);
        const isMinorHighlight = [50, 500, 5000].includes(freq);
        const x = freqToX(freq) * dimensions.width;
        
        if (isMajorHighlight) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        } else if (isMinorHighlight) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        }
        ctx.lineWidth = (isMajorHighlight || isMinorHighlight) ? 2 : 1;
        
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dimensions.height);
        ctx.stroke();

        ctx.fillStyle = isMajorHighlight ? 'rgba(255, 255, 255, 0.8)' : (isMinorHighlight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.4)');
        if (isMajorHighlight) {
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
            textX = x - 38; // Push away from right edge to avoid overlapping with -12 dB label
        } else {
            ctx.textAlign = 'center';
        }

        ctx.textBaseline = 'bottom';
        if (FREQ_LABELS[freq]) {
            ctx.fillText(FREQ_LABELS[freq], textX, dimensions.height - 8); // Push up from bottom edge
        }
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
        ctx.fillText(`${gain > 0 ? '+' : ''}${gain} dB`, dimensions.width - 6, textY);
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
      
      ctx.fillStyle = TARGET_HINT_GAIN_TOP_COLOR;
      ctx.fillRect(0, yTop1, dimensions.width, yTop2 - yTop1);
      
      ctx.fillStyle = TARGET_HINT_GAIN_BOT_COLOR;
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
        drawSpectrum(targetFftData, TARGET_SPECTRUM_FILL_COLOR, targetEnvelopeRef, TARGET_SPECTRUM_STROKE_COLOR);
      }
      
      // User Spectrum
      const userBinCount = engine.userAnalyser.frequencyBinCount;
      const userFftData = new Float32Array(userBinCount);
      engine.userAnalyser.getFloatFrequencyData(userFftData);
      drawSpectrum(userFftData, USER_SPECTRUM_FILL_COLOR, userEnvelopeRef, USER_SPECTRUM_STROKE_COLOR);

      // --- Draw EQ curves ---
      const drawCurve = (isTarget: boolean, color: string, dashes: number[] = []) => {
        const { mid: midResponse, side: sideResponse } = engine.getFrequencyResponse(isTarget, dimensions.width);
        const midY = dimensions.height / 2;

        let selectedMode = 'Stereo';
        const latestNodes = userNodesRef.current || [];
        if (!isTarget && selectedNodeIdx !== null) {
            const node = latestNodes[selectedNodeIdx];
            if (node) {
                selectedMode = node.stereoMode || 'Stereo';
            }
        }

        let isPureStereo = true;
        if (isTarget && targetNodes) {
            isPureStereo = !targetNodes.some(node => (node.stereoMode === 'Mid' || node.stereoMode === 'Side'));
        } else if (!isTarget) {
            isPureStereo = !latestNodes.some(node => node.enabled !== false && (node.stereoMode === 'Mid' || node.stereoMode === 'Side'));
        }

        // --- LAYER 1: Global Curves ---
        ctx.save();
        
        if (!isTarget && isPureStereo) {
            ctx.setLineDash(dashes);
            // Fast Path: Pure Stereo
            ctx.lineWidth = 2.5 * 2.5; 
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = color;
            ctx.beginPath();
            for (let x = 0; x < dimensions.width; x++) {
                const db = midResponse[x]; // Pure stereo, mid == side
                const y = gainToY(db) * dimensions.height;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            ctx.globalAlpha = 1.0;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let x = 0; x < dimensions.width; x++) {
                const db = midResponse[x];
                const y = gainToY(db) * dimensions.height;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else if (isTarget) {
            ctx.setLineDash(dashes);
            
            if (isPureStereo) {
                 // Fast Path: Pure Stereo for Target (Original Style with glow)
                 ctx.lineWidth = 2.5 * 2.5; 
                 ctx.globalAlpha = 0.25;
                 ctx.strokeStyle = color;
                 ctx.beginPath();
                 for (let x = 0; x < dimensions.width; x++) {
                     const db = midResponse[x];
                     const y = gainToY(db) * dimensions.height;
                     if (x === 0) ctx.moveTo(x, y);
                     else ctx.lineTo(x, y);
                 }
                 ctx.stroke();

                 ctx.globalAlpha = 1.0;
                 ctx.lineWidth = 2.5;
                 ctx.beginPath();
                 for (let x = 0; x < dimensions.width; x++) {
                    const db = midResponse[x];
                    const y = gainToY(db) * dimensions.height;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                 }
                 ctx.stroke();
            } else {
                 ctx.lineWidth = 2.5;
                 // Target M/S Path - distinct colors to visualize mid and side clearly
                 // Draw Mid Curve
                 ctx.strokeStyle = '#22c55e'; // Green for Target Mid
                 ctx.beginPath();
                 for (let x = 0; x < dimensions.width; x++) {
                    const db = midResponse[x];
                    const y = gainToY(db) * dimensions.height;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                 }
                 ctx.stroke();
                 
                 // Draw Side Curve
                 ctx.strokeStyle = '#3b82f6'; // Blue for Target Side
                 ctx.beginPath();
                 for (let x = 0; x < dimensions.width; x++) {
                    const db = sideResponse[x];
                    const y = gainToY(db) * dimensions.height;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                 }
                 ctx.stroke();
            }
        } else {
            // Advanced Path: M/S Delta Fusion
            const MERGE_THRESHOLD = 0.5;

            // Alpha logic
            let midBaseAlpha = 0.8, sideBaseAlpha = 0.8;
            let midLineWidth = 2, sideLineWidth = 2;
            
            if (selectedNodeIdx !== null) {
                if (selectedMode === 'Mid') {
                    midBaseAlpha = 1.0; midLineWidth = 3;
                    sideBaseAlpha = 0.2; sideLineWidth = 2;
                } else if (selectedMode === 'Side') {
                    sideBaseAlpha = 1.0; sideLineWidth = 3;
                    midBaseAlpha = 0.2; midLineWidth = 2;
                }
            }

            const interpolateColor = (c1: [number,number,number,number], c2: [number,number,number,number], factor: number) => {
                const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
                const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
                const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
                const a = c1[3] + factor * (c2[3] - c1[3]);
                return `rgba(${r}, ${g}, ${b}, ${a})`;
            };

            const midYellow: [number, number, number, number] = [234, 179, 8, midBaseAlpha];
            const sideYellowMerged: [number, number, number, number] = [234, 179, 8, 0];
            
            const GREEN: [number, number, number, number] = [34, 197, 94, midBaseAlpha];
            const BLUE: [number, number, number, number] = [59, 130, 246, sideBaseAlpha];

            const midGradient = ctx.createLinearGradient(0, 0, dimensions.width, 0);
            const sideGradient = ctx.createLinearGradient(0, 0, dimensions.width, 0);

            const STEP = 5;
            if (dimensions.width > 1) {
                let lastOffset = -1;
                for (let x = 0; x < dimensions.width; x += STEP) {
                    const delta = Math.abs(midResponse[x] - sideResponse[x]);
                    let factor = Math.min(1, delta / MERGE_THRESHOLD);
                    const offset = x / (dimensions.width - 1);
                    midGradient.addColorStop(offset, interpolateColor(midYellow, GREEN, factor));
                    sideGradient.addColorStop(offset, interpolateColor(sideYellowMerged, BLUE, factor));
                    lastOffset = offset;
                }
                if (lastOffset < 1) {
                    const x = dimensions.width - 1;
                    const delta = Math.abs(midResponse[x] - sideResponse[x]);
                    let factor = Math.min(1, delta / MERGE_THRESHOLD);
                    midGradient.addColorStop(1, interpolateColor(midYellow, GREEN, factor));
                    sideGradient.addColorStop(1, interpolateColor(sideYellowMerged, BLUE, factor));
                }
            }

            // Draw Side Curve (Bottom-most)
            // Add a thick glow stroke first
            ctx.lineWidth = sideLineWidth * 2.5;
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = sideGradient;
            ctx.beginPath();
            for (let x = 0; x < dimensions.width; x++) {
                const db = sideResponse[x];
                const y = gainToY(db) * dimensions.height;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Then draw the crisp main line
            ctx.globalAlpha = 1.0;
            ctx.lineWidth = sideLineWidth;
            ctx.beginPath();
            for (let x = 0; x < dimensions.width; x++) {
                const db = sideResponse[x];
                const y = gainToY(db) * dimensions.height;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Draw Mid Curve
            // Add a thick glow stroke first
            ctx.lineWidth = midLineWidth * 2.5;
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = midGradient;
            ctx.beginPath();
            for (let x = 0; x < dimensions.width; x++) {
                const db = midResponse[x];
                const y = gainToY(db) * dimensions.height;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Then draw the crisp main line
            ctx.globalAlpha = 1.0;
            ctx.lineWidth = midLineWidth;
            ctx.beginPath();
            for (let x = 0; x < dimensions.width; x++) {
                const db = midResponse[x];
                const y = gainToY(db) * dimensions.height;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();

        // --- LAYER 2: Selected Node Active Fill ---
        if (!isTarget && fillHoverNodeIdx !== null && latestNodes.length > 0) {
            const individualResponses = engine.getIndividualFrequencyResponses(false, dimensions.width);
            const activeIndResp = individualResponses[fillHoverNodeIdx];
            
            if (activeIndResp) {
                const node = latestNodes[fillHoverNodeIdx];
                const mode = node?.stereoMode || 'Stereo';
                
                const { midDb, sideDb, outDb } = activeIndResp;
                let fillCurve = outDb;
                let fillColor = 'rgba(255, 200, 0, 0.2)'; // Yellow
                if (mode === 'Mid') {
                    fillCurve = midDb;
                    fillColor = 'rgba(0, 255, 150, 0.2)'; // Green
                } else if (mode === 'Side') {
                    fillCurve = sideDb;
                    fillColor = 'rgba(0, 150, 255, 0.2)'; // Blue
                }

                ctx.save();
                ctx.beginPath();
                for (let x = 0; x < dimensions.width; x++) {
                    const db = fillCurve[x];
                    const y = gainToY(db) * dimensions.height;
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.lineTo(dimensions.width, midY);
                ctx.lineTo(0, midY);
                ctx.closePath();
                ctx.fillStyle = fillColor;
                ctx.fill();
                ctx.restore();
            }
        }

        const currentListeningIdx = listeningNodeIdxRef.current;
        if (!isTarget && currentListeningIdx !== null && latestNodes.length > 0) {
            const BAND_COLORS = [
              '239, 68, 68', '249, 115, 22', '234, 179, 8', '34, 197, 94', 
              '6, 182, 212', '59, 130, 246', '168, 85, 247', '236, 72, 153'
            ];
            const bandColor = BAND_COLORS[currentListeningIdx % BAND_COLORS.length];
            // stroke the listened band
            const node = latestNodes[currentListeningIdx];
            if (node) {
                const Q = node.q;
                const f0 = node.freq; 
                const term = Math.sqrt(1 + 1 / (4 * Q * Q));
                const fL = f0 * (term - 1 / (2 * Q));
                const fH = f0 * (term + 1 / (2 * Q));
                const xL = freqToX(fL) * dimensions.width;
                const xH = freqToX(fH) * dimensions.width;
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = `rgba(${bandColor}, 1)`;
                ctx.lineWidth = 1;
                ctx.moveTo(xL, 0);
                ctx.lineTo(xL, dimensions.height);
                ctx.moveTo(xH, 0);
                ctx.lineTo(xH, dimensions.height);
                ctx.stroke();
                ctx.restore();
            }
        }
      };

      if (showTarget) {
        drawCurve(true, '#a855f7', [6, 4]); // Purple dashed
      }
      drawCurve(false, '#eab308'); // Main curve yellow


      frameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameId);
  }, [dimensions, engine, showTarget, targetNodes]);

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    setActiveNodeIdx(idx);
    setSelectedNodeIdx(idx);
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
            if (newNode.type === 'peaking') {
                newNode.q = Math.max(0.1, Math.min(40, newNode.q - yDelta * 0.1));
                newNodes[activeNodeIdx] = newNode;
            }
        } else {
            const newNode = { ...newNodes[activeNodeIdx] };
            let finalFreq = newFreq;
            
            if (newNode.minFreq !== undefined && newNode.maxFreq !== undefined) {
                finalFreq = Math.max(newNode.minFreq, Math.min(newNode.maxFreq, finalFreq));
            }
            
            let finalGain = newGain;
            if (newNode.minGain !== undefined && newNode.maxGain !== undefined) {
                finalGain = Math.max(newNode.minGain, Math.min(newNode.maxGain, finalGain));
            }
            newNode.gain = finalGain;
            
            newNode.freq = finalFreq;
            
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
      if (listenMode === 'target') return;
      setActiveNodeIdx(idx);
      setSelectedNodeIdx(idx);
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
      if (newNode.type === 'peaking') {
          const sensitivity = e.shiftKey ? SCROLL_SENSITIVITY_FINE : SCROLL_SENSITIVITY_NORMAL;
          
          if (Math.sign(e.deltaY) > 0) {
              newNode.q = (newNode.q || 1) * sensitivity;
          } else if (Math.sign(e.deltaY) < 0) {
              newNode.q = (newNode.q || 1) / sensitivity;
          }
          
          newNode.q = Math.max(MIN_Q, Math.min(MAX_Q, newNode.q));
          
          newNodes[idx] = newNode;
          onNodesChange(newNodes);
      }
  };

  const handleGlobalWheel = (e: React.WheelEvent) => {
      if (activeNodeIdx !== null) {
          handleWheel(e as any, activeNodeIdx);
      }
  };

  const handleBackgroundDoubleClick = (e: React.MouseEvent) => {
      if (!allowAddRemoveNodes || !containerRef.current) return;
      if (userNodes.length >= 10) return; // limit to 10 nodes
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      
      const newFreq = xToFreq(x);
      const newGain = yToGain(y);

      const newNode: EQNodeData = {
          id: `c_n_${Date.now()}`,
          freq: newFreq,
          gain: newGain,
          q: 1,
          type: 'peaking',
          stereoMode: 'Stereo'
      };

      onNodesChange([...userNodes, newNode]);
      setSelectedNodeIdx(userNodes.length);
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full bg-[#050915] overflow-hidden rounded-xl", activeNodeIdx !== null && "cursor-grabbing")}
      onPointerDown={() => {
        setSelectedNodeIdx(null);
        setOpenDropdown('none');
      }}
      onPointerMove={activeNodeIdx !== null ? handlePointerMove : undefined}
      onPointerUp={activeNodeIdx !== null ? handlePointerUp : undefined}
      onPointerLeave={activeNodeIdx !== null ? handlePointerUp : undefined}
      onWheel={handleGlobalWheel}
      onDoubleClick={handleBackgroundDoubleClick}
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
        const effectiveQ = node.q || 1;
        const visualWidth = Math.max(20, Math.min(200, 100 / effectiveQ));
        const isActive = activeNodeIdx === idx && listenMode !== 'target';
        const isSelected = selectedNodeIdx === idx && listenMode !== 'target';
        const isBypassed = node.enabled === false;
        const isBoost = node.gain >= 0;
        
        let nodeColor = BAND_COLORS[idx % BAND_COLORS.length];
        // If node is Mid or Side, optionally adapt its color, but standard behavior usually keeps band color
        // so we can distinguish bands. We'll use the band color for the knob, but we dim unselected nodes.

        const isAnySelected = selectedNodeIdx !== null;
        let dotOpacity = isBypassed ? 0.3 : 1;
        if (listenMode === 'target') {
            dotOpacity = 0.15;
        } else if (isAnySelected && !isSelected && !isActive) {
            dotOpacity *= 0.4;
        }

        const isShelf = node.type === 'lowshelf' || node.type === 'highshelf';

        return (
          <div
            key={node.id}
            style={{ 
              left: `${xPos}px`, 
              top: `${yPos}px`, 
              transform: 'translate(-50%, -50%)',
              touchAction: 'none',
              opacity: dotOpacity,
              transition: 'opacity 0.2s',
            }}
            className="absolute z-10 w-8 h-8 flex items-center justify-center select-none pointer-events-auto"
            onPointerEnter={() => handleMouseEnterNode(idx)}
            onPointerLeave={handleMouseLeaveNode}
          >
            {/* The interactive node circle */}
            <div
                className={cn(
                    "absolute pointer-events-none rounded-full transition-all duration-300",
                    (isActive || isSelected) ? "w-10 h-10 opacity-100 blur-md scale-100" : "w-4 h-4 opacity-0 blur-none scale-50"
                )}
                style={{
                    backgroundColor: `rgba(${nodeColor}, 0.5)`
                }}
            />
            
            {(node.stereoMode === 'Side' || node.stereoMode === 'Mid') && (
                <div
                    className={cn(
                        "absolute top-1/2 -translate-y-1/2 min-w-[12px] h-[12px] flex items-center justify-center text-[8px] font-bold rounded-[2px] shadow-sm pointer-events-none z-10",
                        node.stereoMode === 'Side' ? "left-full ml-1 bg-[#3b82f6] text-white" : "right-full mr-1 bg-[#22c55e] text-white"
                    )}
                >
                    {node.stereoMode === 'Side' ? 'S' : 'M'}
                </div>
            )}
            
            <div
                onPointerDown={(e) => handlePointerDown(e, idx)}
                onDoubleClick={() => handleDoubleClick(idx)}
                onWheel={(e: any) => handleWheel(e, idx)}
                className={cn(
                    "w-4 h-4 rounded-full border-2 cursor-grab transition-all",
                    (isActive || isSelected) || listeningNodeIdx === idx ? "border-white scale-125 z-20" : "border-slate-300",
                    listeningNodeIdx !== null && listeningNodeIdx !== idx && "opacity-20 saturate-0 scale-90"
                )}
                style={{
                  backgroundColor: `rgba(${nodeColor}, ${isBypassed ? 0.2 : 0.8})`,
                  borderColor: isBypassed ? 'rgba(148, 163, 184, 0.5)' : `rgba(${nodeColor}, 1)`,
                  boxShadow: (isActive || isSelected)
                    ? `0 0 15px rgba(${nodeColor}, 0.9)`
                    : (isBypassed ? 'none' : `0 0 4px rgba(${nodeColor}, 0.3)`)
                }}
            >
            </div>

            {/* Q-width indicator */}
            {!isShelf && (
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
            )}
            
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
                    <div className="flex w-full px-1 relative">
                        <button
                            className="w-full bg-[#1e2027] hover:bg-[#252830] text-slate-300 rounded-full px-3 py-1.5 text-[10px] font-medium border border-[#2a2d36] flex items-center justify-between transition-colors outline-none cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdown(prev => prev === 'tooltipType' ? 'none' : 'tooltipType');
                            }}
                        >
                            <div className="flex items-center gap-1.5">
                                <FilterTypeIcon type={node.type as 'peaking'|'lowshelf'|'highshelf'} className="text-slate-400" />
                                {node.type === 'peaking' ? 'Bell' : node.type === 'lowshelf' ? 'Low Shelf' : 'High Shelf'}
                            </div>
                            <ChevronDown size={10} className="opacity-50" />
                        </button>
                        
                        <AnimatePresence>
                            {openDropdown === 'tooltipType' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute top-full left-1 right-1 mt-1 bg-[#1e2027] border border-[#2a2d36] rounded-xl shadow-xl overflow-hidden z-[60] flex flex-col p-1"
                                >
                                    {['peaking', 'lowshelf', 'highshelf'].map((t) => (
                                        <button
                                            key={t}
                                            className={cn(
                                                "w-full text-left px-2 py-1.5 text-[10px] font-medium rounded-lg transition-colors flex items-center gap-2",
                                                node.type === t ? "bg-[#252830] text-white" : "text-slate-400 hover:bg-[#252830] hover:text-slate-200"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newNodes = [...userNodes];
                                                newNodes[idx] = { ...node, type: t as any };
                                                if (t === 'lowshelf' || t === 'highshelf') {
                                                    newNodes[idx].q = 1.0;
                                                } else {
                                                    newNodes[idx].q = Math.max(0.1, Math.min(40, newNodes[idx].q));
                                                }
                                                onNodesChange(newNodes);
                                                setOpenDropdown('none');
                                            }}
                                        >
                                            <FilterTypeIcon type={t as 'peaking'|'lowshelf'|'highshelf'} className={node.type === t ? "text-cyan-400" : "opacity-50"} />
                                            {t === 'peaking' ? 'Bell' : t === 'lowshelf' ? 'Low Shelf' : 'High Shelf'}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <div className="flex items-center justify-between px-1 gap-4 text-[10px] tracking-wider text-slate-400 min-h-[16px]">
                        {editingGainNodeIdx === idx ? (
                            <input
                                autoFocus
                                className="w-[46px] bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono rounded px-1 text-center outline-none focus:border-cyan-500 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none z-[70] py-0.5 -my-0.5"
                                value={editingGainValue}
                                onChange={(e) => setEditingGainValue(e.target.value)}
                                onBlur={() => {
                                    setEditingGainNodeIdx(null);
                                    const parsed = parseFloat(editingGainValue);
                                    if (!isNaN(parsed)) {
                                        const newNodes = [...userNodes];
                                        let newVal = parsed;
                                        const maxG = node.maxGain !== undefined ? node.maxGain : 24;
                                        const minG = node.minGain !== undefined ? node.minGain : -24;
                                        if (newVal > maxG) newVal = maxG;
                                        if (newVal < minG) newVal = minG;
                                        newNodes[idx] = { ...node, gain: newVal };
                                        onNodesChange(newNodes);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                    if (e.key === 'Escape') setEditingGainNodeIdx(null);
                                }}
                            />
                        ) : (
                            <span 
                                className={cn(isBoost ? "text-yellow-400" : "text-sky-400", "cursor-text hover:text-white transition-colors")}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingGainNodeIdx(idx);
                                    setEditingGainValue(node.gain.toFixed(2));
                                }}
                            >
                                {node.gain > 0 ? '+' : ''}{node.gain.toFixed(2)} dB
                            </span>
                        )}
                        
                        {isShelf ? (
                            <span className="text-slate-500 cursor-not-allowed">
                                Q: 1.00
                            </span>
                        ) : (
                            editingQNodeIdx === idx ? (
                                <input
                                    autoFocus
                                    className="w-[46px] bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono rounded px-1 text-center outline-none focus:border-cyan-500 [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none z-[70] py-0.5 -my-0.5"
                                    value={editingQValue}
                                    onChange={(e) => setEditingQValue(e.target.value)}
                                    onBlur={() => {
                                        setEditingQNodeIdx(null);
                                        const parsed = parseFloat(editingQValue);
                                        if (!isNaN(parsed) && parsed > 0) {
                                            const newNodes = [...userNodes];
                                            let newVal = parsed;
                                            if (newVal > MAX_Q) newVal = MAX_Q;
                                            if (newVal < MIN_Q) newVal = MIN_Q;
                                            newNodes[idx] = { ...node, q: newVal };
                                            onNodesChange(newNodes);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.currentTarget.blur();
                                        if (e.key === 'Escape') setEditingQNodeIdx(null);
                                    }}
                                />
                            ) : (
                                <span 
                                    className="cursor-text hover:text-white transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingQNodeIdx(idx);
                                        setEditingQValue(effectiveQ.toFixed(2));
                                    }}
                                >
                                    Q: {effectiveQ.toFixed(2)}
                                </span>
                            )
                        )}
                    </div>
                </div>
                {/* Triangle pointing down */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-solid border-t-[#2a2d36] border-t-[6px] border-x-transparent border-x-[6px] border-b-0"></div>
            </div>
          </div>
        );
      })}

      {/* Target Nodes Overlay (for review stage) */}
      {showTarget && targetNodes && targetNodes.map((node, idx) => {
        const xPos = freqToX(node.freq) * dimensions.width;
        const yPos = gainToY(node.gain) * dimensions.height;
        
        return (
          <div
            key={`target-${node.id || idx}`}
            style={{ 
              left: `${xPos}px`, 
              top: `${yPos}px`, 
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute z-10 w-4 h-4 flex items-center justify-center pointer-events-none"
          >
            <div
                className="w-2.5 h-2.5 rounded-full bg-[#a855f7] shadow-[0_0_8px_rgba(168,85,247,0.8)]"
            />
            {node.stereoMode && node.stereoMode !== 'Stereo' && (
                <div
                    className={cn(
                        "absolute top-1/2 -translate-y-1/2 min-w-[12px] h-[12px] flex items-center justify-center text-[8px] font-bold rounded-[2px] shadow-sm pointer-events-none z-10",
                        node.stereoMode === 'Side' ? "left-full ml-1 bg-[#3b82f6] text-white" : "right-full mr-1 bg-[#22c55e] text-white"
                    )}
                >
                    {node.stereoMode === 'Side' ? 'S' : 'M'}
                </div>
            )}
          </div>
        );
      })}

      {/* Floating Control Panel */}
      <AnimatePresence>
        {selectedNodeIdx !== null && (() => {
            const node = userNodes[selectedNodeIdx];
            if (!node) return null;

            const nodeX = freqToX(node.freq) * dimensions.width;
            const panelHalfWidth = 240;
            const minX = panelHalfWidth + 10;
            const maxX = dimensions.width > 0 ? dimensions.width - panelHalfWidth - 10 : panelHalfWidth + 10;
            
            // Default position
            let baseLeft = freqToX(DEFAULT_PANEL_FREQ) * dimensions.width;
            baseLeft = Math.max(minX, Math.min(baseLeft, maxX));
            if (dimensions.width === 0) baseLeft = 0;

            const minF = node.minFreq !== undefined ? node.minFreq : 20;
            const maxF = node.maxFreq !== undefined ? node.maxFreq : 20000;
            const isShelf = node.type === 'lowshelf' || node.type === 'highshelf';
            const colorStr = `rgb(${BAND_COLORS[selectedNodeIdx % BAND_COLORS.length]})`;
            
            const currentPanelOffset = panelOffsets[selectedNodeIdx] || 0;

            return (
              <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-6 w-[540px] bg-gradient-to-b from-[#252830]/70 to-[#181a1f]/70 backdrop-blur-md border border-slate-700/40 rounded-[32px] px-6 pb-5 pt-8 shadow-[0_20px_40px_rgba(0,0,0,0.6)] z-40 pointer-events-auto cursor-default"
                  style={{ left: baseLeft + currentPanelOffset, transform: 'translateX(-50%)' }}
                  onPointerDown={handlePanelPointerDown}
                  onWheel={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
              >
                      <>
                          {/* Drag Handle Top Bar */}
                          <div 
                              className="absolute top-0 left-0 right-0 h-8 cursor-grab active:cursor-grabbing z-50 flex items-center justify-center hover:bg-white/[0.02] rounded-t-[32px] transition-colors"
                              onPointerDown={handlePanelPointerDown}
                          />
                          <div className="flex items-stretch justify-between w-full relative">
                              {/* Left Panel UI Mockup */}
                              <div className="flex flex-col justify-between items-start py-2 relative z-10 w-[120px]">
                              {/* Power Button */}
                              <button 
                                  className={cn(
                                      "w-8 h-8 rounded-full border flex items-center justify-center shadow-inner transition-colors",
                                      node.enabled !== false 
                                          ? "bg-[#2a4030] hover:bg-[#34503c] border-[#3a6040] text-green-400" 
                                          : "bg-[#1e2027] hover:bg-[#252830] border-[#2a2d36] text-slate-500 hover:text-slate-400"
                                  )}
                                  onClick={() => {
                                      const newNodes = [...userNodes];
                                      newNodes[selectedNodeIdx] = { ...node, enabled: node.enabled === false ? true : false };
                                      onNodesChange(newNodes);
                                  }}
                              >
                                  <Power size={14} />
                              </button>
                              
                              <div className="flex flex-col gap-1.5 mt-auto">
                                      <div className="relative">
                                          <button 
                                              className="px-3 py-1.5 rounded-full bg-[#1e2027] hover:bg-[#252830] border border-[#2a2d36] text-[11px] font-medium text-slate-300 flex items-center gap-1.5 transition-colors"
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenDropdown(prev => prev === 'type' ? 'none' : 'type');
                                              }}
                                          >
                                              <FilterTypeIcon type={node.type as 'peaking'|'lowshelf'|'highshelf'} className="opacity-70" />
                                              {node.type === 'peaking' ? 'Bell' : 
                                               node.type === 'lowshelf' ? 'Low Shelf' : 
                                               node.type === 'highshelf' ? 'High Shelf' : 'Filter'}
                                          </button>
                                          
                                          <AnimatePresence>
                                              {openDropdown === 'type' && (
                                                  <motion.div
                                                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                                      exit={{ opacity: 0, scale: 0.95 }}
                                                      transition={{ duration: 0.15 }}
                                                      className="absolute bottom-full left-0 mb-2 w-32 bg-[#1e2027] border border-[#2a2d36] rounded-xl shadow-xl overflow-hidden z-50 p-1"
                                                  >
                                                      {['peaking', 'lowshelf', 'highshelf'].map((t) => (
                                                          <button
                                                              key={t}
                                                              className={cn(
                                                                  "w-full text-left px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors flex items-center gap-2",
                                                                  node.type === t ? "bg-[#252830] text-white" : "text-slate-400 hover:bg-[#252830] hover:text-slate-200"
                                                              )}
                                                              onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  const newNodes = [...userNodes];
                                                                  newNodes[selectedNodeIdx] = { ...node, type: t as BiquadFilterType };
                                                                  onNodesChange(newNodes);
                                                                  setOpenDropdown('none');
                                                              }}
                                                          >
                                                              <FilterTypeIcon type={t as 'peaking'|'lowshelf'|'highshelf'} className={node.type === t ? "text-cyan-400" : "opacity-50"} />
                                                              {t === 'peaking' ? 'Bell' : 
                                                               t === 'lowshelf' ? 'Low Shelf' : 
                                                               t === 'highshelf' ? 'High Shelf' : 'Filter'}
                                                          </button>
                                                      ))}
                                                  </motion.div>
                                              )}
                                          </AnimatePresence>
                                      </div>
                              </div>
                          </div>

                          {/* Knobs Section */}
                          <div className="flex items-end justify-center gap-6 relative px-2 shrink-0">
                              {/* Glowing background top indicator behind gain */}
                              <div 
                                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 w-32 h-16 pointer-events-none rounded-[100%] opacity-15 blur-2xl"
                                  style={{ backgroundColor: colorStr }}
                              />

                              <Knob
                                  label="FREQ"
                                  unit="Hz"
                                  value={node.freq}
                                  min={minF}
                                  max={maxF}
                                  size="md"
                                  type="freq"
                                  showValueNode={false}
                                  color={colorStr}
                                  onChange={(v) => {
                                      const newNodes = [...userNodes];
                                      newNodes[selectedNodeIdx] = { ...node, freq: v };
                                      onNodesChange(newNodes);
                                  }}
                              />
                              
                              <div className="relative z-10 scale-110 pb-2">
                                  <Knob
                                      label="GAIN"
                                      unit="dB"
                                      value={node.gain}
                                      min={node.minGain !== undefined ? node.minGain : -24}
                                      max={node.maxGain !== undefined ? node.maxGain : 24}
                                      size="lg"
                                      defaultValue={0}
                                      type="gain"
                                      color={colorStr}
                                      onChange={(v) => {
                                          const newNodes = [...userNodes];
                                          newNodes[selectedNodeIdx] = { ...node, gain: v };
                                          onNodesChange(newNodes);
                                      }}
                                  />
                              </div>

                              <div className={cn("transition-opacity duration-300 flex items-end gap-2", isShelf ? "opacity-30 pointer-events-none" : "opacity-100")}>
                                  <Knob
                                      label="Q"
                                      value={isShelf ? 1.0 : (node.q || 1.0)}
                                      min={MIN_Q}
                                      max={MAX_Q}
                                      size="md"
                                      type="q"
                                      defaultValue={1.0}
                                      color={colorStr}
                                      onChange={(v) => {
                                          if (isShelf) return;
                                          const newNodes = [...userNodes];
                                          newNodes[selectedNodeIdx] = { ...node, q: v };
                                          onNodesChange(newNodes);
                                      }}
                                  />
                              </div>
                          </div>

                          {/* Right Panel UI Mockup */}
                          <div className="flex flex-col justify-between items-end py-2 w-[120px] relative z-10">
                              <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2 text-slate-300 bg-[#1e2027] px-2.5 py-1 rounded-full border border-[#2a2d36] text-xs font-mono font-medium">
                                      <ChevronLeft 
                                          size={14}
                                          strokeWidth={2.5}
                                          className="shrink-0 hover:text-white cursor-pointer transition-colors" 
                                          onClick={() => setSelectedNodeIdx(prev => prev! > 0 ? prev! - 1 : userNodes.length - 1)}
                                          onPointerDown={(e) => e.stopPropagation()}
                                      />
                                      <span className="min-w-[14px] text-center">{selectedNodeIdx + 1}</span>
                                      <ChevronRight 
                                          size={14}
                                          strokeWidth={2.5}
                                          className="shrink-0 hover:text-white cursor-pointer transition-colors" 
                                          onClick={() => setSelectedNodeIdx(prev => prev! < userNodes.length - 1 ? prev! + 1 : 0)}
                                          onPointerDown={(e) => e.stopPropagation()}
                                      />
                                  </div>
                                  {allowAddRemoveNodes && (
                                    <button 
                                      className="w-7 h-7 rounded border border-red-500/20 bg-[#1e2027] hover:bg-red-500/10 transition-colors flex items-center justify-center text-red-500/70 hover:text-red-400"
                                      onClick={() => {
                                          const newNodes = [...userNodes];
                                          newNodes.splice(selectedNodeIdx, 1);
                                          setSelectedNodeIdx(null);
                                          onNodesChange(newNodes);
                                      }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                  )}
                                  <button 
                                    className="w-7 h-7 rounded bg-[#1e2027] hover:bg-slate-700 transition-colors flex items-center justify-center text-slate-400 hover:text-white"
                                    onClick={() => setSelectedNodeIdx(null)}
                                  >
                                      <X size={14} />
                                  </button>
                              </div>
                              
                              <div className="flex flex-col items-end gap-3 mt-auto">
                                      <div className="relative">
                                          <button 
                                              className="h-7 px-3 rounded-full bg-[#1e2027] hover:bg-[#252830] border border-[#2a2d36] text-[10px] text-slate-300 flex items-center gap-2 transition-colors"
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenDropdown(prev => prev === 'stereo' ? 'none' : 'stereo');
                                              }}
                                          >
                                              <div className="flex items-center justify-center opacity-70 mr-1">
                                                  <StereoModeIcon mode={node.stereoMode || 'Stereo'} className="w-5 h-3 text-current" />
                                              </div>
                                              <div className={cn(
                                                  "w-1.5 h-1.5 rounded-full",
                                                  (!node.stereoMode || node.stereoMode === 'Stereo') ? "bg-[#eab308]" :
                                                  node.stereoMode === 'Mid' ? "bg-[#22c55e]" : "bg-[#38bdf8]"
                                              )}></div>
                                              {node.stereoMode || 'Stereo'}
                                          </button>
                                          
                                          <AnimatePresence>
                                              {openDropdown === 'stereo' && (
                                                  <motion.div
                                                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                                      exit={{ opacity: 0, scale: 0.95 }}
                                                      transition={{ duration: 0.15 }}
                                                      className="absolute bottom-full right-0 mb-2 w-32 bg-[#1e2027] border border-[#2a2d36] rounded-xl shadow-xl overflow-hidden z-50 p-1"
                                                  >
                                                      {(['Stereo', 'Mid', 'Side'] as const).map((mode) => (
                                                          <button
                                                              key={mode}
                                                              className={cn(
                                                                  "w-full text-left px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors flex items-center gap-2",
                                                                  (node.stereoMode || 'Stereo') === mode ? "bg-[#252830] text-white" : "text-slate-400 hover:bg-[#252830] hover:text-slate-200"
                                                              )}
                                                              onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  const newNodes = [...userNodes];
                                                                  newNodes[selectedNodeIdx] = { ...node, stereoMode: mode };
                                                                  onNodesChange(newNodes);
                                                                  setOpenDropdown('none');
                                                              }}
                                                          >
                                                              <div className="flex items-center justify-center opacity-70 mr-1">
                                                                  <StereoModeIcon mode={mode} className="w-5 h-3 text-current" />
                                                              </div>
                                                              <div className={cn(
                                                                  "w-1.5 h-1.5 rounded-full",
                                                                  mode === 'Stereo' ? "bg-[#eab308]" :
                                                                  mode === 'Mid' ? "bg-[#22c55e]" : "bg-[#38bdf8]"
                                                              )}></div>
                                                              {mode}
                                                          </button>
                                                      ))}
                                                  </motion.div>
                                              )}
                                          </AnimatePresence>
                                      </div>
                              </div>
                          </div>
                          </div>
                      </>
                  </motion.div>
                );
            })()}
      </AnimatePresence>
    </div>
  );
}
