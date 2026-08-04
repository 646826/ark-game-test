export class AudioEngine {
    #context = null;
    #master = null;
    #enabled = true;
    #unlocked = false;
    #wasRunningBeforePause = false;
    get enabled() {
        return this.#enabled;
    }
    setEnabled(enabled) {
        this.#enabled = enabled;
        if (this.#master) {
            this.#master.gain.setTargetAtTime(enabled ? 0.16 : 0, this.#context?.currentTime ?? 0, 0.025);
        }
    }
    async unlock() {
        if (this.#unlocked) {
            return;
        }
        this.#unlocked = true;
        try {
            const AudioContextConstructor = window.AudioContext;
            this.#context = new AudioContextConstructor({ latencyHint: 'interactive' });
            this.#master = this.#context.createGain();
            this.#master.gain.value = this.#enabled ? 0.16 : 0;
            this.#master.connect(this.#context.destination);
            if (this.#context.state === 'suspended') {
                await this.#context.resume();
            }
        }
        catch {
            this.#context = null;
            this.#master = null;
        }
    }
    async suspend() {
        if (!this.#context) {
            return;
        }
        this.#wasRunningBeforePause = this.#context.state === 'running';
        if (this.#context.state === 'running') {
            await this.#context.suspend();
        }
    }
    async resume() {
        if (this.#context && this.#wasRunningBeforePause && document.visibilityState === 'visible') {
            await this.#context.resume().catch(() => undefined);
        }
    }
    turn() {
        this.#tone(330, 0.055, 'triangle', 0.65, 470);
        window.setTimeout(() => this.#tone(510, 0.045, 'sine', 0.34), 38);
    }
    connect() {
        this.#tone(510, 0.08, 'sine', 0.45, 720);
    }
    undo() {
        this.#tone(430, 0.07, 'triangle', 0.42, 280);
    }
    hint() {
        this.#tone(660, 0.12, 'sine', 0.36, 880);
        window.setTimeout(() => this.#tone(880, 0.16, 'sine', 0.3, 1_100), 90);
    }
    denied() {
        this.#tone(170, 0.09, 'square', 0.16, 125);
    }
    bloom() {
        const notes = [392, 494, 587, 784];
        notes.forEach((frequency, index) => {
            window.setTimeout(() => this.#tone(frequency, 0.42, 'sine', 0.32, frequency * 1.012), index * 85);
        });
    }
    #tone(frequency, durationSeconds, type, volume, endFrequency = frequency) {
        const context = this.#context;
        const master = this.#master;
        if (!this.#enabled || !context || !master || context.state !== 'running') {
            return;
        }
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + durationSeconds);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(now);
        oscillator.stop(now + durationSeconds + 0.02);
        oscillator.addEventListener('ended', () => {
            oscillator.disconnect();
            gain.disconnect();
        }, { once: true });
    }
}
//# sourceMappingURL=audio.js.map