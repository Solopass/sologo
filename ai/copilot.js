/**
 * AI Studio Co-Pilot (Local OpenAI-compatible server + explicit heuristic fallback),
 * AI Themes / Vault Modal, and window.SOLOPASS_API automation bridge.
 */
import { state, escapeXml } from '../core/state.js';
import { encodeStateToCode, decodeCodeToState } from '../core/seed.js';
import { encodeMessageToState } from '../core/cipher.js';
import { applyLocksToState, getLockedSummaryLabel } from '../core/locks.js';
import { generateSVGString } from '../core/geometry.js';
import { render, syncInputsFromState, showToast } from '../ui/render.js';

const AI_GENERATED_PRESETS = [
    {"title": "Cyber Core", "message": "CYBER_CORE", "description": "High-contrast neon matrix aesthetic with sharp wing structures", "state": {"circleRadius": 52, "ringStrokeWidth": 14, "ringFillOpacity": 0.25, "ringGapDeg": 60, "ringRotate": 0, "wingStrokeWidth": 10, "wingGap": 12, "topWingLen": 165, "botWingLen": 155, "wingSpacing": 18, "wingOffsetY": 4, "botInnerInset": 15, "wingAngle": -12, "wingCurve": 18, "tripleWing": true, "strokeColor": "#00F3FF", "secondaryColor": "#7000FF", "useGradient": true, "glowBlur": 20, "glowOpacity": 0.85}},
    {"title": "Quantum Pulse", "message": "QUANTUM_PULSE", "description": "Deep cyan electromagnetic resonance field with portal opening", "state": {"circleRadius": 68, "ringStrokeWidth": 14, "ringFillOpacity": 0.35, "ringGapDeg": 135, "ringRotate": 45, "wingStrokeWidth": 9, "wingGap": 28, "topWingLen": 165, "botWingLen": 145, "wingSpacing": 22, "wingOffsetY": 8, "botInnerInset": 18, "wingAngle": 12, "wingCurve": 24, "tripleWing": true, "strokeColor": "#00F2FF", "secondaryColor": "#7000FF", "useGradient": true, "glowBlur": 22, "glowOpacity": 0.85}},
    {"title": "Chrono Shift", "message": "CHRONO_SHIFT", "description": "Golden amber temporal anomaly with asymmetric wing sweep", "state": {"circleRadius": 68, "ringStrokeWidth": 12, "ringFillOpacity": 0.35, "ringGapDeg": 45, "ringRotate": -30, "wingStrokeWidth": 9, "wingGap": 18, "topWingLen": 175, "botWingLen": 150, "wingSpacing": 22, "wingOffsetY": 8, "botInnerInset": 20, "wingAngle": -12, "wingCurve": 24, "tripleWing": true, "strokeColor": "#00E5FF", "secondaryColor": "#7000FF", "useGradient": true, "glowBlur": 18, "glowOpacity": 0.8}},
    {"title": "Dark Matter", "message": "DARK_MATTER", "description": "Obsidian black void core with faint emerald edge luminescence", "state": {"circleRadius": 62, "ringStrokeWidth": 10, "ringFillOpacity": 0.25, "ringGapDeg": 115, "ringRotate": -42, "wingStrokeWidth": 9, "wingGap": 45, "topWingLen": 165, "botWingLen": 145, "wingSpacing": 28, "wingOffsetY": -8, "botInnerInset": 12, "wingAngle": 7, "wingCurve": 24, "tripleWing": true, "strokeColor": "#1A0B2E", "secondaryColor": "#7B68EE", "useGradient": true, "glowBlur": 22, "glowOpacity": 0.85}},
    {"title": "Hyper Drive", "message": "HYPER_DRIVE", "description": "Sub-light warp velocity flare with triple-wing stabilizers", "state": {"circleRadius": 68, "ringStrokeWidth": 12, "ringFillOpacity": 0.3, "ringGapDeg": 135, "ringRotate": -45, "wingStrokeWidth": 9, "wingGap": 18, "topWingLen": 185, "botWingLen": 165, "wingSpacing": 28, "wingOffsetY": -12, "botInnerInset": 20, "wingAngle": -14, "wingCurve": 24, "tripleWing": true, "strokeColor": "#00F2FF", "secondaryColor": "#7000FF", "useGradient": true, "glowBlur": 25, "glowOpacity": 0.85}},
    {"title": "Nebula Gate", "message": "NEBULA_GATE", "description": "Cosmic violet and rose stellar corridor with sweeping wings", "state": {"circleRadius": 50, "ringStrokeWidth": 5, "ringFillOpacity": 0.15, "ringGapDeg": 90, "ringRotate": 45, "wingStrokeWidth": 6, "wingGap": 16, "topWingLen": 125, "botWingLen": 88, "wingSpacing": 20, "wingOffsetY": -4, "botInnerInset": 10, "wingAngle": -6, "wingCurve": 14, "tripleWing": true, "strokeColor": "#8A2BE2", "secondaryColor": "#00FFFF", "useGradient": true, "glowBlur": 18, "glowOpacity": 0.85}},
    {"title": "Synth Horizon", "message": "SYNTH_HORIZON", "description": "Outrun synthwave sunset gradient with low wing spread", "state": {"circleRadius": 58, "ringStrokeWidth": 6, "ringFillOpacity": 0.2, "ringGapDeg": 15, "ringRotate": 15, "wingStrokeWidth": 7, "wingGap": 18, "topWingLen": 140, "botWingLen": 95, "wingSpacing": 22, "wingOffsetY": 6, "botInnerInset": 12, "wingAngle": 4, "wingCurve": 14, "tripleWing": true, "strokeColor": "#00F3FF", "secondaryColor": "#FF00FF", "useGradient": true, "glowBlur": 20, "glowOpacity": 0.9}},
    {"title": "Zero Point", "message": "ZERO_POINT", "description": "Minimalist monochromatic quantum vacuum state with thin lines", "state": {"circleRadius": 42, "ringStrokeWidth": 4, "ringFillOpacity": 0.05, "ringGapDeg": 0, "ringRotate": 0, "wingStrokeWidth": 4, "wingGap": 20, "topWingLen": 105, "botWingLen": 75, "wingSpacing": 20, "wingOffsetY": 0, "botInnerInset": 8, "wingAngle": 0, "wingCurve": 0, "tripleWing": false, "strokeColor": "#FFFFFF", "secondaryColor": "#888888", "useGradient": false, "glowBlur": 8, "glowOpacity": 0.7}},
    {"title": "Solar Flare", "message": "SOLAR_FLARE", "description": "Blazing plasma corona with maximum wing extension", "state": {"circleRadius": 60, "ringStrokeWidth": 8, "ringFillOpacity": 0.25, "ringGapDeg": 75, "ringRotate": 45, "wingStrokeWidth": 8, "wingGap": 24, "topWingLen": 175, "botWingLen": 125, "wingSpacing": 26, "wingOffsetY": -5, "botInnerInset": 15, "wingAngle": -8, "wingCurve": 18, "tripleWing": true, "strokeColor": "#FF4500", "secondaryColor": "#FFD700", "useGradient": true, "glowBlur": 24, "glowOpacity": 0.95}},
    {"title": "Apex Signal", "message": "APEX_SIGNAL", "description": "High-frequency encrypted beacon with balanced harmonic arcs", "state": {"circleRadius": 48, "ringStrokeWidth": 7, "ringFillOpacity": 0.15, "ringGapDeg": 35, "ringRotate": -15, "wingStrokeWidth": 7, "wingGap": 22, "topWingLen": 135, "botWingLen": 95, "wingSpacing": 22, "wingOffsetY": 2, "botInnerInset": 8, "wingAngle": 0, "wingCurve": 8, "tripleWing": true, "strokeColor": "#00F2FF", "secondaryColor": "#FFFFFF", "useGradient": true, "glowBlur": 16, "glowOpacity": 0.85}}
];

