/**
 * .SPMOTION Keyframe Timeline, Easing, Seeded Motion Generator & Smooth Morph Loop.
 */
import { state, ANIMATABLE_KEYS, lerpHexColor, escapeXml } from '../core/state.js';
import { applyLocksToState, isKeyLocked, getLockedSummaryLabel } from '../core/locks.js';
import { render, scheduleRender, syncInputsFromState, showToast } from '../ui/render.js';

export function captureAnimatableSnapshot(label = 'Key') {
    const snap = { label, easing: 'easeInOutCubic', state: {} };
    ANIMATABLE_KEYS.forEach(k => { snap.state[k] = state[k]; });
    snap.state.strokeColor = state.strokeColor;
    snap.state.secondaryColor = state.secondaryColor;
    snap.state.useGradient = state.useGradient;
    snap.state.tripleWing = state.tripleWing;
    snap.state.visualStyle = state.visualStyle || 'classic';
    return snap;
}

let motionTimeline = {
    format: 'solopass-motion-v1',
    durationSec: 3.0,
    playMode: 'loop',
    easing: 'easeInOutCubic',
    loop: true,
    keyframes: [
        captureAnimatableSnapshot('Origin'),
        {
            label: 'Portal Surge',
            easing: 'easeInOutCubic',
            state: {
                ...captureAnimatableSnapshot().state,
                ringGapDeg: 48,
                ringRotate: 25,
                topWingLen: 142,
                botWingLen: 98,
                wingGap: 30,
                wingCurve: 8,
                glowBlur: 18
            }
        },
        captureAnimatableSnapshot('Return')
    ]
};

export const getMotionTimeline = () => motionTimeline;
export function setMotionTimeline(next) {
    motionTimeline = next;
    const durEl = document.getElementById('timelineDuration');
    const durVal = document.getElementById('timelineDurationVal');
    const modeEl = document.getElementById('timelinePlayMode');
    const easeEl = document.getElementById('timelineEasingSelect');
    if (durEl) durEl.value = motionTimeline.durationSec || 3;
    if (durVal) durVal.textContent = `${(motionTimeline.durationSec || 3).toFixed(1)}s`;
    if (modeEl) modeEl.value = motionTimeline.playMode || 'loop';
    if (easeEl) easeEl.value = motionTimeline.easing || 'easeInOutCubic';
    activeKeyframeIdx = 0;
    renderKeyframeStrip();
    applyInterpolatedTimeline(0);
}

let isTimelinePlaying = false;
let timelineRafId = null;
let activeKeyframeIdx = 0;
export const getIsTimelinePlaying = () => isTimelinePlaying;

let isMorphLoopActive = false;
let isChainMorphActive = false;
let chainedMorphFrames = [];
let morphRafId = null;
let morphFromState = null;
let morphToState = null;
let morphStartTime = 0;
export const getIsMorphLoopActive = () => isMorphLoopActive;

let stopPulseFn = () => {};
let pushHistoryFn = () => {};
export function bindTimelineCallbacks({ stopPulse, pushHistory }) {
    if (stopPulse) stopPulseFn = stopPulse;
    if (pushHistory) pushHistoryFn = pushHistory;
}

