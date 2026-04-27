export async function generateDrumLoop(ctx: AudioContext): Promise<AudioBuffer> {
  const sampleRate = ctx.sampleRate;
  const bpm = 120;
  const loopDurationSeconds = (60 / bpm) * 4; // 1 bar (4 beats)
  const length = sampleRate * loopDurationSeconds;
  const buffer = ctx.createBuffer(2, length, sampleRate);
  
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Generate pink noise base for realistic frequency spread
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  
  for (let i = 0; i < length; i++) {
    // Pink noise generation
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    
    // Time in seconds
    const t = i / sampleRate;
    const beat = (t * (bpm / 60)) % 4; // 0 to 4
    
    let sample = pink * 0.05; // Base low level noise

    // Kick on 0, 1, 2, 3
    const kickTime = beat % 1;
    if (kickTime < 0.5) {
      // Sine sweep
      const freq = 150 * Math.exp(-kickTime * 15);
      const envelope = Math.exp(-kickTime * 10);
      sample += Math.sin(2 * Math.PI * freq * kickTime) * envelope * 0.8;
    }

    // Snare on 1, 3
    if ((beat >= 1 && beat < 2) || (beat >= 3 && beat < 4)) {
      const snareTime = (beat >= 1 && beat < 2) ? (beat - 1) : (beat - 3);
      if (snareTime >= 0 && snareTime < 0.4) {
        const envelope = Math.exp(-snareTime * 12);
        sample += pink * envelope * 0.6; // Noisy snare
      }
    }

    // Hi-hat every 0.5 beats (8th notes)
    const hatTime = beat % 0.5;
    if (hatTime < 0.1) {
      const envelope = Math.exp(-hatTime * 40);
      // High-passed white
      sample += (Math.random() * 2 - 1) * envelope * 0.2;
    }

    // Soft clipper to avoid harsh distortion
    sample = Math.max(-1, Math.min(1, Math.tanh(sample)));
    
    // Safety check just in case
    if (isNaN(sample)) sample = 0;

    left[i] = sample;
    right[i] = sample;
  }
  
  console.log("Audio drum loop generated. Sample[100]: ", left[100]);
  return buffer;
}
