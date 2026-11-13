/**
 * Two-way SP2 / SP1 vector seed serialization and strict validation.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function utf8ToBase64(str) {
    const bytes = textEncoder.encode(String(str));
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function base64ToUtf8(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return textDecoder.decode(bytes);
}

const isValidHex6 = (s) => typeof s === 'string' && /^[0-9A-Fa-f]{6}$/.test(s);
const clampNum = (val, min, max, fallback) => {
    const n = parseFloat(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
};

export function encodeStateToCode(s) {
    const msgToken = s.encodedMessage ? utf8ToBase64(s.encodedMessage) : '';
    const payload = [
        s.circleRadius,
        s.ringStrokeWidth,
        s.wingStrokeWidth,
        s.wingGap,
        s.topWingLen,
        s.botWingLen,
        s.wingSpacing,
        s.wingOffsetY,
        s.botInnerInset,
        s.wingAngle,
        s.wingCurve,
        s.glowBlur,
        Math.round(s.glowOpacity * 100),
        Math.round(s.ringFillOpacity * 100),
        s.lineCap === 'round' ? 1 : 0,
        (s.strokeColor || '#6b66ff').replace('#', ''),
        s.useGradient ? (s.secondaryColor || '#38bdf8').replace('#', '') : '0',
        msgToken,
        s.showText ? 1 : 0,
        utf8ToBase64(s.brandText || 'SOLOPASS'),
        s.fontSize,
        s.letterSpacing,
        s.wingBalance,
        s.ringGapDeg,
        s.ringRotate,
        s.tripleWing ? 1 : 0,
        s.lockNonStraight ? 1 : 0,
        s.innerRingRadius || 0,
        s.textOffsetY || 58,
        s.gradAngle || 0
    ].join('|');
    return `SP2-${btoa(payload).replace(/=+$/, '')}`;
}

/**
 * Validates and decodes an SP2/SP1 seed into a candidate patch without mutating targetState on failure.
 */