export function applyEasingCurve(t, curveName) {
    const x = Math.max(0, Math.min(1, t));
    if (curveName === 'linear') return x;
    if (curveName === 'easeInOutQuint') {
        return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
    }
    if (curveName === 'easeOutBack') {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    if (curveName === 'easeInOutBack') {
        const c1 = 1.70158;
        const c2 = c1 * 1.525;
        return x < 0.5
            ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
            : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
    }
    if (curveName === 'easeOutElastic') {
        if (x === 0 || x === 1) return x;
        const c4 = (2 * Math.PI) / 3;
        return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
    }
    if (curveName === 'easeOutBounce') {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (x < 1 / d1) return n1 * x * x;
        if (x < 2 / d1) { const k = x - 1.5 / d1; return n1 * k * k + 0.75; }
        if (x < 2.5 / d1) { const k = x - 2.25 / d1; return n1 * k * k + 0.9375; }
        const k = x - 2.625 / d1;
        return n1 * k * k + 0.984375;
    }
    if (curveName === 'easeInOutExpo') {
        if (x === 0 || x === 1) return x;
        return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
    }
    if (curveName === 'spring') {
        if (x === 0 || x === 1) return x;
        const c4 = (2 * Math.PI) / 3;
        return x < 0.5
            ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c4)) / 2
            : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c4)) / 2 + 1;
    }
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function applyInterpolatedTimeline(progress) {
    const kfs = motionTimeline.keyframes;
    if (!kfs || kfs.length === 0) return;
    if (kfs.length === 1) {
        Object.assign(state, kfs[0].state);
        syncInputsFromState();
        render();
        return;
    }
    const clamped = Math.max(0, Math.min(1, progress));
    const scaled = clamped * (kfs.length - 1);
    const idx = Math.min(kfs.length - 2, Math.floor(scaled));
    const curveName = motionTimeline.easing || kfs[idx].easing || 'easeInOutCubic';
    const localT = applyEasingCurve(scaled - idx, curveName);
    const a = kfs[idx].state;
    const b = kfs[idx + 1].state;

    ANIMATABLE_KEYS.forEach(k => {
        const v1 = typeof a[k] === 'number' ? a[k] : state[k];
        const v2 = typeof b[k] === 'number' ? b[k] : state[k];
        state[k] = Number((v1 + (v2 - v1) * localT).toFixed(2));
    });
    if ((state.wingLag || 0) > 0) {
        const lagClamped = Math.max(0, Math.min(1, clamped - (state.wingLag / 100) * 0.22));
        const lagScaled = lagClamped * (kfs.length - 1);
        const lIdx = Math.min(kfs.length - 2, Math.floor(lagScaled));
        const lT = applyEasingCurve(lagScaled - lIdx, motionTimeline.easing || kfs[lIdx].easing || 'easeInOutCubic');
        const la = kfs[lIdx].state;
        const lb = kfs[lIdx + 1].state;
        for (const lagKey of ['botWingLen', 'wingCurve', 'wingAngle']) {
            const lb1 = typeof la[lagKey] === 'number' ? la[lagKey] : state[lagKey];
            const lb2 = typeof lb[lagKey] === 'number' ? lb[lagKey] : state[lagKey];
            state[lagKey] = Number((lb1 + (lb2 - lb1) * lT).toFixed(2));
        }
    }
    if (a.strokeColor && b.strokeColor) {
        state.strokeColor = lerpHexColor(a.strokeColor, b.strokeColor, localT);
    }
    if (a.secondaryColor && b.secondaryColor) {
        state.secondaryColor = lerpHexColor(a.secondaryColor, b.secondaryColor, localT);
    }
    if (typeof a.useGradient === 'boolean') {
        state.useGradient = localT < 0.5 ? a.useGradient : b.useGradient;
    }
    if (typeof a.tripleWing === 'boolean') {
        state.tripleWing = localT < 0.5 ? a.tripleWing : b.tripleWing;
    }
    if (a.visualStyle || b.visualStyle) {
        state.visualStyle = localT < 0.5 ? (a.visualStyle || 'classic') : (b.visualStyle || 'classic');
    }
    if ((state.energyFlow || 0) > 0) {
        state._flowPhase = Number((-(clamped * 160)).toFixed(1));
    }

    syncInputsFromState();
    render();
}

export function renderKeyframeStrip() {
    const strip = document.getElementById('keyframeStrip');
    const updateBtn = document.getElementById('updateKeyframeBtn');
    if (updateBtn) updateBtn.textContent = `Update K${activeKeyframeIdx + 1}`;
    if (!strip) return;
    strip.innerHTML = '';
    motionTimeline.keyframes.forEach((kf, idx) => {
        const pill = document.createElement('div');
        const isSelected = idx === activeKeyframeIdx;
        pill.className = `shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono cursor-pointer transition ${
            isSelected
                ? 'bg-sky-500/25 border-sky-400 text-white'
                : 'bg-black/40 border-white/10 text-gray-300 hover:border-sky-400/40'
        }`;
        pill.innerHTML = `<span>K${idx + 1}: ${escapeXml(kf.label || 'Step')}</span>`;
        pill.addEventListener('click', () => {
            stopTimelinePlayback();
            activeKeyframeIdx = idx;
            Object.assign(state, kf.state);
            const prog = motionTimeline.keyframes.length > 1 ? idx / (motionTimeline.keyframes.length - 1) : 0;
            const scrubber = document.getElementById('timelineScrubber');
            const progVal = document.getElementById('timelineProgressVal');
            if (scrubber) scrubber.value = prog;
            if (progVal) progVal.textContent = `${(prog * motionTimeline.durationSec).toFixed(2)}s`;
            syncInputsFromState();
            render();
            renderKeyframeStrip();
        });

        if (motionTimeline.keyframes.length > 2) {
            const del = document.createElement('button');
            del.textContent = '×';
            del.className = 'ml-1 px-1 text-gray-400 hover:text-rose-400';
            del.title = 'Remove keyframe';
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                motionTimeline.keyframes.splice(idx, 1);
                activeKeyframeIdx = Math.max(0, activeKeyframeIdx - 1);
                renderKeyframeStrip();
            });
            pill.appendChild(del);
        }
        strip.appendChild(pill);
    });
}

export function stopTimelinePlayback() {
    isTimelinePlaying = false;
    if (timelineRafId) cancelAnimationFrame(timelineRafId);
    const icon = document.getElementById('playTimelineIcon');
    const lbl = document.getElementById('playTimelineLabel');
    if (icon) icon.textContent = '▶';
    if (lbl) lbl.textContent = 'Play';
}

