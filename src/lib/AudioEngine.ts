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

  targetAnalyser: AnalyserNode;
  userAnalyser: AnalyserNode;

  isPlaying = false;
  currentListenMode: 'target' | 'user' | 'solo' = 'user';
  previousListenMode: 'target' | 'user' = 'user';

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Setup routing
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    
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
    if (this.isPlaying) {
      this.stop();
      this.play();
    }
  }

  async play() {
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

    try {
      this.source = this.ctx.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.loop = true;

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

      this.source.start();
      this.isPlaying = true;
      console.log("Audio Engine playing started, state:", this.ctx.state);
    } catch (err) {
      console.error("Error setting up audio source:", err);
    }
  }

  stop() {
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
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
      f.type = isBypassed ? 'peaking' : data.type;
      f.frequency.value = data.freq;
      f.gain.value = isBypassed ? 0 : data.gain;
      f.Q.value = data.q;
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
        filter.type = isBypassed ? 'peaking' : n.type;
        // Direct assignment ensures instant getFrequencyResponse math and UI visual sync 
        // without relying on Web Audio clock progression (which might fail if suspended)
        filter.frequency.value = n.freq;
        filter.gain.value = isBypassed ? 0 : n.gain;
        filter.Q.value = n.q;
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
}
