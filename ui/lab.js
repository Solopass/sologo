/**
 * Lab & Message-to-Motion Controls:
 * Geometric Cipher, SP2- Seed Codec, Video Beacon Decoder, and Phrase-to-Motion Composer.
 */
import { state } from '../core/state.js';
import { decodeSeedDetailed } from '../core/seed.js';
import { encodeMessageToState } from '../core/cipher.js';
import { buildStealthMessageTimeline, buildBeaconMessageTimeline } from '../core/message-motion.js';
import { generateSVGString } from '../core/geometry.js';
import { render, syncInputsFromState, showToast } from './render.js';
import { copyTextToClipboard } from '../export/exporters.js';

export function initLabControls({ pushHistory, timelineApi }) {
    const {
        getIsTimelinePlaying,
        getMotionTimeline,
        setMotionTimeline,
        stopTimelinePlayback,
        stopSmoothMorphLoop
    } = timelineApi;

    const cipherInputEl = document.getElementById('cipherMessageInput');
    const motionPhraseEl = document.getElementById('motionPhraseInput');

    // Sync Lab Cipher input <-> Motion Phrase input
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

    // Geometric Cipher
    document.getElementById('encodeMessageBtn')?.addEventListener('click', () => {
        const val = cipherInputEl?.value || '';
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

    cipherInputEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('encodeMessageBtn')?.click();
    });

    document.getElementById('clearCipherBtn')?.addEventListener('click', () => {
        state.encodedMessage = '';
        if (cipherInputEl) cipherInputEl.value = '';
        if (motionPhraseEl) motionPhraseEl.value = '';
        render();
        pushHistory();
        showToast('Cleared embedded cipher message');
    });

    // Message-to-Motion Composer
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

    // Video Clip Beacon Decoder
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

    // Offscreen CRC-8 Beacon Verifier
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

    // SP2- Seed Copy & Decode
    document.getElementById('copySeedBtn')?.addEventListener('click', () => {
        const code = document.getElementById('vectorSeedCode')?.value;
        if (code) copyTextToClipboard(code, 'Copied live SP2 Vector Seed!');
    });

    document.getElementById('decodeSeedBtn')?.addEventListener('click', () => {
        const input = document.getElementById('vectorSeedCode')?.value || '';
        const res = decodeSeedDetailed(input, state);
        if (res.ok) {
            if (cipherInputEl) cipherInputEl.value = state.encodedMessage || '';
            if (motionPhraseEl) motionPhraseEl.value = state.encodedMessage || '';
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
}