export function createSeededRng(seedStr) {
    let h = 2166136261 >>> 0;
    const s = String(seedStr || '4829');
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return () => {
        h = (Math.imul(1664525, h) + 1013904223) >>> 0;
        return h / 4294967296;
    };
}

export function generateSeededMotion(seedStr) {
    const anchor = { ...state };
    const rng = createSeededRng(seedStr);
    const rRange = (min, max) => Math.round(min + rng() * (max - min));
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];

    const archetypes = ['Portal Surge', 'Hypersonic Flap', 'Orbital Spin', 'Warp Core', 'Wing Whip'];
    const palettes = [
        { name: 'Cyber Cyan', c1: '#38bdf8', c2: '#6366f1' },
        { name: 'Neon Synth', c1: '#a855f7', c2: '#ec4899' },
        { name: 'Emerald Matrix', c1: '#34d399', c2: '#06b6d4' },
        { name: 'Solar Flare', c1: '#fb923c', c2: '#facc15' },
        { name: 'Crimson Pulse', c1: '#f43f5e', c2: '#8b5cf6' },
        { name: 'Arctic White', c1: '#ffffff', c2: '#38bdf8' }
    ];
    const pal = pick(palettes);
    const archetype = pick(archetypes);
    const easing = pick(['easeInOutCubic', 'spring', 'easeOutBack', 'easeInOutExpo']);
    const playMode = pick(['pingpong', 'loop']);
    const durationSec = Math.round((2.0 + rng() * 2.5) * 2) / 2;
    const frameCount = rRange(5, 6);

    const base = applyLocksToState({
        ...captureAnimatableSnapshot().state,
        strokeColor: pal.c1,
        secondaryColor: pal.c2,
        useGradient: true,
        gradAngle: 0,
        tripleWing: rng() > 0.35
    }, anchor);

    const frames = [{ label: 'Origin', easing, state: { ...base } }];
    for (let i = 1; i < frameCount - 1; i++) {
        const phase = i / (frameCount - 1);
        const s = { ...base };
        s.gradAngle = Math.round(-120 + phase * 240);
        const isAnticipation = i === 1 && frameCount >= 5;
        if (isAnticipation) {
            s.circleRadius = Math.max(26, base.circleRadius - rRange(4, 9));
            s.wingGap = Math.max(10, base.wingGap - rRange(4, 8));
            s.wingCurve = -rRange(6, 12);
            s.glowBlur = Math.max(4, base.glowBlur - 4);
        } else if (archetype === 'Portal Surge' || archetype === 'Warp Core') {
            s.ringGapDeg = rRange(40, 135);
            s.ringRotate = rRange(-130, 130);
            s.ringFillOpacity = Number((0.1 + rng() * 0.25).toFixed(2));
            s.glowBlur = rRange(16, 28);
            s.topWingLen = Math.min(185, base.topWingLen + rRange(18, 52));
        } else if (archetype === 'Hypersonic Flap' || archetype === 'Wing Whip') {
            s.wingAngle = (i % 2 === 1 ? 1 : -1) * rRange(6, 15);
            s.wingCurve = (i % 2 === 1 ? 1 : -1) * rRange(12, 24);
            s.wingSpacing = rRange(16, 36);
            s.topWingLen = rRange(115, 185);
            s.botWingLen = Math.round(s.topWingLen * (0.6 + rng() * 0.25));
        } else if (archetype === 'Orbital Spin') {
            s.ringGapDeg = rRange(45, 110);
            s.ringRotate = Math.round(-165 + phase * 330);
            s.wingBalance = (i % 2 === 1 ? 1 : -1) * rRange(8, 24);
            s.glowBlur = rRange(12, 26);
        } else {
            s.circleRadius = rRange(36, 58);
            s.ringGapDeg = rng() > 0.35 ? rRange(20, 105) : 0;
            s.ringRotate = rRange(-95, 95);
            s.wingGap = rRange(14, 42);
            s.topWingLen = rRange(95, 180);
            s.botWingLen = Math.round(s.topWingLen * 0.72);
            s.wingCurve = rRange(-18, 20);
            s.glowBlur = rRange(12, 28);
        }
        frames.push({ label: isAnticipation ? 'Windup' : `Pose ${i}`, easing, state: applyLocksToState(s, anchor) });
    }
    frames.push({ label: 'Settle', easing, state: { ...base } });

    if (isTimelinePlaying) stopTimelinePlayback();
    motionTimeline.durationSec = durationSec;
    motionTimeline.easing = easing;
    motionTimeline.playMode = playMode;
    motionTimeline.keyframes = frames;

    const durEl = document.getElementById('timelineDuration');
    const durVal = document.getElementById('timelineDurationVal');
    const easeEl = document.getElementById('timelineEasingSelect');
    const modeEl = document.getElementById('timelinePlayMode');
    if (durEl) durEl.value = durationSec;
    if (durVal) durVal.textContent = `${durationSec.toFixed(1)}s`;
    if (easeEl) easeEl.value = easing;
    if (modeEl) modeEl.value = playMode;

    Object.assign(state, frames[0].state);
    syncInputsFromState();
    render();
    activeKeyframeIdx = 0;
    renderKeyframeStrip();
    pushHistoryFn();
    document.getElementById('playTimelineBtn')?.click();
    showToast(`Seed #${seedStr}: ${archetype} (${pal.name}, ${frames.length} frames)${getLockedSummaryLabel()}`);
}

