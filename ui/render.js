/**
 * DOM references, rAF-throttled SVG rendering, input sync, toast, and lock UI updates.
 */
import { state } from '../core/state.js';
import { encodeStateToCode } from '../core/seed.js';
import { generateSVGString } from '../core/geometry.js';
import { lockedGroups, lockedSliders, isKeyLocked } from '../core/locks.js';

const $ = (id) => document.getElementById(id);

export const els = {
    previewWrapper: $('previewWrapper'),
    svgStage: $('svgStage'),
    strokeColor: $('strokeColor'),
    strokeColorHex: $('strokeColorHex'),
    secondaryColor: $('secondaryColor'),
    secondaryColorHex: $('secondaryColorHex'),
    secondaryColorBox: $('secondaryColorBox'),
    useGradient: $('useGradient'),
    glowBlur: $('glowBlur'),
    glowVal: $('glowVal'),
    glowOpacity: $('glowOpacity'),
    glowOpacityVal: $('glowOpacityVal'),
    gradAngle: $('gradAngle'),
    gradAngleVal: $('gradAngleVal'),
    circleRadius: $('circleRadius'),
    radiusVal: $('radiusVal'),
    ringStrokeWidth: $('ringStrokeWidth'),
    ringStrokeVal: $('ringStrokeVal'),
    ringFillOpacity: $('ringFillOpacity'),
    ringFillVal: $('ringFillVal'),
    ringGapDeg: $('ringGapDeg'),
    ringGapDegVal: $('ringGapDegVal'),
    ringRotate: $('ringRotate'),
    ringRotateVal: $('ringRotateVal'),
    innerRingRadius: $('innerRingRadius'),
    innerRingVal: $('innerRingVal'),
    wingStrokeWidth: $('wingStrokeWidth'),
    wingStrokeVal: $('wingStrokeVal'),
    wingGap: $('wingGap'),
    gapVal: $('gapVal'),
    topWingLen: $('topWingLen'),
    topLenVal: $('topLenVal'),
    botWingLen: $('botWingLen'),
    botLenVal: $('botLenVal'),
    wingSpacing: $('wingSpacing'),
    spacingVal: $('spacingVal'),
    wingOffsetY: $('wingOffsetY'),
    wingOffsetYVal: $('wingOffsetYVal'),
    botInnerInset: $('botInnerInset'),
    botInsetVal: $('botInsetVal'),
    wingAngle: $('wingAngle'),
    wingAngleVal: $('wingAngleVal'),
    wingCurve: $('wingCurve'),
    wingCurveVal: $('wingCurveVal'),
    wingBalance: $('wingBalance'),
    wingBalanceVal: $('wingBalanceVal'),
    wingLag: $('wingLag'),
    wingLagVal: $('wingLagVal'),
    showText: $('showText'),
    textControls: $('textControls'),
    brandText: $('brandText'),
    fontSize: $('fontSize'),
    fontSizeVal: $('fontSizeVal'),
    letterSpacing: $('letterSpacing'),
    letterSpacingVal: $('letterSpacingVal'),
    textOffsetY: $('textOffsetY'),
    textOffsetYVal: $('textOffsetYVal'),
    previewZoom: $('previewZoom'),
    zoomVal: $('zoomVal'),
    toast: $('toast')
};

let toastTimer = null;
export function showToast(msg, variant = 'info') {
    if (variant === 'error') {
        console.error('[SOLOPASS]', msg);
    }
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.remove('translate-y-20', 'opacity-0');
    els.toast.classList.toggle('border-rose-500/60', variant === 'error');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        els.toast?.classList.add('translate-y-20', 'opacity-0');
    }, variant === 'error' ? 3600 : 2400);
}

let timelinePlayingGetter = () => false;
export function setTimelinePlayingGetter(fn) {
    timelinePlayingGetter = fn;
}

export function getOpticalGridMarkup() {
    if (state.showOpticalGrid && typeof window.SoloSyncGrid !== 'undefined') {
        return window.SoloSyncGrid.generateGridMarkup(
            600,
            state.showText ? 290 : 220,
            state.clockBit || 0,
            state.seq || 0
        );
    }
    return '';
}

const setText = (el, val) => { if (el) el.textContent = val; };

