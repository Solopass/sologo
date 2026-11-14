/**
 * Message-to-Motion Choreography Engine.
 * Converts real text messages into smooth .SPMOTION keyframe timelines
 * (Stealth Aesthetic Morphs or CRC-8 Decodable SoloSync Beacons).
 */
import { ANIMATABLE_KEYS } from './state.js';
import { applyLocksToState } from './locks.js';

function snapshotBase(src) {
    const snap = {};
    ANIMATABLE_KEYS.forEach((k) => {
        snap[k] = src[k];
    });
    snap.strokeColor = src.strokeColor;
    snap.secondaryColor = src.secondaryColor;
    snap.useGradient = !!src.useGradient;
    snap.tripleWing = !!src.tripleWing;
    snap.visualStyle = src.visualStyle || 'classic';
    return snap;
}

function hashChunk(text, index) {
    let h = (2166136261 ^ (index * 16777619)) >>> 0;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

const STYLE_CONFIG = {
    cyberMorph: {
        label: 'Stealth Morph',
        visualStyle: 'classic',
        easing: 'easeInOutQuint',
        playMode: 'loop',
        energyFlow: 45
    },
    plasmaPulse: {
        label: 'Plasma Pulse',
        visualStyle: 'plasma',
        easing: 'spring',
        playMode: 'pingpong',
        energyFlow: 80
    },
    holoScan: {
        label: 'Holo Scan',
        visualStyle: 'holographic',
        easing: 'easeInOutCubic',
        playMode: 'loop',
        energyFlow: 90
    },
    glitchCipher: {
        label: 'Glitch Cipher',
        visualStyle: 'glitch',
        easing: 'easeInOutBack',
        playMode: 'loop',
        energyFlow: 85
    }
};

/**
 * Generates a smooth, aesthetic .SPMOTION timeline driven deterministically by a message.
 */
export function buildStealthMessageTimeline(message, baseState, { style = 'cyberMorph', anchorState = null } = {}) {
    if (typeof message !== 'string' || !message.trim()) {
        return { ok: false, error: 'Enter a message to animate first.' };
    }
    const clean = message.trim();
    if (clean.length > 240) {
        return { ok: false, error: 'Message must be 240 characters or fewer.' };
    }

    const cfg = STYLE_CONFIG[style] || STYLE_CONFIG.cyberMorph;
    const anchor = anchorState || baseState;
    const base = applyLocksToState({
        ...snapshotBase(baseState),
        visualStyle: cfg.visualStyle,
        useGradient: cfg.visualStyle === 'plasma' || cfg.visualStyle === 'holographic' ? true : !!baseState.useGradient,
        energyFlow: cfg.energyFlow
    }, anchor);

    // Group into up to 12 balanced rhythmic tokens so long messages stay crisp
    const maxTokens = 12;
    const step = Math.max(1, Math.ceil(clean.length / maxTokens));
    const tokens = [];
    for (let i = 0; i < clean.length; i += step) {
        tokens.push(clean.slice(i, i + step));
    }

    const keyframes = [{ label: 'Origin', easing: cfg.easing, state: { ...base } }];

    tokens.forEach((tok, idx) => {
        const h = hashChunk(tok, idx);
        const norm = (shift, min, max) => min + (((h >>> shift) & 0xFF) / 255) * (max - min);
        const phase = (idx + 1) / (tokens.length + 1);

        const pose = {
            ...base,
            circleRadius: Math.round(Math.max(26, Math.min(64, (base.circleRadius || 44) + norm(0, -6, 8)))),
            ringGapDeg: Math.round(norm(4, 22, 115)),
            ringRotate: Math.round(-140 + phase * 280 + norm(8, -25, 25)),
            topWingLen: Math.round(Math.max(70, Math.min(195, (base.topWingLen || 115) + norm(12, -16, 46)))),
            botWingLen: Math.round(Math.max(50, Math.min(160, (base.botWingLen || 85) + norm(16, -12, 34)))),
            wingGap: Math.round(norm(20, 18, 42)),
            wingCurve: Math.round(norm(2, -16, 18)),
            wingAngle: Number(norm(10, -9, 9).toFixed(1)),
            wingBalance: style === 'glitchCipher' ? Math.round(norm(14, -24, 24)) : Math.round(norm(14, -8, 8)),
            gradAngle: Math.round(-160 + phase * 320),
            glowBlur: Math.round(norm(6, 10, 26)),
            energyFlow: cfg.energyFlow
        };

        keyframes.push({
            label: tok.length > 3 ? tok.slice(0, 3) : tok,
            easing: cfg.easing,
            state: applyLocksToState(pose, anchor)
        });
    });

    keyframes.push({ label: 'Settle', easing: cfg.easing, state: { ...base } });

    const durationSec = Number(Math.max(2.5, Math.min(8.0, keyframes.length * 0.48)).toFixed(1));
    return {
        ok: true,
        message: clean,
        style,
        frameCount: keyframes.length,
        timeline: {
            format: 'solopass-motion-v1',
            durationSec,
            playMode: cfg.playMode,
            easing: cfg.easing,
            loop: true,
            keyframes
        }
    };
}

/**
 * Generates a CRC-8 visually decodable SoloSync beacon timeline from a message.
 */
export function buildBeaconMessageTimeline(message, baseState, { anchorState = null, protocol = null } = {}) {
    if (typeof message !== 'string' || !message.trim()) {
        return { ok: false, error: 'Enter a message to encode into a beacon timeline.' };
    }
    const clean = message.trim();
    if (clean.length > 64) {
        return { ok: false, error: 'Decodable Beacon timelines support up to 64 characters for clean video capture.' };
    }

    const proto = protocol || (typeof window !== 'undefined' ? window.SoloSyncProtocol : null);
    if (!proto || typeof proto.encodePayloadToFrames !== 'function') {
        return { ok: false, error: 'SoloSyncProtocol is not loaded.' };
    }

    const rawFrames = proto.encodePayloadToFrames(clean);
    if (!rawFrames.length) {
        return { ok: false, error: 'No frames generated for message.' };
    }

    const anchor = anchorState || baseState;
    const base = snapshotBase(baseState);
    const keyframes = rawFrames.map((f, idx) => {
        const ch = String.fromCharCode(f.b0);
        const safeCh = /[\x20-\x7E]/.test(ch) ? ch : `#${idx + 1}`;
        return {
            label: `${idx + 1}:${safeCh}`,
            easing: 'step',
            state: applyLocksToState({
                ...base,
                ...f.state,
                visualStyle: 'classic',
                useGradient: true,
                energyFlow: 0,
                _clockBit: f.clockBit
            }, anchor)
        };
    });

    const durationSec = Number(Math.max(2.0, Math.min(12.0, keyframes.length * 0.4)).toFixed(1));
    return {
        ok: true,
        message: clean,
        style: 'beacon',
        frameCount: keyframes.length,
        timeline: {
            format: 'solopass-motion-v1',
            durationSec,
            playMode: 'loop',
            easing: 'step',
            loop: true,
            keyframes
        }
    };
}
