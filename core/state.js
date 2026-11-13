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
    visualStyle: 'classic',
    energyFlow: 0,
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
    visualStyle: 'classic',
    energyFlow: 0,
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
    'glowBlur', 'glowOpacity', 'gradAngle', 'wingLag', 'energyFlow', 'textOffsetY'
];

export const LOCK_GROUP_KEYS = {
    colors: ['strokeColor', 'secondaryColor', 'useGradient', 'bgColor', 'gradAngle', 'visualStyle', 'energyFlow'],
    ring: ['circleRadius', 'ringStrokeWidth', 'ringFillOpacity', 'ringGapDeg', 'ringRotate', 'innerRingRadius'],
    wings: ['wingStrokeWidth', 'wingGap', 'topWingLen', 'botWingLen', 'wingSpacing', 'wingOffsetY', 'botInnerInset', 'wingAngle', 'wingCurve', 'wingBalance', 'wingLag', 'tripleWing', 'lineCap'],
    glow: ['glowBlur', 'glowOpacity'],
    text: ['showText', 'brandText', 'letterSpacing', 'fontSize', 'textOffsetY']
};

export const SECTION_RESET_PRESETS = {
    colors: { strokeColor: '#6b66ff', secondaryColor: '#38bdf8', useGradient: false, gradAngle: 0, visualStyle: 'classic', energyFlow: 0, glowBlur: 10, glowOpacity: 1 },
    ring: { circleRadius: 44, ringStrokeWidth: 7, ringFillOpacity: 0, ringGapDeg: 0, ringRotate: 0, innerRingRadius: 0 },
    wings: { wingStrokeWidth: 7, wingGap: 24, topWingLen: 115, botWingLen: 85, wingSpacing: 24, wingOffsetY: 4, botInnerInset: 0, wingAngle: 0, wingCurve: 0, wingBalance: 0, wingLag: 0, tripleWing: false, lineCap: 'round' },
    text: { showText: false, brandText: 'SOLOPASS', fontSize: 30, letterSpacing: 12, textOffsetY: 58 }
};

export const PRESETS = {
    reference: {
        strokeColor: '#6b66ff', secondaryColor: '#38bdf8', useGradient: false,
        visualStyle: 'classic', energyFlow: 0,
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
        visualStyle: 'classic', energyFlow: 0,
        glowBlur: 12, glowOpacity: 0.95, circleRadius: 44, ringStrokeWidth: 7,
        ringFillOpacity: 0.06, wingStrokeWidth: 6.5, wingGap: 24,
        topWingLen: 125, botWingLen: 85, wingSpacing: 24, wingOffsetY: 2,
        botInnerInset: 0, wingAngle: 0, wingCurve: 0, lineCap: 'round', showText: false
    },
    plasma: {
        strokeColor: '#38bdf8', secondaryColor: '#a855f7', useGradient: true,
        visualStyle: 'plasma', energyFlow: 65, gradAngle: 25,
        glowBlur: 18, glowOpacity: 1, circleRadius: 46, ringStrokeWidth: 7.5,
        ringFillOpacity: 0.1, ringGapDeg: 28, ringRotate: 15, innerRingRadius: 22,
        wingStrokeWidth: 7.5, wingGap: 24, topWingLen: 145, botWingLen: 102,
        wingSpacing: 26, wingOffsetY: 0, botInnerInset: 6, wingAngle: 4,
        wingCurve: 10, wingBalance: 0, tripleWing: true, lineCap: 'round', showText: false
    },
    hologram: {
        strokeColor: '#22d3ee', secondaryColor: '#f472b6', useGradient: true,
        visualStyle: 'holographic', energyFlow: 45, gradAngle: 45,
        glowBlur: 14, glowOpacity: 0.95, circleRadius: 44, ringStrokeWidth: 6,
        ringFillOpacity: 0.08, ringGapDeg: 40, ringRotate: -20, innerRingRadius: 26,
        wingStrokeWidth: 6, wingGap: 26, topWingLen: 138, botWingLen: 95,
        wingSpacing: 24, wingOffsetY: 2, botInnerInset: 4, wingAngle: -3,
        wingCurve: -8, wingBalance: 0, tripleWing: false, lineCap: 'round', showText: false
    },
    glitch: {
        strokeColor: '#00f5d4', secondaryColor: '#f43f5e', useGradient: true,
        visualStyle: 'glitch', energyFlow: 80, gradAngle: 0,
        glowBlur: 10, glowOpacity: 0.95, circleRadius: 42, ringStrokeWidth: 7,
        ringFillOpacity: 0.04, ringGapDeg: 55, ringRotate: 18, innerRingRadius: 18,
        wingStrokeWidth: 7, wingGap: 20, topWingLen: 150, botWingLen: 88,
        wingSpacing: 22, wingOffsetY: 0, botInnerInset: 10, wingAngle: 6,
        wingCurve: 0, wingBalance: 14, tripleWing: true, lineCap: 'butt', showText: false
    },
    bloom: {
        strokeColor: '#f43f5e', secondaryColor: '#fb923c', useGradient: true,
        visualStyle: 'bloom', energyFlow: 35, gradAngle: -30,
        glowBlur: 24, glowOpacity: 1, circleRadius: 48, ringStrokeWidth: 8,
        ringFillOpacity: 0.14, ringGapDeg: 0, ringRotate: 0, innerRingRadius: 20,
        wingStrokeWidth: 8, wingGap: 26, topWingLen: 142, botWingLen: 104,
        wingSpacing: 28, wingOffsetY: 4, botInnerInset: 0, wingAngle: 0,
        wingCurve: 12, wingBalance: 0, tripleWing: false, lineCap: 'round', showText: false
    },
    minimal: {
        strokeColor: '#f8fafc', secondaryColor: '#94a3b8', useGradient: false,
        visualStyle: 'minimal', energyFlow: 0, gradAngle: 0,
        glowBlur: 2, glowOpacity: 0.5, circleRadius: 42, ringStrokeWidth: 3.5,
        ringFillOpacity: 0, ringGapDeg: 24, ringRotate: 0, innerRingRadius: 28,
        wingStrokeWidth: 3.5, wingGap: 22, topWingLen: 132, botWingLen: 92,
        wingSpacing: 20, wingOffsetY: 0, botInnerInset: 8, wingAngle: 0,
        wingCurve: 0, wingBalance: 0, tripleWing: false, lineCap: 'butt', showText: false
    },
    aggressive: {
        strokeColor: '#facc15', secondaryColor: '#ef4444', useGradient: true,
        visualStyle: 'aggressive', energyFlow: 55, gradAngle: 15,
        glowBlur: 12, glowOpacity: 1, circleRadius: 40, ringStrokeWidth: 7.5,
        ringFillOpacity: 0.08, ringGapDeg: 65, ringRotate: -35, innerRingRadius: 0,
        wingStrokeWidth: 7.5, wingGap: 18, topWingLen: 168, botWingLen: 90,
        wingSpacing: 24, wingOffsetY: -2, botInnerInset: 14, wingAngle: 11,
        wingCurve: -6, wingBalance: 22, tripleWing: true, lineCap: 'butt', showText: false
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