export function render() {
    if (!els.svgStage) return;
    els.svgStage.innerHTML = generateSVGString(state, {
        forExport: false,
        includeGuides: state.showGuides,
        isTimelinePlaying: timelinePlayingGetter(),
        opticalGridMarkup: getOpticalGridMarkup()
    });
    els.svgStage.style.transform = `scale(${state.zoom})`;

    setText(els.glowVal, `${state.glowBlur}px`);
    setText(els.glowOpacityVal, `${Math.round(state.glowOpacity * 100)}%`);
    setText(els.gradAngleVal, `${state.gradAngle || 0}°`);
    setText(els.radiusVal, `${state.circleRadius}px`);
    setText(els.ringStrokeVal, `${state.ringStrokeWidth}px`);
    setText(els.ringFillVal, `${Math.round(state.ringFillOpacity * 100)}%`);
    setText(els.ringGapDegVal, `${state.ringGapDeg}°`);
    setText(els.ringRotateVal, `${state.ringRotate}°`);
    setText(els.innerRingVal, `${state.innerRingRadius || 0}px`);
    setText(els.wingStrokeVal, `${state.wingStrokeWidth}px`);
    setText(els.gapVal, `${state.wingGap}px`);
    setText(els.topLenVal, `${state.topWingLen}px`);
    setText(els.botLenVal, `${state.botWingLen}px`);
    setText(els.spacingVal, `${state.wingSpacing}px`);
    setText(els.wingOffsetYVal, `${state.wingOffsetY >= 0 ? '+' : ''}${state.wingOffsetY}px`);
    setText(els.botInsetVal, `${state.botInnerInset}px`);
    setText(els.wingAngleVal, `${state.wingAngle}°`);
    setText(els.wingCurveVal, `${state.wingCurve}px`);
    setText(els.wingBalanceVal, `${state.wingBalance > 0 ? '+' : ''}${state.wingBalance}%`);
    setText(els.wingLagVal, `${state.wingLag || 0}%`);
    setText(els.fontSizeVal, `${state.fontSize}px`);
    setText(els.letterSpacingVal, `${state.letterSpacing}px`);
    setText(els.textOffsetYVal, `${state.textOffsetY || 58}px`);
    setText(els.zoomVal, `${Math.round(state.zoom * 100)}%`);

    const ratioBadge = $('mathRatioBadge');
    if (ratioBadge) {
        const ratio = (state.topWingLen / Math.max(1, state.botWingLen)).toFixed(3);
        ratioBadge.textContent = `Top/Bot: ${ratio}`;
    }

    const seedField = $('vectorSeedCode');
    if (seedField && document.activeElement !== seedField) {
        seedField.value = encodeStateToCode(state);
    }

    const decodedBanner = $('decodedCipherBanner');
    const decodedText = $('decodedCipherText');
    if (decodedBanner && decodedText) {
        if (state.encodedMessage) {
            decodedBanner.classList.remove('hidden');
            decodedText.textContent = state.encodedMessage;
        } else {
            decodedBanner.classList.add('hidden');
        }
    }

    if (els.secondaryColorBox) {
        els.secondaryColorBox.classList.toggle('opacity-40', !state.useGradient);
        els.secondaryColorBox.classList.toggle('pointer-events-none', !state.useGradient);
    }

    if (els.textControls) {
        els.textControls.classList.toggle('opacity-40', !state.showText);
        els.textControls.classList.toggle('pointer-events-none', !state.showText);
    }

    if (els.previewWrapper) {
        if (state.bgColor === 'transparent') {
            els.previewWrapper.style.backgroundColor = '#0b0b12';
            els.previewWrapper.style.backgroundImage = 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)';
            els.previewWrapper.style.backgroundSize = '16px 16px';
        } else {
            els.previewWrapper.style.backgroundImage = 'none';
            els.previewWrapper.style.backgroundColor = state.bgColor;
        }
    }
}

let renderRafPending = false;
export function scheduleRender() {
    if (renderRafPending) return;
    renderRafPending = true;
    requestAnimationFrame(() => {
        renderRafPending = false;
        render();
    });
}

