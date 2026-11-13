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

    document.getElementById('clearCipherBtn')?.addEventListener('click', () => {
        state.encodedMessage = '';
        const cipherInput = document.getElementById('cipherMessageInput');
        if (cipherInput) cipherInput.value = '';
        render();
        pushHistory();
        showToast('Cleared embedded cipher message');
    });

    document.getElementById('animateMessageBtn')?.addEventListener('click', () => {
        const msg = document.getElementById('cipherMessageInput')?.value || '';
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
        setMotionTimeline(res.timeline);
        syncInputsFromState();
        render();
        pushHistory();
        document.getElementById('tabBtnAnimate')?.click();
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

    // 3-Tab Sidebar + Keyboard Arrow Navigation
    const tabOrder = ['studio', 'animate', 'cipher'];
    function switchSidebarTab(tabName) {
        const tabs = {
            studio: { btn: document.getElementById('tabBtnStudio'), panel: document.getElementById('tabPanelStudio') },
            animate: { btn: document.getElementById('tabBtnAnimate'), panel: document.getElementById('tabPanelAnimate') },
            cipher: { btn: document.getElementById('tabBtnCipher'), panel: document.getElementById('tabPanelCipher') }
        };
        Object.entries(tabs).forEach(([name, item]) => {
            const active = name === tabName;
            if (item.panel) item.panel.classList.toggle('hidden', !active);
            if (item.btn) {
                item.btn.setAttribute('aria-selected', String(active));
                item.btn.setAttribute('tabindex', active ? '0' : '-1');
                item.btn.className = active
                    ? 'sidebar-tab-btn px-2 py-2 sm:py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-400/50 text-xs font-semibold text-white transition flex items-center justify-center gap-1'
                    : 'sidebar-tab-btn px-2 py-2 sm:py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition flex items-center justify-center gap-1';
            }
        });
        try { localStorage.setItem('solopass_sidebar_tab', tabName); } catch {}
    }

    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchSidebarTab(btn.dataset.sidebarTab));
        btn.addEventListener('keydown', (e) => {
            const idx = tabOrder.indexOf(btn.dataset.sidebarTab);
            if (idx === -1) return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const nextIdx = (idx + (e.key === 'ArrowRight' ? 1 : -1) + tabOrder.length) % tabOrder.length;
                const nextTab = tabOrder[nextIdx];
                switchSidebarTab(nextTab);
                document.querySelector(`[data-sidebar-tab="${nextTab}"]`)?.focus();
            }
        });
    });
    let initialTab = 'studio';
    try { initialTab = localStorage.getItem('solopass_sidebar_tab') || 'studio'; } catch {}
    switchSidebarTab(initialTab);

    // Native Export Popover
    const exportMenuBtn = document.getElementById('exportMenuBtn');
    const exportMenuPopover = document.getElementById('exportMenuPopover');
    if (exportMenuBtn && exportMenuPopover) {
        const positionExportPopover = () => {
            const rect = exportMenuBtn.getBoundingClientRect();
            exportMenuPopover.style.position = 'fixed';
            exportMenuPopover.style.top = `${Math.round(rect.bottom + 8)}px`;
            exportMenuPopover.style.right = `${Math.round(Math.max(8, window.innerWidth - rect.right))}px`;
            exportMenuPopover.style.left = 'auto';
        };
        if ('popover' in HTMLElement.prototype) {
            exportMenuPopover.addEventListener('beforetoggle', (e) => {
                const isOpen = e.newState === 'open';
                exportMenuBtn.setAttribute('aria-expanded', String(isOpen));
                if (isOpen) positionExportPopover();
            });
            exportMenuPopover.querySelectorAll('button').forEach(b => {
                b.addEventListener('click', () => {
                    if (exportMenuPopover.matches(':popover-open')) exportMenuPopover.hidePopover();
                });
            });
        } else {
            exportMenuPopover.classList.add('hidden');
            exportMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                positionExportPopover();
                const open = exportMenuPopover.classList.toggle('hidden') === false;
                exportMenuBtn.setAttribute('aria-expanded', String(open));
            });
            document.addEventListener('click', (e) => {
                if (!exportMenuPopover.classList.contains('hidden') && !exportMenuPopover.contains(e.target) && e.target !== exportMenuBtn) {
                    exportMenuPopover.classList.add('hidden');
                    exportMenuBtn.setAttribute('aria-expanded', 'false');
                }
            });
            exportMenuPopover.querySelectorAll('button').forEach(b => {
                b.addEventListener('click', () => {
                    exportMenuPopover.classList.add('hidden');
                    exportMenuBtn.setAttribute('aria-expanded', 'false');
                });
            });
        }
    }

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
        showToast('Shortcuts: [1/2/3] Tabs · [Space] Play/Pause · [R] Randomize · [M] Smooth Morph · [G] Guides · [Ctrl+S] Save');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSvgInspectorModal();
            document.getElementById('aiPresetsModal')?.classList.add('hidden');
            document.getElementById('userProfileModal')?.classList.add('hidden');
            if (exportMenuPopover && !exportMenuPopover.classList.contains('hidden') && !('popover' in HTMLElement.prototype)) {
                exportMenuPopover.classList.add('hidden');
            }
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
        if (e.key === '1') switchSidebarTab('studio');
        else if (e.key === '2') switchSidebarTab('animate');
        else if (e.key === '3') switchSidebarTab('cipher');
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

    return {
        pushHistory,
        setPulseActive,
        stopPulse: () => { if (isPulsing) setPulseActive(false); }
    };
}