function buildSeededTargetPose(seedStr, anchor) {
    const rng = createSeededRng(seedStr);
    const rRange = (min, max) => Math.round(min + rng() * (max - min));
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const palettes = [
        { name: 'Cyber Cyan', c1: '#38bdf8', c2: '#6366f1' },
        { name: 'Neon Synth', c1: '#a855f7', c2: '#ec4899' },
        { name: 'Emerald Matrix', c1: '#34d399', c2: '#06b6d4' },
        { name: 'Solar Flare', c1: '#fb923c', c2: '#facc15' },
        { name: 'Crimson Pulse', c1: '#f43f5e', c2: '#8b5cf6' },
        { name: 'Arctic White', c1: '#ffffff', c2: '#38bdf8' }
    ];
    const pal = pick(palettes);
    const topLen = rRange(85, 180);
    const hasGap = rng() > 0.3;
    return applyLocksToState({
        ...captureAnimatableSnapshot().state,
        strokeColor: pal.c1,
        secondaryColor: pal.c2,
        useGradient: true,
        gradAngle: rRange(-150, 150),
        circleRadius: rRange(32, 60),
        ringStrokeWidth: rRange(5, 13),
        ringFillOpacity: Number((rng() * 0.28).toFixed(2)),
        ringGapDeg: hasGap ? rRange(24, 125) : 0,
        ringRotate: hasGap ? rRange(-135, 135) : 0,
        wingStrokeWidth: rRange(4, 10),
        wingGap: rRange(14, 44),
        topWingLen: topLen,
        botWingLen: Math.round(topLen * (0.58 + rng() * 0.25)),
        wingSpacing: rRange(16, 36),
        wingOffsetY: rRange(-6, 8),
        botInnerInset: rRange(0, 14),
        wingAngle: rRange(-12, 12),
        wingCurve: rRange(-20, 20),
        wingBalance: rng() > 0.6 ? rRange(-18, 18) : 0,
        tripleWing: rng() > 0.4,
        glowBlur: rRange(8, 26),
        glowOpacity: Number((0.7 + rng() * 0.3).toFixed(2))
    }, anchor);
}

export function stopSmoothMorphLoop(silent = false) {
    isMorphLoopActive = false;
    if (morphRafId) {
        cancelAnimationFrame(morphRafId);
        morphRafId = null;
    }
    const morphLoopBtn = document.getElementById('morphLoopBtn');
    if (morphLoopBtn) {
        morphLoopBtn.textContent = '🌊 Smooth Morph';
        morphLoopBtn.classList.remove('bg-cyan-500/35', 'border-cyan-300', 'text-white', 'animate-pulse');
        morphLoopBtn.classList.add('bg-cyan-500/15', 'border-cyan-400/30', 'text-cyan-200');
    }
    if (!silent) showToast('Smooth Morph paused');
}

let idleMode = 'none';
let idleRafId = null;
let idleBaseSnapshot = null;

export function stopIdleBehavior(restore = false) {
    if (idleRafId) {
        cancelAnimationFrame(idleRafId);
        idleRafId = null;
    }
    if (restore && idleBaseSnapshot) {
        Object.assign(state, idleBaseSnapshot);
        state._flowPhase = 0;
        syncInputsFromState();
        render();
    }
    idleBaseSnapshot = null;
    idleMode = 'none';
    document.querySelectorAll('[data-idle-mode]').forEach((btn) => {
        const active = btn.dataset.idleMode === 'none';
        btn.classList.toggle('bg-sky-500/30', active);
        btn.classList.toggle('border-sky-400', active);
        btn.classList.toggle('text-white', active);
    });
}

