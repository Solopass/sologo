/**
 * Studio controls, Undo history, Lock UI, Direct Canvas Drag Handles,
 * 3-Tab Inspector (with keyboard Arrow navigation), Export Popover, and Modals.
 */
import { state, DEFAULTS, PRESETS, SECTION_RESET_PRESETS } from '../core/state.js';
import { decodeSeedDetailed } from '../core/seed.js';
import { encodeMessageToState } from '../core/cipher.js';
import { buildStealthMessageTimeline, buildBeaconMessageTimeline } from '../core/message-motion.js';
import {
    lockedGroups,
    lockedSliders,
    safeWriteStorage,
    findLockGroupForKey,
    isKeyLocked,
    applyLocksToState
} from '../core/locks.js';
import { generateSVGString } from '../core/geometry.js';
import {
    els,
    render,
    scheduleRender,
    syncInputsFromState,
    showToast,
    updateLockUI,
    updateSliderLockUI
} from './render.js';
import { copyTextToClipboard } from '../export/exporters.js';

export function initControls({ timelineApi }) {
    const {
        getIsTimelinePlaying,
        getIsMorphLoopActive,
        getMotionTimeline,
        setMotionTimeline,
        stopTimelinePlayback,
        stopSmoothMorphLoop
    } = timelineApi;

    // Undo History Stack
    const historyStack = [];
    let isApplyingHistory = false;

    function updateUndoButton() {
        const btn = document.getElementById('undoBtn');
        if (btn) btn.disabled = historyStack.length <= 1;
    }

    function pushHistory() {
        if (isApplyingHistory) return;
        const snapshot = JSON.stringify(state);
        if (historyStack[historyStack.length - 1] === snapshot) return;
        historyStack.push(snapshot);
        if (historyStack.length > 40) historyStack.shift();
        updateUndoButton();
    }

    document.getElementById('undoBtn')?.addEventListener('click', () => {
        if (historyStack.length <= 1) return;
        historyStack.pop();
        const prev = JSON.parse(historyStack[historyStack.length - 1]);
        isApplyingHistory = true;
        Object.assign(state, prev);
        const cipherInput = document.getElementById('cipherMessageInput');
        if (cipherInput) cipherInput.value = state.encodedMessage || '';
        syncInputsFromState();
        render();
        isApplyingHistory = false;
        updateUndoButton();
        showToast('Undid last change');
    });

    // Color Inputs
    els.strokeColor?.addEventListener('input', (e) => {
        state.strokeColor = e.target.value;
        if (els.strokeColorHex) els.strokeColorHex.value = e.target.value;
        scheduleRender();
    });
    els.strokeColor?.addEventListener('change', pushHistory);

    els.strokeColorHex?.addEventListener('input', (e) => {
        const val = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            state.strokeColor = val;
            if (els.strokeColor) els.strokeColor.value = val;
            render();
            pushHistory();
        }
    });

    els.secondaryColor?.addEventListener('input', (e) => {
        state.secondaryColor = e.target.value;
        if (els.secondaryColorHex) els.secondaryColorHex.value = e.target.value;
        scheduleRender();
    });
    els.secondaryColor?.addEventListener('change', pushHistory);

    els.secondaryColorHex?.addEventListener('input', (e) => {
        const val = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            state.secondaryColor = val;
            if (els.secondaryColor) els.secondaryColor.value = val;
            render();
            pushHistory();
        }
    });

    els.useGradient?.addEventListener('change', (e) => {
        state.useGradient = e.target.checked;
        render();
        pushHistory();
    });

    document.getElementById('showLowerThird')?.addEventListener('change', (e) => {
        state.showLowerThird = e.target.checked;
        render();
        pushHistory();
    });

    els.visualStyleSelect?.addEventListener('change', (e) => {
        state.visualStyle = e.target.value || 'classic';
        render();
        pushHistory();
    });

    // Numeric Range Sliders + Lock & Fine-Step Buttons
    const rangeBindings = [
        ['glowBlur', 'glowBlur'],
        ['glowOpacity', 'glowOpacity'],
        ['gradAngle', 'gradAngle'],
        ['energyFlow', 'energyFlow'],
        ['circleRadius', 'circleRadius'],
        ['ringStrokeWidth', 'ringStrokeWidth'],
        ['ringFillOpacity', 'ringFillOpacity'],
        ['ringGapDeg', 'ringGapDeg'],
        ['ringRotate', 'ringRotate'],
        ['innerRingRadius', 'innerRingRadius'],
        ['wingStrokeWidth', 'wingStrokeWidth'],
        ['wingGap', 'wingGap'],
        ['topWingLen', 'topWingLen'],
        ['botWingLen', 'botWingLen'],
        ['wingSpacing', 'wingSpacing'],
        ['wingOffsetY', 'wingOffsetY'],
        ['botInnerInset', 'botInnerInset'],
        ['wingAngle', 'wingAngle'],
        ['wingCurve', 'wingCurve'],
        ['wingBalance', 'wingBalance'],
        ['wingLag', 'wingLag'],
        ['fontSize', 'fontSize'],
        ['letterSpacing', 'letterSpacing'],
        ['textOffsetY', 'textOffsetY'],
        ['previewZoom', 'zoom']
    ];

    rangeBindings.forEach(([elId, stateKey]) => {
        const slider = els[elId];
        if (!slider) return;
        slider.title = 'Double-click to reset to default';

        const headerRow = slider.previousElementSibling;
        const valSpan = headerRow?.querySelector('span:last-child');
        if (headerRow && valSpan && !headerRow.querySelector('.step-btn')) {
            const stepWrap = document.createElement('span');
            stepWrap.className = 'inline-flex items-center gap-1';

            if (stateKey !== 'zoom') {
                const lockBtn = document.createElement('button');
                lockBtn.type = 'button';
                lockBtn.dataset.sliderLock = stateKey;
                lockBtn.className = 'slider-lock-btn min-w-[22px] min-h-[22px] sm:min-w-[18px] sm:min-h-[18px] px-1 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] leading-none text-gray-500 hover:text-amber-200 transition';
                lockBtn.textContent = isKeyLocked(stateKey) ? '🔒' : '🔓';
                lockBtn.setAttribute('aria-pressed', String(isKeyLocked(stateKey)));
                lockBtn.title = isKeyLocked(stateKey) ? `Unlock ${stateKey}` : `Lock ${stateKey} during Randomize & AI`;
                lockBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const grp = findLockGroupForKey(stateKey);
                    if (grp && lockedGroups[grp]) {
                        lockedGroups[grp] = false;
                        safeWriteStorage('solopass_locks', lockedGroups);
                        import('../core/state.js').then(({ LOCK_GROUP_KEYS }) => {
                            LOCK_GROUP_KEYS[grp].forEach(k => {
                                if (k !== stateKey && els[k]) lockedSliders[k] = true;
                            });
                            lockedSliders[stateKey] = false;
                            safeWriteStorage('solopass_locked_sliders', lockedSliders);
                            updateLockUI();
                            showToast(`${stateKey} unlocked 🔓`);
                        });
                        return;
                    }
                    lockedSliders[stateKey] = !lockedSliders[stateKey];
                    safeWriteStorage('solopass_locked_sliders', lockedSliders);
                    updateLockUI();
                    showToast(`${stateKey} ${isKeyLocked(stateKey) ? 'locked 🔒' : 'unlocked 🔓'}`);
                });
                stepWrap.appendChild(lockBtn);
            }

            const makeStepBtn = (label, title) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'step-btn';
                btn.textContent = label;
                btn.title = title;
                return btn;
            };
            const minusBtn = makeStepBtn('−', 'Decrease by 1 step');
            const plusBtn = makeStepBtn('+', 'Increase by 1 step');

            const nudge = (dir) => {
                if (getIsTimelinePlaying()) stopTimelinePlayback();
                const step = parseFloat(slider.step) || 1;
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                const next = Math.max(min, Math.min(max, Number((state[stateKey] + dir * step).toFixed(3))));
                state[stateKey] = next;
                slider.value = next;
                render();
                pushHistory();
            };
            minusBtn.addEventListener('click', () => nudge(-1));
            plusBtn.addEventListener('click', () => nudge(1));

            headerRow.removeChild(valSpan);
            stepWrap.appendChild(minusBtn);
            stepWrap.appendChild(valSpan);
            stepWrap.appendChild(plusBtn);
            headerRow.appendChild(stepWrap);
        }

        slider.addEventListener('pointerdown', (e) => e.stopPropagation());
        slider.addEventListener('input', (e) => {
            if (getIsTimelinePlaying() && stateKey !== 'zoom') stopTimelinePlayback();
            state[stateKey] = parseFloat(e.target.value);
            scheduleRender();
        });
        slider.addEventListener('change', () => {
            if (stateKey !== 'zoom') pushHistory();
        });
        slider.addEventListener('dblclick', () => {
            if (DEFAULTS[stateKey] !== undefined) {
                state[stateKey] = DEFAULTS[stateKey];
                slider.value = DEFAULTS[stateKey];
                render();
                if (stateKey !== 'zoom') pushHistory();
                showToast(`Reset ${elId} to default`);
            }
        });
    });

    // Brand Wordmark Controls
    els.showText?.addEventListener('change', (e) => {
        state.showText = e.target.checked;
        render();
        pushHistory();
    });
    els.brandText?.addEventListener('input', (e) => {
        state.brandText = e.target.value;
        scheduleRender();
    });
    els.brandText?.addEventListener('change', pushHistory);

    // Harmonic Mutate
    document.getElementById('mutateBtn')?.addEventListener('click', () => {
        const palettes = [
            { primary: '#6b66ff', secondary: '#38bdf8' },
            { primary: '#818cf8', secondary: '#c084fc' },
            { primary: '#38bdf8', secondary: '#34d399' },
            { primary: '#6366f1', secondary: '#f472b6' },
            { primary: '#60a5fa', secondary: '#a78bfa' }
        ];
        const preAnchor = { ...state };
        const pal = palettes[Math.floor(Math.random() * palettes.length)];
        const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        state.strokeColor = pal.primary;
        state.secondaryColor = pal.secondary;
        state.useGradient = Math.random() > 0.35;
        state.circleRadius = randInt(34, 56);
        state.ringGapDeg = Math.random() > 0.5 ? randInt(16, 68) : 0;
        state.ringRotate = state.ringGapDeg > 0 ? randInt(-45, 45) : 0;
        state.wingGap = randInt(16, 38);
        state.topWingLen = randInt(95, 160);
        state.botWingLen = Math.round(state.topWingLen * (0.58 + Math.random() * 0.24));
        state.wingSpacing = randInt(18, 34);
        state.wingAngle = Math.random() > 0.55 ? (randInt(-6, 6) * 0.5) : 0;
        state.wingCurve = Math.random() > 0.55 ? randInt(-10, 10) : 0;
        state.tripleWing = Math.random() > 0.72;
        Object.assign(state, applyLocksToState(state, preAnchor));

        syncInputsFromState();
        render();
        pushHistory();
        showToast('Generated harmonic logo variation!');
    });

    // Line cap, 3-wing, Arc Lock, Stage Background
    document.querySelectorAll('.cap-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.lineCap = btn.dataset.cap;
            syncInputsFromState();
            render();
            pushHistory();
        });
    });

    document.getElementById('tripleWingBtn')?.addEventListener('click', () => {
        state.tripleWing = !state.tripleWing;
        syncInputsFromState();
        render();
        pushHistory();
        showToast(state.tripleWing ? '3-Wing accent tier enabled' : '3-Wing accent tier disabled');
    });

    document.getElementById('lockNonStraightBtn')?.addEventListener('click', () => {
        state.lockNonStraight = !state.lockNonStraight;
        syncInputsFromState();
        render();
        pushHistory();
        showToast(state.lockNonStraight ? 'Arc Lock enabled: Wings stay curved/angled' : 'Arc Lock disabled');
    });

    document.querySelectorAll('.bg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.bgColor = btn.dataset.bg;
            render();
        });
    });

    // Presets
    window.applyPreset = function(type) {
        if (getIsTimelinePlaying()) stopTimelinePlayback();
        const preset = PRESETS[type];
        if (!preset) return;
        Object.assign(state, preset);
        syncInputsFromState();
        render();
        pushHistory();
    };

    document.getElementById('resetBtn')?.addEventListener('click', () => {
        state.encodedMessage = '';
        const cipherInput = document.getElementById('cipherMessageInput');
        if (cipherInput) cipherInput.value = '';
        window.applyPreset('reference');
        showToast('Reset to Exact Reference');
    });

    // Section Resets
    document.querySelectorAll('.reset-section-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sec = btn.dataset.resetSection;
            const patch = SECTION_RESET_PRESETS[sec];
            if (!patch) return;
            if (getIsTimelinePlaying()) stopTimelinePlayback();
            Object.assign(state, patch);
            syncInputsFromState();
            render();
            pushHistory();
            showToast(`Reset ${sec} section to defaults ↺`);
        });
    });

    // Lock Group & Lock All Buttons
    document.querySelectorAll('.lock-group-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const grp = btn.dataset.lockGroup;
            if (!grp || !(grp in lockedGroups)) return;
            lockedGroups[grp] = !lockedGroups[grp];
            safeWriteStorage('solopass_locks', lockedGroups);
            updateLockUI();
            showToast(`${grp.charAt(0).toUpperCase() + grp.slice(1)} ${lockedGroups[grp] ? 'locked 🔒' : 'unlocked 🔓'}`);
        });
    });

    document.getElementById('toggleAllLocksBtn')?.addEventListener('click', () => {
        const nextLocked = !Object.values(lockedGroups).every(Boolean);
        Object.keys(lockedGroups).forEach(k => { lockedGroups[k] = nextLocked; });
        document.querySelectorAll('.slider-lock-btn').forEach(btn => {
            const key = btn.dataset.sliderLock;
            if (key) lockedSliders[key] = nextLocked;
        });
        safeWriteStorage('solopass_locked_sliders', lockedSliders);
        safeWriteStorage('solopass_locks', lockedGroups);
        updateLockUI();
        showToast(nextLocked ? 'All groups & sliders locked 🔒' : 'All locks cleared 🔓');
    });
    updateLockUI();

    // Motion Trail Toggle
    const motionTrailBtn = document.getElementById('motionTrailBtn');
    motionTrailBtn?.addEventListener('click', () => {
        state.motionTrail = !state.motionTrail;
        motionTrailBtn.classList.toggle('bg-sky-500/25', state.motionTrail);
        motionTrailBtn.classList.toggle('border-sky-400/50', state.motionTrail);
        motionTrailBtn.classList.toggle('text-sky-200', state.motionTrail);
        render();
        showToast(`Motion Trail ${state.motionTrail ? 'enabled ✨' : 'disabled'}`);
    });

    // Guides & Direct Canvas Drag Handles
    document.getElementById('toggleGuidesBtn')?.addEventListener('click', (e) => {
        state.showGuides = !state.showGuides;
        e.currentTarget.classList.toggle('border-indigo-400', state.showGuides);
        e.currentTarget.classList.toggle('bg-indigo-500/20', state.showGuides);
        document.getElementById('directDragHint')?.classList.toggle('hidden', !state.showGuides);
        render();
    });

    let activeDragHandle = null;
    els.svgStage?.addEventListener('pointerdown', (e) => {
        const handleEl = e.target.closest('[data-handle]');
        if (!handleEl) return;
        e.preventDefault();
        e.stopPropagation();
        if (getIsTimelinePlaying()) stopTimelinePlayback();
        activeDragHandle = handleEl.dataset.handle;
        els.svgStage.setPointerCapture?.(e.pointerId);
    });

    window.addEventListener('pointermove', (e) => {
        if (!activeDragHandle || !els.svgStage) return;
        const svgEl = els.svgStage.querySelector('svg');
        if (!svgEl) return;
        const rect = svgEl.getBoundingClientRect();
        const viewW = 600;
        const viewH = state.showText ? 290 : 220;
        const cx = viewW / 2;
        const cy = state.showText ? 105 : 110;
        const svgX = ((e.clientX - rect.left) / rect.width) * viewW;
        const svgY = ((e.clientY - rect.top) / rect.height) * viewH;

        if (activeDragHandle === 'radius') {
            state.circleRadius = Math.max(20, Math.min(72, Math.round(Math.abs(cy - svgY))));
        } else if (activeDragHandle === 'gap') {
            state.wingGap = Math.max(6, Math.min(65, Math.round(svgX - cx - state.circleRadius)));
        } else if (activeDragHandle === 'topLen') {
            state.topWingLen = Math.max(30, Math.min(190, Math.round(svgX - cx - state.circleRadius - state.wingGap)));
        } else if (activeDragHandle === 'botLen') {
            state.botWingLen = Math.max(20, Math.min(170, Math.round(svgX - cx - state.circleRadius - state.wingGap - state.botInnerInset)));
        }
        syncInputsFromState();
        scheduleRender();
    });

    window.addEventListener('pointerup', () => {
        if (activeDragHandle) {
            activeDragHandle = null;
            pushHistory();
        }
    });

    // Cipher & Seed Codec UI
    document.getElementById('encodeMessageBtn')?.addEventListener('click', () => {
        const val = document.getElementById('cipherMessageInput')?.value || '';
        const res = encodeMessageToState(val, state);
        if (!res.ok) {
            showToast(res.error, 'error');
            return;
        }
        syncInputsFromState();
        render();
        pushHistory();
        showToast(`Encoded "${res.message}" into geometry & SP2 code!`);
    });

    document.getElementById('cipherMessageInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('encodeMessageBtn')?.click();
    });

    const cipherInputEl = document.getElementById('cipherMessageInput');
    const motionPhraseEl = document.getElementById('motionPhraseInput');
    cipherInputEl?.addEventListener('input', () => {
        if (motionPhraseEl && motionPhraseEl.value !== cipherInputEl.value) {
            motionPhraseEl.value = cipherInputEl.value;
        }
    });
    motionPhraseEl?.addEventListener('input', () => {
        if (cipherInputEl && cipherInputEl.value !== motionPhraseEl.value) {
            cipherInputEl.value = motionPhraseEl.value;
        }
    });
    motionPhraseEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('animateMessageBtn')?.click();
    });

    document.getElementById('clearCipherBtn')?.addEventListener('click', () => {
        state.encodedMessage = '';
        if (cipherInputEl) cipherInputEl.value = '';
        if (motionPhraseEl) motionPhraseEl.value = '';
        render();
        pushHistory();
        showToast('Cleared embedded cipher message');
    });

    document.getElementById('animateMessageBtn')?.addEventListener('click', () => {
        const msg = motionPhraseEl?.value || cipherInputEl?.value || '';
        const styleMode = document.getElementById('messageAnimStyleSelect')?.value || 'cyberMorph';
        const res = styleMode === 'beacon'
            ? buildBeaconMessageTimeline(msg, state, { anchorState: state })
            : buildStealthMessageTimeline(msg, state, { style: styleMode, anchorState: state });

        if (!res.ok) {
            showToast(res.error, 'error');
            return;
        }
        if (getIsTimelinePlaying()) stopTimelinePlayback();
        stopSmoothMorphLoop(true);
        state.encodedMessage = res.message;
        if (cipherInputEl) cipherInputEl.value = res.message;
        if (motionPhraseEl) motionPhraseEl.value = res.message;
        setMotionTimeline(res.timeline);
        syncInputsFromState();
        render();
        pushHistory();
        document.getElementById('modeBtnMotion')?.click();
        document.getElementById('playTimelineBtn')?.click();
        showToast(`Animated "${res.message}" (${res.frameCount} keyframes · ${styleMode === 'beacon' ? 'CRC-8 Beacon' : styleMode})`);
    });

    document.getElementById('decodeVideoFileInput')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const statusEl = document.getElementById('videoDecodeStatus');
        const box = document.getElementById('decodedMessageBox');
        const textEl = document.getElementById('decodedMessageText');
        if (statusEl) statusEl.textContent = 'Scanning video...';

        const ChannelCtor = window.SoloSyncChannel;
        if (!ChannelCtor) {
            showToast('SoloSync optical decoder is unavailable', 'error');
            return;
        }
        const decoderChannel = new ChannelCtor();
        const res = await decoderChannel.decodeVideoFile(file, {
            onProgress: (pct) => {
                if (statusEl) statusEl.textContent = `Scanning ${pct}%`;
            },
            onError: (msg) => {
                if (statusEl) statusEl.textContent = 'Decode error';
                showToast(msg, 'error');
            }
        });
        e.target.value = '';

        if (res.ok && res.text) {
            if (statusEl) statusEl.textContent = `Decoded ${res.byteCount}B`;
            if (box && textEl) {
                box.classList.remove('hidden');
                textEl.textContent = res.text;
            }
            showToast(`Recovered hidden message: "${res.text}"`);
        } else if (res.ok) {
            if (statusEl) statusEl.textContent = 'No beacon frames found';
            showToast('No SoloSync CRC-8 beacon frames detected in clip', 'error');
        }
    });

    document.getElementById('verifyBeaconBtn')?.addEventListener('click', async () => {
        const statusEl = document.getElementById('videoDecodeStatus');
        const box = document.getElementById('decodedMessageBox');
        const textEl = document.getElementById('decodedMessageText');
        const tl = getMotionTimeline();
        const DecoderCtor = window.SoloSyncCVDecoder;
        const GridApi = window.SoloSyncGrid;
        if (!DecoderCtor || !GridApi || !tl?.keyframes?.length) {
            showToast('Generate a Decodable Beacon timeline first', 'error');
            return;
        }
        if (statusEl) statusEl.textContent = 'Verifying frames...';
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 220;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const cvDecoder = new DecoderCtor();
        const bytes = [];

        for (let i = 0; i < tl.keyframes.length; i++) {
            const kfState = { ...state, ...tl.keyframes[i].state, showText: false };
            const grid = GridApi.generateGridMarkup(600, 220, kfState._clockBit ?? (i % 2), i);
            const svgMarkup = generateSVGString(kfState, { forExport: true, includeGuides: false, opticalGridMarkup: grid });
            const url = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' }));
            await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    ctx.fillStyle = '#0d0d16';
                    ctx.fillRect(0, 0, 600, 220);
                    ctx.drawImage(img, 0, 0, 600, 220);
                    URL.revokeObjectURL(url);
                    resolve();
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve();
                };
                img.src = url;
            });
            const res = cvDecoder.decodeCanvas(canvas, true);
            if (res && res.locked && res.bytes && res.bytes.b0) {
                bytes.push(res.bytes.b0);
            }
        }

        const recovered = new TextDecoder().decode(new Uint8Array(bytes));
        if (recovered) {
            if (statusEl) statusEl.textContent = `CRC-8 OK (${bytes.length}/${tl.keyframes.length})`;
            if (box && textEl) {
                box.classList.remove('hidden');
                textEl.textContent = recovered;
            }
            showToast(`Beacon verified: "${recovered}" (${bytes.length}/${tl.keyframes.length} frames)`);
        } else {
            if (statusEl) statusEl.textContent = 'Verify failed (not a Beacon?)';
            showToast('No CRC-8 Beacon bytes recovered — select Decodable Beacon first', 'error');
        }
    });

    // Video Corner Bug Preview Toggle
    let isVideoBugPreview = false;
    document.getElementById('videoBugPreviewBtn')?.addEventListener('click', () => {
        isVideoBugPreview = !isVideoBugPreview;
        const btn = document.getElementById('videoBugPreviewBtn');
        const overlay = document.getElementById('videoBugMockOverlay');
        btn?.classList.toggle('border-rose-400/50', isVideoBugPreview);
        btn?.classList.toggle('text-rose-200', isVideoBugPreview);
        overlay?.classList.toggle('hidden', !isVideoBugPreview);
        if (els.svgStage) {
            els.svgStage.classList.toggle('scale-[0.38]', isVideoBugPreview);
            els.svgStage.classList.toggle('origin-bottom-right', isVideoBugPreview);
            els.svgStage.classList.toggle('translate-x-[-4%]', isVideoBugPreview);
            els.svgStage.classList.toggle('translate-y-[-6%]', isVideoBugPreview);
        }
        showToast(isVideoBugPreview ? '16:9 YouTube Corner Bug Preview active' : 'Returned to full stage preview');
    });

    document.getElementById('copySeedBtn')?.addEventListener('click', () => {
        const code = document.getElementById('vectorSeedCode')?.value;
        if (code) copyTextToClipboard(code, 'Copied live SP2 Vector Seed!');
    });

    document.getElementById('decodeSeedBtn')?.addEventListener('click', () => {
        const input = document.getElementById('vectorSeedCode')?.value || '';
        const res = decodeSeedDetailed(input, state);
        if (res.ok) {
            const cipherInput = document.getElementById('cipherMessageInput');
            if (cipherInput) cipherInput.value = state.encodedMessage || '';
            syncInputsFromState();
            render();
            pushHistory();
            showToast(state.encodedMessage
                ? `Decoded Seed & Secret Message: "${state.encodedMessage}"`
                : 'Loaded design from SP2 Vector Seed!');
        } else {
            showToast(res.error || 'Invalid SP2 seed format.', 'error');
        }
    });

    document.getElementById('vectorSeedCode')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('decodeSeedBtn')?.click();
    });

    // Live SVG Inspector Modal
    let lastFocusedBeforeModal = null;
    document.getElementById('inspectSvgBtn')?.addEventListener('click', () => {
        lastFocusedBeforeModal = document.activeElement;
        const previewEl = document.getElementById('svgCodePreview');
        if (previewEl) previewEl.textContent = generateSVGString(state, { forExport: false, includeGuides: false });
        document.getElementById('svgInspectorModal')?.classList.remove('hidden');
        document.getElementById('closeInspectorBtn')?.focus();
    });

    function closeSvgInspectorModal() {
        const modal = document.getElementById('svgInspectorModal');
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
                lastFocusedBeforeModal.focus();
            }
        }
    }
    document.getElementById('closeInspectorBtn')?.addEventListener('click', closeSvgInspectorModal);
    document.getElementById('svgInspectorModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'svgInspectorModal') closeSvgInspectorModal();
    });
    document.getElementById('modalCopySvgBtn')?.addEventListener('click', () => {
        copyTextToClipboard(generateSVGString(state, { forExport: false, includeGuides: false }), 'Copied formatted SVG XML!');
    });

    // Ambient Pulse Preview
    let pulseAnimId = null;
    let isPulsing = false;
    function setPulseActive(active) {
        isPulsing = active;
        const dot = document.getElementById('pulseDot');
        const btn = document.getElementById('pulseToggleBtn');
        dot?.classList.toggle('bg-indigo-400', isPulsing);
        dot?.classList.toggle('shadow-[0_0_8px_#818cf8]', isPulsing);
        dot?.classList.toggle('bg-gray-500', !isPulsing);
        btn?.classList.toggle('border-indigo-400/40', isPulsing);

        if (isPulsing) {
            const start = performance.now();
            const tick = (now) => {
                if (!isPulsing) return;
                const wave = Math.sin((now - start) / 550);
                const blur = Math.max(2, state.glowBlur + wave * 4);
                const blurEl = els.svgStage?.querySelector('feGaussianBlur');
                if (blurEl) blurEl.setAttribute('stdDeviation', blur.toFixed(1));
                pulseAnimId = requestAnimationFrame(tick);
            };
            pulseAnimId = requestAnimationFrame(tick);
        } else {
            if (pulseAnimId) cancelAnimationFrame(pulseAnimId);
            render();
        }
    }
    document.getElementById('pulseToggleBtn')?.addEventListener('click', () => setPulseActive(!isPulsing));

    // Session Snapshot Vault
    const savedSnapshots = [];
    function renderSnapshotVault() {
        const vault = document.getElementById('snapshotVault');
        const list = document.getElementById('snapshotList');
        if (!vault || !list) return;
        if (!savedSnapshots.length) {
            vault.classList.add('hidden');
            return;
        }
        vault.classList.remove('hidden');
        list.innerHTML = '';
        savedSnapshots.forEach((snap, idx) => {
            const btn = document.createElement('button');
            btn.className = 'shrink-0 px-2.5 py-1.5 rounded-xl bg-black/50 hover:bg-white/10 border border-white/10 flex items-center gap-2 transition text-[11px] text-gray-200';
            btn.innerHTML = `<span class="w-2.5 h-2.5 rounded-full" style="background:${snap.strokeColor}"></span><span>#${idx + 1}</span>`;
            btn.title = 'Click to load this saved snapshot';
            btn.addEventListener('click', () => {
                Object.assign(state, snap);
                const cipherInput = document.getElementById('cipherMessageInput');
                if (cipherInput) cipherInput.value = state.encodedMessage || '';
                syncInputsFromState();
                render();
                pushHistory();
                showToast(`Loaded Snapshot #${idx + 1}`);
            });
            list.appendChild(btn);
        });
    }
    document.getElementById('saveSnapshotBtn')?.addEventListener('click', () => {
        savedSnapshots.push(JSON.parse(JSON.stringify(state)));
        renderSnapshotVault();
        showToast(`Saved Snapshot #${savedSnapshots.length} to Vault`);
    });
    document.getElementById('clearVaultBtn')?.addEventListener('click', () => {
        savedSnapshots.length = 0;
        renderSnapshotVault();
        showToast('Cleared session snapshots');
    });

    // 4-Workspace Mode Switcher (Design | Motion | Lab | Export)
    const modeOrder = ['design', 'motion', 'lab', 'export'];
    const modeMeta = {
        design: { title: '🎨 Design Studio', subtitle: 'Emblem geometry, colors & wordmark', panel: 'tabPanelStudio' },
        motion: { title: '🎬 Motion & Video Bug', subtitle: 'Phrase motion, keyframes & AI choreographer', panel: 'tabPanelAnimate' },
        lab: { title: '🧪 Cipher & Optical Lab', subtitle: 'SP2 seeds, video beacon decode & SoloSync', panel: 'tabPanelCipher' }
    };
    let currentWorkspaceMode = 'design';
    let lastEditorMode = 'design';

    function setWorkspaceMode(mode) {
        if (!modeOrder.includes(mode)) mode = 'design';
        currentWorkspaceMode = mode;
        if (mode !== 'export') lastEditorMode = mode;

        const editorWorkspace = document.getElementById('editorWorkspace');
        const exportPageView = document.getElementById('exportPageView');
        const isExport = mode === 'export';
        if (editorWorkspace) editorWorkspace.classList.toggle('hidden', isExport);
        if (exportPageView) exportPageView.classList.toggle('hidden', !isExport);

        document.querySelectorAll('.workspace-mode-btn').forEach(btn => {
            const btnMode = btn.dataset.workspaceMode;
            const active = btnMode === mode;
            btn.setAttribute('aria-selected', String(active));
            btn.setAttribute('tabindex', active ? '0' : '-1');
            if (btnMode === 'export') {
                btn.className = active
                    ? 'workspace-mode-btn flex-1 lg:flex-none px-3.5 py-1.5 rounded-xl bg-indigo-500 border border-indigo-300/70 text-xs font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.55)] transition flex items-center justify-center gap-1.5'
                    : 'workspace-mode-btn flex-1 lg:flex-none px-3.5 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 border border-indigo-400/40 text-xs font-semibold text-white shadow-[0_0_14px_rgba(99,102,241,0.3)] transition flex items-center justify-center gap-1.5';
            } else {
                btn.className = active
                    ? 'workspace-mode-btn flex-1 lg:flex-none px-3 py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-400/50 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5'
                    : 'workspace-mode-btn flex-1 lg:flex-none px-3 py-1.5 rounded-xl bg-transparent border border-transparent text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition flex items-center justify-center gap-1.5';
            }
        });

        if (!isExport) {
            const meta = modeMeta[mode];
            const titleEl = document.getElementById('sidebarModeTitle');
            const subEl = document.getElementById('sidebarModeSubtitle');
            if (titleEl && meta) titleEl.textContent = meta.title;
            if (subEl && meta) subEl.textContent = meta.subtitle;

            Object.entries(modeMeta).forEach(([key, info]) => {
                document.getElementById(info.panel)?.classList.toggle('hidden', key !== mode);
            });
            // Keep motion phrase input synced with cipher input
            const cEl = document.getElementById('cipherMessageInput');
            const mEl = document.getElementById('motionPhraseInput');
            if (cEl && mEl && mEl.value !== cEl.value) mEl.value = cEl.value;
        }

        window.dispatchEvent(new CustomEvent('solopass:modechange', { detail: { mode, lastEditorMode } }));
        try { localStorage.setItem('solopass_workspace_mode', mode); } catch {}
    }

    document.querySelectorAll('.workspace-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setWorkspaceMode(btn.dataset.workspaceMode));
        btn.addEventListener('keydown', (e) => {
            const idx = modeOrder.indexOf(btn.dataset.workspaceMode);
            if (idx === -1) return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const nextIdx = (idx + (e.key === 'ArrowRight' ? 1 : -1) + modeOrder.length) % modeOrder.length;
                const nextMode = modeOrder[nextIdx];
                setWorkspaceMode(nextMode);
                document.querySelector(`[data-workspace-mode="${nextMode}"]`)?.focus();
            }
        });
    });

    document.querySelectorAll('[data-jump-export="true"]').forEach(btn => {
        btn.addEventListener('click', () => setWorkspaceMode('export'));
    });
    document.querySelectorAll('[data-jump-motion="true"]').forEach(btn => {
        btn.addEventListener('click', () => setWorkspaceMode('motion'));
    });
    document.getElementById('backToEditorBtn')?.addEventListener('click', () => {
        setWorkspaceMode(lastEditorMode || 'design');
    });

    let initialMode = 'design';
    try {
        const savedMode = localStorage.getItem('solopass_workspace_mode');
        if (savedMode && modeOrder.includes(savedMode) && savedMode !== 'export') initialMode = savedMode;
    } catch {}
    setWorkspaceMode(initialMode);

    // Compare Peek
    const comparePeekBtn = document.getElementById('comparePeekBtn');
    let comparePreSnapshot = null;
    comparePeekBtn?.addEventListener('click', () => {
        if (!comparePreSnapshot) {
            comparePreSnapshot = { ...state };
            window.applyPreset('reference');
            comparePeekBtn.classList.add('bg-indigo-500/30', 'border-indigo-400', 'text-white');
            showToast('Comparing against Exact Reference (click again to restore)');
        } else {
            Object.assign(state, comparePreSnapshot);
            comparePreSnapshot = null;
            syncInputsFromState();
            render();
            comparePeekBtn.classList.remove('bg-indigo-500/30', 'border-indigo-400', 'text-white');
            showToast('Restored your design');
        }
    });

    // 3D Stage Tilt Parallax
    const tiltStageBtn = document.getElementById('tiltStageBtn');
    const previewWrapperEl = document.getElementById('previewWrapper');
    let isTiltEnabled = false;
    if (tiltStageBtn && previewWrapperEl) {
        tiltStageBtn.addEventListener('click', () => {
            isTiltEnabled = !isTiltEnabled;
            tiltStageBtn.classList.toggle('bg-sky-500/30', isTiltEnabled);
            tiltStageBtn.classList.toggle('border-sky-400', isTiltEnabled);
            tiltStageBtn.classList.toggle('text-white', isTiltEnabled);
            if (!isTiltEnabled) previewWrapperEl.style.transform = '';
            showToast(`3D Stage Tilt ${isTiltEnabled ? 'enabled 🪩' : 'disabled'}`);
        });
        previewWrapperEl.addEventListener('mousemove', (e) => {
            if (!isTiltEnabled) return;
            const rect = previewWrapperEl.getBoundingClientRect();
            const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
            previewWrapperEl.style.transform = `perspective(900px) rotateY(${(nx * 7).toFixed(2)}deg) rotateX(${(-ny * 7).toFixed(2)}deg)`;
        });
        previewWrapperEl.addEventListener('mouseleave', () => {
            if (isTiltEnabled) previewWrapperEl.style.transform = '';
        });
    }

    // Stage Telemetry HUD sync
    function updateStageHud() {
        const seedEl = document.getElementById('hudSeedBadge');
        const locksEl = document.getElementById('hudLocksBadge');
        const modeEl = document.getElementById('hudModeBadge');
        const seedVal = document.getElementById('motionSeedInput')?.value || '4829';
        if (seedEl) seedEl.textContent = `Seed #${seedVal}`;
        const activeLocks = Object.entries(lockedGroups).filter(([, v]) => v).map(([k]) => k);
        const sliderLockCount = Object.values(lockedSliders).filter(Boolean).length;
        if (sliderLockCount > 0) activeLocks.push(`${sliderLockCount}s`);
        if (locksEl) {
            locksEl.classList.toggle('hidden', activeLocks.length === 0);
            locksEl.textContent = `🔒 ${activeLocks.join(',')}`;
        }
        if (modeEl) {
            if (getIsMorphLoopActive()) modeEl.textContent = 'Morphing';
            else if (getIsTimelinePlaying()) modeEl.textContent = 'Playing';
            else modeEl.textContent = 'Ready';
        }
    }
    setInterval(updateStageHud, 400);

    // Shortcuts & Global Keyboard Navigation
    const openShortcutsBtn = document.getElementById('openShortcutsBtn');
    openShortcutsBtn?.addEventListener('click', () => {
        showToast('Shortcuts: [1-4] Modes · [Space] Play/Pause · [R] Randomize · [M] Smooth Morph · [G] Guides · [Ctrl+S] Save');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSvgInspectorModal();
            document.getElementById('aiPresetsModal')?.classList.add('hidden');
            document.getElementById('userProfileModal')?.classList.add('hidden');
            if (currentWorkspaceMode === 'export') setWorkspaceMode(lastEditorMode || 'design');
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            document.getElementById('undoBtn')?.click();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            document.getElementById('quickSaveVaultBtn')?.click();
            return;
        }
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
        if (e.key === '1') setWorkspaceMode('design');
        else if (e.key === '2') setWorkspaceMode('motion');
        else if (e.key === '3') setWorkspaceMode('lab');
        else if (e.key === '4') setWorkspaceMode('export');
        else if (e.key === ' ') {
            e.preventDefault();
            if (getIsMorphLoopActive()) stopSmoothMorphLoop();
            else document.getElementById('playTimelineBtn')?.click();
        } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
            document.getElementById('aiRandomizeMotionBtn')?.click();
        } else if (e.key.toLowerCase() === 'm') {
            document.getElementById('morphLoopBtn')?.click();
        } else if (e.key.toLowerCase() === 'g') {
            document.getElementById('toggleGuidesBtn')?.click();
        } else if (e.key === '?') {
            openShortcutsBtn?.click();
        }
    });

    // Channel Brand Kit (localStorage)
    const BRAND_KIT_KEY = 'solopass_brand_kits_v1';
    function loadBrandKits() {
        try {
            const raw = localStorage.getItem(BRAND_KIT_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    function saveBrandKits(kits) {
        try { localStorage.setItem(BRAND_KIT_KEY, JSON.stringify(kits.slice(0, 4))); } catch {}
    }
    function renderBrandKitStrip() {
        const strip = document.getElementById('brandKitStrip');
        if (!strip) return;
        const kits = loadBrandKits();
        strip.innerHTML = '';
        if (kits.length === 0) {
            strip.innerHTML = '<span class="text-[10px] text-gray-400">Save colors, style &amp; wordmark for 1-click recall.</span>';
            return;
        }
        kits.forEach((kit, idx) => {
            const wrap = document.createElement('div');
            wrap.className = 'shrink-0 inline-flex items-center gap-1 bg-black/45 border border-white/15 rounded-lg px-2 py-1';
            const applyBtn = document.createElement('button');
            applyBtn.type = 'button';
            applyBtn.className = 'inline-flex items-center gap-1.5 text-[10px] font-medium text-gray-100 hover:text-white';
            applyBtn.title = `Apply Brand Kit "${kit.name}"`;
            const swatch = document.createElement('span');
            swatch.className = 'w-2.5 h-2.5 rounded-full border border-white/30';
            swatch.style.backgroundColor = kit.strokeColor || '#6b66ff';
            const labelSpan = document.createElement('span');
            labelSpan.className = 'max-w-[76px] truncate';
            labelSpan.textContent = String(kit.name || 'Brand');
            applyBtn.appendChild(swatch);
            applyBtn.appendChild(labelSpan);
            applyBtn.addEventListener('click', () => {
                state.strokeColor = kit.strokeColor || state.strokeColor;
                state.secondaryColor = kit.secondaryColor || state.secondaryColor;
                state.useGradient = Boolean(kit.useGradient);
                state.visualStyle = kit.visualStyle || 'classic';
                if (typeof kit.brandText === 'string') state.brandText = kit.brandText;
                if (typeof kit.encodedMessage === 'string') state.encodedMessage = kit.encodedMessage;
                state.showLowerThird = Boolean(kit.showLowerThird);
                if (kit.bgColor) state.bgColor = kit.bgColor;
                syncInputsFromState();
                render();
                pushHistory();
                showToast(`Applied Brand Kit "${kit.name}"`);
            });
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'text-[10px] text-gray-500 hover:text-rose-300 ml-0.5';
            delBtn.textContent = '×';
            delBtn.title = 'Remove Brand Kit';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const next = loadBrandKits();
                next.splice(idx, 1);
                saveBrandKits(next);
                renderBrandKitStrip();
            });
            wrap.appendChild(applyBtn);
            wrap.appendChild(delBtn);
            strip.appendChild(wrap);
        });
    }
    document.getElementById('saveBrandKitBtn')?.addEventListener('click', () => {
        const label = (state.encodedMessage || state.brandText || 'Brand').trim().slice(0, 14) || 'Brand';
        const kits = loadBrandKits();
        kits.unshift({
            name: label,
            strokeColor: state.strokeColor,
            secondaryColor: state.secondaryColor,
            useGradient: state.useGradient,
            visualStyle: state.visualStyle,
            brandText: state.brandText,
            encodedMessage: state.encodedMessage,
            showLowerThird: state.showLowerThird,
            bgColor: state.bgColor
        });
        saveBrandKits(kits);
        renderBrandKitStrip();
        showToast(`Saved "${label}" to Channel Brand Kit`);
    });
    renderBrandKitStrip();

    return {
        pushHistory,
        setPulseActive,
        stopPulse: () => { if (isPulsing) setPulseActive(false); }
    };
}
