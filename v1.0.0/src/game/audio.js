export class AudioEngine {
    #context = null;
    #master = null;
    #music = null;
    #enabled = true;
    #musicEnabled = true;
    #unlocked = false;
    #ambientTimer = 0;
    #ambientIndex = 0;
    setEnabled(enabled) {
        this.#enabled = enabled;
        if (this.#master)
            this.#master.gain.setTargetAtTime(enabled ? 0.28 : 0, this.#master.context.currentTime, 0.03);
    }
    setMusicEnabled(enabled) {
        this.#musicEnabled = enabled;
        if (this.#music)
            this.#music.gain.setTargetAtTime(enabled ? 0.09 : 0, this.#music.context.currentTime, 0.25);
        if (enabled && this.#unlocked)
            this.#scheduleAmbient();
    }
    async unlock() {
        if (this.#unlocked) {
            if (this.#context?.state === 'suspended')
                await this.#context.resume();
            return;
        }
        const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
        if (!AudioContextConstructor)
            return;
        this.#context = new AudioContextConstructor();
        this.#master = this.#context.createGain();
        this.#music = this.#context.createGain();
        this.#master.gain.value = this.#enabled ? 0.28 : 0;
        this.#music.gain.value = this.#musicEnabled ? 0.09 : 0;
        this.#music.connect(this.#master);
        this.#master.connect(this.#context.destination);
        this.#unlocked = true;
        await this.#context.resume();
        this.#scheduleAmbient();
    }
    turn() { this.#tone(330, 0.055, 'triangle', 0.13, 430); }
    connect() {
        this.#tone(523.25, 0.11, 'sine', 0.16, 659.25);
        window.setTimeout(() => this.#tone(783.99, 0.14, 'sine', 0.12, 880), 65);
    }
    denied() { this.#tone(150, 0.095, 'square', 0.07, 105); }
    undo() { this.#tone(410, 0.09, 'triangle', 0.1, 280); }
    hint() {
        this.#tone(659.25, 0.18, 'sine', 0.13, 987.77);
        window.setTimeout(() => this.#tone(987.77, 0.24, 'sine', 0.1, 1318.51), 110);
    }
    bloom() {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((frequency, index) => window.setTimeout(() => this.#tone(frequency, 0.42, 'sine', 0.12, frequency * 1.08), index * 95));
    }
    async suspend() {
        if (this.#context?.state === 'running')
            await this.#context.suspend();
    }
    async resume() {
        if (this.#context?.state === 'suspended')
            await this.#context.resume();
    }
    destroy() {
        window.clearTimeout(this.#ambientTimer);
        void this.#context?.close();
        this.#context = null;
        this.#master = null;
        this.#music = null;
    }
    #tone(frequency, duration, type, gainValue, endFrequency = frequency) {
        const context = this.#context;
        const master = this.#master;
        if (!context || !master || !this.#enabled || context.state !== 'running')
            return;
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
    #scheduleAmbient() {
        window.clearTimeout(this.#ambientTimer);
        if (!this.#context || !this.#music || !this.#musicEnabled || !this.#unlocked)
            return;
        const chords = [
            [130.81, 196, 261.63],
            [146.83, 220, 293.66],
            [164.81, 246.94, 329.63],
            [146.83, 220, 277.18],
        ];
        const chord = chords[this.#ambientIndex % chords.length];
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
//# sourceMappingURL=audio.js.map