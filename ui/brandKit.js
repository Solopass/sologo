/**
 * Channel Brand Kit persistence (localStorage) & 1-click recall UI.
 */
import { state } from '../core/state.js';
import { render, syncInputsFromState, showToast } from './render.js';

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

export function initBrandKit({ pushHistory }) {
    const cipherInputEl = document.getElementById('cipherMessageInput');
    const motionPhraseEl = document.getElementById('motionPhraseInput');

    function renderBrandKitStrip() {
        const strip = document.getElementById('brandKitStrip');
        if (!strip) return;
        const kits = loadBrandKits();
        strip.innerHTML = '';
        if (kits.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'text-[10px] text-gray-400';
            empty.textContent = 'Save colors, style & wordmark for 1-click recall.';
            strip.appendChild(empty);
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
                if (typeof kit.encodedMessage === 'string') {
                    state.encodedMessage = kit.encodedMessage;
                    if (cipherInputEl) cipherInputEl.value = kit.encodedMessage;
                    if (motionPhraseEl) motionPhraseEl.value = kit.encodedMessage;
                }
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
}
