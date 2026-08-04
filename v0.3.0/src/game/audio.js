var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AudioEngine_instances, _AudioEngine_context, _AudioEngine_master, _AudioEngine_ambience, _AudioEngine_enabled, _AudioEngine_unlocked, _AudioEngine_ambientStarted, _AudioEngine_createContext, _AudioEngine_startAmbience, _AudioEngine_chime, _AudioEngine_tone, _AudioEngine_noiseBurst;
export class AudioEngine {
    constructor() {
        _AudioEngine_instances.add(this);
        _AudioEngine_context.set(this, null);
        _AudioEngine_master.set(this, null);
        _AudioEngine_ambience.set(this, null);
        _AudioEngine_enabled.set(this, true);
        _AudioEngine_unlocked.set(this, false);
        _AudioEngine_ambientStarted.set(this, false);
    }
    setEnabled(enabled) {
        __classPrivateFieldSet(this, _AudioEngine_enabled, enabled, "f");
        if (__classPrivateFieldGet(this, _AudioEngine_master, "f") && __classPrivateFieldGet(this, _AudioEngine_context, "f")) {
            __classPrivateFieldGet(this, _AudioEngine_master, "f").gain.cancelScheduledValues(__classPrivateFieldGet(this, _AudioEngine_context, "f").currentTime);
            __classPrivateFieldGet(this, _AudioEngine_master, "f").gain.setTargetAtTime(enabled ? 0.78 : 0.0001, __classPrivateFieldGet(this, _AudioEngine_context, "f").currentTime, 0.04);
        }
    }
    async unlock() {
        if (!__classPrivateFieldGet(this, _AudioEngine_context, "f"))
            __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_createContext).call(this);
        if (!__classPrivateFieldGet(this, _AudioEngine_context, "f"))
            return;
        if (__classPrivateFieldGet(this, _AudioEngine_context, "f").state !== 'running')
            await __classPrivateFieldGet(this, _AudioEngine_context, "f").resume().catch(() => undefined);
        __classPrivateFieldSet(this, _AudioEngine_unlocked, true, "f");
        __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_startAmbience).call(this);
    }
    async suspend() {
        if (__classPrivateFieldGet(this, _AudioEngine_context, "f")?.state === 'running')
            await __classPrivateFieldGet(this, _AudioEngine_context, "f").suspend().catch(() => undefined);
    }
    async resume() {
        if (__classPrivateFieldGet(this, _AudioEngine_unlocked, "f") && __classPrivateFieldGet(this, _AudioEngine_context, "f")?.state === 'suspended')
            await __classPrivateFieldGet(this, _AudioEngine_context, "f").resume().catch(() => undefined);
    }
    turn() {
        __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_tone).call(this, 196, 0.08, 'triangle', 0.06, 238);
        window.setTimeout(() => __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_tone).call(this, 261.63, 0.06, 'sine', 0.035), 45);
    }
    connect() {
        __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_tone).call(this, 329.63, 0.14, 'sine', 0.07, 493.88);
        window.setTimeout(() => __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_tone).call(this, 659.25, 0.18, 'sine', 0.045), 75);
    }
    denied() {
        __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_tone).call(this, 118, 0.12, 'square', 0.035, 92);
    }
    undo() {
        __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_tone).call(this, 270, 0.12, 'triangle', 0.045, 170);
    }
    hint() {
        __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_chime).call(this, [523.25, 659.25, 783.99], 0.075, 0.19);
    }
    bloom() {
        __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_chime).call(this, [261.63, 329.63, 392, 523.25, 659.25, 783.99], 0.08, 0.5);
        window.setTimeout(() => __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_noiseBurst).call(this, 0.65, 0.055), 180);
    }
    click() {
        __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_tone).call(this, 420, 0.045, 'triangle', 0.025, 520);
    }
}
_AudioEngine_context = new WeakMap(), _AudioEngine_master = new WeakMap(), _AudioEngine_ambience = new WeakMap(), _AudioEngine_enabled = new WeakMap(), _AudioEngine_unlocked = new WeakMap(), _AudioEngine_ambientStarted = new WeakMap(), _AudioEngine_instances = new WeakSet(), _AudioEngine_createContext = function _AudioEngine_createContext() {
    const Constructor = window.AudioContext;
    if (!Constructor)
        return;
    __classPrivateFieldSet(this, _AudioEngine_context, new Constructor({ latencyHint: 'interactive' }), "f");
    __classPrivateFieldSet(this, _AudioEngine_master, __classPrivateFieldGet(this, _AudioEngine_context, "f").createGain(), "f");
    __classPrivateFieldGet(this, _AudioEngine_master, "f").gain.value = __classPrivateFieldGet(this, _AudioEngine_enabled, "f") ? 0.78 : 0.0001;
    __classPrivateFieldGet(this, _AudioEngine_master, "f").connect(__classPrivateFieldGet(this, _AudioEngine_context, "f").destination);
    __classPrivateFieldSet(this, _AudioEngine_ambience, __classPrivateFieldGet(this, _AudioEngine_context, "f").createGain(), "f");
    __classPrivateFieldGet(this, _AudioEngine_ambience, "f").gain.value = 0.16;
    __classPrivateFieldGet(this, _AudioEngine_ambience, "f").connect(__classPrivateFieldGet(this, _AudioEngine_master, "f"));
}, _AudioEngine_startAmbience = function _AudioEngine_startAmbience() {
    if (__classPrivateFieldGet(this, _AudioEngine_ambientStarted, "f") || !__classPrivateFieldGet(this, _AudioEngine_context, "f") || !__classPrivateFieldGet(this, _AudioEngine_ambience, "f"))
        return;
    __classPrivateFieldSet(this, _AudioEngine_ambientStarted, true, "f");
    const context = __classPrivateFieldGet(this, _AudioEngine_context, "f");
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 680;
    filter.Q.value = 0.35;
    filter.connect(__classPrivateFieldGet(this, _AudioEngine_ambience, "f"));
    for (const [frequency, detune, gainValue] of [[65.41, -7, 0.028], [98, 4, 0.017], [130.81, 9, 0.012]]) {
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
}, _AudioEngine_chime = function _AudioEngine_chime(frequencies, spacing, duration) {
    frequencies.forEach((frequency, index) => {
        window.setTimeout(() => __classPrivateFieldGet(this, _AudioEngine_instances, "m", _AudioEngine_tone).call(this, frequency, duration, 'sine', Math.max(0.025, 0.072 - index * 0.006)), index * spacing * 1000);
    });
}, _AudioEngine_tone = function _AudioEngine_tone(frequency, duration, type, volume, endFrequency) {
    if (!__classPrivateFieldGet(this, _AudioEngine_enabled, "f") || !__classPrivateFieldGet(this, _AudioEngine_context, "f") || !__classPrivateFieldGet(this, _AudioEngine_master, "f") || __classPrivateFieldGet(this, _AudioEngine_context, "f").state !== 'running')
        return;
    const context = __classPrivateFieldGet(this, _AudioEngine_context, "f");
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency)
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(__classPrivateFieldGet(this, _AudioEngine_master, "f"));
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
}, _AudioEngine_noiseBurst = function _AudioEngine_noiseBurst(duration, volume) {
    if (!__classPrivateFieldGet(this, _AudioEngine_enabled, "f") || !__classPrivateFieldGet(this, _AudioEngine_context, "f") || !__classPrivateFieldGet(this, _AudioEngine_master, "f") || __classPrivateFieldGet(this, _AudioEngine_context, "f").state !== 'running')
        return;
    const context = __classPrivateFieldGet(this, _AudioEngine_context, "f");
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
    gain.connect(__classPrivateFieldGet(this, _AudioEngine_master, "f"));
    source.start();
};
//# sourceMappingURL=audio.js.map