import { DEFAULTS } from '../core/state.js';
import { encodeStateToCode, decodeSeedDetailed, decodeCodeToState } from '../core/seed.js';
import { encodeMessageToState } from '../core/cipher.js';
import { lockedGroups, lockedSliders, applyLocksToState } from '../core/locks.js';
import { generateSVGString } from '../core/geometry.js';

function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg || 'Mismatch'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

export function runAllTests() {
    const results = [];
    const test = (name, fn) => {
        try {
            fn();
            results.push({ name, passed: true });
        } catch (err) {
            results.push({ name, passed: false, error: err?.message || String(err) });
        }
    };

    test('Seed encode -> decode round-trip preserves state fields', () => {
        const custom = {
            ...DEFAULTS,
            circleRadius: 68,
            ringStrokeWidth: 9.5,
            wingStrokeWidth: 8.5,
            topWingLen: 152,
            botWingLen: 112,
            strokeColor: '#38bdf8',
            secondaryColor: '#f43f5e',
            useGradient: true,
            gradAngle: 135,
            tripleWing: true,
            innerRingRadius: 24,
            textOffsetY: 72,
            encodedMessage: 'SOLOPASS TEST',
            brandText: 'SOLOPASS',
            showText: true,
            letterSpacing: 6
        };

        const seed = encodeStateToCode(custom);
        assert(seed.startsWith('SP2-'), `Expected SP2- prefix, got ${seed}`);

        const decoded = decodeSeedDetailed(seed);
        assert(decoded.ok, `Expected ok: true, got error: ${decoded.error}`);

        const keysToVerify = [
            'circleRadius',
            'ringStrokeWidth',
            'wingStrokeWidth',
            'topWingLen',
            'botWingLen',
            'strokeColor',
            'secondaryColor',
            'useGradient',
            'gradAngle',
            'tripleWing',
            'innerRingRadius',
            'textOffsetY',
            'encodedMessage',
            'brandText',
            'showText',
            'letterSpacing'
        ];
        for (const k of keysToVerify) {
            assertEqual(decoded.state[k], custom[k], `Field ${k}`);
        }
    });

    test('Invalid seeds fail gracefully without mutating targetState', () => {
        const snapshot = { ...DEFAULTS, circleRadius: 71, strokeColor: '#a855f7' };
        const target = { ...snapshot };

        const invalidInputs = [
            '',
            '   ',
            'SP0-invalid',
            'SP2-!!!not-base64!!!',
            'SP2-' + btoa('short.payload'),
            'SP2-' + btoa('44.7.7.24.115.85.24.4.0.0.0.10.50.0.1.NOTHEX.0..1.U09MT1BBU1M=.16.4.0.0.0.0.0')
        ];

        for (const bad of invalidInputs) {
            const res = decodeSeedDetailed(bad, target);
            assert(!res.ok, `Expected failure for input: ${bad}`);
            assert(typeof res.error === 'string' && res.error.length > 0, 'Expected descriptive error');
            assertEqual(decodeCodeToState(bad, target), false, 'decodeCodeToState should return false');
            assertEqual(target.circleRadius, snapshot.circleRadius, 'targetState.circleRadius mutated');
            assertEqual(target.strokeColor, snapshot.strokeColor, 'targetState.strokeColor mutated');
        }
    });

    test('Cipher encode is deterministic for identical messages', () => {
        const s1 = { ...DEFAULTS };
        const s2 = { ...DEFAULTS };

        const r1 = encodeMessageToState('Zero Trust Mesh', s1);
        const r2 = encodeMessageToState('Zero Trust Mesh', s2);

        assert(r1.ok && r2.ok, 'Expected cipher encode to succeed');
        assertEqual(s1.topWingLen, s2.topWingLen, 'topWingLen deterministic');
        assertEqual(s1.circleRadius, s2.circleRadius, 'circleRadius deterministic');
        assertEqual(s1.wingAngle, s2.wingAngle, 'wingAngle deterministic');
        assertEqual(s1.ringStrokeWidth, s2.ringStrokeWidth, 'ringStrokeWidth deterministic');
        assertEqual(s1.encodedMessage, 'Zero Trust Mesh', 'trimmed message preserved');

        const emptyRes = encodeMessageToState('   ', { ...DEFAULTS });
        assert(!emptyRes.ok, 'Empty message should fail gracefully');
    });

    test('Lock groups and per-slider locks protect anchor values', () => {
        const prevWings = lockedGroups.wings;
        const prevRadius = lockedSliders.circleRadius;
        try {
            lockedGroups.wings = true;
            lockedSliders.circleRadius = true;

            const anchor = { ...DEFAULTS, topWingLen: 144, circleRadius: 59, ringRotate: 0 };
            const candidate = { ...DEFAULTS, topWingLen: 90, circleRadius: 35, ringRotate: 75 };

            const result = applyLocksToState(candidate, anchor);

            assertEqual(result.topWingLen, 144, 'Locked group key restored');
            assertEqual(result.circleRadius, 59, 'Locked slider key restored');
            assertEqual(result.ringRotate, 75, 'Unlocked key updated');
        } finally {
            lockedGroups.wings = prevWings;
            if (prevRadius === undefined) {
                delete lockedSliders.circleRadius;
            } else {
                lockedSliders.circleRadius = prevRadius;
            }
        }
    });

    test('SVG generator outputs valid non-empty SVG with expected attributes', () => {
        const svg = generateSVGString({ ...DEFAULTS, useGradient: true, innerRingRadius: 20 });
        assert(svg.startsWith('<svg '), 'Starts with <svg');
        assert(svg.includes('</svg>'), 'Ends with </svg>');
        assert(svg.includes('linearGradient'), 'Includes linearGradient when useGradient is true');
    });

    return results;
}
