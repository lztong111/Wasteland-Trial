import type { GameSettings } from '../data/SettingsManager';

export type SoundId =
    | 'melee'
    | 'ranged'
    | 'hit'
    | 'hurt'
    | 'pickup'
    | 'heal'
    | 'levelup'
    | 'ui'
    | 'pause'
    | 'dodge';

interface ToneSpec {
    frequency: number;
    duration: number;
    type: OscillatorType;
    gain: number;
    slideTo?: number;
}

const TONES: Record<SoundId, ToneSpec> = {
    melee: { frequency: 180, duration: 0.08, type: 'square', gain: 0.08, slideTo: 90 },
    ranged: { frequency: 520, duration: 0.07, type: 'triangle', gain: 0.06, slideTo: 220 },
    hit: { frequency: 140, duration: 0.09, type: 'sawtooth', gain: 0.07, slideTo: 60 },
    hurt: { frequency: 90, duration: 0.12, type: 'square', gain: 0.09, slideTo: 40 },
    pickup: { frequency: 480, duration: 0.1, type: 'sine', gain: 0.07, slideTo: 720 },
    heal: { frequency: 360, duration: 0.16, type: 'sine', gain: 0.06, slideTo: 540 },
    levelup: { frequency: 440, duration: 0.22, type: 'triangle', gain: 0.08, slideTo: 880 },
    ui: { frequency: 300, duration: 0.05, type: 'sine', gain: 0.04 },
    pause: { frequency: 220, duration: 0.06, type: 'triangle', gain: 0.05, slideTo: 160 },
    dodge: { frequency: 260, duration: 0.1, type: 'triangle', gain: 0.055, slideTo: 110 }
};

/**
 * 无外部资源的轻量音效：用 Web Audio 振荡器合成短促反馈音。
 */
export class AudioManager {
    private context: AudioContext | null = null;
    private settings: Readonly<GameSettings>;

    public constructor(settings: Readonly<GameSettings>) {
        this.settings = settings;
    }

    public setSettings(settings: Readonly<GameSettings>): void {
        this.settings = settings;
    }

    public play(id: SoundId): void {
        if (this.settings.muted || this.settings.masterVolume <= 0) return;
        const tone = TONES[id];
        try {
            const context = this.ensureContext();
            if (context.state === 'suspended') {
                void context.resume();
            }
            const now = context.currentTime;
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = tone.type;
            oscillator.frequency.setValueAtTime(tone.frequency, now);
            if (tone.slideTo !== undefined) {
                oscillator.frequency.exponentialRampToValueAtTime(
                    Math.max(40, tone.slideTo),
                    now + tone.duration
                );
            }
            const peak = tone.gain * this.settings.masterVolume;
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(now);
            oscillator.stop(now + tone.duration + 0.02);
            oscillator.onended = () => {
                oscillator.disconnect();
                gain.disconnect();
            };
        } catch {
            // 音频上下文不可用时静默失败。
        }
    }

    public dispose(): void {
        if (this.context && this.context.state !== 'closed') {
            void this.context.close();
        }
        this.context = null;
    }

    private ensureContext(): AudioContext {
        if (!this.context) {
            const AudioContextCtor = window.AudioContext
                ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextCtor) throw new Error('Web Audio 不可用');
            this.context = new AudioContextCtor();
        }
        return this.context;
    }
}
