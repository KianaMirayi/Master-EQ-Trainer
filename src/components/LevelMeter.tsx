import React, { useEffect, useRef } from 'react';
import { AudioEngine } from '../lib/AudioEngine';
import { cn } from '../lib/utils';

// Meter Ballistics Configuration (Adjustable)
const METER_RMS_ATTACK_FACTOR = 0.4;
const METER_RMS_RELEASE_DB_PER_FRAME = 0.6;
const METER_PEAK_ATTACK_FACTOR = 0.8;
const METER_PEAK_RELEASE_DB_PER_FRAME = 0.4;
const METER_PEAK_HOLD_FRAMES = 60;
const METER_PEAK_HOLD_RELEASE_DB_PER_FRAME = 0.2;

interface LevelMeterProps {
  engine: AudioEngine;
  className?: string;
  isVisible?: boolean;
}

export const LevelMeter = React.memo(({ engine, className, isVisible = true }: LevelMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const meterPeakRef = useRef({ rms: -100, peak: -100, peakHold: -100, peakHoldFrames: 0 });

  useEffect(() => {
    if (!isVisible || !canvasRef.current || !containerRef.current) return;
    
    // Resize observer logic
    let width = 60;
    let height = 300;
    
    const observer = new ResizeObserver((entries) => {
      width = entries[0].contentRect.width;
      height = entries[0].contentRect.height;
      if (canvasRef.current) {
         canvasRef.current.width = width;
         canvasRef.current.height = height;
      }
    });
    observer.observe(containerRef.current);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    let frameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const levels = engine.getMasterLevel();
      const meter = meterPeakRef.current;
      
      // RMS Ballistics
      if (levels.rms > meter.rms) {
          meter.rms += (levels.rms - meter.rms) * METER_RMS_ATTACK_FACTOR;
      } else {
          meter.rms = Math.max(levels.rms, meter.rms - METER_RMS_RELEASE_DB_PER_FRAME);
      }
      
      // Peak Ballistics
      if (levels.peak > meter.peak) {
          meter.peak += (levels.peak - meter.peak) * METER_PEAK_ATTACK_FACTOR;
      } else {
          meter.peak = Math.max(levels.peak, meter.peak - METER_PEAK_RELEASE_DB_PER_FRAME);
      }

      // Peak Hold
      if (levels.peak > meter.peakHold) {
          meter.peakHold = levels.peak;
          meter.peakHoldFrames = METER_PEAK_HOLD_FRAMES;
      } else {
          if (meter.peakHoldFrames > 0) {
              meter.peakHoldFrames--;
          } else {
              meter.peakHold = Math.max(levels.peak, meter.peakHold - METER_PEAK_HOLD_RELEASE_DB_PER_FRAME);
          }
      }

      const meterWidth = 8;
      const meterX = width > 30 ? 24 : 10;
      const meterTop = 20;
      const meterHeight = Math.max(10, height - 40); 
      
      const MIN_DB = -90;
      const MAX_DB = 0;
      
      const dbToNormalized = (db: number) => {
          if (db <= -90) return 0;
          if (db >= 0) return 1;
          if (db >= -18) {
              return 0.5 + ((db + 18) / 18) * 0.5;
          } else if (db >= -36) {
              return 0.25 + ((db + 36) / 18) * 0.25;
          } else {
              return ((db + 90) / 54) * 0.25;
          }
      };

      const dbToMeterY = (db: number) => {
          const normalized = dbToNormalized(db);
          return meterTop + meterHeight * (1 - normalized);
      };

      // Draw DB Scale Labels
      const DB_LABELS = [0, -3, -6, -10, -15, -18, -36, -54, -72, -90];
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      
      DB_LABELS.forEach(db => {
          const isBold = db === -3 || db === -15;
          ctx.font = isBold ? 'bold 10px monospace' : '9px monospace';
          const y = dbToMeterY(db);
          ctx.fillStyle = isBold ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)';
          ctx.fillText(db.toString(), meterX - 4, y);
          // tick line
          ctx.fillStyle = isBold ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(meterX, y, meterWidth, 1);
      });

      // Meter BG
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(meterX, meterTop, meterWidth, meterHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(meterX, meterTop, meterWidth, meterHeight);

      // Gradient based on exact normalized breakpoints
      const gradient = ctx.createLinearGradient(0, meterTop + meterHeight, 0, meterTop);
      gradient.addColorStop(0, '#22c55e');
      gradient.addColorStop(dbToNormalized(-18), '#22c55e');
      gradient.addColorStop(dbToNormalized(-9), '#eab308');
      gradient.addColorStop(dbToNormalized(-3), '#ef4444');
      gradient.addColorStop(1, '#ef4444');
      
      // Peak Bar
      const peakY = dbToMeterY(meter.peak);
      const peakFillHeight = (meterTop + meterHeight) - peakY;
      if (peakFillHeight > 0) {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = gradient;
          ctx.fillRect(meterX, peakY, meterWidth, peakFillHeight);
          ctx.globalAlpha = 1.0;
      }

      // RMS Bar (Inset)
      const rmsY = dbToMeterY(meter.rms);
      const rmsFillHeight = (meterTop + meterHeight) - rmsY;
      if (rmsFillHeight > 0) {
          ctx.fillStyle = gradient;
          ctx.fillRect(meterX + 1, rmsY, Math.max(1, meterWidth - 2), rmsFillHeight);
      }

      // Peak Hold Line
      const peakHoldY = dbToMeterY(meter.peakHold);
      ctx.fillStyle = meter.peakHold >= -0.1 ? '#ef4444' : '#ffffff';
      ctx.fillRect(meterX, peakHoldY - 1, meterWidth, 2);

      // Peak Value Text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = '9px monospace';
      ctx.fillStyle = meter.peakHold >= -0.1 ? '#ef4444' : 'rgba(255, 255, 255, 0.7)';
      const textPeak = Math.max(MIN_DB, meter.peakHold).toFixed(1);
      
      ctx.fillText(textPeak, meterX + meterWidth / 2, meterTop - 4);

      frameId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [engine, isVisible]);

  if (!isVisible) return null;

  return (
    <div ref={containerRef} className={cn("relative w-full h-full min-w-[36px]", className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
    </div>
  );
});
