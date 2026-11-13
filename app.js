/**
 * Main entry point for SOLOPASS Vector Studio.
 */
import { state } from './core/state.js';
import { generateSVGString } from './core/geometry.js';
import { render, syncInputsFromState, showToast, setTimelinePlayingGetter } from './ui/render.js';
import { initTimeline } from './animation/timeline.js';
import { initControls } from './ui/controls.js';
import { initExporters, copyTextToClipboard } from './export/exporters.js';
import { initCopilot } from './ai/copilot.js';

function initOpticalSyncAndExtras({ pushHistory }) {
    // Mic Audio-Reactive Mode
    const micBtn = document.getElementById('micReactiveBtn');
    let micStream = null;
    let micCtx = null;
    let micRaf = null;
    let isMicActive = false;

    const stopMic = () => {
        isMicActive = false;
        if (micRaf) cancelAnimationFrame(micRaf);
        if (micStream) micStream.getTracks().forEach(t => t.stop());
        if (micCtx) micCtx.close().catch(() => {});
        micStream = null;
        micCtx = null;
        micBtn?.classList.remove('bg-emerald-500/25', 'border-emerald-400/50', 'text-emerald-200');
    };

    micBtn?.addEventListener('click', async () => {
        if (isMicActive) {
            stopMic();
            showToast('Audio-Reactive Mic stopped');
            return;
        }
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Microphone API unavailable in this browser context.');
            }
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micCtx = new (window.AudioContext || window.webkitAudioContext)();
            const src = micCtx.createMediaStreamSource(micStream);
            const analyser = micCtx.createAnalyser();
            analyser.fftSize = 128;
            src.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            isMicActive = true;
            micBtn.classList.add('bg-emerald-500/25', 'border-emerald-400/50', 'text-emerald-200');
            showToast('Audio-Reactive Mode active 🎵');

            const baseRadius = state.circleRadius;
            const baseGlow = state.glowBlur;
            const tick = () => {
                if (!isMicActive) return;
                analyser.getByteFrequencyData(data);
                const avg = data.reduce((a, b) => a + b, 0) / data.length;
                const norm = Math.min(1, avg / 90);
                state.glowBlur = Math.round(baseGlow + norm * 16);
                state.circleRadius = Math.round(baseRadius + norm * 10);
                render();
                micRaf = requestAnimationFrame(tick);
            };
            micRaf = requestAnimationFrame(tick);
        } catch (err) {
            console.error('[SOLOPASS] Mic access failed:', err);
            showToast(`Mic access denied or unavailable: ${err.message}`, 'error');
        }
    });

    // User Profile Modal
    let currentUserName = 'User';
    try { currentUserName = localStorage.getItem('solopass_username') || 'User'; } catch {}
    const userProfileBtn = document.getElementById('userProfileBtn');
    const userProfileLabel = document.getElementById('userProfileLabel');
    const userProfileModal = document.getElementById('userProfileModal');
    const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
    const profileNameInput = document.getElementById('profileNameInput');
    const saveProfileBtn = document.getElementById('saveProfileBtn');

    const updateProfileUI = () => {
        if (userProfileLabel) userProfileLabel.textContent = currentUserName || 'User';
        if (profileNameInput) profileNameInput.value = currentUserName || '';
    };
    updateProfileUI();

    userProfileBtn?.addEventListener('click', () => {
        updateProfileUI();
        userProfileModal?.classList.remove('hidden');
        profileNameInput?.focus();
    });
    closeProfileModalBtn?.addEventListener('click', () => userProfileModal?.classList.add('hidden'));
    userProfileModal?.addEventListener('click', (e) => {
        if (e.target.id === 'userProfileModal') userProfileModal.classList.add('hidden');
    });
    profileNameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveProfileBtn?.click();
    });
    saveProfileBtn?.addEventListener('click', () => {
        const newName = (profileNameInput?.value || '').trim();
        if (newName) {
            currentUserName = newName;
            try { localStorage.setItem('solopass_username', currentUserName); } catch {}
            updateProfileUI();
            const txSenderBadge = document.getElementById('txSenderBadge');
            if (txSenderBadge) txSenderBadge.textContent = `@${currentUserName}`;
            userProfileModal?.classList.add('hidden');
            showToast(`Updated sender profile name: ${currentUserName}`);
        }
    });

    // SOLO-SYNC Experimental Optical Channel
    const soloSync = typeof window.SoloSyncChannel !== 'undefined' ? new window.SoloSyncChannel() : null;
    const syncModal = document.getElementById('soloSyncModal');
    const soloSyncModalBtn = document.getElementById('soloSyncModalBtn');
    const closeSyncModalBtn = document.getElementById('closeSyncModalBtn');
    const syncGridToggle = document.getElementById('syncGridToggle');
    const txFpsSlider = document.getElementById('txFpsSlider');
    const txFpsVal = document.getElementById('txFpsVal');
    const txLoopToggle = document.getElementById('txLoopToggle');
    const txOpticalStage = document.getElementById('txOpticalStage');
    const txOpticalSvgWrap = document.getElementById('txOpticalSvgWrap');
    const txStageIdleLabel = document.getElementById('txStageIdleLabel');
    const txFullscreenBtn = document.getElementById('txFullscreenBtn');
    const txSenderBadge = document.getElementById('txSenderBadge');
    const testLoopbackBtn = document.getElementById('testLoopbackBtn');
    const startTxBtn = document.getElementById('startTxBtn');
    const stopTxBtn = document.getElementById('stopTxBtn');
    const txStatusBadge = document.getElementById('txStatusBadge');
    const txFramesCount = document.getElementById('txFramesCount');
    const txThroughputVal = document.getElementById('txThroughputVal');
    const toggleCameraRxBtn = document.getElementById('toggleCameraRxBtn');
    const rxCameraWrapper = document.getElementById('rxCameraWrapper');
    const rxCameraVideo = document.getElementById('rxCameraVideo');
    const rxLockBadge = document.getElementById('rxLockBadge');
    const rxConfidenceVal = document.getElementById('rxConfidenceVal');
    const rxLowConfWarning = document.getElementById('rxLowConfWarning');
    const rxTerminalLog = document.getElementById('rxTerminalLog');

    let isCameraRxActive = false;
    let lastReceivedText = '';
    let preTxStateSnapshot = null;

    function renderTxModalStage() {
        if (!txOpticalSvgWrap) return;
        const gridMarkup = state.showOpticalGrid && typeof window.SoloSyncGrid !== 'undefined'
            ? window.SoloSyncGrid.generateGridMarkup(600, state.showText ? 290 : 220, state.clockBit || 0, state.seq || 0)
            : '';
        txOpticalSvgWrap.innerHTML = generateSVGString(state, { forExport: true, includeGuides: false, opticalGridMarkup: gridMarkup });
        const svgEl = txOpticalSvgWrap.querySelector('svg');
        if (svgEl) {
            svgEl.style.width = '100%';
            svgEl.style.height = '100%';
            svgEl.style.maxHeight = '100%';
        }
    }

    function restorePreTxState() {
        if (preTxStateSnapshot) {
            Object.assign(state, preTxStateSnapshot);
            preTxStateSnapshot = null;
            syncInputsFromState();
            render();
            renderTxModalStage();
        }
    }

    function finishTxUI(statusText = 'DONE') {
        if (txStatusBadge) {
            txStatusBadge.textContent = statusText;
            txStatusBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-emerald-300 border border-white/10';
        }
        txStageIdleLabel?.classList.remove('hidden');
        if (stopTxBtn) stopTxBtn.disabled = true;
        if (startTxBtn) startTxBtn.disabled = false;
        restorePreTxState();
    }

    async function toggleCameraRx() {
        if (!soloSync) {
            showToast('Optical Sync module not loaded', 'error');
            return;
        }
        if (!isCameraRxActive) {
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error('Camera access requires HTTPS or localhost.');
                }
                rxCameraWrapper?.classList.remove('hidden');
                await soloSync.startCameraReceiver(rxCameraVideo);
                isCameraRxActive = true;
                const lbl = document.getElementById('cameraRxLabel');
                if (lbl) lbl.textContent = 'Stop Camera RX';
                toggleCameraRxBtn?.classList.add('bg-rose-600/30', 'border-rose-400/40', 'text-rose-200');
                showToast('Camera optical receiver online (Experimental)');
            } catch (err) {
                console.error('[SOLO-SYNC] Camera receiver error:', err);
                rxCameraWrapper?.classList.add('hidden');
                const friendly = err.name === 'NotAllowedError'
                    ? 'Camera permission denied. Allow camera access in browser settings.'
                    : err.name === 'NotFoundError'
                        ? 'No webcam detected on this device.'
                        : (err.message || 'Unable to start camera.');
                if (rxLockBadge) {
                    rxLockBadge.textContent = 'CAM ERROR';
                    rxLockBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30';
                }
                showToast(`Camera Error: ${friendly}`, 'error');
            }
        } else {
            soloSync.stopCameraReceiver();
            isCameraRxActive = false;
            rxCameraWrapper?.classList.add('hidden');
            rxLowConfWarning?.classList.add('hidden');
            const lbl = document.getElementById('cameraRxLabel');
            if (lbl) lbl.textContent = 'Start Webcam Vision RX';
            toggleCameraRxBtn?.classList.remove('bg-rose-600/30', 'border-rose-400/40', 'text-rose-200');
        }
    }

    function closeSoloSyncModal() {
        if (!syncModal || syncModal.classList.contains('hidden')) return;
        syncModal.classList.add('hidden');
        if (soloSync?.isTransmitting) soloSync.stopTransmission(false);
        if (isCameraRxActive) toggleCameraRx();
        restorePreTxState();
        state.showOpticalGrid = false;
        render();
    }

    soloSyncModalBtn?.addEventListener('click', () => {
        syncModal?.classList.remove('hidden');
        if (txSenderBadge) txSenderBadge.textContent = `@${currentUserName || 'Anon'}`;
        state.showOpticalGrid = syncGridToggle ? syncGridToggle.checked : true;
        render();
        renderTxModalStage();
    });
    closeSyncModalBtn?.addEventListener('click', closeSoloSyncModal);
    syncModal?.addEventListener('click', (e) => {
        if (e.target.id === 'soloSyncModal') closeSoloSyncModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSoloSyncModal();
    });
    syncGridToggle?.addEventListener('change', (e) => {
        state.showOpticalGrid = e.target.checked;
        render();
        renderTxModalStage();
    });
    txFpsSlider?.addEventListener('input', (e) => {
        if (txFpsVal) txFpsVal.textContent = `${e.target.value}fps`;
    });
    txFullscreenBtn?.addEventListener('click', () => {
        if (!txOpticalStage) return;
        if (document.fullscreenElement === txOpticalStage) {
            document.exitFullscreen().catch(() => {});
        } else if (txOpticalStage.requestFullscreen) {
            txOpticalStage.requestFullscreen().catch(() => showToast('Fullscreen not supported in this context'));
        }
    });

    startTxBtn?.addEventListener('click', () => {
        if (!soloSync) return;
        let text = (document.getElementById('txMessageInput')?.value || 'HELLO_AI').trim();
        if (currentUserName && !text.startsWith(`[${currentUserName}]:`)) {
            text = `[${currentUserName}]: ${text}`;
        }
        const fps = parseInt(txFpsSlider?.value || 25, 10);
        const loop = Boolean(txLoopToggle?.checked);
        if (!preTxStateSnapshot) preTxStateSnapshot = { ...state };
        state.showOpticalGrid = true;
        if (syncGridToggle) syncGridToggle.checked = true;
        txStageIdleLabel?.classList.add('hidden');

        if (txStatusBadge) {
            txStatusBadge.textContent = loop ? 'LOOPING' : 'TRANSMITTING';
            txStatusBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 animate-pulse';
        }
        if (stopTxBtn) stopTxBtn.disabled = false;
        startTxBtn.disabled = true;

        const startTime = performance.now();
        let framesRendered = 0;
        soloSync.onTxProgressCallback = ({ current, total }) => {
            framesRendered++;
            if (txFramesCount) txFramesCount.textContent = `${current}/${total}`;
            const elapsedSec = (performance.now() - startTime) / 1000;
            if (txThroughputVal && elapsedSec > 0) {
                txThroughputVal.textContent = `${Math.round((framesRendered * 2) / elapsedSec)} B/s`;
            }
        };

        soloSync.transmit(text, {
            fps,
            loop,
            onFrameRender: (frame) => {
                Object.assign(state, frame.state);
                render();
                renderTxModalStage();
            },
            onComplete: () => {
                finishTxUI('DONE');
                showToast('Optical transmission completed!');
            }
        });
    });

    stopTxBtn?.addEventListener('click', () => {
        soloSync?.stopTransmission(false);
        finishTxUI('STOPPED');
    });

    testLoopbackBtn?.addEventListener('click', async () => {
        if (!soloSync || typeof window.SoloSyncProtocol === 'undefined') return;
        let text = (document.getElementById('txMessageInput')?.value || 'HELLO_AI').trim();
        if (currentUserName && !text.startsWith(`[${currentUserName}]:`)) {
            text = `[${currentUserName}]: ${text}`;
        }
        const frames = window.SoloSyncProtocol.encodePayloadToFrames(text);
        soloSync.cvDecoder.reset();
        const saved = { ...state };
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 220;
        const ctx = canvas.getContext('2d');
        let lockedCount = 0;
        testLoopbackBtn.disabled = true;

        try {
            for (const frame of frames) {
                Object.assign(state, frame.state, { showOpticalGrid: true, showText: false });
                render();
                renderTxModalStage();
                const svgStr = generateSVGString(state, { forExport: true, includeGuides: false, opticalGridMarkup: window.SoloSyncGrid.generateGridMarkup(600, 220, state.clockBit || 0, state.seq || 0) });
                const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));
                await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        ctx.fillStyle = '#07070c';
                        ctx.fillRect(0, 0, 600, 220);
                        ctx.drawImage(img, 0, 0, 600, 220);
                        URL.revokeObjectURL(url);
                        const res = soloSync.cvDecoder.decodeCanvas(canvas, true);
                        if (res.locked) lockedCount++;
                        soloSync.onRxTelemetryCallback?.(res);
                        if (res.isNewFrame && res.bytes) {
                            soloSync.handleReceivedFrame({ seq: frame.seq, b0: res.bytes.b0, b1: res.bytes.b1, clockBit: res.clockBit });
                        }
                        resolve();
                    };
                    img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
                    img.src = url;
                });
            }
            showToast(`CV Loopback: ${lockedCount}/${frames.length} frames locked`);
        } catch (err) {
            console.error('[SOLO-SYNC] Loopback error:', err);
            showToast('CV Loopback failed', 'error');
        } finally {
            Object.assign(state, saved);
            render();
            renderTxModalStage();
            testLoopbackBtn.disabled = false;
        }
    });

    toggleCameraRxBtn?.addEventListener('click', toggleCameraRx);

    if (soloSync) {
        soloSync.onReceiveCallback = ({ text }) => {
            lastReceivedText = text;
            if (rxTerminalLog) {
                rxTerminalLog.textContent = text;
                rxTerminalLog.scrollTop = rxTerminalLog.scrollHeight;
            }
        };
        soloSync.onRxTelemetryCallback = ({ locked, confidence }) => {
            if (rxLockBadge) {
                rxLockBadge.textContent = locked ? 'LOCKED' : 'SEARCHING';
                rxLockBadge.className = locked
                    ? 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30';
            }
            if (rxConfidenceVal) rxConfidenceVal.textContent = `${confidence}%`;
            if (rxLowConfWarning) {
                rxLowConfWarning.classList.toggle('hidden', confidence >= 40 || !isCameraRxActive);
            }
        };
    }

    document.getElementById('clearRxLogBtn')?.addEventListener('click', () => {
        soloSync?.clearRxBuffer();
        lastReceivedText = '';
        if (rxTerminalLog) rxTerminalLog.textContent = '[Log cleared]';
    });
    document.getElementById('copyRxTextBtn')?.addEventListener('click', () => {
        if (!lastReceivedText) {
            showToast('No text in receiver buffer');
            return;
        }
        copyTextToClipboard(lastReceivedText, 'Copied received message!');
    });
}

// Bootstrap Application
const timelineApi = initTimeline();
setTimelinePlayingGetter(timelineApi.getIsTimelinePlaying);
const controlsApi = initControls({ timelineApi });
timelineApi.bindTimelineCallbacks?.({
    stopPulse: controlsApi.stopPulse,
    pushHistory: controlsApi.pushHistory
});
initExporters({
    pushHistory: controlsApi.pushHistory,
    getMotionTimeline: timelineApi.getMotionTimeline,
    setMotionTimeline: timelineApi.setMotionTimeline,
    isTimelinePlaying: timelineApi.getIsTimelinePlaying,
    stopTimelinePlayback: timelineApi.stopTimelinePlayback,
    applyInterpolatedTimeline: timelineApi.applyInterpolatedTimeline
});
initCopilot({
    pushHistory: controlsApi.pushHistory,
    timelineApi
});
initOpticalSyncAndExtras({ pushHistory: controlsApi.pushHistory });

// Initial render
syncInputsFromState();
render();
controlsApi.pushHistory();
