export class AudioEngine {
  #context: AudioContext | null = null;
  #master: GainNode | null = null;
  #music: GainNode | null = null;
  #enabled = true;
  #musicEnabled = true;
  #unlocked = false;
  #ambientTimer = 0;
  #ambientIndex = 0;
  #suspended = false;

  public setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (this.#master) this.#master.gain.setTargetAtTime(enabled ? 0.28 : 0, this.#master.context.currentTime, 0.03);
  }

  public setMusicEnabled(enabled: boolean): void {
    this.#musicEnabled = enabled;
    if (this.#music) this.#music.gain.setTargetAtTime(enabled ? 0.09 : 0, this.#music.context.currentTime, 0.25);
    if (!enabled) window.clearTimeout(this.#ambientTimer);
    else if (this.#unlocked && !this.#suspended) this.#scheduleAmbient();
  }

  public async unlock(): Promise<void> {
    if (this.#unlocked) {
      if (this.#context?.state === 'suspended') await this.#context.resume();
      this.#suspended = false;
      if (this.#musicEnabled) this.#scheduleAmbient();
      return;
    }
    const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    this.#context = new AudioContextConstructor({ latencyHint: 'interactive' });
    this.#master = this.#context.createGain();
    this.#music = this.#context.createGain();
    this.#master.gain.value = this.#enabled ? 0.28 : 0;
    this.#music.gain.value = this.#musicEnabled ? 0.09 : 0;
    this.#music.connect(this.#master);
    this.#master.connect(this.#context.destination);
    this.#unlocked = true;
    this.#suspended = false;
    await this.#context.resume();
    this.#scheduleAmbient();
  }

  public turn(progress = 0): void {
    const start = 300 + clamp(progress, 0, 1) * 115;
    this.#tone(start, 0.055, 'triangle', 0.13, start + 105);
  }

  public connect(strength = 1): void {
    const lift = Math.min(3, Math.max(1, Math.round(strength)));
    this.#tone(523.25, 0.11, 'sine', 0.16, 659.25);
    window.setTimeout(() => this.#tone(783.99, 0.14, 'sine', 0.12, 880), 58);
    if (lift >= 2) window.setTimeout(() => this.#tone(1046.5, 0.16, 'sine', 0.08, 1174.66), 118);
  }

  public denied(): void { this.#tone(150, 0.095, 'square', 0.07, 105); }
  public undo(): void { this.#tone(410, 0.09, 'triangle', 0.1, 280); }

  public hint(): void {
    this.#tone(659.25, 0.18, 'sine', 0.13, 987.77);
    window.setTimeout(() => this.#tone(987.77, 0.24, 'sine', 0.1, 1318.51), 110);
  }

  public bloom(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((frequency, index) => window.setTimeout(() => this.#tone(frequency, 0.42, 'sine', 0.12, frequency * 1.08), index * 82));
  }

  public async suspend(): Promise<void> {
    this.#suspended = true;
    window.clearTimeout(this.#ambientTimer);
    if (this.#context?.state === 'running') await this.#context.suspend();
  }

  public async resume(): Promise<void> {
    this.#suspended = false;
    if (this.#context?.state === 'suspended') await this.#context.resume();
    if (this.#musicEnabled && this.#unlocked) this.#scheduleAmbient();
  }

  public destroy(): void {
    this.#suspended = true;
    window.clearTimeout(this.#ambientTimer);
    void this.#context?.close();
    this.#context = null;
    this.#master = null;
    this.#music = null;
  }

  #tone(frequency: number, duration: number, type: OscillatorType, gainValue: number, endFrequency = frequency): void {
    const context = this.#context;
    const master = this.#master;
    if (!context || !master || !this.#enabled || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), now + duration);
    filter.type = 'lowpass';
    filter.frequency.value = 2_400;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue), now + Math.min(0.025, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  #scheduleAmbient(): void {
    window.clearTimeout(this.#ambientTimer);
    if (!this.#context || !this.#music || !this.#musicEnabled || !this.#unlocked || this.#suspended || this.#context.state !== 'running') return;
    const chords: readonly (readonly number[])[] = [
      [130.81, 196, 261.63],
      [146.83, 220, 293.66],
      [164.81, 246.94, 329.63],
      [146.83, 220, 277.18],
    ];
    const chord = chords[this.#ambientIndex % chords.length] as readonly number[];
    this.#ambientIndex += 1;
    const context = this.#context;
    const destination = this.#music;
    const now = context.currentTime;
    for (const frequency of chord) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = (Math.random() - 0.5) * 5;
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 1.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 7.5);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      oscillator.start(now);
      oscillator.stop(now + 7.7);
    }
    this.#ambientTimer = window.setTimeout(() => this.#scheduleAmbient(), 6_800);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