export function setIdleMode(mode) {
    if (mode === 'none' || idleMode === mode) {
        stopIdleBehavior(true);
        showToast('Idle motion paused');
        return;
    }
    if (isTimelinePlaying) stopTimelinePlayback();
    if (isMorphLoopActive) stopSmoothMorphLoop(true);
    stopPulseFn();
    stopIdleBehavior(true);

    idleMode = mode;
    idleBaseSnapshot = captureAnimatableSnapshot().state;
    const t0 = performance.now();

    document.querySelectorAll('[data-idle-mode]').forEach((btn) => {
        const active = btn.dataset.idleMode === mode;
        btn.classList.toggle('bg-sky-500/30', active);
        btn.classList.toggle('border-sky-400', active);
        btn.classList.toggle('text-white', active);
    });

    const tick = (now) => {
        if (idleMode !== mode || !idleBaseSnapshot) return;
        const elapsed = (now - t0) / 1000;
        const b = idleBaseSnapshot;
        if (mode === 'pulse') {
            const wave = Math.sin(elapsed * 2.4);
            if (!isKeyLocked('glowBlur')) state.glowBlur = Number(Math.max(2, b.glowBlur + wave * 5).toFixed(1));
            if (!isKeyLocked('circleRadius')) state.circleRadius = Number((b.circleRadius + wave * 1.6).toFixed(1));
            if (!isKeyLocked('ringGapDeg') && b.ringGapDeg > 0) {
                state.ringGapDeg = Number(Math.max(0, b.ringGapDeg + wave * 8).toFixed(1));
            }
        } else if (mode === 'orbit') {
            if (!isKeyLocked('ringRotate')) state.ringRotate = Number((((b.ringRotate + elapsed * 42 + 180) % 360) - 180).toFixed(1));
            if (!isKeyLocked('gradAngle')) state.gradAngle = Number((((b.gradAngle + elapsed * 36 + 180) % 360) - 180).toFixed(1));
            if (!isKeyLocked('ringGapDeg') && b.ringGapDeg === 0) state.ringGapDeg = 36;
        } else if (mode === 'flow') {
            if (!isKeyLocked('energyFlow') && (b.energyFlow || 0) < 40) state.energyFlow = 70;
            state._flowPhase = Number((-(elapsed * 55)).toFixed(1));
            if (!isKeyLocked('gradAngle')) state.gradAngle = Number((((b.gradAngle + elapsed * 24 + 180) % 360) - 180).toFixed(1));
        }
        scheduleRender();
        idleRafId = requestAnimationFrame(tick);
    };
    idleRafId = requestAnimationFrame(tick);
    const labels = { pulse: 'Idle Pulse/Breathe', orbit: 'Continuous Orbit', flow: 'Energy Flow' };
    showToast(`${labels[mode] || mode} active`);
}