export function initCopilot({
    pushHistory,
    timelineApi
}) {
    const {
        getMotionTimeline,
        setMotionTimeline,
        getIsTimelinePlaying,
        getIsMorphLoopActive,
        stopTimelinePlayback,
        stopSmoothMorphLoop,
        applyInterpolatedTimeline,
        captureAnimatableSnapshot,
        renderKeyframeStrip
    } = timelineApi;

    function setAiModeStatus(connected, labelText) {
        const badge = document.getElementById('localAiStatusBadge');
        const dot = document.getElementById('localAiStatusDot');
        const textEl = document.getElementById('localAiStatusText');
        const noticeEl = document.getElementById('aiModeNotice');
        if (!badge || !dot || !textEl) return;

        if (connected) {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]';
            textEl.textContent = labelText || 'Local AI Connected';
            badge.className = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-400/30';
            if (noticeEl) {
                noticeEl.textContent = 'Connected to local OpenAI-compatible server at 127.0.0.1:11440.';
                noticeEl.className = 'text-[10px] text-emerald-300/80';
            }
        } else {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-400';
            textEl.textContent = labelText || 'Heuristic Mode';
            badge.className = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-amber-500/15 text-amber-200 border border-amber-400/30';
            if (noticeEl) {
                noticeEl.textContent = 'Local model not running – using heuristic mode (start an OpenAI-compatible server at 127.0.0.1:11440 for LLM generation).';
                noticeEl.className = 'text-[10px] text-amber-300/85';
            }
        }
    }

    async function checkLocalAiHealth() {
        const selectEl = document.getElementById('aiModelSelect');
        if (selectEl && selectEl.value === 'heuristic') {
            setAiModeStatus(false, 'Heuristic Mode');
            return false;
        }
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 1400);
            const res = await fetch('http://127.0.0.1:11440/v1/models', { signal: ctrl.signal });
            clearTimeout(timer);
            if (res.ok) {
                setAiModeStatus(true, 'Local AI Connected');
                return true;
            }
        } catch (err) {
            console.info('[SOLOPASS] Local AI server not reachable at 127.0.0.1:11440; heuristic mode active.', err?.name || '');
        }
        setAiModeStatus(false, 'Heuristic Mode');
        return false;
    }

    document.getElementById('aiModelSelect')?.addEventListener('change', checkLocalAiHealth);
    checkLocalAiHealth();

    async function generateAiMotion(rawPrompt) {
        if (!rawPrompt || !rawPrompt.trim()) {
            showToast('Enter an animation or design prompt first');
            return;
        }
        const modelChoice = document.getElementById('aiModelSelect')?.value || 'sol-fast';
        const btn = document.getElementById('aiGenerateMotionBtn');
        const spinner = document.getElementById('aiBtnSpinner');
        const label = document.getElementById('aiBtnLabel');

        if (modelChoice !== 'heuristic') {
            if (spinner) spinner.classList.remove('hidden');
            if (label) label.textContent = 'Thinking...';
            if (btn) btn.disabled = true;

            try {
                const systemPrompt = `You are the SOLOPASS Vector Motion Choreographer. Given a user prompt, output ONLY a strict JSON object with keys:
- "title": short 2-3 word animation name
- "durationSec": number between 1.5 and 6.0
- "easing": one of ["easeInOutCubic", "spring", "easeOutBack", "easeInOutExpo", "linear"]
- "playMode": one of ["loop", "pingpong", "once"]
- "keyframes": array of 3 to 5 objects, each with "label" (string) and "state" (partial object using any of: circleRadius [20..72], ringStrokeWidth [2..18], ringFillOpacity [0..0.5], ringGapDeg [0..160], ringRotate [-180..180], innerRingRadius [0..38], wingStrokeWidth [2..18], wingGap [8..70], topWingLen [40..190], botWingLen [30..170], wingSpacing [10..46], wingOffsetY [-20..20], botInnerInset [0..35], wingAngle [-15..15], wingCurve [-28..28], wingBalance [-35..35], glowBlur [0..30], glowOpacity [0.1..1], strokeColor hex, secondaryColor hex, useGradient boolean, tripleWing boolean).
Start and end smoothly if looping.`;

                const response = await fetch('http://127.0.0.1:11440/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: modelChoice,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: rawPrompt }
                        ],
                        max_tokens: 2048,
                        temperature: 0.7
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    let text = data.choices?.[0]?.message?.content?.trim() || '';
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) text = jsonMatch[0];
                    const parsed = JSON.parse(text);

                    const llmEncodeMatch = rawPrompt.match(/(?:encode|cipher|hide|embed)\s+['"“]([^'"”]+)['"”]/i)
                        || rawPrompt.match(/(?:encode|cipher)\s+([a-zA-Z0-9_-]{2,24})/i);
                    if (llmEncodeMatch && llmEncodeMatch[1]) {
                        const msg = llmEncodeMatch[1].trim();
                        const cipherInput = document.getElementById('cipherMessageInput');
                        if (cipherInput) cipherInput.value = msg;
                        encodeMessageToState(msg, state);
                    }

                    if (Array.isArray(parsed.keyframes) && parsed.keyframes.length >= 2) {
                        const anchor = { ...state };
                        const base = captureAnimatableSnapshot().state;
                        const tl = getMotionTimeline();
                        tl.durationSec = parsed.durationSec || 3.0;
                        tl.easing = parsed.easing || 'easeInOutCubic';
                        if (parsed.playMode && ['loop', 'pingpong', 'once'].includes(parsed.playMode)) {
                            tl.playMode = parsed.playMode;
                        }
                        tl.keyframes = parsed.keyframes.map((kf, i) => ({
                            label: kf.label || `Pose ${i + 1}`,
                            easing: tl.easing,
                            state: applyLocksToState({ ...base, ...(kf.state || {}) }, anchor)
                        }));
                        setMotionTimeline(tl);
                        pushHistory();
                        if (!getIsTimelinePlaying()) document.getElementById('playTimelineBtn')?.click();
                        setAiModeStatus(true, 'Local AI Connected');
                        showToast(`AI (${modelChoice}) generated ${tl.keyframes.length} keyframes for "${parsed.title || rawPrompt}"!`);
                        return;
                    }
                }
            } catch (err) {
                console.warn('[SOLOPASS] Local LLM generation failed, falling back to heuristic:', err);
                setAiModeStatus(false, 'Heuristic Mode');
                showToast('Local model not running – using heuristic mode');
            } finally {
                if (spinner) spinner.classList.add('hidden');
                if (label) label.textContent = 'AI Run';
                if (btn) btn.disabled = false;
            }
        }

        // Heuristic Fallback Animator
        const p = rawPrompt.toLowerCase();
        const actions = [];
        const encodeMatch = rawPrompt.match(/(?:encode|cipher|hide|embed)\s+['"“]([^'"”]+)['"”]/i)
            || rawPrompt.match(/(?:encode|cipher)\s+([a-zA-Z0-9_-]{2,24})/i);
        if (encodeMatch && encodeMatch[1]) {
            const msg = encodeMatch[1].trim();
            const cipherInput = document.getElementById('cipherMessageInput');
            if (cipherInput) cipherInput.value = msg;
            encodeMessageToState(msg, state);
            actions.push(`encoded "${msg}"`);
        }
        if (p.includes('triple') || p.includes('3-wing') || p.includes('three wing')) {
            state.tripleWing = true;
            actions.push('enabled 3-wing tier');
        }
        if (p.includes('wordmark') || p.includes('text')) {
            state.showText = true;
            actions.push('enabled wordmark');
        }

        const base = captureAnimatableSnapshot().state;
        const peak = { ...base };
        let title = 'Heuristic Sequence';

        if (p.includes('portal') || p.includes('open') || p.includes('spin')) {
            peak.ringGapDeg = 95;
            peak.ringRotate = 90;
            peak.wingGap = Math.min(58, base.wingGap + 14);
            peak.glowBlur = 20;
            title = 'Portal Open';
        }
        if (p.includes('flare') || p.includes('sweep') || p.includes('arc') || p.includes('wing') || p.includes('fly')) {
            peak.topWingLen = Math.min(185, base.topWingLen + 36);
            peak.botWingLen = Math.min(165, base.botWingLen + 28);
            peak.wingAngle = -7;
            peak.wingCurve = 14;
            title = 'Wing Flare';
        }
        if (p.includes('pulse') || p.includes('glow') || p.includes('neon') || p.includes('surge')) {
            peak.glowBlur = 26;
            peak.ringFillOpacity = 0.22;
            peak.ringStrokeWidth = Math.min(14, base.ringStrokeWidth + 3);
            title = 'Neon Surge';
        }
        if (p.includes('cyan') || p.includes('blue') || p.includes('cyber')) {
            peak.strokeColor = '#38bdf8';
            peak.secondaryColor = '#818cf8';
            peak.useGradient = true;
        }
        if (p.includes('violet') || p.includes('purple') || p.includes('pink')) {
            peak.strokeColor = '#a855f7';
            peak.secondaryColor = '#ec4899';
            peak.useGradient = true;
        }
        const tl = getMotionTimeline();
        if (p.includes('spring') || p.includes('bounce')) {
            tl.easing = 'spring';
            const easeEl = document.getElementById('timelineEasingSelect');
            if (easeEl) easeEl.value = 'spring';
        }
        if (p.includes('ping') || p.includes('boomerang')) {
            tl.playMode = 'pingpong';
            const modeEl = document.getElementById('timelinePlayMode');
            if (modeEl) modeEl.value = 'pingpong';
        }
        if (peak.ringGapDeg === base.ringGapDeg && peak.topWingLen === base.topWingLen && peak.glowBlur === base.glowBlur) {
            peak.ringGapDeg = 55;
            peak.topWingLen = Math.min(180, base.topWingLen + 24);
            peak.wingCurve = 9;
            peak.glowBlur = 19;
        }

        const anchor = { ...state };
        const lockedPeak = applyLocksToState(peak, anchor);
        const lockedBase = applyLocksToState(base, anchor);
        Object.assign(state, lockedBase);
        tl.keyframes = [
            { label: 'Origin', easing: tl.easing, state: { ...lockedBase } },
            { label: title, easing: tl.easing, state: lockedPeak },
            { label: 'Return', easing: tl.easing, state: { ...lockedBase } }
        ];
        setMotionTimeline(tl);
        pushHistory();
        if (!getIsTimelinePlaying()) document.getElementById('playTimelineBtn')?.click();
        const extra = actions.length ? ` + ${actions.join(', ')}` : '';
        showToast(`Heuristic Mode: ${title}${extra}${getLockedSummaryLabel()}`);
    }

    document.getElementById('aiGenerateMotionBtn')?.addEventListener('click', () => {
        generateAiMotion(document.getElementById('aiMotionPrompt')?.value || '');
    });
    document.getElementById('aiMotionPrompt')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') generateAiMotion(e.target.value);
    });
    document.querySelectorAll('.ai-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const promptEl = document.getElementById('aiMotionPrompt');
            if (promptEl) promptEl.value = chip.dataset.aiChip || '';
            generateAiMotion(chip.dataset.aiChip || '');
        });
    });

    // AI Themes & Saved Vault Modal
    const openAiPresetsBtn = document.getElementById('openAiPresetsBtn');
    const aiPresetsModal = document.getElementById('aiPresetsModal');
    const closeAiPresetsBtn = document.getElementById('closeAiPresetsBtn');
    const aiPresetsList = document.getElementById('aiPresetsList');
    const tabAiThemesBtn = document.getElementById('tabAiThemesBtn');
    const tabSavedVaultBtn = document.getElementById('tabSavedVaultBtn');
    const vaultCountBadge = document.getElementById('vaultCountBadge');
    const saveToVaultBtn = document.getElementById('saveToVaultBtn');
    const quickSaveVaultBtn = document.getElementById('quickSaveVaultBtn');
    let activePresetsTab = 'themes';

    function getSavedVault() {
        try { return JSON.parse(localStorage.getItem('solopass_vault') || '[]'); } catch { return []; }
    }
    function setSavedVault(items) {
        try { localStorage.setItem('solopass_vault', JSON.stringify(items)); } catch {}
        if (vaultCountBadge) vaultCountBadge.textContent = String(items.length);
    }
    setSavedVault(getSavedVault());

    function saveCurrentToVault() {
        const items = getSavedVault();
        const seed = document.getElementById('motionSeedInput')?.value || encodeStateToCode(state).slice(0, 12);
        const msg = state.encodedMessage || '';
        const entry = {
            id: 'v_' + Date.now(),
            title: msg ? `Saved (${msg})` : `Logo #${seed}`,
            seed,
            message: msg,
            createdAt: new Date().toLocaleTimeString(),
            state: { ...state },
            timeline: JSON.parse(JSON.stringify(getMotionTimeline()))
        };
        items.unshift(entry);
        setSavedVault(items.slice(0, 30));
        if (activePresetsTab === 'vault') renderSavedVault();
        showToast(`Saved "${entry.title}" to Vault ⭐`);
    }

    function renderSavedVault() {
        if (!aiPresetsList) return;
        const items = getSavedVault();
        aiPresetsList.innerHTML = '';
        if (items.length === 0) {
            aiPresetsList.innerHTML = '<div class="text-center py-8 text-xs text-gray-400">Your Vault is empty. Click <strong>⭐ Save</strong> or <strong>+ Save Current</strong> to save any logo, seed, or timeline!</div>';
            return;
        }
        items.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'p-3 rounded-xl bg-black/50 hover:bg-white/5 border border-white/10 hover:border-amber-400/40 transition flex items-center justify-between gap-3';
            card.innerHTML = `
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-7 h-7 rounded-lg border border-white/15 shrink-0" style="background: ${item.state.useGradient ? `linear-gradient(135deg, ${item.state.strokeColor}, ${item.state.secondaryColor})` : item.state.strokeColor}"></div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <h4 class="text-xs font-semibold text-white truncate">${escapeXml(item.title)}</h4>
                            <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-400/20">#${escapeXml(String(item.seed))}</span>
                        </div>
                        <p class="text-[10px] text-gray-400">${item.timeline?.keyframes?.length || 0} keyframes · Saved ${item.createdAt}</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" class="vault-apply px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-[10px] font-medium text-sky-200 border border-sky-400/30 transition">Apply</button>
                    <button type="button" class="vault-del px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-[10px] text-rose-300 border border-rose-400/20 transition">✕</button>
                </div>
            `;
            card.querySelector('.vault-apply')?.addEventListener('click', () => {
                if (getIsTimelinePlaying()) stopTimelinePlayback();
                if (getIsMorphLoopActive()) stopSmoothMorphLoop(true);
                const anchor = { ...state };
                Object.assign(state, applyLocksToState(item.state, anchor));
                if (item.timeline && Array.isArray(item.timeline.keyframes) && item.timeline.keyframes.length >= 2) {
                    setMotionTimeline(JSON.parse(JSON.stringify(item.timeline)));
                }
                const cipherInput = document.getElementById('cipherMessageInput');
                if (cipherInput) cipherInput.value = state.encodedMessage || '';
                syncInputsFromState();
                render();
                pushHistory();
                aiPresetsModal?.classList.add('hidden');
                showToast(`Loaded "${item.title}" from Vault!`);
            });
            card.querySelector('.vault-del')?.addEventListener('click', () => {
                setSavedVault(getSavedVault().filter(v => v.id !== item.id));
                renderSavedVault();
            });
            aiPresetsList.appendChild(card);
        });
    }

    function renderAiThemesList() {
        if (!aiPresetsList) return;
        aiPresetsList.innerHTML = '';
        AI_GENERATED_PRESETS.forEach((preset) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'w-full text-left p-3 rounded-xl bg-black/50 hover:bg-sky-500/10 border border-white/10 hover:border-sky-400/40 transition flex items-center justify-between gap-3 group';
            card.innerHTML = `
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-7 h-7 rounded-lg border border-white/15 shrink-0" style="background: linear-gradient(135deg, ${preset.state.strokeColor}, ${preset.state.secondaryColor})"></div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <h4 class="text-xs font-semibold text-white group-hover:text-sky-200 truncate">${escapeXml(preset.title)}</h4>
                            <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">${escapeXml(preset.message)}</span>
                        </div>
                        <p class="text-[10px] text-gray-400 truncate">${escapeXml(preset.description)}</p>
                    </div>
                </div>
                <span class="text-[10px] font-mono text-sky-400 opacity-0 group-hover:opacity-100 transition shrink-0">Apply →</span>
            `;
            card.addEventListener('click', () => {
                if (getIsTimelinePlaying()) stopTimelinePlayback();
                const anchor = { ...state };
                const nextState = applyLocksToState({ ...state, wingBalance: 0, lineCap: 'round', showText: false, ...preset.state }, anchor);
                Object.assign(state, nextState);
                state.encodedMessage = preset.message;
                const cipherInput = document.getElementById('cipherMessageInput');
                if (cipherInput) cipherInput.value = preset.message;
                syncInputsFromState();
                render();
                pushHistory();
                aiPresetsModal?.classList.add('hidden');
                showToast(`Applied AI Theme "${preset.title}" (${preset.message})`);
            });
            aiPresetsList.appendChild(card);
        });
    }

    function switchPresetsTab(tab) {
        activePresetsTab = tab;
        const isThemes = tab === 'themes';
        if (tabAiThemesBtn) {
            tabAiThemesBtn.className = isThemes
                ? 'px-3 py-1 rounded-lg bg-sky-500/20 border border-sky-400/40 text-xs font-semibold text-sky-200 transition'
                : 'px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-gray-400 hover:text-white transition';
        }
        if (tabSavedVaultBtn) {
            tabSavedVaultBtn.className = !isThemes
                ? 'px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-xs font-semibold text-amber-200 transition flex items-center gap-1'
                : 'px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-gray-400 hover:text-white transition flex items-center gap-1';
        }
        if (isThemes) renderAiThemesList();
        else renderSavedVault();
    }

    tabAiThemesBtn?.addEventListener('click', () => switchPresetsTab('themes'));
    tabSavedVaultBtn?.addEventListener('click', () => switchPresetsTab('vault'));
    saveToVaultBtn?.addEventListener('click', saveCurrentToVault);
    quickSaveVaultBtn?.addEventListener('click', saveCurrentToVault);

    openAiPresetsBtn?.addEventListener('click', () => {
        switchPresetsTab('themes');
        aiPresetsModal?.classList.remove('hidden');
    });
    closeAiPresetsBtn?.addEventListener('click', () => aiPresetsModal?.classList.add('hidden'));
    aiPresetsModal?.addEventListener('click', (e) => {
        if (e.target.id === 'aiPresetsModal') aiPresetsModal.classList.add('hidden');
    });

    // Programmatic Agent Bridge
    window.SOLOPASS_API = {
        getState: () => ({ ...state }),
        setState: (patch) => {
            Object.assign(state, patch || {});
            syncInputsFromState();
            render();
            pushHistory();
            return encodeStateToCode(state);
        },
        encodeCipher: (msg) => {
            const cipherInput = document.getElementById('cipherMessageInput');
            if (cipherInput) cipherInput.value = msg || '';
            const res = encodeMessageToState(msg, state);
            if (res.ok) {
                syncInputsFromState();
                render();
                pushHistory();
            }
            return encodeStateToCode(state);
        },
        getSeed: () => encodeStateToCode(state),
        loadSeed: (seed) => {
            const ok = decodeCodeToState(seed, state);
            if (ok) {
                const cipherInput = document.getElementById('cipherMessageInput');
                if (cipherInput) cipherInput.value = state.encodedMessage || '';
                syncInputsFromState();
                render();
                pushHistory();
            }
            return ok;
        },
        setTimeline: (timelineObj) => {
            if (!timelineObj || !Array.isArray(timelineObj.keyframes)) return false;
            setMotionTimeline(timelineObj);
            return true;
        },
        getTimeline: () => JSON.parse(JSON.stringify(getMotionTimeline())),
        playTimeline: () => { if (!getIsTimelinePlaying()) document.getElementById('playTimelineBtn')?.click(); },
        pauseTimeline: () => { if (getIsTimelinePlaying()) stopTimelinePlayback(); },
        exportSVG: () => generateSVGString(state, { forExport: true, includeGuides: false })
    };
}
