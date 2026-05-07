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
  onListenModeChange?: (mode: 'user' | 'target') => void;
  showGainHint?: boolean;
  gainRange?: [number, number];
  isScanning?: boolean;
  onNodeSoloChange?: (isSolo: boolean) => void;
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

export function EQCanvas({ engine, userNodes, targetNodes, onNodesChange, showTarget, allowAddRemoveNodes, listenMode = 'user', onListenModeChange, showGainHint = false, gainRange = [3, 9], isScanning = false, onNodeSoloChange }: EQCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanStartTimeRef = useRef<number>(0);
  const isScanningRef = useRef<boolean>(isScanning);

  useEffect(() => {
    isScanningRef.current = isScanning;
    if (isScanning) {
      scanStartTimeRef.current = performance.now();
    }
  }, [isScanning]);

  const handleNodesChangeWrapper = (nodes: EQNodeData[]) => {
      if (listenMode === 'target') onListenModeChange?.('user');
      onNodesChange(nodes);
  };
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [activeNodeIdx, setActiveNodeIdx] = useState<number | null>(null);
  const [selectedNodeIdx, setSelectedNodeIdx] = useState<number | null>(null);
  const [hoveredNodeIdx, setHoveredNodeIdx] = useState<number | null>(null);
  const [fillHoverNodeIdx, setFillHoverNodeIdx] = useState<number | null>(null);
  const [listeningNodeIdx, setListeningNodeIdx] = useState<number | null>(null);
  
  useEffect(() => {
    onNodeSoloChange?.(listeningNodeIdx !== null);
  }, [listeningNodeIdx, onNodeSoloChange]);

  useEffect(() => {
      if (selectedNodeIdx !== null) {
          engine.playEffect('select');
      }
  }, [selectedNodeIdx, engine]);

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
      
      if (e.key === 'b' || e.key === 'B') {
        if (selectedNodeIdx !== null && userNodes[selectedNodeIdx]) {
           if (listenMode === 'target') onListenModeChange?.('user');
           const newNodes = [...userNodes];
           newNodes[selectedNodeIdx] = { 
               ...newNodes[selectedNodeIdx], 
               enabled: newNodes[selectedNodeIdx].enabled === false ? true : false 
           };
           handleNodesChangeWrapper(newNodes);
        }
        return;
      }
      
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
  }, [selectedNodeIdx, userNodes, engine, listenMode, onNodesChange]);

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
      if (listenMode === 'target') return;
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
      handleNodesChangeWrapper(newNodes);
      closeEdit();
  };

  // References for spectrum calculation reuse to avoid allocations
  const specRawPointsRef = useRef<Float32Array | null>(null);
  const specDilatedPointsRef = useRef<Float32Array | null>(null);
  const specSmoothedPointsRef = useRef<Float32Array | null>(null);

  // References for temporal envelope smoothing
  const targetEnvelopeRef = useRef<Float32Array | null>(null);
  const userEnvelopeRef = useRef<Float32Array | null>(null);

  // References for caching EQ Curves to avoid calculating every frame
  const cachedTargetResponse = useRef<{ width: number, nodesStr: string, mid: Float32Array, side: Float32Array }>({ width: 0, nodesStr: '', mid: new Float32Array(), side: new Float32Array() });
  const cachedUserResponse = useRef<{ width: number, nodesStr: string, mid: Float32Array, side: Float32Array }>({ width: 0, nodesStr: '', mid: new Float32Array(), side: new Float32Array() });
  const cachedIndividualResponses = useRef<{ width: number, nodesStr: string, resps: any[] }>({ width: 0, nodesStr: '', resps: [] });

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

    // DPI Scaling Optimization
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    let frameId: number;
    const draw = () => {
      const now = performance.now();
      const elapsedScan = scanStartTimeRef.current > 0 ? (now - scanStartTimeRef.current) : 0;
      let scanPhase = -1;
      let scanProgress = 1;
      let dimLevel = 0;
      let effectFade = 1.0;

      if (isScanningRef.current || showTarget) {
          if (elapsedScan < 500) {
              scanPhase = 0; // intro dim
              dimLevel = (elapsedScan / 500) * 0.7;
              scanProgress = 0;
          } else if (elapsedScan < 1300) {
              scanPhase = 1; // sweep
              dimLevel = 0.7;
              scanProgress = Math.min(1, (elapsedScan - 500) / 800);
          } else {
              scanPhase = 2; // highlight overlap
              dimLevel = 0.7;
              scanProgress = 1;
              
              if (elapsedScan > 3000) {
                  effectFade = Math.max(0, 1 - (elapsedScan - 3000) / 1000);
                  dimLevel = effectFade * 0.7;
              }
              
              if (effectFade <= 0) {
                  scanPhase = -1;
              }
          }
      }

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // --- Draw Grid ---
      ctx.lineWidth = 1;

      const FREQ_TICKS = [
        20, 30, 40, 50, 60, 70, 80, 90, 100, 
        200, 300, 400, 500, 600, 700, 800, 900, 1000, 
        2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 20000
      ];
      const FREQ_LABELS: Record<number, string> = {
        20: '20', 30: '30', 50: '50', 70: '70', 100: '100', 
        200: '200', 300: '300', 500: '500', 700: '700', 1000: '1k', 
        2000: '2k', 3000: '3k', 5000: '5k', 7000: '7k', 10000: '10k', 20000: '20k'
      };

      // Batch grid lines
      ctx.beginPath();
      FREQ_TICKS.forEach(freq => {
        const x = freqToX(freq) * dimensions.width;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dimensions.height);
      });
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.stroke();

      FREQ_TICKS.forEach(freq => {
        const isMajorHighlight = [20, 200, 2000, 20000].includes(freq);
        const isMinorHighlight = [50, 500, 5000].includes(freq);
        const x = freqToX(freq) * dimensions.width;
        
        if (isMajorHighlight || isMinorHighlight) {
            ctx.strokeStyle = isMajorHighlight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, dimensions.height);
            ctx.stroke();
        }

        ctx.fillStyle = isMajorHighlight ? 'rgba(255, 255, 255, 0.8)' : (isMinorHighlight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.4)');
        ctx.font = isMajorHighlight ? 'bold 11px monospace' : '10px monospace';
        
        let textX = x;
        if (freq === 20) { ctx.textAlign = 'left'; textX = x + 12; } 
        else if (freq === 20000 && x > dimensions.width - 25) { ctx.textAlign = 'right'; textX = x - 38; } 
        else ctx.textAlign = 'center';

        ctx.textBaseline = 'bottom';
        if (FREQ_LABELS[freq]) ctx.fillText(FREQ_LABELS[freq], textX, dimensions.height - 8);
      });

      ctx.beginPath();
      const GAIN_TICKS = [12, 9, 6, 3, 0, -3, -6, -9, -12];
      GAIN_TICKS.forEach(gain => {
        const y = gainToY(gain) * dimensions.height;
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.width, y);
      });
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, gainToY(0) * dimensions.height);
      ctx.lineTo(dimensions.width, gainToY(0) * dimensions.height);
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'right';
      GAIN_TICKS.forEach(gain => {
        const y = gainToY(gain) * dimensions.height;
        let textY = y;
        if (gain === 12) { ctx.textBaseline = 'top'; textY = y + 12; } 
        else if (gain === -12) { ctx.textBaseline = 'bottom'; textY = y - 12; } 
        else ctx.textBaseline = 'middle';
        ctx.fillStyle = gain === 0 ? 'rgba(234, 179, 8, 0.8)' : 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(`${gain > 0 ? '+' : ''}${gain} dB`, dimensions.width - 6, textY);
      });

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const AMP_TICKS = [0, -10, -20, -30, -40, -50, -60, -70, -80, -90];
      AMP_TICKS.forEach(amp => {
        const normalizedDb = Math.max(0, Math.min(1, (amp - (-100)) / (0 - (-100))));
        let y = dimensions.height - normalizedDb * dimensions.height;
        if (amp === 0) { ctx.textBaseline = 'top'; y = y + 12; } 
        else if (amp === -90) { ctx.textBaseline = 'bottom'; y = Math.min(y, dimensions.height - 18); } 
        else ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillText(`${amp}`, 12, y);
      });

      // --- Draw Global Gain Hints ---
      if (showGainHint) {
          const yTop1 = gainToY(gainRange[1]) * dimensions.height;
          const yTop2 = gainToY(gainRange[0]) * dimensions.height;
          const yBot1 = gainToY(-gainRange[0]) * dimensions.height;
          const yBot2 = gainToY(-gainRange[1]) * dimensions.height;
          
          ctx.fillStyle = TARGET_HINT_GAIN_TOP_COLOR;
          ctx.fillRect(0, yTop1, dimensions.width, yTop2 - yTop1);
          
          ctx.fillStyle = TARGET_HINT_GAIN_BOT_COLOR;
          ctx.fillRect(0, yBot1, dimensions.width, yBot2 - yBot1);
          
          // Draw borders for the global gain hints
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.strokeRect(0, yTop1, dimensions.width, yTop2 - yTop1);
          ctx.strokeRect(0, yBot1, dimensions.width, yBot2 - yBot1);
      }

      // --- Draw Spectrum ---
      const drawSpectrum = (data: Float32Array, colorGr: string, envelopeRef: React.MutableRefObject<Float32Array | null>, strokeColor?: string) => {
        const binCount = data.length;
        const sampleRate = engine.ctx.sampleRate || 48000;
        
        // Restore higher resolution for visual smoothness
        const POINT_COUNT = Math.max(80, Math.floor(dimensions.width / 4));
        
        // Initialize buffers if needed (one-time allocation)
        if (!envelopeRef.current || envelopeRef.current.length !== POINT_COUNT) {
            envelopeRef.current = new Float32Array(POINT_COUNT).fill(-100);
            specRawPointsRef.current = new Float32Array(POINT_COUNT);
            specDilatedPointsRef.current = new Float32Array(POINT_COUNT);
            specSmoothedPointsRef.current = new Float32Array(POINT_COUNT);
        }
        
        const envelope = envelopeRef.current;
        const rawPoints = specRawPointsRef.current!;
        const dilatedPoints = specDilatedPointsRef.current!;
        const smoothedPoints = specSmoothedPointsRef.current!;
        
        const attackMultiplier = 0.2;  // Increased for better "snappiness" (follow the sound better)
        const releaseMultiplier = 0.96; 

        // 1. Restore Original Sampling Loop (Precision)
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
               
               // Original Cosine interpolation for smoother curves
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

        // 2. Restore Original Smoothing Passes (Visual Fidelity)
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

        const blurRadius = 3; 
        for (let p = 0; p < POINT_COUNT; p++) {
             let sum = 0;
             let weightSum = 0;
             for (let dp = -blurRadius; dp <= blurRadius; dp++) {
                 const idx = p + dp;
                 if (idx >= 0 && idx < POINT_COUNT) {
                     const weight = Math.exp(-(dp*dp) / ((blurRadius/2)*(blurRadius/2)));
                     sum += dilatedPoints[idx] * weight;
                     weightSum += weight;
                 }
             }
             
             const targetLevel = sum / weightSum;
             const prev = envelope[p];
             
             if (targetLevel > prev) {
                 envelope[p] = targetLevel * attackMultiplier + prev * (1 - attackMultiplier);
             } else {
                 envelope[p] = targetLevel * (1 - releaseMultiplier) + prev * releaseMultiplier;
             }
             
             smoothedPoints[p] = Math.max(0, Math.min(1, (envelope[p] - (-100)) / 100));
        }

        // 3. Draw Path (Bezier-like curves)
        ctx.beginPath();
        const firstY = dimensions.height - smoothedPoints[0] * dimensions.height;
        ctx.moveTo(0, dimensions.height);
        ctx.lineTo(0, firstY);
        
        for (let i = 0; i < POINT_COUNT - 1; i++) {
            const x = (i / (POINT_COUNT - 1)) * dimensions.width;
            const nx = ((i + 1) / (POINT_COUNT - 1)) * dimensions.width;
            const y = dimensions.height - smoothedPoints[i] * dimensions.height;
            const ny = dimensions.height - smoothedPoints[i+1] * dimensions.height;
            const xc = (x + nx) / 2;
            const yc = (y + ny) / 2;
            ctx.quadraticCurveTo(x, y, xc, yc);
        }
        
        ctx.lineTo(dimensions.width, dimensions.height - smoothedPoints[POINT_COUNT-1] * dimensions.height);
        ctx.lineTo(dimensions.width, dimensions.height);
        ctx.closePath();
        
        ctx.fillStyle = colorGr;
        ctx.fill();
        
        if (strokeColor) {
            ctx.beginPath();
            const startY = dimensions.height - smoothedPoints[0] * dimensions.height;
            ctx.moveTo(0, startY);
            for (let i = 0; i < POINT_COUNT - 1; i++) {
                const x = (i / (POINT_COUNT - 1)) * dimensions.width;
                const nx = ((i + 1) / (POINT_COUNT - 1)) * dimensions.width;
                const y = dimensions.height - smoothedPoints[i] * dimensions.height;
                const ny = dimensions.height - smoothedPoints[i+1] * dimensions.height;
                const xc = (x + nx) / 2;
                const yc = (y + ny) / 2;
                ctx.quadraticCurveTo(x, y, xc, yc);
            }
            ctx.lineTo(dimensions.width, dimensions.height - smoothedPoints[POINT_COUNT-1] * dimensions.height);
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

      if (dimLevel > 0) {
          ctx.fillStyle = `rgba(11, 12, 16, ${dimLevel})`;
          ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      }

      // Helper to get or update cached responses
      const getCachedResponse = (isTarget: boolean) => {
          if (isTarget) {
              const currentStr = JSON.stringify(targetNodes);
              if (cachedTargetResponse.current.width !== dimensions.width || cachedTargetResponse.current.nodesStr !== currentStr) {
                  const res = engine.getFrequencyResponse(true, dimensions.width);
                  cachedTargetResponse.current = { width: dimensions.width, nodesStr: currentStr, mid: res.mid, side: res.side };
              }
              return cachedTargetResponse.current;
          } else {
              const currentStr = JSON.stringify(userNodesRef.current);
              if (cachedUserResponse.current.width !== dimensions.width || cachedUserResponse.current.nodesStr !== currentStr) {
                  const res = engine.getFrequencyResponse(false, dimensions.width);
                  cachedUserResponse.current = { width: dimensions.width, nodesStr: currentStr, mid: res.mid, side: res.side };
              }
              return cachedUserResponse.current;
          }
      };

      // --- Draw EQ curves ---
      const drawCurve = (isTarget: boolean, color: string, dashes: number[] = []) => {
        const cached = getCachedResponse(isTarget);
        const midResponse = cached.mid;
        const sideResponse = cached.side;

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
        
        if (isTarget && scanProgress < 1) {
            ctx.beginPath();
            ctx.rect(0, 0, dimensions.width * scanProgress, dimensions.height);
            ctx.clip();
        }

        ctx.setLineDash(dashes);
        
        if (isPureStereo) {
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
        } else {
            // Advanced Path: M/S Delta Fusion
            const MERGE_THRESHOLD = 0.5;

            // Alpha logic
            let midBaseAlpha = isTarget ? 0.6 : 0.8;
            let sideBaseAlpha = isTarget ? 0.6 : 0.8;
            let midLineWidth = 2, sideLineWidth = 2;
            
            if (!isTarget && selectedNodeIdx !== null) {
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

            const baseColorRGB: [number, number, number] = isTarget ? [168, 85, 247] : [234, 179, 8];

            const midBase: [number, number, number, number] = [...baseColorRGB, midBaseAlpha] as [number, number, number, number];
            const sideBaseMerged: [number, number, number, number] = [...baseColorRGB, 0] as [number, number, number, number];
            
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
                    midGradient.addColorStop(offset, interpolateColor(midBase, GREEN, factor));
                    sideGradient.addColorStop(offset, interpolateColor(sideBaseMerged, BLUE, factor));
                    lastOffset = offset;
                }
                if (lastOffset < 1) {
                    const x = dimensions.width - 1;
                    const delta = Math.abs(midResponse[x] - sideResponse[x]);
                    let factor = Math.min(1, delta / MERGE_THRESHOLD);
                    midGradient.addColorStop(1, interpolateColor(midBase, GREEN, factor));
                    sideGradient.addColorStop(1, interpolateColor(sideBaseMerged, BLUE, factor));
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
            const currentStr = JSON.stringify(userNodesRef.current);
            if (cachedIndividualResponses.current.width !== dimensions.width || cachedIndividualResponses.current.nodesStr !== currentStr) {
                cachedIndividualResponses.current = {
                    width: dimensions.width,
                    nodesStr: currentStr,
                    resps: engine.getIndividualFrequencyResponses(false, dimensions.width)
                };
            }
            const individualResponses = cachedIndividualResponses.current.resps;
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

      if (showTarget || scanPhase === 1 || scanPhase === 2) {
          const tgtMid = getCachedResponse(true).mid;
          const usrMid = getCachedResponse(false).mid;
          
          ctx.save();
          const drawWidth = dimensions.width * scanProgress;
          
          for (let x = 0; x < drawWidth; x++) {
              const diff = Math.abs(tgtMid[x] - usrMid[x]);
              const tY = gainToY(tgtMid[x]) * dimensions.height;
              const uY = gainToY(usrMid[x]) * dimensions.height;
              
              if (diff < 1.0) {
                  ctx.strokeStyle = `rgba(250, 204, 21, ${(1 - diff) * 0.5 * effectFade})`;
                  ctx.beginPath();
                  ctx.moveTo(x, Math.min(tY, uY) - 5);
                  ctx.lineTo(x, Math.max(tY, uY) + 5);
                  ctx.stroke();
              } else if (diff > 4.0) {
                  const pulse = (Math.sin(now / 150 + x / 30) + 1) / 2;
                  ctx.strokeStyle = `rgba(239, 68, 68, ${Math.min(0.4, (diff - 4) * 0.1) * pulse * effectFade})`;
                  ctx.beginPath();
                  ctx.moveTo(x, tY);
                  ctx.lineTo(x, uY);
                  ctx.stroke();
              }
          }
          
          if (scanPhase === 1) {
              const scanX = dimensions.width * scanProgress;
              const grad = ctx.createLinearGradient(scanX - 50, 0, scanX, 0);
              grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
              grad.addColorStop(1, 'rgba(56, 189, 248, 0.4)');
              
              ctx.fillStyle = grad;
              ctx.fillRect(scanX - 50, 0, 50, dimensions.height);
              
              ctx.strokeStyle = 'rgba(56, 189, 248, 1)';
              ctx.lineWidth = 2;
              ctx.shadowColor = 'rgba(56, 189, 248, 1)';
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.moveTo(scanX, 0);
              ctx.lineTo(scanX, dimensions.height);
              ctx.stroke();
          }
          ctx.restore();
      }

      frameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frameId);
  }, [dimensions, engine, showTarget, targetNodes]);

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    if (isScanningRef.current) return;
    if (listenMode === 'target') onListenModeChange?.('user');
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
        } else if (e.shiftKey) {
            // Fine-tuning with movementX and movementY
            const deltaX = e.movementX / rect.width;
            const deltaY = e.movementY / rect.height;
            const fineScale = 0.15; // 15% speed for precise adjustment
            
            const newNode = { ...newNodes[activeNodeIdx] };
            const oldX = freqToX(newNode.freq);
            const oldY = gainToY(newNode.gain || 0); // Handle highpass/lowpass lack of gain
            
            const nextX = Math.max(0, Math.min(1, oldX + deltaX * fineScale));
            const nextY = Math.max(0, Math.min(1, oldY + deltaY * fineScale));
            
            let finalFreq = xToFreq(nextX);
            if (newNode.minFreq !== undefined && newNode.maxFreq !== undefined) {
                finalFreq = Math.max(newNode.minFreq, Math.min(newNode.maxFreq, finalFreq));
            }
            newNode.freq = finalFreq;
            
            if (newNode.type !== 'highpass' && newNode.type !== 'lowpass') {
                let finalGain = yToGain(nextY);
                if (newNode.minGain !== undefined && newNode.maxGain !== undefined) {
                    finalGain = Math.max(newNode.minGain, Math.min(newNode.maxGain, finalGain));
                }
                newNode.gain = finalGain;
            }
            newNodes[activeNodeIdx] = newNode;
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
        
        handleNodesChangeWrapper(newNodes);
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
      if (listenMode === 'target') onListenModeChange?.('user');
      setActiveNodeIdx(idx);
      setSelectedNodeIdx(idx);
      setListeningNodeIdx(idx);
      engine.setSoloBand(userNodes[idx]);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDoubleClick = (idx: number) => {
      if (listenMode === 'target') onListenModeChange?.('user');
      const newNodes = [...userNodes];
      const newNode = { ...newNodes[idx] };
      newNode.gain = 0;
      newNodes[idx] = newNode;
      handleNodesChangeWrapper(newNodes);
  }

  const handleWheel = (e: WheelEvent, idx: number) => {
      e.stopPropagation();
      e.preventDefault();
      if (listenMode === 'target') onListenModeChange?.('user');
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
          handleNodesChangeWrapper(newNodes);
      }
  };

  const handleGlobalWheel = (e: React.WheelEvent) => {
      if (activeNodeIdx !== null) {
          handleWheel(e as any, activeNodeIdx);
      }
  };

  const handleBackgroundDoubleClick = (e: React.MouseEvent) => {
      if (listenMode === 'target') onListenModeChange?.('user');
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

      handleNodesChangeWrapper([...userNodes, newNode]);
      setSelectedNodeIdx(userNodes.length);
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full overflow-hidden rounded-xl", activeNodeIdx !== null && "cursor-grabbing")}
      style={{ 
        backgroundImage: 'linear-gradient(to bottom, #0b0c10 0%, #1a1c23 50%, #0b0c10 100%)',
        contain: 'paint' // CSS optimization
      }}
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
        className="absolute inset-0 pointer-events-none"
        style={{ 
          width: '100%', 
          height: '100%',
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
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
              transition: activeNodeIdx !== null ? 'none' : 'opacity 0.2s',
              willChange: activeNodeIdx !== null ? 'left, top' : 'auto'
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
                    "w-4 h-4 rounded-full border-2 cursor-grab transition-all relative before:absolute before:-inset-4 before:content-[''] before:rounded-full",
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
                                handleNodesChangeWrapper(newNodes);
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
                                                handleNodesChangeWrapper(newNodes);
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
                                        handleNodesChangeWrapper(newNodes);
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
                                            handleNodesChangeWrapper(newNodes);
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
      {!isScanning && showTarget && targetNodes && targetNodes.map((node, idx) => {
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
                                      handleNodesChangeWrapper(newNodes);
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
                                                                  handleNodesChangeWrapper(newNodes);
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
                                      handleNodesChangeWrapper(newNodes);
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
                                          handleNodesChangeWrapper(newNodes);
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
                                          handleNodesChangeWrapper(newNodes);
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
                                          handleNodesChangeWrapper(newNodes);
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
                                                                  handleNodesChangeWrapper(newNodes);
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
