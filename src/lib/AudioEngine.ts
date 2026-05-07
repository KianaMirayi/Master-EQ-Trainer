import { EQNodeData, MIN_FREQ, MAX_FREQ } from './utils';

export class AudioEngine {
  ctx: AudioContext;
  buffer: AudioBuffer | null = null;
  source: AudioBufferSourceNode | null = null;
  
  targetGraph: { input: GainNode; output: GainNode; midFilters: BiquadFilterNode[]; sideFilters: BiquadFilterNode[]; } | null = null;
  userGraph: { input: GainNode; output: GainNode; midFilters: BiquadFilterNode[]; sideFilters: BiquadFilterNode[]; } | null = null;
  calibrationGraph: { input: GainNode; output: GainNode; midFilters: BiquadFilterNode[]; sideFilters: BiquadFilterNode[]; } | null = null;
  
  targetGain: GainNode;
  userGain: GainNode;
  soloGain: GainNode;
  soloFilter: BiquadFilterNode;
  
  masterGain: GainNode;
  compressor: DynamicsCompressorNode;
  
  calibrationInput: GainNode;
  calibrationOutput: GainNode;

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
    this.compressor.threshold.value = -2.0;
    this.compressor.knee.value = 4.0;
    this.compressor.ratio.value = 20.0;
    this.compressor.attack.value = 0.002;
    this.compressor.release.value = 0.150;

    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.compressor);
    
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.masterAnalyser.smoothingTimeConstant = 0.8;
    this.compressor.connect(this.masterAnalyser);
    
    this.calibrationInput = this.ctx.createGain();
    this.masterAnalyser.connect(this.calibrationInput);
    
    this.calibrationOutput = this.ctx.createGain();
    this.calibrationInput.connect(this.calibrationOutput);
    this.calibrationOutput.connect(this.ctx.destination);
    
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
    
    this.targetGain.connect(this.masterGain);
    this.userGain.connect(this.masterGain);
    this.soloGain.connect(this.masterGain);
    
      // Analysers
    this.targetAnalyser = this.ctx.createAnalyser();
    this.userAnalyser = this.ctx.createAnalyser();
    
    this.targetAnalyser.fftSize = 4096;
    this.userAnalyser.fftSize = 4096;
    this.targetAnalyser.smoothingTimeConstant = 0.65; // Balanced smoothing
    this.userAnalyser.smoothingTimeConstant = 0.65;

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

  playEffect(type: 'select' | 'change' | 'delete') {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    const now = this.ctx.currentTime;
    
    if (type === 'select') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'change') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'delete') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
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
      if (this.targetGraph) {
        this.source.connect(this.targetGraph.input);
      } else {
        this.source.connect(this.targetGain);
        this.source.connect(this.targetAnalyser);
      }

      if (this.userGraph) {
        this.source.connect(this.userGraph.input);
      } else {
        this.source.connect(this.userGain);
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

  private constructFilterGraph(nodes: EQNodeData[]): { input: GainNode; output: GainNode; midFilters: BiquadFilterNode[]; sideFilters: BiquadFilterNode[]; } {
    const input = this.ctx.createGain();

    // Splitter
    const splitter = this.ctx.createChannelSplitter(2);
    input.connect(splitter);

    // M/S Encoding Matrix
    // Mid = 0.5 * L + 0.5 * R
    const midSum = this.ctx.createGain();
    const lToMid = this.ctx.createGain(); lToMid.gain.value = 0.5;
    const rToMid = this.ctx.createGain(); rToMid.gain.value = 0.5;
    splitter.connect(lToMid, 0); lToMid.connect(midSum);
    splitter.connect(rToMid, 1); rToMid.connect(midSum);

    // Side = 0.5 * L - 0.5 * R
    const sideSum = this.ctx.createGain();
    const lToSide = this.ctx.createGain(); lToSide.gain.value = 0.5;
    const rToSide = this.ctx.createGain(); rToSide.gain.value = -0.5;
    splitter.connect(lToSide, 0); lToSide.connect(sideSum);
    splitter.connect(rToSide, 1); rToSide.connect(sideSum);

    // Processing Chains
    const midFilters: BiquadFilterNode[] = [];
    const sideFilters: BiquadFilterNode[] = [];

    let currentMid: AudioNode = midSum;
    let currentSide: AudioNode = sideSum;

    for (let i = 0; i < nodes.length; i++) {
        const data = nodes[i];
        const isBypassed = data.enabled === false;
        
        // --- Mid Filter ---
        const midF = this.ctx.createBiquadFilter();
        const applyMid = !isBypassed && (data.stereoMode === 'Stereo' || data.stereoMode === 'Mid' || !data.stereoMode);
        midF.type = applyMid ? data.type : 'peaking';
        midF.frequency.value = data.freq;
        if (midF.type === 'lowshelf' || midF.type === 'highshelf') {
            midF.gain.value = applyMid ? data.gain : 0;
            midF.Q.value = 1.0;
        } else {
            midF.gain.value = applyMid ? data.gain : 0;
            midF.Q.value = data.q;
        }
        currentMid.connect(midF);
        currentMid = midF;
        midFilters.push(midF);

        // --- Side Filter ---
        const sideF = this.ctx.createBiquadFilter();
        const applySide = !isBypassed && (data.stereoMode === 'Stereo' || data.stereoMode === 'Side' || !data.stereoMode);
        sideF.type = applySide ? data.type : 'peaking';
        sideF.frequency.value = data.freq;
        if (sideF.type === 'lowshelf' || sideF.type === 'highshelf') {
            sideF.gain.value = applySide ? data.gain : 0;
            sideF.Q.value = 1.0;
        } else {
            sideF.gain.value = applySide ? data.gain : 0;
            sideF.Q.value = data.q;
        }
        currentSide.connect(sideF);
        currentSide = sideF;
        sideFilters.push(sideF);
    }

    // Decoding M/S to L/R Matrix
    // L' = Mid + Side
    const lSum = this.ctx.createGain();
    currentMid.connect(lSum);
    currentSide.connect(lSum);

    // R' = Mid - Side
    const rSum = this.ctx.createGain();
    const sideInv = this.ctx.createGain(); sideInv.gain.value = -1;
    currentSide.connect(sideInv);
    currentMid.connect(rSum);
    sideInv.connect(rSum);

    const merger = this.ctx.createChannelMerger(2);
    lSum.connect(merger, 0, 0);
    rSum.connect(merger, 0, 1);

    const output = this.ctx.createGain();
    merger.connect(output);

    return {
        input,
        output,
        midFilters,
        sideFilters
    };
  }

  private applyNodes(nodes: EQNodeData[], isTarget: boolean) {
    let graph = isTarget ? this.targetGraph : this.userGraph;
    
    // Disconnect old
    if (graph) {
      if (this.source) {
        try { this.source.disconnect(graph.input); } catch (e) {}
      }
      graph.output.disconnect();
    }

    const newGraph = this.constructFilterGraph(nodes);
    
    if (isTarget) {
      this.targetGraph = newGraph;
    } else {
      this.userGraph = newGraph;
    }

    // Reconnect
    if (newGraph) {
      if (this.source) {
        this.source.connect(newGraph.input);
      }
      
      if (isTarget) {
        newGraph.output.connect(this.targetGain);
        newGraph.output.connect(this.targetAnalyser);
      } else {
        newGraph.output.connect(this.userGain);
        newGraph.output.connect(this.userAnalyser);
      }
    }
  }

  setTargetNodes(nodes: EQNodeData[]) {
    this.applyNodes(nodes, true);
  }

  setUserNodes(nodes: EQNodeData[]) {
    // Only update values if structure hasn't changed to avoid audio glitches
    if (this.userGraph && this.userGraph.midFilters.length === nodes.length) {
      nodes.forEach((n, i) => {
        const isBypassed = n.enabled === false;
        
        // Mid Filter Update
        const midF = this.userGraph!.midFilters[i];
        const applyMid = !isBypassed && (n.stereoMode === 'Stereo' || n.stereoMode === 'Mid' || !n.stereoMode);
        const midType = applyMid ? n.type : 'peaking';
        midF.type = midType;
        midF.frequency.value = n.freq;
        
        if (midType === 'lowshelf' || midType === 'highshelf') {
          midF.gain.value = applyMid ? n.gain : 0;
          midF.Q.value = 1.0; 
        } else {
          midF.gain.value = applyMid ? n.gain : 0;
          midF.Q.value = n.q;
        }

        // Side Filter Update
        const sideF = this.userGraph!.sideFilters[i];
        const applySide = !isBypassed && (n.stereoMode === 'Stereo' || n.stereoMode === 'Side' || !n.stereoMode);
        const sideType = applySide ? n.type : 'peaking';
        sideF.type = sideType;
        sideF.frequency.value = n.freq;
        
        if (sideType === 'lowshelf' || sideType === 'highshelf') {
          sideF.gain.value = applySide ? n.gain : 0;
          sideF.Q.value = 1.0; 
        } else {
          sideF.gain.value = applySide ? n.gain : 0;
          sideF.Q.value = n.q;
        }
      });
    } else {
      this.applyNodes(nodes, false);
    }
  }

  setCalibrationNodes(nodes: EQNodeData[]) {
    if (this.calibrationGraph) {
      this.calibrationInput.disconnect(this.calibrationGraph.input);
      this.calibrationGraph.output.disconnect();
    } else {
      this.calibrationInput.disconnect(this.calibrationOutput);
    }

    const activeNodes = nodes.filter(n => n.enabled !== false);
    
    if (activeNodes.length > 0) {
      this.calibrationGraph = this.constructFilterGraph(activeNodes);
      this.calibrationInput.connect(this.calibrationGraph.input);
      this.calibrationGraph.output.connect(this.calibrationOutput);
    } else {
      this.calibrationGraph = null;
      this.calibrationInput.connect(this.calibrationOutput);
    }
  }

  setCalibrationGain(gainDb: number) {
    if (this.calibrationOutput) {
      // Map dB to linear multiplier. e.g. 0dB = 1, -6dB ≈ 0.5, 6dB ≈ 2
      const gainLinear = Math.pow(10, gainDb / 20);
      this.calibrationOutput.gain.setTargetAtTime(gainLinear, this.ctx.currentTime, 0.05);
    }
  }

  getIndividualFrequencyResponses(isTarget: boolean, width: number): { outDb: Float32Array, midDb: Float32Array, sideDb: Float32Array }[] {
    const graph = isTarget ? this.targetGraph : this.userGraph;
    const freqs = new Float32Array(width);
    const minLog = Math.log10(MIN_FREQ);
    const maxLog = Math.log10(MAX_FREQ);
    for (let i = 0; i < width; i++) {
        freqs[i] = Math.pow(10, minLog + (i / (width-1)) * (maxLog - minLog));
    }

    const responses: { outDb: Float32Array, midDb: Float32Array, sideDb: Float32Array }[] = [];
    
    if (graph && graph.midFilters.length > 0) {
      for (let i = 0; i < graph.midFilters.length; i++) {
          const midF = graph.midFilters[i];
          const sideF = graph.sideFilters[i];

          const midMag = new Float32Array(width);
          const midPhase = new Float32Array(width);
          midF.getFrequencyResponse(freqs, midMag, midPhase);

          const sideMag = new Float32Array(width);
          const sidePhase = new Float32Array(width);
          sideF.getFrequencyResponse(freqs, sideMag, sidePhase);

          const outDb = new Float32Array(width);
          const midDb = new Float32Array(width);
          const sideDb = new Float32Array(width);
          
          for(let j = 0; j < width; j++) {
              let m = midMag[j];
              let s = sideMag[j];
              // Use the magnitude that deviates most from 0dB (1 linear)
              let mag = Math.abs(1 - m) > Math.abs(1 - s) ? m : s;
              outDb[j] = 20 * Math.log10(mag || 1);
              midDb[j] = 20 * Math.log10(m || 1);
              sideDb[j] = 20 * Math.log10(s || 1);
          }
          responses.push({ outDb, midDb, sideDb });
      }
    }

    return responses;
  }

  getFrequencyResponse(isTarget: boolean, width: number): { mid: Float32Array, side: Float32Array } {
    const graph = isTarget ? this.targetGraph : this.userGraph;
    const freqs = new Float32Array(width);
    const minLog = Math.log10(MIN_FREQ);
    const maxLog = Math.log10(MAX_FREQ);
    for (let i = 0; i < width; i++) {
        freqs[i] = Math.pow(10, minLog + (i / (width-1)) * (maxLog - minLog));
    }

    const midTotalMag = new Float32Array(width).fill(1);
    const sideTotalMag = new Float32Array(width).fill(1);
    
    if (graph) {
      const mag = new Float32Array(width);
      const phase = new Float32Array(width);
      
      graph.midFilters.forEach(f => {
          f.getFrequencyResponse(freqs, mag, phase);
          for(let i = 0; i < width; i++) {
              midTotalMag[i] *= mag[i];
          }
      });

      graph.sideFilters.forEach(f => {
          f.getFrequencyResponse(freqs, mag, phase);
          for(let i = 0; i < width; i++) {
              sideTotalMag[i] *= mag[i];
          }
      });
    }

    const midOutDb = new Float32Array(width);
    const sideOutDb = new Float32Array(width);
    for(let i = 0; i < width; i++) {
        midOutDb[i] = 20 * Math.log10(midTotalMag[i] || 1);
        sideOutDb[i] = 20 * Math.log10(sideTotalMag[i] || 1);
    }
    return { mid: midOutDb, side: sideOutDb };
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