export function initTimeline() {
    const morphLoopBtn = document.getElementById('morphLoopBtn');
    const chainMorphBtn = document.getElementById('chainMorphBtn');
    const aiRandomizeBtn = document.getElementById('aiRandomizeMotionBtn');
    const aiBatchVariationsBtn = document.getElementById('aiBatchVariationsBtn');
    const seedVarStrip = document.getElementById('seedVarStrip');
    const motionSeedInput = document.getElementById('motionSeedInput');

    const queueNextMorphTarget = (explicitSeed = null) => {
        const anchor = { ...state };
        const nextSeed = explicitSeed || String(Math.floor(1000 + Math.random() * 9000));
        if (motionSeedInput) motionSeedInput.value = nextSeed;
        morphFromState = captureAnimatableSnapshot().state;
        morphToState = buildSeededTargetPose(nextSeed, anchor);
        morphStartTime = performance.now();

        const curve = motionTimeline.easing || 'easeInOutCubic';
        if (isChainMorphActive) {
            if (chainedMorphFrames.length === 0) {
                chainedMorphFrames.push({ label: 'Origin', easing: curve, state: { ...morphFromState } });
            }
            if (chainedMorphFrames.length >= 12) chainedMorphFrames.shift();
            chainedMorphFrames.push({ label: `Seed #${nextSeed}`, easing: curve, state: { ...morphToState } });
            motionTimeline.keyframes = chainedMorphFrames.map(f => ({ ...f }));
        } else {
            motionTimeline.keyframes = [
                { label: 'Current', easing: curve, state: { ...morphFromState } },
                { label: `Seed #${nextSeed}`, easing: curve, state: { ...morphToState } }
            ];
        }
        activeKeyframeIdx = 0;
        renderKeyframeStrip();
    };

    const startSmoothMorphLoop = (explicitSeed = null) => {
        if (isTimelinePlaying) stopTimelinePlayback();
        stopPulseFn();
        isMorphLoopActive = true;
        if (morphLoopBtn) {
            morphLoopBtn.textContent = '🌊 Morphing...';
            morphLoopBtn.classList.remove('bg-cyan-500/15', 'border-cyan-400/30', 'text-cyan-200');
            morphLoopBtn.classList.add('bg-cyan-500/35', 'border-cyan-300', 'text-white', 'animate-pulse');
        }
        queueNextMorphTarget(explicitSeed);

        const tick = (now) => {
            if (!isMorphLoopActive) return;
            const durMs = Math.max(800, (motionTimeline.durationSec || 3.0) * 1000);
            const rawProg = Math.min(1, (now - morphStartTime) / durMs);
            const curve = document.getElementById('timelineEasingSelect')?.value || motionTimeline.easing || 'easeInOutCubic';
            const eased = applyEasingCurve(rawProg, curve);

            ANIMATABLE_KEYS.forEach(k => {
                if (isKeyLocked(k)) return;
                const v1 = typeof morphFromState[k] === 'number' ? morphFromState[k] : state[k];
                const v2 = typeof morphToState[k] === 'number' ? morphToState[k] : state[k];
                state[k] = Number((v1 + (v2 - v1) * eased).toFixed(2));
            });
            if (!isKeyLocked('strokeColor') && morphFromState.strokeColor && morphToState.strokeColor) {
                state.strokeColor = lerpHexColor(morphFromState.strokeColor, morphToState.strokeColor, eased);
            }
            if (!isKeyLocked('secondaryColor') && morphFromState.secondaryColor && morphToState.secondaryColor) {
                state.secondaryColor = lerpHexColor(morphFromState.secondaryColor, morphToState.secondaryColor, eased);
            }
            if (!isKeyLocked('tripleWing') && typeof morphToState.tripleWing === 'boolean') {
                state.tripleWing = eased < 0.5 ? morphFromState.tripleWing : morphToState.tripleWing;
            }
            if (!isKeyLocked('useGradient')) {
                state.useGradient = eased < 0.5 ? morphFromState.useGradient : morphToState.useGradient;
            }

            const scrubber = document.getElementById('timelineScrubber');
            const progVal = document.getElementById('timelineProgressVal');
            if (scrubber) scrubber.value = rawProg;
            if (progVal) progVal.textContent = `${(rawProg * (durMs / 1000)).toFixed(2)}s`;

            syncInputsFromState();
            scheduleRender();

            if (rawProg >= 1) {
                queueNextMorphTarget();
            }
            morphRafId = requestAnimationFrame(tick);
        };
        morphRafId = requestAnimationFrame(tick);
    };

    document.getElementById('playTimelineBtn')?.addEventListener('click', () => {
        if (isTimelinePlaying) {
            stopTimelinePlayback();
            return;
        }
        stopPulseFn();
        if (isMorphLoopActive) stopSmoothMorphLoop(true);
        isTimelinePlaying = true;
        const icon = document.getElementById('playTimelineIcon');
        const lbl = document.getElementById('playTimelineLabel');
        if (icon) icon.textContent = '❚❚';
        if (lbl) lbl.textContent = 'Pause';
        const startTime = performance.now();
        const durationMs = motionTimeline.durationSec * 1000;

        const step = (now) => {
            if (!isTimelinePlaying) return;
            const totalElapsed = now - startTime;
            const mode = motionTimeline.playMode || 'loop';
            let progress = 0;

            if (mode === 'pingpong') {
                const cycle = (totalElapsed % (durationMs * 2)) / durationMs;
                progress = cycle <= 1 ? cycle : 2 - cycle;
            } else if (mode === 'once') {
                progress = Math.min(1, totalElapsed / durationMs);
            } else {
                progress = (totalElapsed % durationMs) / durationMs;
            }

            const scrubber = document.getElementById('timelineScrubber');
            const progVal = document.getElementById('timelineProgressVal');
            if (scrubber) scrubber.value = progress;
            if (progVal) progVal.textContent = `${(progress * motionTimeline.durationSec).toFixed(2)}s`;
            applyInterpolatedTimeline(progress);

            if (mode === 'once' && progress >= 1) {
                stopTimelinePlayback();
                return;
            }
            timelineRafId = requestAnimationFrame(step);
        };
        timelineRafId = requestAnimationFrame(step);
    });

    document.getElementById('timelinePlayMode')?.addEventListener('change', (e) => {
        motionTimeline.playMode = e.target.value;
    });
    document.getElementById('timelineEasingSelect')?.addEventListener('change', (e) => {
        motionTimeline.easing = e.target.value;
    });
    document.getElementById('timelineScrubber')?.addEventListener('input', (e) => {
        stopTimelinePlayback();
        const prog = parseFloat(e.target.value);
        const progVal = document.getElementById('timelineProgressVal');
        if (progVal) progVal.textContent = `${(prog * motionTimeline.durationSec).toFixed(2)}s`;
        applyInterpolatedTimeline(prog);
    });
    document.getElementById('timelineDuration')?.addEventListener('input', (e) => {
        motionTimeline.durationSec = parseFloat(e.target.value);
        const valEl = document.getElementById('timelineDurationVal');
        if (valEl) valEl.textContent = `${motionTimeline.durationSec.toFixed(1)}s`;
    });
    document.getElementById('addKeyframeBtn')?.addEventListener('click', () => {
        stopTimelinePlayback();
        motionTimeline.keyframes.push(captureAnimatableSnapshot(`Pose ${motionTimeline.keyframes.length + 1}`));
        activeKeyframeIdx = motionTimeline.keyframes.length - 1;
        renderKeyframeStrip();
        showToast(`Captured Keyframe K${motionTimeline.keyframes.length}`);
    });
    document.getElementById('updateKeyframeBtn')?.addEventListener('click', () => {
        stopTimelinePlayback();
        const existing = motionTimeline.keyframes[activeKeyframeIdx];
        if (!existing) return;
        existing.state = captureAnimatableSnapshot().state;
        renderKeyframeStrip();
        showToast(`Updated K${activeKeyframeIdx + 1} with current sliders`);
    });

    chainMorphBtn?.addEventListener('click', () => {
        isChainMorphActive = !isChainMorphActive;
        chainMorphBtn.classList.toggle('bg-sky-500/25', isChainMorphActive);
        chainMorphBtn.classList.toggle('border-sky-400/50', isChainMorphActive);
        chainMorphBtn.classList.toggle('text-sky-200', isChainMorphActive);
        if (isChainMorphActive) {
            chainedMorphFrames = [{ label: 'Origin', easing: motionTimeline.easing || 'easeInOutCubic', state: captureAnimatableSnapshot().state }];
        }
        showToast(`Chain Morphs to Timeline ${isChainMorphActive ? 'enabled 📌 (up to 12 seeds)' : 'disabled'}`);
    });

    morphLoopBtn?.addEventListener('click', () => {
        if (isMorphLoopActive) stopSmoothMorphLoop();
        else {
            startSmoothMorphLoop();
            showToast(`Smooth Morph active (${(motionTimeline.durationSec || 3).toFixed(1)}s per transition)${getLockedSummaryLabel()}`);
        }
    });

    aiRandomizeBtn?.addEventListener('click', () => {
        const newSeed = String(Math.floor(1000 + Math.random() * 9000));
        if (motionSeedInput) motionSeedInput.value = newSeed;
        if (isMorphLoopActive) {
            queueNextMorphTarget(newSeed);
            showToast(`Morphing smoothly to Seed #${newSeed}${getLockedSummaryLabel()}`);
        } else {
            generateSeededMotion(newSeed);
        }
    });

    motionSeedInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const seed = motionSeedInput.value.trim() || '4829';
            if (isMorphLoopActive) {
                queueNextMorphTarget(seed);
                showToast(`Morphing smoothly to Seed #${seed}${getLockedSummaryLabel()}`);
            } else {
                generateSeededMotion(seed);
            }
        }
    });

    aiBatchVariationsBtn?.addEventListener('click', () => {
        if (!seedVarStrip) return;
        seedVarStrip.innerHTML = '';
        seedVarStrip.classList.remove('hidden');
        for (let i = 0; i < 4; i++) {
            const s = String(Math.floor(1000 + Math.random() * 9000));
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shrink-0 px-2.5 py-1 rounded-md bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-400/30 text-[10px] font-mono text-indigo-200 transition';
            btn.textContent = `#${s}`;
            btn.title = `Apply & play seed #${s}`;
            btn.addEventListener('click', () => {
                if (motionSeedInput) motionSeedInput.value = s;
                generateSeededMotion(s);
            });
            seedVarStrip.appendChild(btn);
        }
        showToast('Generated 4 variation seeds — click any # to audition!');
    });

    renderKeyframeStrip();

    const applyMotionPreset = (presetName) => {
        stopIdleBehavior(false);
        if (presetName === 'smoothMorphLoop') {
            if (!isMorphLoopActive) {
                const easeEl = document.getElementById('timelineEasingSelect');
                if (easeEl) easeEl.value = 'easeInOutQuint';
                motionTimeline.easing = 'easeInOutQuint';
                startSmoothMorphLoop();
                showToast(`Smooth Morph Loop active (${(motionTimeline.durationSec || 3).toFixed(1)}s)${getLockedSummaryLabel()}`);
            } else {
                queueNextMorphTarget();
            }
            return;
        }

        if (isMorphLoopActive) stopSmoothMorphLoop(true);
        if (isTimelinePlaying) stopTimelinePlayback();
        stopPulseFn();

        const anchor = { ...state };
        const base = captureAnimatableSnapshot().state;
        const makeState = (overrides) => applyLocksToState({ ...base, ...overrides }, anchor);

        let frames = [];
        let durationSec = 2.6;
        let easing = 'easeInOutQuint';
        let playMode = 'loop';
        let title = presetName;

        if (presetName === 'idlePulse') {
            title = 'Idle Pulse';
            durationSec = 2.8;
            easing = 'easeInOutQuint';
            frames = [
                { label: 'Rest', easing, state: makeState({}) },
                { label: 'Inhale', easing, state: makeState({ circleRadius: Math.min(70, base.circleRadius + 3), glowBlur: Math.min(30, base.glowBlur + 8), topWingLen: base.topWingLen + 8 }) },
                { label: 'Rest', easing, state: makeState({}) }
            ];
        } else if (presetName === 'powerUp') {
            title = 'Power Up';
            durationSec = 2.4;
            easing = 'easeOutBack';
            playMode = 'pingpong';
            frames = [
                { label: 'Charge', easing, state: makeState({ circleRadius: Math.max(24, base.circleRadius - 6), wingGap: Math.max(10, base.wingGap - 6), glowBlur: Math.max(4, base.glowBlur - 4), energyFlow: 35 }) },
                { label: 'Surge', easing, state: makeState({ visualStyle: 'plasma', useGradient: true, topWingLen: Math.min(200, base.topWingLen + 36), botWingLen: Math.min(165, base.botWingLen + 26), glowBlur: 24, energyFlow: 90, wingCurve: 10 }) },
                { label: 'Lock', easing, state: makeState({ visualStyle: 'plasma', useGradient: true, topWingLen: Math.min(190, base.topWingLen + 24), glowBlur: 18, energyFlow: 65 }) }
            ];
        } else if (presetName === 'scan') {
            title = 'Energy Scan';
            durationSec = 3.0;
            easing = 'linear';
            frames = [
                { label: 'Sweep A', easing, state: makeState({ visualStyle: 'holographic', useGradient: true, energyFlow: 90, gradAngle: -140 }) },
                { label: 'Apex', easing, state: makeState({ visualStyle: 'holographic', useGradient: true, energyFlow: 95, gradAngle: 0, glowBlur: Math.min(28, base.glowBlur + 6) }) },
                { label: 'Sweep B', easing, state: makeState({ visualStyle: 'holographic', useGradient: true, energyFlow: 90, gradAngle: 140 }) }
            ];
        } else if (presetName === 'spinExpand') {
            title = 'Spin & Expand';
            durationSec = 3.2;
            easing = 'easeOutElastic';
            frames = [
                { label: 'Origin', easing, state: makeState({ ringGapDeg: 32, ringRotate: -160 }) },
                { label: 'Flare', easing, state: makeState({ ringGapDeg: 92, ringRotate: 20, topWingLen: Math.min(200, base.topWingLen + 32), wingGap: Math.min(60, base.wingGap + 14), wingAngle: 9, glowBlur: 20 }) },
                { label: 'Resolve', easing, state: makeState({ ringGapDeg: 32, ringRotate: 175 }) }
            ];
        } else if (presetName === 'glitchBurst') {
            title = 'Glitch Burst';
            durationSec = 1.8;
            easing = 'easeInOutBack';
            frames = [
                { label: 'Clean', easing, state: makeState({ visualStyle: 'classic', wingBalance: 0, wingAngle: 0 }) },
                { label: 'Spike L', easing, state: makeState({ visualStyle: 'glitch', useGradient: true, wingBalance: -24, wingAngle: -11, ringGapDeg: 68, energyFlow: 90 }) },
                { label: 'Spike R', easing, state: makeState({ visualStyle: 'glitch', useGradient: true, wingBalance: 26, wingAngle: 12, ringGapDeg: 45, energyFlow: 95 }) },
                { label: 'Settle', easing, state: makeState({ visualStyle: 'classic', wingBalance: 0, wingAngle: 0 }) }
            ];
        }

        if (!frames.length) return;
        motionTimeline.durationSec = durationSec;
        motionTimeline.easing = easing;
        motionTimeline.playMode = playMode;
        motionTimeline.keyframes = frames;

        const durEl = document.getElementById('timelineDuration');
        const durVal = document.getElementById('timelineDurationVal');
        const easeEl = document.getElementById('timelineEasingSelect');
        const modeEl = document.getElementById('timelinePlayMode');
        if (durEl) durEl.value = durationSec;
        if (durVal) durVal.textContent = `${durationSec.toFixed(1)}s`;
        if (easeEl) easeEl.value = easing;
        if (modeEl) modeEl.value = playMode;

        Object.assign(state, frames[0].state);
        syncInputsFromState();
        render();
        activeKeyframeIdx = 0;
        renderKeyframeStrip();
        pushHistoryFn();
        document.getElementById('playTimelineBtn')?.click();
        showToast(`${title} motion preset active${getLockedSummaryLabel()}`);
    };

    document.querySelectorAll('[data-idle-mode]').forEach((btn) => {
        btn.addEventListener('click', () => setIdleMode(btn.dataset.idleMode));
    });
    document.querySelectorAll('[data-motion-preset]').forEach((btn) => {
        btn.addEventListener('click', () => applyMotionPreset(btn.dataset.motionPreset));
    });

    return {
        getMotionTimeline,
        setMotionTimeline,
        getIsTimelinePlaying,
        getIsMorphLoopActive,
        stopTimelinePlayback,
        stopSmoothMorphLoop,
        stopIdleBehavior,
        setIdleMode,
        applyMotionPreset,
        applyInterpolatedTimeline,
        captureAnimatableSnapshot,
        renderKeyframeStrip
    };
}
