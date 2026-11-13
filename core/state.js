/**
 * Shared emblem state, defaults, presets, and pure color/XML helpers.
 */

export const DEFAULTS = {
    strokeColor: '#6b66ff',
    secondaryColor: '#38bdf8',
    useGradient: false,
    glowBlur: 10,
    glowOpacity: 1,
    circleRadius: 44,
    ringStrokeWidth: 7,
    ringFillOpacity: 0,
    wingStrokeWidth: 7,
    wingGap: 24,
    topWingLen: 115,
    botWingLen: 85,
    wingSpacing: 24,
    wingOffsetY: 4,
    botInnerInset: 0,
    wingAngle: 0,
    wingCurve: 0,
    wingBalance: 0,
    wingLag: 0,
    ringGapDeg: 0,
    ringRotate: 0,
    innerRingRadius: 0,
    tripleWing: false,
    fontSize: 30,
    letterSpacing: 12,
    textOffsetY: 58,
    gradAngle: 0,
    zoom: 1
};

export const state = {
    strokeColor: '#6b66ff',
    secondaryColor: '#38bdf8',
    useGradient: false,
    glowBlur: 10,
    glowOpacity: 1,
    circleRadius: 44,
    ringStrokeWidth: 7,
    ringFillOpacity: 0,
    ringGapDeg: 0,
    ringRotate: 0,
    innerRingRadius: 0,
    wingStrokeWidth: 7,
    wingGap: 24,
    topWingLen: 115,
    botWingLen: 85,
    wingSpacing: 24,
    wingOffsetY: 4,
    botInnerInset: 0,
    wingAngle: 0,
    wingCurve: 0,
    wingBalance: 0,
    wingLag: 0,
    tripleWing: false,
    lockNonStraight: false,
    lineCap: 'round',
    showText: false,
    brandText: 'SOLOPASS',
    fontSize: 30,
    letterSpacing: 12,
    textOffsetY: 58,
    gradAngle: 0,
    bgColor: '#0d0d16',
    zoom: 1,
    showGuides: false,
    showOpticalGrid: false,
    motionTrail: false,
    encodedMessage: ''
};

export const ANIMATABLE_KEYS = [
    'circleRadius', 'ringStrokeWidth', 'ringFillOpacity', 'ringGapDeg', 'ringRotate', 'innerRingRadius',
    'wingStrokeWidth', 'wingGap', 'topWingLen', 'botWingLen', 'wingSpacing',
    'wingOffsetY', 'botInnerInset', 'wingAngle', 'wingCurve', 'wingBalance',
    'glowBlur', 'glowOpacity', 'gradAngle', 'wingLag', 'textOffsetY'
];

export const LOCK_GROUP_KEYS = {
    colors: ['strokeColor', 'secondaryColor', 'useGradient', 'bgColor', 'gradAngle'],
    ring: ['circleRadius', 'ringStrokeWidth', 'ringFillOpacity', 'ringGapDeg', 'ringRotate', 'innerRingRadius'],
    wings: ['wingStrokeWidth', 'wingGap', 'topWingLen', 'botWingLen', 'wingSpacing', 'wingOffsetY', 'botInnerInset', 'wingAngle', 'wingCurve', 'wingBalance', 'wingLag', 'tripleWing', 'lineCap'],
    glow: ['glowBlur', 'glowOpacity'],
    text: ['showText', 'brandText', 'letterSpacing', 'fontSize', 'textOffsetY']
};

export const SECTION_RESET_PRESETS = {
    colors: { strokeColor: '#6b66ff', secondaryColor: '#38bdf8', useGradient: false, gradAngle: 0, glowBlur: 10, glowOpacity: 1 },
    ring: { circleRadius: 44, ringStrokeWidth: 7, ringFillOpacity: 0, ringGapDeg: 0, ringRotate: 0, innerRingRadius: 0 },
    wings: { wingStrokeWidth: 7, wingGap: 24, topWingLen: 115, botWingLen: 85, wingSpacing: 24, wingOffsetY: 4, botInnerInset: 0, wingAngle: 0, wingCurve: 0, wingBalance: 0, wingLag: 0, tripleWing: false, lineCap: 'round' },
    text: { showText: false, brandText: 'SOLOPASS', fontSize: 30, letterSpacing: 12, textOffsetY: 58 }
};

