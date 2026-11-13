/**
 * Deterministic Message-to-Geometry Cipher Codec.
 */

export function encodeMessageToState(msg, targetState) {
    if (typeof msg !== 'string' || !msg.trim()) {
        return { ok: false, error: 'Enter a phrase or key to encode first.' };
    }
    const text = msg.trim();
    if (text.length > 240) {
        return { ok: false, error: 'Cipher phrase must be 240 characters or fewer.' };
    }

    let h1 = 2166136261;
    let h2 = 16777619;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        h1 ^= code;
        h1 = Math.imul(h1, 16777619);
        h2 = (h2 * 31 + code * (i + 7)) >>> 0;
    }

    const pick = (seed, min, max, step = 1) => {
        const norm = ((seed >>> 0) % 10000) / 10000;
        const raw = min + norm * (max - min);
        return Math.round(raw / step) * step;
    };

    const patch = {
        encodedMessage: text,
        circleRadius: pick(h1, 34, 58, 1),
        ringStrokeWidth: pick(h1 >> 3, 5, 10, 0.5),
        wingStrokeWidth: pick(h2 >> 2, 5, 10, 0.5),
        wingGap: pick(h1 >> 6, 16, 40, 1),
        topWingLen: pick(h2 >> 5, 85, 165, 1),
        botWingLen: pick(h1 >> 9, 55, 130, 1),
        wingSpacing: pick(h2 >> 8, 18, 36, 1),
        wingOffsetY: pick(h1 >> 12, -10, 12, 1),
        botInnerInset: pick(h2 >> 11, 0, 18, 1),
        wingAngle: pick(h1 >> 15, -8, 8, 0.5),
        wingCurve: pick(h2 >> 14, -14, 14, 1)
    };

    if (targetState) {
        Object.assign(targetState, patch);
    }
    return { ok: true, message: text, patch };
}