export function decodeSeedDetailed(codeStr, targetState = null) {
    if (typeof codeStr !== 'string' || !codeStr.trim()) {
        return { ok: false, error: 'Seed string is empty.' };
    }
    try {
        let raw = codeStr.trim();
        const seedAttrMatch = raw.match(/data-solopass-seed=["'](SP[12]-[A-Za-z0-9+/=_-]+)["']/);
        if (seedAttrMatch) {
            raw = seedAttrMatch[1];
        }
        if (!/^SP[12]-[A-Za-z0-9+/=_-]+$/.test(raw)) {
            return { ok: false, error: 'Invalid seed prefix or characters (expected SP2-...).' };
        }
        const isV2 = raw.startsWith('SP2-');
        let clean = raw.replace(/^SP[12]-/, '').replace(/-/g, '+').replace(/_/g, '/');
        while (clean.length % 4) clean += '=';
        const decoded = atob(clean);
        const p = decoded.includes('|') ? decoded.split('|') : decoded.split('.');
        if (p.length < 15) {
            return { ok: false, error: 'Seed payload is truncated.' };
        }

        const patch = {};
        if (isV2 && p.length >= 17) {
            const reqNums = p.slice(0, 14).map(Number);
            if (reqNums.some(n => !Number.isFinite(n))) {
                return { ok: false, error: 'Seed contains invalid numeric geometry.' };
            }
            if (!isValidHex6(p[15])) {
                return { ok: false, error: 'Seed contains invalid primary color hex.' };
            }
            if (p[16] && p[16] !== '0' && !isValidHex6(p[16])) {
                return { ok: false, error: 'Seed contains invalid secondary color hex.' };
            }
            patch.circleRadius = clampNum(p[0], 10, 120, 44);
            patch.ringStrokeWidth = clampNum(p[1], 1, 30, 7);
            patch.wingStrokeWidth = clampNum(p[2], 1, 30, 7);
            patch.wingGap = clampNum(p[3], 0, 120, 24);
            patch.topWingLen = clampNum(p[4], 15, 260, 115);
            patch.botWingLen = clampNum(p[5], 10, 260, 85);
            patch.wingSpacing = clampNum(p[6], 4, 100, 24);
            patch.wingOffsetY = clampNum(p[7], -50, 50, 4);
            patch.botInnerInset = clampNum(p[8], -40, 60, 0);
            patch.wingAngle = clampNum(p[9], -45, 45, 0);
            patch.wingCurve = clampNum(p[10], -60, 60, 0);
            patch.glowBlur = clampNum(p[11], 0, 50, 10);
            patch.glowOpacity = clampNum(parseFloat(p[12]) / 100, 0.05, 1, 1);
            patch.ringFillOpacity = clampNum(parseFloat(p[13]) / 100, 0, 1, 0);
            patch.lineCap = p[14] === '1' ? 'round' : 'butt';
            patch.strokeColor = `#${p[15]}`;
            if (p[16] && p[16] !== '0') {
                patch.useGradient = true;
                patch.secondaryColor = `#${p[16]}`;
            } else {
                patch.useGradient = false;
            }
            patch.encodedMessage = p[17] ? base64ToUtf8(p[17]) : '';
            if (p.length >= 22) {
                patch.showText = p[18] === '1';
                patch.brandText = p[19] ? base64ToUtf8(p[19]) : 'SOLOPASS';
                patch.fontSize = clampNum(p[20], 10, 80, 30);
                patch.letterSpacing = clampNum(p[21], 0, 40, 12);
            }
            patch.wingBalance = p.length >= 23 ? clampNum(p[22], -50, 50, 0) : 0;
            patch.ringGapDeg = p.length >= 24 ? clampNum(p[23], 0, 180, 0) : 0;
            patch.ringRotate = p.length >= 25 ? clampNum(p[24], -180, 180, 0) : 0;
            patch.tripleWing = p.length >= 26 ? p[25] === '1' : false;
            patch.lockNonStraight = p.length >= 27 ? p[26] === '1' : false;
            patch.innerRingRadius = p.length >= 28 ? clampNum(p[27], 0, 60, 0) : 0;
            patch.textOffsetY = p.length >= 29 ? clampNum(p[28], 20, 140, 58) : 58;
            patch.gradAngle = p.length >= 30 ? clampNum(p[29], -180, 180, 0) : 0;
        } else {
            if (!isValidHex6(p[12])) {
                return { ok: false, error: 'Legacy SP1 seed has invalid color hex.' };
            }
            patch.circleRadius = clampNum(p[0], 10, 120, 44);
            patch.ringStrokeWidth = clampNum(p[1], 1, 30, 7);
            patch.wingStrokeWidth = clampNum(p[2], 1, 30, 7);
            patch.wingGap = clampNum(p[3], 0, 120, 24);
            patch.topWingLen = clampNum(p[4], 15, 260, 115);
            patch.botWingLen = clampNum(p[5], 10, 260, 85);
            patch.wingSpacing = clampNum(p[6], 4, 100, 24);
            patch.wingOffsetY = clampNum(p[7], -50, 50, 4);
            patch.botInnerInset = clampNum(p[8], -40, 60, 0);
            patch.wingAngle = clampNum(p[9], -45, 45, 0);
            patch.wingCurve = 0;
            patch.glowBlur = clampNum(p[10], 0, 50, 10);
            patch.lineCap = p[11] === '1' ? 'round' : 'butt';
            patch.strokeColor = `#${p[12]}`;
            if (p[13] && p[13] !== '0' && isValidHex6(p[13])) {
                patch.useGradient = true;
                patch.secondaryColor = `#${p[13]}`;
            } else {
                patch.useGradient = false;
            }
            patch.encodedMessage = '';
        }

        if (targetState) {
            Object.assign(targetState, patch);
        }
        return { ok: true, state: patch };
    } catch (err) {
        return { ok: false, error: err?.message || 'Malformed seed string.' };
    }
}

export function decodeCodeToState(codeStr, targetState) {
    return decodeSeedDetailed(codeStr, targetState).ok;
}
