export class AudioEngine {
  #context: AudioContext | null = null;
  #master: GainNode | null = null;
  #ambience: GainNode | null = null;
  #enabled = true;
  #unlocked = false;
  #ambientStarted = false;

  public setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (this.#master && this.#context) {
      this.#master.gain.cancelScheduledValues(this.#context.currentTime);
      this.#master.gain.setTargetAtTime(enabled ? 0.78 : 0.0001, this.#context.currentTime, 0.04);
    }
  }

  public async unlock(): Promise<void> {
    if (!this.#context) this.#createContext();
    if (!this.#context) return;
    if (this.#context.state !== 'running') await this.#context.resume().catch(() => undefined);
    this.#unlocked = true;
    this.#startAmbience();
  }

  public async suspend(): Promise<void> {
    if (this.#context?.state === 'running') await this.#context.suspend().catch(() => undefined);
  }

  public async resume(): Promise<void> {
    if (this.#unlocked && this.#context?.state === 'suspended') await this.#context.resume().catch(() => undefined);
  }

  public turn(): void {
    this.#tone(196, 0.08, 'triangle', 0.06, 238);
    window.setTimeout(() => this.#tone(261.63, 0.06, 'sine', 0.035), 45);
  }

  public connect(): void {
    this.#tone(329.63, 0.14, 'sine', 0.07, 493.88);
    window.setTimeout(() => this.#tone(659.25, 0.18, 'sine', 0.045), 75);
  }

  public denied(): void {
    this.#tone(118, 0.12, 'square', 0.035, 92);
  }

  public undo(): void {
    this.#tone(270, 0.12, 'triangle', 0.045, 170);
  }

  public hint(): void {
    this.#chime([523.25, 659.25, 783.99], 0.075, 0.19);
  }

  public bloom(): void {
    this.#chime([261.63, 329.63, 392, 523.25, 659.25, 783.99], 0.08, 0.5);
    window.setTimeout(() => this.#noiseBurst(0.65, 0.055), 180);
  }

  public click(): void {
    this.#tone(420, 0.045, 'triangle', 0.025, 520);
  }

  #createContext(): void {
    const Constructor = window.AudioContext;
    if (!Constructor) return;
    this.#context = new Constructor({ latencyHint: 'interactive' });
    this.#master = this.#context.createGain();
    this.#master.gain.value = this.#enabled ? 0.78 : 0.0001;
    this.#master.connect(this.#context.destination);
    this.#ambience = this.#context.createGain();
    this.#ambience.gain.value = 0.16;
    this.#ambience.connect(this.#master);
  }

  #startAmbience(): void {
    if (this.#ambientStarted || !this.#context || !this.#ambience) return;
    this.#ambientStarted = true;
    const context = this.#context;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 680;
    filter.Q.value = 0.35;
    filter.connect(this.#ambience);

    for (const [frequency, detune, gainValue] of [[65.41, -7, 0.028], [98, 4, 0.017], [130.81, 9, 0.012]] as const) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      gain.gain.value = gainValue;
      lfo.frequency.value = 0.035 + gainValue;
      lfoGain.gain.value = gainValue * 0.38;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start();
      lfo.start();
    }
  }

  #chime(frequencies: readonly number[], spacing: number, duration: number): void {
    frequencies.forEach((frequency, index) => {
      window.setTimeout(() => this.#tone(frequency, duration, 'sine', Math.max(0.025, 0.072 - index * 0.006)), index * spacing * 1000);
    });
  }

  #tone(frequency: number, duration: number, type: OscillatorType, volume: number, endFrequency?: number): void {
    if (!this.#enabled || !this.#context || !this.#master || this.#context.state !== 'running') return;
    const context = this.#context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.#master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  #noiseBurst(duration: number, volume: number): void {
    if (!this.#enabled || !this.#context || !this.#master || this.#context.state !== 'running') return;
    const context = this.#context;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const envelope = Math.pow(1 - index / data.length, 2.8);
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 2400;
    filter.Q.value = 0.55;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.#master);
    source.start();
  }
}
