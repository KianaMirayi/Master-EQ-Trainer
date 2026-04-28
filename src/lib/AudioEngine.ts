import { EQNodeData, MIN_FREQ, MAX_FREQ } from './utils';

export class AudioEngine {
  ctx: AudioContext;
  buffer: AudioBuffer | null = null;
  source: AudioBufferSourceNode | null = null;
  
  targetFilters: BiquadFilterNode[] = [];
  userFilters: BiquadFilterNode[] = [];
  
  targetGain: GainNode;
  userGain: GainNode;
  soloGain: GainNode;
  soloFilter: BiquadFilterNode;
  
  targetMakeupGain: GainNode;
  userMakeupGain: GainNode;
  
  masterGain: GainNode;
  compressor: DynamicsCompressorNode;

  targetAnalyser: AnalyserNode;
  userAnalyser: AnalyserNode;
  masterAnalyser: AnalyserNode;

  isPlaying = false;
  isLooping = true;
  loopStart = 0;
  loopEnd = 0;
  playbackOffset = 0;
  baseCurrentTime = 0;
  currentListenMode: 'target' | 'user' | 'solo' = 'user';
  previousListenMode: 'target' | 'user' = 'user';

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Setup routing
    this.compressor = this.ctx.createDynamicsCompressor();
    // Limiter settings
    this.compressor.threshold.value = -1.0;
    this.compressor.knee.value = 2.0;
    this.compressor.ratio.value = 20.0;
    this.compressor.attack.value = 0.002;
    this.compressor.release.value = 0.100;

    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.compressor);
    
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.masterAnalyser.smoothingTimeConstant = 0.8;
    this.compressor.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);
    
    // Listen paths
    this.targetGain = this.ctx.createGain();
    this.userGain = this.ctx.createGain();
    this.soloGain = this.ctx.createGain();
    
    // Avoid exact 0 to prevent browsers from optimizing out the path and stopping analysers
    this.targetGain.gain.value = 0.0001; // Starts listening to user
    this.userGain.gain.value = 1;
    this.soloGain.gain.value = 0.0001;
    
    this.soloFilter = this.ctx.createBiquadFilter();
    this.soloFilter.type = 'bandpass';
    this.soloFilter.connect(this.soloGain);
    
    this.targetMakeupGain = this.ctx.createGain();
    this.userMakeupGain = this.ctx.createGain();
    
    this.targetMakeupGain.connect(this.targetGain);
    this.userMakeupGain.connect(this.userGain);
    
    this.targetGain.connect(this.masterGain);
    this.userGain.connect(this.masterGain);
    this.soloGain.connect(this.masterGain);
    
    // Analysers
    this.targetAnalyser = this.ctx.createAnalyser();
    this.userAnalyser = this.ctx.createAnalyser();
    
    this.targetAnalyser.fftSize = 8192;
    this.userAnalyser.fftSize = 8192;
    this.targetAnalyser.smoothingTimeConstant = 0.5; // Baseline smoothing
    this.userAnalyser.smoothingTimeConstant = 0.5;

    // Analysers need a sink to process continuously if not connected to main output
    const dummySink = this.ctx.createGain();
    dummySink.gain.value = 0.0001; // Avoid exact 0
    dummySink.connect(this.ctx.destination);
    this.targetAnalyser.connect(dummySink);
    this.userAnalyser.connect(dummySink);
  }

  setBuffer(buffer: AudioBuffer) {
    this.buffer = buffer;
    this.playbackOffset = 0;
    this.loopEnd = buffer.duration;
    if (this.isPlaying) {
      this.play(0);
    }
  }

  async play(timeOffset?: number) {
    console.log("Audio Engine play initiated. Buffer:", !!this.buffer, "State:", this.ctx.state);
    if (!this.buffer) return;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
        console.log("Context resumed.");
      } catch (err) {
        console.error("Failed to resume ctx", err);
      }
    }

    this.stop(false);

    try {
      this.source = this.ctx.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.loop = this.isLooping;
      if (this.isLooping) {
        this.source.loopStart = this.loopStart;
        this.source.loopEnd = this.loopEnd;
      }

      // source -> filters
      if (this.targetFilters.length > 0) {
        this.source.connect(this.targetFilters[0]);
      } else {
        this.source.connect(this.targetMakeupGain);
        this.source.connect(this.targetAnalyser);
      }

      if (this.userFilters.length > 0) {
        this.source.connect(this.userFilters[0]);
      } else {
        this.source.connect(this.userMakeupGain);
        this.source.connect(this.userAnalyser);
      }

      // Connect source to solo filter
      this.source.connect(this.soloFilter);

      const startOffset = timeOffset !== undefined ? timeOffset : this.playbackOffset;
      this.playbackOffset = startOffset;
      this.baseCurrentTime = this.ctx.currentTime;
      
      let actualStartOffset = startOffset;
      if (this.isLooping && startOffset > this.loopEnd) {
          actualStartOffset = this.loopStart + ((startOffset - this.loopStart) % (this.loopEnd - this.loopStart));
      }

      this.source.start(0, actualStartOffset);
      this.isPlaying = true;
      console.log("Audio Engine playing started, state:", this.ctx.state);
    } catch (err) {
      console.error("Error setting up audio source:", err);
    }
  }

  pause() {
    this.stop(true);
  }

  seek(time: number) {
      if (this.isPlaying) {
          this.play(time);
      } else {
          this.playbackOffset = time;
      }
  }

  setLoopPoints(start: number, end: number) {
      this.loopStart = Math.min(start, end);
      this.loopEnd = Math.max(start, end);
      if (this.source) {
          this.source.loopStart = this.loopStart;
          this.source.loopEnd = this.loopEnd;
      }
      if (this.isPlaying && this.getCurrentTime() > this.loopEnd && this.isLooping) {
          this.seek(this.loopStart);
      }
  }

  toggleLoop(enabled: boolean) {
      this.isLooping = enabled;
      if (this.source) {
          this.source.loop = enabled;
      }
      if (enabled && this.isPlaying && this.getCurrentTime() > this.loopEnd) {
          this.seek(this.loopStart);
      }
  }

  getCurrentTime(): number {
      if (!this.isPlaying) return this.playbackOffset;
      
      let t = this.playbackOffset + (this.ctx.currentTime - this.baseCurrentTime);
      if (this.isLooping && this.buffer && this.loopEnd > 0) {
          if (t > this.loopEnd) {
              const loopDuration = this.loopEnd - this.loopStart;
              if (loopDuration > 0) {
                 t = this.loopStart + ((t - this.loopStart) % loopDuration);
              }
          }
      } else if (this.buffer && t > this.buffer.duration) {
          // If not looping and past duration, it means playback finished
          // We don't automatically update isPlaying here since we don't have an easily trappable onended event without complexities,
          // but capping to duration is fine for UI.
          t = this.buffer.duration;
      }
      return t;
  }

  stop(saveOffset = false) {
    if (this.isPlaying && saveOffset) {
      this.playbackOffset = this.getCurrentTime();
    }
    if (this.source) {
      try { this.source.stop(); } catch(e) {}
      try { this.source.disconnect(); } catch(e) {}
      this.source = null;
    }
    this.isPlaying = false;
  }

  dispose() {
    this.stop();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
  }

  setListenMode(mode: 'target' | 'user' | 'solo') {
    if (this.currentListenMode === mode) return;
    
    if (mode !== 'solo') {
        this.previousListenMode = mode;
    }
    
    const now = Math.max(0, this.ctx.currentTime);
    const timeConstant = 0.02; // 20ms time constant for smooth fade
    
    // Cancel scheduled values
    this.targetGain.gain.cancelScheduledValues(now);
    this.userGain.gain.cancelScheduledValues(now);
    this.soloGain.gain.cancelScheduledValues(now);
    
    if (mode === 'target') {
      this.targetGain.gain.setTargetAtTime(1, now, timeConstant);
      this.userGain.gain.setTargetAtTime(0.0001, now, timeConstant);
      this.soloGain.gain.setTargetAtTime(0.0001, now, timeConstant);
    } else if (mode === 'user') {
      this.targetGain.gain.setTargetAtTime(0.0001, now, timeConstant);
      this.userGain.gain.setTargetAtTime(1, now, timeConstant);
      this.soloGain.gain.setTargetAtTime(0.0001, now, timeConstant);
    } else if (mode === 'solo') {
      this.targetGain.gain.setTargetAtTime(0.0001, now, timeConstant);
      this.userGain.gain.setTargetAtTime(0.0001, now, timeConstant);
      this.soloGain.gain.setTargetAtTime(1, now, timeConstant);
    }
    this.currentListenMode = mode;
  }

  setSoloBand(node: EQNodeData | null) {
      if (node) {
          // Bandpass centered at freq with same Q
          this.soloFilter.frequency.value = node.freq;
          this.soloFilter.Q.value = node.q;
          this.setListenMode('solo');
      } else {
          this.setListenMode(this.previousListenMode);
      }
  }

  private constructFilterChain(nodes: EQNodeData[]): BiquadFilterNode[] {
    const filters = nodes.map(data => {
      const f = this.ctx.createBiquadFilter();
      const isBypassed = data.enabled === false;
      const type = isBypassed ? 'peaking' : data.type;
      f.type = type;
      f.frequency.value = data.freq;
      
      if (type === 'lowshelf' || type === 'highshelf') {
        f.gain.value = isBypassed ? 0 : data.gain;
        f.Q.value = 1.0; 
      } else {
        f.gain.value = isBypassed ? 0 : data.gain;
        f.Q.value = data.q;
      }
      // Optimize out zipper noise on drag
      return f;
    });

    for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i+1]);
    }
    return filters;
  }

  private applyNodes(nodes: EQNodeData[], isTarget: boolean) {
    const filterArray = isTarget ? this.targetFilters : this.userFilters;
    
    // Disconnect old
    if (filterArray.length > 0) {
      if (this.source) {
        try { this.source.disconnect(filterArray[0]); } catch (e) {}
      }
      filterArray[filterArray.length - 1].disconnect();
    }

    const newFilters = this.constructFilterChain(nodes);
    
    if (isTarget) {
      this.targetFilters = newFilters;
    } else {
      this.userFilters = newFilters;
    }

    // Reconnect
    if (newFilters.length > 0) {
      if (this.source) this.source.connect(newFilters[0]);
      
      const lastNode = newFilters[newFilters.length - 1];
      if (isTarget) {
        lastNode.connect(this.targetMakeupGain);
        lastNode.connect(this.targetAnalyser);
      } else {
        lastNode.connect(this.userMakeupGain);
        lastNode.connect(this.userAnalyser);
      }
    }

    this.calculateAutoMakeupGain(isTarget);
  }

  setTargetNodes(nodes: EQNodeData[]) {
    this.applyNodes(nodes, true);
  }

  setUserNodes(nodes: EQNodeData[]) {
    // Only update values if structure hasn't changed to avoid audio glitches
    if (this.userFilters.length === nodes.length) {
      nodes.forEach((n, i) => {
        const filter = this.userFilters[i];
        const isBypassed = n.enabled === false;
        const type = isBypassed ? 'peaking' : n.type;
        filter.type = type;
        // Direct assignment ensures instant getFrequencyResponse math and UI visual sync 
        // without relying on Web Audio clock progression (which might fail if suspended)
        filter.frequency.value = n.freq;
        
        if (type === 'lowshelf' || type === 'highshelf') {
          filter.gain.value = isBypassed ? 0 : n.gain;
          filter.Q.value = 1.0; 
        } else {
          filter.gain.value = isBypassed ? 0 : n.gain;
          filter.Q.value = n.q;
        }
      });
      this.calculateAutoMakeupGain(false);
    } else {
      this.applyNodes(nodes, false);
    }
  }

  // Calculate generic response across spectrum
  private calculateAutoMakeupGain(isTarget: boolean) {
    const filters = isTarget ? this.targetFilters : this.userFilters;
    if (filters.length === 0) {
      const makeUpNode = isTarget ? this.targetMakeupGain : this.userMakeupGain;
      makeUpNode.gain.cancelScheduledValues(this.ctx.currentTime);
      makeUpNode.gain.setValueAtTime(1, this.ctx.currentTime);
      return;
    }

    const steps = 100;
    const freqs = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
        const minLog = Math.log10(MIN_FREQ);
        const maxLog = Math.log10(MAX_FREQ);
        freqs[i] = Math.pow(10, minLog + (i / (steps-1)) * (maxLog - minLog));
    }

    const totalMag = new Float32Array(steps).fill(1);
    const mag = new Float32Array(steps);
    const phase = new Float32Array(steps);

    filters.forEach(f => {
        f.getFrequencyResponse(freqs, mag, phase);
        for(let i = 0; i < steps; i++) {
            totalMag[i] *= (mag[i] || 1);
        }
    });

    let sum = 0;
    for(let i = 0; i < steps; i++) {
        const db = 20 * Math.log10(totalMag[i] || 1);
        sum += db;
    }
    const avgDb = sum / steps;
    // ensure no NaNs
    const safeAvgDb = isNaN(avgDb) ? 0 : avgDb;
    const makeupGainLinear = Math.min(10, Math.max(0.1, Math.pow(10, -safeAvgDb / 20)));
    console.log(`Makeup gain for ${isTarget ? 'target' : 'user'} filters: safeAvgDb=${safeAvgDb}, makeupGainLinear=${makeupGainLinear}`);

    const makeUpNode = isTarget ? this.targetMakeupGain : this.userMakeupGain;
    makeUpNode.gain.cancelScheduledValues(this.ctx.currentTime);
    makeUpNode.gain.value = makeupGainLinear;
  }

  getIndividualFrequencyResponses(isTarget: boolean, width: number): Float32Array[] {
    const filters = isTarget ? this.targetFilters : this.userFilters;
    const freqs = new Float32Array(width);
    const minLog = Math.log10(MIN_FREQ);
    const maxLog = Math.log10(MAX_FREQ);
    for (let i = 0; i < width; i++) {
        freqs[i] = Math.pow(10, minLog + (i / (width-1)) * (maxLog - minLog));
    }

    const responses: Float32Array[] = [];
    
    if (filters.length > 0) {
      filters.forEach(f => {
          const mag = new Float32Array(width);
          const phase = new Float32Array(width);
          f.getFrequencyResponse(freqs, mag, phase);
          const outDb = new Float32Array(width);
          for(let i = 0; i < width; i++) {
              outDb[i] = 20 * Math.log10(mag[i] || 1);
          }
          responses.push(outDb);
      });
    }

    return responses;
  }

  getFrequencyResponse(isTarget: boolean, width: number): Float32Array {
    const filters = isTarget ? this.targetFilters : this.userFilters;
    const freqs = new Float32Array(width);
    const minLog = Math.log10(MIN_FREQ);
    const maxLog = Math.log10(MAX_FREQ);
    for (let i = 0; i < width; i++) {
        freqs[i] = Math.pow(10, minLog + (i / (width-1)) * (maxLog - minLog));
    }

    const totalMag = new Float32Array(width).fill(1);
    if (filters.length > 0) {
      const mag = new Float32Array(width);
      const phase = new Float32Array(width);
      filters.forEach(f => {
          f.getFrequencyResponse(freqs, mag, phase);
          for(let i = 0; i < width; i++) {
              totalMag[i] *= mag[i];
          }
      });
    }

    const outDb = new Float32Array(width);
    for(let i = 0; i < width; i++) {
        outDb[i] = 20 * Math.log10(totalMag[i] || 1);
    }
    return outDb;
  }

  getMasterLevel(): { rms: number, peak: number } {
    if (!this.isPlaying) return { rms: -100, peak: -100 };
    const data = new Float32Array(this.masterAnalyser.fftSize);
    this.masterAnalyser.getFloatTimeDomainData(data);
    
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        sum += val * val;
        if (Math.abs(val) > peak) peak = Math.abs(val);
    }
    
    const rms = Math.sqrt(sum / data.length);
    
    return {
        rms: rms > 0 ? 20 * Math.log10(rms) : -100,
        peak: peak > 0 ? 20 * Math.log10(peak) : -100
    };
  }
}