export function syncInputsFromState() {
    const setVal = (el, val) => { if (el) el.value = val; };
    setVal(els.strokeColor, state.strokeColor);
    setVal(els.strokeColorHex, state.strokeColor);
    setVal(els.secondaryColor, state.secondaryColor);
    setVal(els.secondaryColorHex, state.secondaryColor);
    if (els.useGradient) els.useGradient.checked = state.useGradient;
    setVal(els.glowBlur, state.glowBlur);
    setVal(els.glowOpacity, state.glowOpacity);
    setVal(els.gradAngle, state.gradAngle || 0);
    setVal(els.circleRadius, state.circleRadius);
    setVal(els.ringStrokeWidth, state.ringStrokeWidth);
    setVal(els.ringFillOpacity, state.ringFillOpacity);
    setVal(els.ringGapDeg, state.ringGapDeg);
    setVal(els.ringRotate, state.ringRotate);
    setVal(els.innerRingRadius, state.innerRingRadius || 0);
    setVal(els.wingStrokeWidth, state.wingStrokeWidth);
    setVal(els.wingGap, state.wingGap);
    setVal(els.topWingLen, state.topWingLen);
    setVal(els.botWingLen, state.botWingLen);
    setVal(els.wingSpacing, state.wingSpacing);
    setVal(els.wingOffsetY, state.wingOffsetY);
    setVal(els.botInnerInset, state.botInnerInset);
    setVal(els.wingAngle, state.wingAngle);
    setVal(els.wingCurve, state.wingCurve);
    setVal(els.wingBalance, state.wingBalance);
    setVal(els.wingLag, state.wingLag || 0);
    if (els.showText) els.showText.checked = state.showText;
    setVal(els.brandText, state.brandText);
    setVal(els.fontSize, state.fontSize);
    setVal(els.letterSpacing, state.letterSpacing);
    setVal(els.textOffsetY, state.textOffsetY || 58);

    const lockBtn = $('lockNonStraightBtn');
    if (lockBtn) {
        lockBtn.classList.toggle('bg-indigo-500/20', state.lockNonStraight);
        lockBtn.classList.toggle('border-indigo-400/40', state.lockNonStraight);
        lockBtn.classList.toggle('text-indigo-200', state.lockNonStraight);
        lockBtn.classList.toggle('bg-white/5', !state.lockNonStraight);
        lockBtn.classList.toggle('border-white/10', !state.lockNonStraight);
        lockBtn.classList.toggle('text-gray-400', !state.lockNonStraight);
    }

    const tripleBtn = $('tripleWingBtn');
    if (tripleBtn) {
        tripleBtn.classList.toggle('bg-indigo-500/20', state.tripleWing);
        tripleBtn.classList.toggle('border-indigo-400/40', state.tripleWing);
        tripleBtn.classList.toggle('text-indigo-200', state.tripleWing);
        tripleBtn.classList.toggle('bg-white/5', !state.tripleWing);
        tripleBtn.classList.toggle('border-white/10', !state.tripleWing);
        tripleBtn.classList.toggle('text-gray-400', !state.tripleWing);
    }

    document.querySelectorAll('.cap-btn').forEach(b => {
        const isActive = b.dataset.cap === state.lineCap;
        b.classList.toggle('bg-indigo-600', isActive);
        b.classList.toggle('text-white', isActive);
        b.classList.toggle('text-gray-400', !isActive);
    });
}

export function updateSliderLockUI() {
    document.querySelectorAll('.slider-lock-btn').forEach(btn => {
        const key = btn.dataset.sliderLock;
        const locked = isKeyLocked(key);
        btn.textContent = locked ? '🔒' : '🔓';
        btn.setAttribute('aria-pressed', String(locked));
        btn.title = locked ? `Unlock ${key}` : `Lock ${key} during Randomize & AI`;
        btn.classList.toggle('bg-amber-500/25', locked);
        btn.classList.toggle('border-amber-400/50', locked);
        btn.classList.toggle('text-amber-200', locked);
        btn.classList.toggle('bg-white/5', !locked);
        btn.classList.toggle('border-white/10', !locked);
        btn.classList.toggle('text-gray-500', !locked);
    });
}

export function updateAllLocksBtnUI() {
    const toggleAllBtn = $('toggleAllLocksBtn');
    if (!toggleAllBtn) return;
    const allGroupsLocked = Object.values(lockedGroups).every(Boolean);
    const anyLocked = Object.values(lockedGroups).some(Boolean) || Object.values(lockedSliders).some(Boolean);
    toggleAllBtn.textContent = allGroupsLocked ? '🔓 Unlock All' : '🔒 Lock All';
    toggleAllBtn.setAttribute('aria-pressed', String(allGroupsLocked));
    toggleAllBtn.classList.toggle('bg-amber-500/30', anyLocked);
    toggleAllBtn.classList.toggle('border-amber-400/50', anyLocked);
}

export function updateLockUI() {
    document.querySelectorAll('.lock-group-btn').forEach(btn => {
        const grp = btn.dataset.lockGroup;
        const locked = !!lockedGroups[grp];
        btn.setAttribute('aria-pressed', String(locked));
        const isCompact = btn.textContent.includes('🔓') || btn.textContent.includes('🔒');
        if (isCompact) {
            const prefix = grp === 'glow' ? '✨' : '';
            btn.textContent = `${prefix}${locked ? '🔒' : '🔓'}`;
        }
        btn.classList.toggle('bg-amber-500/25', locked);
        btn.classList.toggle('border-amber-400/50', locked);
        btn.classList.toggle('text-amber-200', locked);
        btn.classList.toggle('bg-white/5', !locked);
        btn.classList.toggle('border-white/10', !locked);
    });
    updateSliderLockUI();
    updateAllLocksBtnUI();
}
