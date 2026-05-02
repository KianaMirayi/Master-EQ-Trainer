import React, { useRef, useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface KnobProps {
    value: number;
    min: number;
    max: number;
    onChange: (val: number) => void;
    label: string;
    unit?: string;
    size?: 'sm' | 'md' | 'lg';
    type?: 'freq' | 'gain' | 'q';
    defaultValue?: number;
    color?: string;
    showValueNode?: boolean;
}

export function Knob({ 
    value, 
    min, 
    max, 
    onChange, 
    label, 
    unit = '', 
    size = 'md',
    type = 'freq',
    defaultValue,
    color = '#22d3ee', // cyan-400
    showValueNode = true
}: KnobProps) {
    const defaultVal = defaultValue !== undefined ? defaultValue : (min + max) / 2;
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef<number>(0);
    const startAngleRef = useRef<number>(0);

    const sizes = {
        sm: { outer: 48, inner: 36, stroke: 3 },
        md: { outer: 64, inner: 46, stroke: 4 },
        lg: { outer: 92, inner: 70, stroke: 4 }
    };
    
    const currSize = sizes[size];
    const center = currSize.outer / 2;
    const radius = currSize.outer / 2 - currSize.stroke;
    
    const getAngleFromValue = (val: number) => {
        if (type === 'gain') {
            if (val >= 0) {
                return 360 + (val / Math.max(0.1, max)) * 150;
            } else {
                return 360 - (Math.abs(val) / Math.max(0.1, Math.abs(min))) * 150;
            }
        } else if (type === 'q') {
            if (val >= 1) {
                const p = Math.log10(val) / Math.max(0.001, Math.log10(max));
                return 360 + p * 150;
            } else {
                const minL = Math.log10(min);
                const p = (Math.log10(val) - minL) / (0 - minL);
                return 210 + p * 150;
            }
        } else { // freq
            const minL = Math.log10(min);
            const maxL = Math.log10(max);
            const valL = Math.log10(Math.max(min, val));
            const p = (valL - minL) / (maxL - minL);
            return 210 + p * 300;
        }
    };

    const getValueFromAngle = (angle: number) => {
        const clampedAngle = Math.max(210, Math.min(510, angle));
        
        if (type === 'gain') {
            if (clampedAngle >= 360) {
                return ((clampedAngle - 360) / 150) * max;
            } else {
                return -((360 - clampedAngle) / 150) * Math.abs(min);
            }
        } else if (type === 'q') {
            if (clampedAngle >= 360) {
                const p = (clampedAngle - 360) / 150;
                const targetLog = p * Math.log10(max);
                return Math.pow(10, targetLog);
            } else {
                const p = (clampedAngle - 210) / 150;
                const minL = Math.log10(min);
                const targetLog = minL + p * (0 - minL);
                return Math.pow(10, targetLog);
            }
        } else { // freq
            const p = (clampedAngle - 210) / 300;
            const minL = Math.log10(min);
            const maxL = Math.log10(max);
            const targetLog = minL + p * (maxL - minL);
            return Math.pow(10, targetLog);
        }
    };

    const currentAngle = getAngleFromValue(value);
    const trackStartAngle = (type === 'gain' || type === 'q') ? 360 : 210;

    const describeArc = (x: number, y: number, r: number, startDeg: number, endDeg: number) => {
        if (Math.abs(startDeg - endDeg) < 0.1) return "";
        let sDeg = startDeg;
        let eDeg = endDeg;
        if (startDeg > endDeg) {
            sDeg = endDeg;
            eDeg = startDeg;
        }

        const startRad = (sDeg - 90) * Math.PI / 180.0;
        const endRad = (eDeg - 90) * Math.PI / 180.0;

        const x1 = x + (r * Math.cos(startRad));
        const y1 = y + (r * Math.sin(startRad));
        const x2 = x + (r * Math.cos(endRad));
        const y2 = y + (r * Math.sin(endRad));

        const largeArcFlag = eDeg - sDeg <= 180 ? "0" : "1";

        return [
            "M", x1, y1, 
            "A", r, r, 0, largeArcFlag, 1, x2, y2
        ].join(" ");
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        startY.current = e.clientY;
        startAngleRef.current = getAngleFromValue(value);
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const deltaY = startY.current - e.clientY;
        // For fine-grained control, 1 pixel = 1.5 degrees
        const newAngle = startAngleRef.current + deltaY * 1.5;
        const newValue = getValueFromAngle(newAngle);
        onChange(newValue);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const handleDoubleClick = () => {
        onChange(defaultVal);
    };

    const [isEditing, setIsEditing] = useState(false);
    const [editStr, setEditStr] = useState("");

    const displayValue = () => {
        if (type === 'freq') {
            return value < 1000 ? Math.round(value) : (value / 1000).toFixed(2) + 'k';
        }
        if (type === 'gain') {
            return value.toFixed(1);
        }
        if (type === 'q') {
            return value.toFixed(value < 10 ? 2 : 1);
        }
        return value.toFixed(2);
    };

    const handleValueClick = () => {
        if (!isEditing) {
            setIsEditing(true);
            setEditStr(type === 'freq' ? Math.round(value).toString() : value.toFixed(type === 'gain' ? 1 : 2));
        }
    };

    const handleValueBlur = () => {
        setIsEditing(false);
        const parsed = parseFloat(editStr.replace('k', '000'));
        if (!isNaN(parsed)) {
            let newVal = parsed;
            if (type === 'freq' && editStr.toLowerCase().endsWith('k')) {
                newVal *= 1000;
            }
            if (newVal < min) newVal = min;
            if (newVal > max) newVal = max;
            onChange(newVal);
        }
    };

    const handleValueKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleValueBlur();
        }
    };

    return (
        <div className="knob-container flex flex-col items-center gap-2 touch-none select-none">
            {/* Top value display container - fixed height to prevent jumping */}
            <div className="h-4 flex items-center justify-center">
                {(isDragging || showValueNode || isEditing) && (
                    isEditing ? (
                        <div className="flex z-50">
                            <input 
                                autoFocus
                                value={editStr}
                                onChange={(e) => setEditStr(e.target.value)}
                                onBlur={handleValueBlur}
                                onKeyDown={handleValueKeyDown}
                                className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-mono rounded px-1 w-12 text-center outline-none focus:border-cyan-500"
                            />
                        </div>
                    ) : (
                        <div 
                            className={cn(
                                "text-[11px] font-medium whitespace-nowrap transition-colors cursor-text hover:text-white",
                                isDragging ? "text-white" : "text-slate-400"
                            )}
                            onClick={handleValueClick}
                        >
                            {displayValue()} {unit}
                        </div>
                    )
                )}
            </div>
            
            <div 
                ref={containerRef}
                className="relative cursor-ns-resize group outline-none"
                style={{ width: currSize.outer, height: currSize.outer }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onDoubleClick={handleDoubleClick}
                tabIndex={0}
            >
                <svg className="absolute inset-0 w-full h-full">
                    {/* Track background */}
                    <path
                        d={describeArc(center, center, radius, 210, 510)}
                        fill="none"
                        stroke="#1a1c23" // very dark background track
                        strokeWidth={currSize.stroke}
                        strokeLinecap="round"
                    />
                    
                    {/* Active track */}
                    <path
                        d={describeArc(center, center, radius, trackStartAngle, currentAngle)}
                        fill="none"
                        stroke={color}
                        strokeWidth={currSize.stroke}
                        strokeLinecap="round"
                        style={{
                            filter: isDragging ? `drop-shadow(0 0 6px ${color})` : `drop-shadow(0 0 2px ${color}) brightness(0.9)`
                        }}
                        className="transition-[filter] duration-150"
                    />
                </svg>

                {/* Knob face */}
                <div 
                    className="absolute rounded-full overflow-hidden"
                    style={{
                        top: (currSize.outer - currSize.inner) / 2,
                        left: (currSize.outer - currSize.inner) / 2,
                        width: currSize.inner,
                        height: currSize.inner,
                        background: 'linear-gradient(135deg, #2d3039 0%, #1c1e24 100%)',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -1px 2px rgba(0,0,0,0.4)',
                        border: '1px solid #1a1c20'
                    }}
                >
                    {/* Tick indicator */}
                    <div 
                        className="absolute w-full h-full pointer-events-none"
                        style={{ 
                            transform: `rotate(${currentAngle}deg)`
                        }}
                    >
                        {/* A tiny glowing tick near the edge */}
                        <div 
                            className="absolute left-1/2 -translate-x-1/2 rounded-full"
                            style={{ 
                                top: '8%',
                                width: Math.max(2, currSize.stroke - 2), 
                                height: '14%',
                                backgroundColor: isDragging ? '#ffffff' : color, 
                                opacity: isDragging ? 1 : 0.8,
                                boxShadow: isDragging ? `0 0 6px ${color}` : 'none',
                                transition: 'background-color 0.15s, box-shadow 0.15s'
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className={cn(
                "text-[10px] font-bold tracking-widest transition-colors mt-1",
                isDragging ? "text-slate-200" : "text-slate-500"
            )}>
                {label}
            </div>
        </div>
    );
}