export const PRESETS = {
    reference: {
        strokeColor: '#6b66ff', secondaryColor: '#38bdf8', useGradient: false,
        glowBlur: 10, glowOpacity: 1, circleRadius: 44, ringStrokeWidth: 7,
        ringFillOpacity: 0, ringGapDeg: 0, ringRotate: 0, wingStrokeWidth: 7,
        wingGap: 24, topWingLen: 115, botWingLen: 85, wingSpacing: 24,
        wingOffsetY: 4, botInnerInset: 0, wingAngle: 0, wingCurve: 0,
        wingBalance: 0, wingLag: 0, gradAngle: 0, innerRingRadius: 0, textOffsetY: 58,
        tripleWing: false, lineCap: 'round', showText: false
    },
    phi: {
        strokeColor: '#6b66ff', secondaryColor: '#a78bfa', useGradient: true,
        glowBlur: 11, glowOpacity: 0.95, circleRadius: 45, ringStrokeWidth: 6.5,
        ringFillOpacity: 0.04, wingStrokeWidth: 6.5, wingGap: 28,
        topWingLen: 136, botWingLen: 84, wingSpacing: 26, wingOffsetY: 0,
        botInnerInset: 0, wingAngle: 0, wingCurve: 0, lineCap: 'round', showText: false
    },
    fibonacci: {
        strokeColor: '#7873ff', useGradient: false,
        glowBlur: 13, glowOpacity: 0.95, circleRadius: 55, ringStrokeWidth: 8,
        ringFillOpacity: 0.02, wingStrokeWidth: 8, wingGap: 21,
        topWingLen: 144, botWingLen: 89, wingSpacing: 34, wingOffsetY: 5,
        botInnerInset: 0, wingAngle: 0, wingCurve: 0, lineCap: 'round', showText: false
    },
    pi: {
        strokeColor: '#60a5fa', secondaryColor: '#6b66ff', useGradient: true,
        glowBlur: 12, glowOpacity: 1, circleRadius: 42, ringStrokeWidth: 6.5,
        ringFillOpacity: 0.06, wingStrokeWidth: 6.5, wingGap: 31,
        topWingLen: 126, botWingLen: 94, wingSpacing: 25, wingOffsetY: 3,
        botInnerInset: 0, wingAngle: 0, wingCurve: 0, lineCap: 'round', showText: false
    },
    primes: {
        strokeColor: '#6b66ff', useGradient: false,
        glowBlur: 11, glowOpacity: 1, circleRadius: 43, ringStrokeWidth: 7,
        ringFillOpacity: 0, wingStrokeWidth: 7, wingGap: 23,
        topWingLen: 131, botWingLen: 83, wingSpacing: 29, wingOffsetY: 7,
        botInnerInset: 0, wingAngle: 0, wingCurve: 0, lineCap: 'round', showText: false
    },
    lockup: {
        strokeColor: '#7873ff', useGradient: false, glowBlur: 9, glowOpacity: 0.9,
        circleRadius: 38, ringStrokeWidth: 6.5, ringFillOpacity: 0.04,
        wingStrokeWidth: 6.5, wingGap: 22, topWingLen: 105, botWingLen: 75,
        wingSpacing: 22, wingOffsetY: 3, botInnerInset: 0, wingAngle: 0, wingCurve: 0,
        lineCap: 'round', showText: true, brandText: 'SOLOPASS', fontSize: 30, letterSpacing: 14
    },
    gradient: {
        strokeColor: '#6b66ff', secondaryColor: '#38bdf8', useGradient: true,
        glowBlur: 12, glowOpacity: 0.95, circleRadius: 44, ringStrokeWidth: 7,
        ringFillOpacity: 0.06, wingStrokeWidth: 6.5, wingGap: 24,
        topWingLen: 125, botWingLen: 85, wingSpacing: 24, wingOffsetY: 2,
        botInnerInset: 0, wingAngle: 0, wingCurve: 0, lineCap: 'round', showText: false
    }
};

export function escapeXml(str) {
    return String(str).replace(/[<>&'"]/g, (c) => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    }[c]));
}

export function lerpHexColor(hexA, hexB, t) {
    const parse = (h) => {
        const clean = (h || '#6b66ff').replace('#', '');
        const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
        return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    };
    const [r1, g1, b1] = parse(hexA);
    const [r2, g2, b2] = parse(hexB);
    const r = Math.max(0, Math.min(255, Math.round(r1 + (r2 - r1) * t)));
    const g = Math.max(0, Math.min(255, Math.round(g1 + (g2 - g1) * t)));
    const b = Math.max(0, Math.min(255, Math.round(b1 + (b2 - b1) * t)));
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
