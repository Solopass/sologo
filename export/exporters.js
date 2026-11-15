/**
 * Export & Import handlers: SVG, PNG (with embedded SP2 tEXt chunk), 512px Icon,
 * zero-dependency Animated .GIF (GIF89a), .WEBM video, Animated .SVG, and .SPMOTION JSON.
 */
import { state, escapeXml } from '../core/state.js';
import { encodeStateToCode, decodeSeedDetailed } from '../core/seed.js';
import { generateSVGString } from '../core/geometry.js';
import { render, syncInputsFromState, showToast } from '../ui/render.js';

export async function copyTextToClipboard(text, successMessage) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            showToast(successMessage);
            return true;
        }
    } catch (err) {
        console.warn('[SOLOPASS] Clipboard API fallback:', err);
    }
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) {
            showToast(successMessage);
            return true;
        }
    } catch (err) {
        console.error('[SOLOPASS] Copy failed:', err);
    }
    showToast('Clipboard copy failed in this browser context', 'error');
    return false;
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function injectPngTextChunk(pngBuffer, keyword, text) {
    const src = new Uint8Array(pngBuffer);
    const keyBytes = new TextEncoder().encode(keyword);
    const valBytes = new TextEncoder().encode(text);
    const dataLen = keyBytes.length + 1 + valBytes.length;

    const chunk = new Uint8Array(12 + dataLen);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, dataLen);
    chunk.set([116, 69, 88, 116], 4); // "tEXt"
    chunk.set(keyBytes, 8);
    chunk[8 + keyBytes.length] = 0;
    chunk.set(valBytes, 9 + keyBytes.length);
    view.setUint32(8 + dataLen, crc32(chunk.subarray(4, 8 + dataLen)));

    const iendOffset = src.length - 12;
    const out = new Uint8Array(src.length + chunk.length);
    out.set(src.subarray(0, iendOffset), 0);
    out.set(chunk, iendOffset);
    out.set(src.subarray(iendOffset), iendOffset + chunk.length);
    return out;
}

function extractPngTextChunk(pngBuffer, keyword) {
    const bytes = new Uint8Array(pngBuffer);
    const view = new DataView(pngBuffer);
    let offset = 8;
    while (offset + 8 < bytes.length) {
        const len = view.getUint32(offset);
        const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
        if (type === 'tEXt') {
            const data = bytes.subarray(offset + 8, offset + 8 + len);
            const nul = data.indexOf(0);
            if (nul > 0) {
                const key = new TextDecoder().decode(data.subarray(0, nul));
                if (key === keyword) {
                    return new TextDecoder().decode(data.subarray(nul + 1));
                }
            }
        }
        if (type === 'IEND') break;
        offset += 12 + len;
    }
    return null;
}

function exportCanvasWithSeed(canvas, filename, toastMsg) {
    canvas.toBlob(async (blob) => {
        if (!blob) {
            showToast('Failed to render PNG blob', 'error');
            return;
        }
        try {
            const buf = await blob.arrayBuffer();
            const patched = injectPngTextChunk(buf, 'solopass-seed', encodeStateToCode(state));
            triggerDownload(new Blob([patched], { type: 'image/png' }), filename);
            showToast(toastMsg);
        } catch (err) {
            console.error('[SOLOPASS] PNG seed embed failed:', err);
            triggerDownload(blob, filename);
            showToast(toastMsg);
        }
    }, 'image/png');
}

function buildAdaptivePalette(framesRgba, transparent) {
    const maxColors = transparent ? 255 : 256;
    const hist = new Uint32Array(32768);
    const sumR = new Uint32Array(32768);
    const sumG = new Uint32Array(32768);
    const sumB = new Uint32Array(32768);

    const frameStep = framesRgba.length > 24 ? 2 : 1;
    for (let f = 0; f < framesRgba.length; f += frameStep) {
        const rgba = framesRgba[f];
        for (let p = 0; p < rgba.length; p += 8) {
            if (transparent && rgba[p + 3] < 112) continue;
            const r = rgba[p];
            const g = rgba[p + 1];
            const b = rgba[p + 2];
            const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
            hist[key]++;
            sumR[key] += r;
            sumG[key] += g;
            sumB[key] += b;
        }
    }

    const active = [];
    for (let k = 0; k < 32768; k++) {
        if (hist[k] > 0) active.push(k);
    }

    if (active.length === 0) {
        const fallback = [[13, 13, 22], [107, 102, 255], [56, 189, 248], [255, 255, 255]];
        while (fallback.length < 256) fallback.push([0, 0, 0]);
        return fallback;
    }

    const makeBox = (keys) => {
        let minR = 31, maxR = 0, minG = 31, maxG = 0, minB = 31, maxB = 0, pop = 0;
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            const r = (k >> 10) & 31, g = (k >> 5) & 31, b = k & 31;
            if (r < minR) minR = r; if (r > maxR) maxR = r;
            if (g < minG) minG = g; if (g > maxG) maxG = g;
            if (b < minB) minB = b; if (b > maxB) maxB = b;
            pop += hist[k];
        }
        return { keys, minR, maxR, minG, maxG, minB, maxB, pop };
    };

    const boxes = [makeBox(active)];
    while (boxes.length < maxColors) {
        let bestIdx = -1;
        let bestSpan = 0;
        for (let i = 0; i < boxes.length; i++) {
            const bx = boxes[i];
            if (bx.keys.length < 2) continue;
            const span = Math.max(bx.maxR - bx.minR, bx.maxG - bx.minG, bx.maxB - bx.minB);
            if (span > bestSpan) {
                bestSpan = span;
                bestIdx = i;
            }
        }
        if (bestIdx === -1) break;
        const bx = boxes[bestIdx];
        const rSpan = bx.maxR - bx.minR;
        const gSpan = bx.maxG - bx.minG;
        const bSpan = bx.maxB - bx.minB;
        const shift = rSpan >= gSpan && rSpan >= bSpan ? 10 : (gSpan >= bSpan ? 5 : 0);
        bx.keys.sort((a, b) => ((a >> shift) & 31) - ((b >> shift) & 31));
        const mid = Math.max(1, bx.keys.length >> 1);
        boxes.splice(bestIdx, 1, makeBox(bx.keys.slice(0, mid)), makeBox(bx.keys.slice(mid)));
    }

    const palette = boxes.map((bx) => {
        let tr = 0, tg = 0, tb = 0, cnt = 0;
        for (let i = 0; i < bx.keys.length; i++) {
            const k = bx.keys[i];
            tr += sumR[k];
            tg += sumG[k];
            tb += sumB[k];
            cnt += hist[k];
        }
        return cnt > 0
            ? [Math.round(tr / cnt), Math.round(tg / cnt), Math.round(tb / cnt)]
            : [0, 0, 0];
    });
    while (palette.length < 256) palette.push([0, 0, 0]);
    return palette;
}

export function encodeGif89a(framesRgba, width, height, delayCs = 5, { transparent = false } = {}) {
    const out = [];
    const pushStr = (s) => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); };
    const pushU16 = (v) => { out.push(v & 0xff, (v >> 8) & 0xff); };

    const palette = buildAdaptivePalette(framesRgba, transparent);
    const activeCount = transparent ? 255 : 256;
    const lut555 = new Uint16Array(32768);
    const findClosestColor = (r, g, b) => {
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        const cached = lut555[key];
        if (cached !== 0) return cached - 1;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < activeCount; i++) {
            const pr = palette[i][0], pg = palette[i][1], pb = palette[i][2];
            const dist = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
                if (dist === 0) break;
            }
        }
        lut555[key] = bestIdx + 1;
        return bestIdx;
    };

    pushStr('GIF89a');
    pushU16(width);
    pushU16(height);
    out.push(0xf7, 0x00, 0x00);

    for (let i = 0; i < 256; i++) {
        out.push(palette[i][0], palette[i][1], palette[i][2]);
    }

    out.push(0x21, 0xff, 0x0b);
    pushStr('NETSCAPE2.0');
    out.push(0x03, 0x01, 0x00, 0x00, 0x00);

    const bayer = [0, 2, 3, 1];
    const writeLzwFrame = (rgba) => {
        const len = width * height;
        const indices = new Uint8Array(len);
        for (let y = 0; y < height; y++) {
            const rowOff = y * width;
            const by = (y & 1) << 1;
            for (let x = 0; x < width; x++) {
                const p = (rowOff + x) << 2;
                if (transparent && rgba[p + 3] < 112) {
                    indices[rowOff + x] = 255;
                    continue;
                }
                const isFlatDarkBg = rgba[p] < 24 && rgba[p + 1] < 24 && rgba[p + 2] < 32;
                const d = isFlatDarkBg ? 0 : (bayer[by | (x & 1)] - 1.5) * 10;
                const r = Math.max(0, Math.min(255, rgba[p] + d));
                const g = Math.max(0, Math.min(255, rgba[p + 1] + d));
                const b = Math.max(0, Math.min(255, rgba[p + 2] + d));
                indices[rowOff + x] = findClosestColor(r, g, b);
            }
        }

        out.push(0x08);
        let bitBuf = 0;
        let bitCount = 0;
        const subBlock = [];
        const flushSubBlock = () => {
            if (subBlock.length > 0) {
                out.push(subBlock.length);
                for (let i = 0; i < subBlock.length; i++) out.push(subBlock[i]);
                subBlock.length = 0;
            }
        };
        const writeBits = (code, size) => {
            bitBuf |= code << bitCount;
            bitCount += size;
            while (bitCount >= 8) {
                subBlock.push(bitBuf & 0xff);
                bitBuf >>= 8;
                bitCount -= 8;
                if (subBlock.length === 255) flushSubBlock();
            }
        };

        const clearCode = 256;
        const eoiCode = 257;
        let codeSize = 9;
        let nextCode = 258;
        const dict = new Map();

        writeBits(clearCode, codeSize);
        let prefix = indices[0];
        for (let i = 1; i < len; i++) {
            const c = indices[i];
            const key = (prefix << 8) | c;
            const found = dict.get(key);
            if (found !== undefined) {
                prefix = found;
            } else {
                writeBits(prefix, codeSize);
                if (nextCode < 4096) {
                    dict.set(key, nextCode++);
                    if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
                } else {
                    writeBits(clearCode, codeSize);
                    dict.clear();
                    nextCode = 258;
                    codeSize = 9;
                }
                prefix = c;
            }
        }
        writeBits(prefix, codeSize);
        writeBits(eoiCode, codeSize);
        if (bitCount > 0) subBlock.push(bitBuf & 0xff);
        flushSubBlock();
        out.push(0x00);
    };

    for (const rgba of framesRgba) {
        out.push(0x21, 0xf9, 0x04, transparent ? 0x09 : 0x04);
        pushU16(delayCs);
        out.push(transparent ? 0xff : 0x00, 0x00);
        out.push(0x2c);
        pushU16(0);
        pushU16(0);
        pushU16(width);
        pushU16(height);
        out.push(0x00);
        writeLzwFrame(rgba);
    }

    out.push(0x3b);
    return new Uint8Array(out);
}

export function buildZipBlob(entries) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
        const crc = crc32(data);

        const local = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true);
        lv.setUint16(6, 0, true);
        lv.setUint16(8, 0, true);
        lv.setUint16(10, 0, true);
        lv.setUint16(12, 0x5421, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, data.length, true);
        lv.setUint32(22, data.length, true);
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true);
        local.set(nameBytes, 30);

        const central = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, 0, true);
        cv.setUint16(14, 0x5421, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0, true);
        cv.setUint32(42, offset, true);
        central.set(nameBytes, 46);

        localParts.push(local, data);
        centralParts.push(central);
        offset += local.length + data.length;
    }

    const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
}

export function initExporters({
    pushHistory,
    getMotionTimeline,
    setMotionTimeline,
    isTimelinePlaying,
    stopTimelinePlayback,
    applyInterpolatedTimeline
}) {
    function resolveOverlaySettings() {
        const bgMode = document.getElementById('exportOverlayBg')?.value || 'studio';
        const bugPos = document.getElementById('exportBugPosition')?.value || 'centered';
        let bgFill = state.bgColor === 'transparent' ? '#0d0d16' : state.bgColor;
        if (bgMode === 'transparent') bgFill = 'transparent';
        else if (bgMode === 'chroma') bgFill = '#00ff00';
        return { bgMode, bgFill, bugPos };
    }

    async function renderTimelineFrameToCanvas(canvas, ctx, prog, bgFill, bugPos = 'centered', timeline = null) {
        applyInterpolatedTimeline(prog, { skipDomRender: true });
        const isBeacon = timeline?.easing === 'step' && typeof state._clockBit === 'number';
        const opticalGridMarkup = isBeacon && window.SoloSyncGrid?.generateGridMarkup
            ? window.SoloSyncGrid.generateGridMarkup(600, state.showText ? 290 : 220, state._clockBit, 0)
            : '';
        const svgMarkup = generateSVGString(state, { forExport: true, includeGuides: false, opticalGridMarkup });
        const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
        const imgUrl = URL.createObjectURL(svgBlob);

        await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (bgFill !== 'transparent') {
                    ctx.fillStyle = bgFill;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                const srcW = img.naturalWidth || 600;
                const srcH = img.naturalHeight || (state.showText ? 290 : 220);
                const aspect = srcH / srcW;

                if (bugPos === 'yt-bottom-left' || bugPos === 'yt-bottom-right') {
                    const bugW = Math.round(canvas.width * 0.25);
                    const bugH = Math.round(bugW * aspect);
                    const padX = Math.round(canvas.width * 0.035);
                    const padY = Math.round(canvas.height * 0.045);
                    const dx = bugPos === 'yt-bottom-left' ? padX : canvas.width - bugW - padX;
                    const dy = canvas.height - bugH - padY;
                    ctx.drawImage(img, dx, dy, bugW, bugH);
                } else {
                    const scale = Math.min(canvas.width / srcW, canvas.height / srcH);
                    const drawW = Math.round(srcW * scale);
                    const drawH = Math.round(srcH * scale);
                    const dx = Math.round((canvas.width - drawW) / 2);
                    const dy = Math.round((canvas.height - drawH) / 2);
                    ctx.drawImage(img, dx, dy, drawW, drawH);
                }
                URL.revokeObjectURL(imgUrl);
                resolve();
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(imgUrl);
                reject(err);
            };
            img.src = imgUrl;
        });
    }

    document.getElementById('copySvgBtn')?.addEventListener('click', () => {
        copyTextToClipboard(generateSVGString(state, { forExport: false, includeGuides: false }), 'Clean SVG code copied to clipboard!');
    });

    document.getElementById('downloadSvgBtn')?.addEventListener('click', () => {
        const svgCode = generateSVGString(state, { forExport: false, includeGuides: false });
        triggerDownload(new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' }), 'solopass-logo.svg');
        showToast('Downloaded solopass-logo.svg');
    });

    document.getElementById('downloadPngBtn')?.addEventListener('click', () => {
        const canvas = document.getElementById('exportCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const svgCode = generateSVGString(state, { forExport: true, includeGuides: false });
        const img = new Image();
        const url = URL.createObjectURL(new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' }));

        img.onload = () => {
            canvas.width = 1800;
            canvas.height = state.showText ? 870 : 660;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            exportCanvasWithSeed(canvas, 'solopass-logo.png', 'Downloaded high-res solopass-logo.png (with embedded SP2 seed)');
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            showToast('PNG export failed — check SVG settings', 'error');
        };
        img.src = url;
    });

    document.getElementById('downloadIconBtn')?.addEventListener('click', () => {
        const canvas = document.getElementById('exportCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const svgCode = generateSVGString({ ...state, showText: false }, { forExport: true, includeGuides: false });
        const img = new Image();
        const url = URL.createObjectURL(new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' }));

        img.onload = () => {
            canvas.width = 512;
            canvas.height = 512;
            ctx.clearRect(0, 0, 512, 512);
            if (state.bgColor !== 'transparent') {
                ctx.fillStyle = state.bgColor;
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') ctx.roundRect(0, 0, 512, 512, 96);
                else ctx.rect(0, 0, 512, 512);
                ctx.fill();
            }
            ctx.drawImage(img, -44, 154, 600, 204);
            URL.revokeObjectURL(url);
            exportCanvasWithSeed(canvas, 'solopass-icon-512.png', 'Downloaded 512x512 solopass-icon-512.png (with embedded SP2 seed)');
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            showToast('Failed to export icon PNG', 'error');
        };
        img.src = url;
    });

    async function renderTimelineToGifBytes(canvas, timeline, bgFill, bugPos, { fps = 18, maxFrames = 90, onProgress = null } = {}) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const totalFrames = Math.max(12, Math.min(maxFrames, Math.round((timeline?.durationSec || 3) * fps)));
        const framesRgba = [];
        for (let f = 0; f < totalFrames; f++) {
            if (onProgress) onProgress(Math.round(((f + 1) / totalFrames) * 100));
            const rawProg = f / totalFrames;
            const prog = timeline.playMode === 'pingpong'
                ? (rawProg <= 0.5 ? rawProg * 2 : (1 - rawProg) * 2)
                : rawProg;
            await renderTimelineFrameToCanvas(canvas, ctx, prog, bgFill, bugPos, timeline);
            framesRgba.push(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
        }
        const delayCs = Math.max(2, Math.round(100 / fps));
        return encodeGif89a(framesRgba, canvas.width, canvas.height, delayCs, { transparent: bgFill === 'transparent' });
    }

    async function exportTimelineToGif() {
        const btn = document.getElementById('exportGifBtn');
        const canvas = document.getElementById('exportCanvas');
        if (!canvas) return;
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'GIF 0%';
        }
        showToast('Rendering Animated .GIF...');

        const wasPlaying = isTimelinePlaying();
        stopTimelinePlayback();
        const timeline = getMotionTimeline();
        const { bgFill, bugPos } = resolveOverlaySettings();
        const resVal = parseInt(document.getElementById('webmResSelect')?.value || '1200', 10);
        if (bugPos !== 'centered') {
            canvas.width = 640;
            canvas.height = 360;
        } else if (resVal === 512) {
            canvas.width = 480;
            canvas.height = 480;
        } else {
            canvas.width = 600;
            canvas.height = state.showText ? 290 : 220;
        }

        try {
            const gifBytes = await renderTimelineToGifBytes(canvas, timeline, bgFill, bugPos, {
                fps: 18,
                maxFrames: 90,
                onProgress: (pct) => { if (btn) btn.textContent = `GIF ${pct}%`; }
            });
            if (btn) btn.textContent = 'Encoding...';
            await new Promise(r => setTimeout(r, 10));
            const gifBlob = new Blob([gifBytes], { type: 'image/gif' });
            triggerDownload(gifBlob, 'solopass-animation.gif');
            showToast(`Downloaded solopass-animation.gif (${(gifBlob.size / 1024).toFixed(0)} KB)`);
        } catch (err) {
            console.error('[SOLOPASS] GIF export failed:', err);
            showToast('GIF export failed — check console for details', 'error');
        } finally {
            applyInterpolatedTimeline(0);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            if (wasPlaying) document.getElementById('playTimelineBtn')?.click();
        }
    }

    document.getElementById('exportGifBtn')?.addEventListener('click', exportTimelineToGif);
    document.getElementById('exportGifMenuBtn')?.addEventListener('click', exportTimelineToGif);

    document.getElementById('exportWebmBtn')?.addEventListener('click', async () => {
        if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
            showToast('Video recording (.WEBM) is not supported in this browser', 'error');
            return;
        }
        const btn = document.getElementById('exportWebmBtn');
        const canvas = document.getElementById('exportCanvas');
        if (!btn || !canvas) return;
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Rec...';
        showToast('Rendering .WEBM video loop...');

        const wasPlaying = isTimelinePlaying();
        stopTimelinePlayback();
        const timeline = getMotionTimeline();
        const { bgFill, bugPos } = resolveOverlaySettings();
        const resVal = parseInt(document.getElementById('webmResSelect')?.value || '1200', 10);
        if (bugPos !== 'centered') {
            canvas.width = resVal === 1920 ? 1920 : 1280;
            canvas.height = resVal === 1920 ? 1080 : 720;
        } else if (resVal === 512) {
            canvas.width = 512;
            canvas.height = 512;
        } else if (resVal === 1920) {
            canvas.width = 1920;
            canvas.height = state.showText ? 928 : 704;
        } else {
            canvas.width = 1200;
            canvas.height = state.showText ? 580 : 440;
        }
        const ctx = canvas.getContext('2d', { alpha: true });
        let recorder = null;
        let videoTrack = null;
        const fps = 30;
        try {
            const stream = canvas.captureStream(0);
            videoTrack = stream.getVideoTracks()[0];
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
            recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4500000 });
        } catch (err) {
            console.error('[SOLOPASS] MediaRecorder init failed:', err);
            btn.disabled = false;
            btn.innerHTML = origHtml;
            showToast('Unable to initialize .WEBM recorder', 'error');
            return;
        }

        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        recorder.onerror = (err) => {
            console.error('[SOLOPASS] MediaRecorder error:', err);
            showToast('Video recording failed during capture', 'error');
        };
        recorder.onstop = () => {
            const webmBlob = new Blob(chunks, { type: 'video/webm' });
            triggerDownload(webmBlob, 'solopass-animation.webm');
            applyInterpolatedTimeline(0);
            btn.disabled = false;
            btn.innerHTML = origHtml;
            showToast(`Downloaded solopass-animation.webm (${(webmBlob.size / 1024).toFixed(0)} KB)`);
            if (wasPlaying) document.getElementById('playTimelineBtn')?.click();
        };

        recorder.start(100);
        const totalFrames = Math.max(15, Math.round(timeline.durationSec * fps));
        const frameIntervalMs = 1000 / fps;
        const startPerf = performance.now();

        try {
            for (let f = 0; f <= totalFrames; f++) {
                btn.textContent = `${Math.round((f / totalFrames) * 100)}%`;
                const rawProg = f / totalFrames;
                const prog = timeline.playMode === 'pingpong'
                    ? (rawProg <= 0.5 ? rawProg * 2 : (1 - rawProg) * 2)
                    : rawProg;
                await renderTimelineFrameToCanvas(canvas, ctx, prog, bgFill, bugPos, timeline);
                if (videoTrack && typeof videoTrack.requestFrame === 'function') {
                    videoTrack.requestFrame();
                }
                const targetTime = startPerf + (f + 1) * frameIntervalMs;
                const waitMs = targetTime - performance.now();
                if (waitMs > 1) {
                    await new Promise(r => setTimeout(r, waitMs));
                }
            }
        } catch (err) {
            console.error('[SOLOPASS] .WEBM frame render error:', err);
            showToast('Error rendering .WEBM frame', 'error');
        } finally {
            if (recorder && recorder.state !== 'inactive') recorder.stop();
        }
    });

    document.getElementById('exportAnimatedSvgBtn')?.addEventListener('click', () => {
        const timeline = getMotionTimeline();
        const width = 600;
        const height = state.showText ? 290 : 220;
        const cx = width / 2;
        const cy = state.showText ? 105 : 110;
        const seedCode = encodeStateToCode(state);
        const safeTitle = escapeXml(state.brandText || 'SOLOPASS');
        const timelineJson = JSON.stringify(timeline).replace(/</g, '\\u003c');
        const hasTriple = state.tripleWing || timeline.keyframes.some(k => k.state && k.state.tripleWing);
        const styleMode = state.visualStyle || 'classic';
        const filterAttr = styleMode === 'minimal' ? '' : 'filter="url(#neonGlow)"';
        const hasFlow = (state.energyFlow || 0) > 0 || timeline.keyframes.some(k => k.state && (k.state.energyFlow || 0) > 0);
        const gradStops = styleMode === 'holographic'
            ? `<stop id="gStop1" offset="0%" stop-color="${state.strokeColor}" /><stop offset="30%" stop-color="#38bdf8" /><stop id="gStop2" offset="55%" stop-color="#f472b6" /><stop offset="80%" stop-color="#a78bfa" /><stop id="gStop3" offset="100%" stop-color="${state.secondaryColor}" />`
            : styleMode === 'plasma'
                ? `<stop id="gStop1" offset="0%" stop-color="${state.strokeColor}" /><stop offset="35%" stop-color="#ffffff" stop-opacity="0.95" /><stop id="gStop2" offset="68%" stop-color="${state.secondaryColor}" /><stop id="gStop3" offset="100%" stop-color="${state.strokeColor}" />`
                : `<stop id="gStop1" offset="0%" stop-color="${state.strokeColor}" /><stop id="gStop2" offset="50%" stop-color="${state.secondaryColor}" /><stop id="gStop3" offset="100%" stop-color="${state.strokeColor}" />`;

        const animatedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="${safeTitle} Animated Vector Emblem" data-solopass-seed="${seedCode}">
  <title>${safeTitle} Animated Vector Emblem</title>
  <metadata id="spmotion-data">${escapeXml(JSON.stringify(timeline))}</metadata>
  <defs>
    <linearGradient id="solopassGrad" gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="540" y2="0" gradientTransform="rotate(${state.gradAngle || 0} ${cx} ${cy})">
      ${gradStops}
    </linearGradient>
    <filter id="neonGlow" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur id="glowB1" stdDeviation="${state.glowBlur}" result="blur1" />
      <feGaussianBlur id="glowB2" stdDeviation="${(state.glowBlur * 0.45).toFixed(1)}" result="blur2" />
      <feComponentTransfer in="blur1" result="fadeBlur1">
        <feFuncA id="glowAlpha" type="linear" slope="${state.glowOpacity}" />
      </feComponentTransfer>
      <feMerge><feMergeNode in="fadeBlur1" /><feMergeNode in="blur2" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
  <g id="emblemGroup" ${filterAttr} fill="none" stroke="${(state.useGradient || styleMode === 'plasma' || styleMode === 'holographic') ? 'url(#solopassGrad)' : state.strokeColor}" stroke-linecap="${state.lineCap}" stroke-linejoin="round">
    <circle id="cRing" cx="${cx}" cy="${cy}" r="${state.circleRadius}" stroke-width="${state.ringStrokeWidth}" fill="${state.strokeColor}" fill-opacity="${state.ringFillOpacity}" />
    <g id="lWings"><path id="lTop" stroke-width="${state.wingStrokeWidth}" /><path id="lBot" stroke-width="${state.wingStrokeWidth}" />${hasTriple ? `<path id="l3" stroke-width="${Math.max(2, state.wingStrokeWidth * 0.85)}" />` : ''}</g>
    <g id="rWings"><path id="rTop" stroke-width="${state.wingStrokeWidth}" /><path id="rBot" stroke-width="${state.wingStrokeWidth}" />${hasTriple ? `<path id="r3" stroke-width="${Math.max(2, state.wingStrokeWidth * 0.85)}" />` : ''}</g>
  </g>${hasFlow ? `
  <g id="flowGroup" opacity="0.7" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-dasharray="18 32" stroke-dashoffset="0">
    <g id="flWings"><path id="flTop" stroke-width="2" /><path id="flBot" stroke-width="1.8" /></g>
    <g id="frWings"><path id="frTop" stroke-width="2" /><path id="frBot" stroke-width="1.8" /></g>
  </g>` : ''}
  <script><![CDATA[
    (function(){
      var tl = ${timelineJson};
      var kfs = tl.keyframes || [];
      if (kfs.length < 2) return;
      var keys = ['circleRadius','ringStrokeWidth','ringFillOpacity','ringGapDeg','ringRotate','wingStrokeWidth','wingGap','topWingLen','botWingLen','wingSpacing','wingOffsetY','botInnerInset','wingAngle','wingCurve','wingBalance','glowBlur','glowOpacity','gradAngle','energyFlow'];
      var cx = ${cx}, cy = ${cy}, dur = (tl.durationSec || 3) * 1000;
      var svg = document.documentElement;
      function ease(t, c){
        if(c==='step') return t>=1?1:0;
        if(c==='linear') return t;
        if(c==='easeInOutQuint') return t<0.5?16*t*t*t*t*t:1-Math.pow(-2*t+2,5)/2;
        if(c==='easeOutBack'){var c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);}
        if(c==='easeInOutBack'){var c1=1.70158,c2=c1*1.525;return t<0.5?(Math.pow(2*t,2)*((c2+1)*2*t-c2))/2:(Math.pow(2*t-2,2)*((c2+1)*(t*2-2)+c2)+2)/2;}
        if(c==='easeOutElastic'){if(t===0||t===1)return t;var c4=(2*Math.PI)/3;return Math.pow(2,-10*t)*Math.sin((t*10-0.75)*c4)+1;}
        if(c==='easeOutBounce'){var n1=7.5625,d1=2.75;if(t<1/d1)return n1*t*t;if(t<2/d1){t-=1.5/d1;return n1*t*t+0.75;}if(t<2.5/d1){t-=2.25/d1;return n1*t*t+0.9375;}t-=2.625/d1;return n1*t*t+0.984375;}
        if(c==='easeInOutExpo'){return t===0||t===1?t:(t<0.5?Math.pow(2,20*t-10)/2:(2-Math.pow(2,-20*t+10))/2);}
        if(c==='spring'){if(t===0||t===1)return t;var c4=(2*Math.PI)/3;return t<0.5?-(Math.pow(2,20*t-10)*Math.sin((20*t-11.125)*c4))/2:(Math.pow(2,-20*t+10)*Math.sin((20*t-11.125)*c4))/2+1;}
        return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
      }
      function parseHex(h){var c=(h||'#6b66ff').replace('#','');if(c.length===3)c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2];var n=parseInt(c,16);return[(n>>16)&255,(n>>8)&255,n&255];}
      function lerpC(a,b,t){var p1=parseHex(a),p2=parseHex(b);return '#'+[0,1,2].map(function(i){return Math.max(0,Math.min(255,Math.round(p1[i]+(p2[i]-p1[i])*t))).toString(16).padStart(2,'0');}).join('');}
      function qPath(x1,y1,x2,y2,cv){var mx=(x1+x2)/2,my=(y1+y2)/2-cv;return 'M '+x1.toFixed(1)+' '+y1.toFixed(1)+' Q '+mx.toFixed(1)+' '+my.toFixed(1)+' '+x2.toFixed(1)+' '+y2.toFixed(1);}
      var t0 = performance.now();
      function frame(now){
        var raw = ((now - t0) % dur) / dur;
        var prog = tl.playMode === 'pingpong' ? (raw <= 0.5 ? raw * 2 : (1 - raw) * 2) : raw;
        var a, b, lt, s = {};
        if ((tl.easing || kfs[0].easing) === 'step') {
          var sIdx = Math.min(kfs.length - 1, Math.floor(prog * kfs.length));
          a = kfs[sIdx].state; b = a; lt = 0;
        } else {
          var sc = prog * (kfs.length - 1), idx = Math.min(kfs.length - 2, Math.floor(sc));
          lt = ease(sc - idx, tl.easing || kfs[idx].easing || 'easeInOutCubic');
          a = kfs[idx].state; b = kfs[idx + 1].state;
        }
        keys.forEach(function(k){var v1=typeof a[k]==='number'?a[k]:0,v2=typeof b[k]==='number'?b[k]:v1;s[k]=v1+(v2-v1)*lt;});
        var c1 = lerpC(a.strokeColor, b.strokeColor, lt), c2 = lerpC(a.secondaryColor, b.secondaryColor, lt);
        var gradEl = svg.getElementById('solopassGrad');
        if (gradEl) gradEl.setAttribute('gradientTransform', 'rotate(' + (s.gradAngle || 0).toFixed(1) + ' ' + cx + ' ' + cy + ')');
        var r = s.circleRadius, gap = s.wingGap, bal = (s.wingBalance || 0) / 100, hs = s.wingSpacing / 2, oy = s.wingOffsetY, ins = s.botInnerInset;
        var ltLen = Math.max(15, s.topWingLen*(1-bal)), rtLen = Math.max(15, s.topWingLen*(1+bal));
        var lbLen = Math.max(10, s.botWingLen*(1-bal)), rbLen = Math.max(10, s.botWingLen*(1+bal));
        var ty = cy - hs + oy, by = cy + hs + oy;
        var cRing = svg.getElementById('cRing');
        cRing.setAttribute('r', r.toFixed(2)); cRing.setAttribute('stroke-width', s.ringStrokeWidth.toFixed(2));
        cRing.setAttribute('fill', c1); cRing.setAttribute('fill-opacity', s.ringFillOpacity.toFixed(3));
        var gf = Math.max(0, Math.min(0.45, s.ringGapDeg / 360)), circ = 2 * Math.PI * r;
        if (gf > 0) { cRing.setAttribute('stroke-dasharray', (circ*(1-gf)).toFixed(2)+' '+(circ*gf).toFixed(2)); cRing.setAttribute('transform', 'rotate('+(s.ringRotate+s.ringGapDeg/2).toFixed(1)+' '+cx+' '+cy+')'); }
        else { cRing.removeAttribute('stroke-dasharray'); cRing.removeAttribute('transform'); }
        svg.getElementById('lTop').setAttribute('d', qPath(cx-r-gap, ty, cx-r-gap-ltLen, ty, s.wingCurve));
        svg.getElementById('lBot').setAttribute('d', qPath(cx-r-gap-ins, by, cx-r-gap-ins-lbLen, by, s.wingCurve*0.75));
        svg.getElementById('rTop').setAttribute('d', qPath(cx+r+gap, ty, cx+r+gap+rtLen, ty, s.wingCurve));
        svg.getElementById('rBot').setAttribute('d', qPath(cx+r+gap+ins, by, cx+r+gap+ins+rbLen, by, s.wingCurve*0.75));
        var l3El = svg.getElementById('l3'), r3El = svg.getElementById('r3');
        if (l3El && r3El) {
          var show3 = (lt < 0.5 ? a.tripleWing : b.tripleWing);
          l3El.style.display = show3 ? '' : 'none'; r3El.style.display = show3 ? '' : 'none';
          if (show3) {
            var y3 = by + hs * 0.92, i3 = ins * 1.6 + 8;
            l3El.setAttribute('d', qPath(cx-r-gap-i3, y3, cx-r-gap-i3-Math.max(12,lbLen*0.62), y3, s.wingCurve*0.5));
            r3El.setAttribute('d', qPath(cx+r+gap+i3, y3, cx+r+gap+i3+Math.max(12,rbLen*0.62), y3, s.wingCurve*0.5));
          }
        }
        svg.getElementById('lWings').setAttribute('transform', 'rotate('+(-s.wingAngle).toFixed(2)+' '+cx+' '+(cy+oy).toFixed(1)+')');
        svg.getElementById('rWings').setAttribute('transform', 'rotate('+(s.wingAngle).toFixed(2)+' '+cx+' '+(cy+oy).toFixed(1)+')');
        svg.getElementById('gStop1').setAttribute('stop-color', c1); svg.getElementById('gStop2').setAttribute('stop-color', c2); svg.getElementById('gStop3').setAttribute('stop-color', c1);
        svg.getElementById('emblemGroup').setAttribute('stroke', (lt<0.5?a.useGradient:b.useGradient) ? 'url(#solopassGrad)' : c1);
        svg.getElementById('glowB1').setAttribute('stdDeviation', s.glowBlur.toFixed(1));
        svg.getElementById('glowB2').setAttribute('stdDeviation', (s.glowBlur*0.45).toFixed(1));
        svg.getElementById('glowAlpha').setAttribute('slope', s.glowOpacity.toFixed(2));
        var fg = svg.getElementById('flowGroup');
        if (fg) {
          var fa = s.energyFlow || 0;
          fg.style.display = fa > 0 ? '' : 'none';
          if (fa > 0) {
            fg.setAttribute('stroke-dashoffset', (-prog * 160).toFixed(1));
            svg.getElementById('flTop').setAttribute('d', svg.getElementById('lTop').getAttribute('d'));
            svg.getElementById('flBot').setAttribute('d', svg.getElementById('lBot').getAttribute('d'));
            svg.getElementById('frTop').setAttribute('d', svg.getElementById('rTop').getAttribute('d'));
            svg.getElementById('frBot').setAttribute('d', svg.getElementById('rBot').getAttribute('d'));
            svg.getElementById('flWings').setAttribute('transform', svg.getElementById('lWings').getAttribute('transform'));
            svg.getElementById('frWings').setAttribute('transform', svg.getElementById('rWings').getAttribute('transform'));
          }
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    })();
  ]]></script>
</svg>`;
        triggerDownload(new Blob([animatedSvg], { type: 'image/svg+xml;charset=utf-8' }), 'solopass-animated.svg');
        showToast('Exported self-contained Animated .SVG!');
    });

    document.getElementById('exportPngSeqBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('exportPngSeqBtn');
        const canvas = document.getElementById('exportCanvas');
        if (!canvas) return;
        const origHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'PNG 0%';
        }
        showToast('Rendering lossless RGBA PNG sequence (.ZIP)...');

        const wasPlaying = isTimelinePlaying();
        stopTimelinePlayback();
        const timeline = getMotionTimeline();
        const { bugPos } = resolveOverlaySettings();
        const resVal = parseInt(document.getElementById('webmResSelect')?.value || '1200', 10);
        if (bugPos !== 'centered') {
            canvas.width = resVal === 1920 ? 1920 : 1280;
            canvas.height = resVal === 1920 ? 1080 : 720;
        } else if (resVal === 512) {
            canvas.width = 512;
            canvas.height = 512;
        } else {
            canvas.width = 900;
            canvas.height = state.showText ? 435 : 330;
        }
        const ctx = canvas.getContext('2d', { alpha: true });
        const fps = 24;
        const totalFrames = Math.max(12, Math.min(96, Math.round(timeline.durationSec * fps)));
        const zipEntries = [];

        try {
            for (let f = 0; f < totalFrames; f++) {
                if (btn) btn.textContent = `PNG ${Math.round(((f + 1) / totalFrames) * 100)}%`;
                const rawProg = f / totalFrames;
                const prog = timeline.playMode === 'pingpong'
                    ? (rawProg <= 0.5 ? rawProg * 2 : (1 - rawProg) * 2)
                    : rawProg;
                await renderTimelineFrameToCanvas(canvas, ctx, prog, 'transparent', bugPos, timeline);
                const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                const buf = new Uint8Array(await pngBlob.arrayBuffer());
                zipEntries.push({
                    name: `frame_${String(f).padStart(3, '0')}.png`,
                    data: buf
                });
            }
            const zipBlob = buildZipBlob(zipEntries);
            triggerDownload(zipBlob, 'solopass-png-sequence.zip');
            showToast(`Downloaded solopass-png-sequence.zip (${totalFrames} RGBA frames)`);
        } catch (err) {
            console.error('[SOLOPASS] PNG sequence export failed:', err);
            showToast('PNG sequence export failed — check console', 'error');
        } finally {
            applyInterpolatedTimeline(0);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
            }
            if (wasPlaying) document.getElementById('playTimelineBtn')?.click();
        }
    });

    document.getElementById('exportSpmotionBtn')?.addEventListener('click', () => {
        const timeline = getMotionTimeline();
        const payload = { ...timeline, seed: encodeStateToCode(state), exportedAt: new Date().toISOString() };
        triggerDownload(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'solopass.spmotion');
        showToast('Exported solopass.spmotion timeline');
    });

    const handleFileImport = (file, inputEl) => {
        if (!file) return;
        const fileName = file.name.toLowerCase();
        const reader = new FileReader();
        reader.onerror = () => {
            console.error('[SOLOPASS] FileReader error:', reader.error);
            showToast('Failed to read selected file', 'error');
            if (inputEl) inputEl.value = '';
        };

        if (fileName.endsWith('.png')) {
            reader.onload = (ev) => {
                try {
                    const buf = ev.target?.result;
                    const seed = buf ? extractPngTextChunk(buf, 'solopass-seed') : null;
                    const res = seed ? decodeSeedDetailed(seed, state) : { ok: false };
                    if (res.ok) {
                        const cipherInput = document.getElementById('cipherMessageInput');
                        if (cipherInput) cipherInput.value = state.encodedMessage || '';
                        syncInputsFromState();
                        render();
                        pushHistory();
                        showToast(state.encodedMessage
                            ? `Imported PNG & decoded message: "${state.encodedMessage}"`
                            : 'Imported PNG & restored SOLOPASS settings!');
                    } else {
                        showToast('No valid SOLOPASS seed found in PNG', 'error');
                    }
                } catch (err) {
                    console.error('[SOLOPASS] PNG import error:', err);
                    showToast('Failed to parse PNG metadata', 'error');
                }
                if (inputEl) inputEl.value = '';
            };
            reader.readAsArrayBuffer(file);
            return;
        }

        if (fileName.endsWith('.spmotion') || (fileName.endsWith('.json') && !fileName.endsWith('.svg'))) {
            reader.onload = (ev) => {
                try {
                    const parsed = JSON.parse(String(ev.target?.result || '{}'));
                    if (Array.isArray(parsed.keyframes) && parsed.keyframes.length >= 2) {
                        setMotionTimeline(parsed);
                        const cipherInput = document.getElementById('cipherMessageInput');
                        if (cipherInput) cipherInput.value = state.encodedMessage || '';
                        pushHistory();
                        showToast(`Imported .spmotion file (${parsed.keyframes.length} keyframes)`);
                    } else {
                        showToast('Invalid .spmotion structure (needs >= 2 keyframes)', 'error');
                    }
                } catch (err) {
                    console.error('[SOLOPASS] .spmotion parse error:', err);
                    showToast('Failed to parse .spmotion JSON', 'error');
                }
                if (inputEl) inputEl.value = '';
            };
            reader.readAsText(file);
            return;
        }

        reader.onload = (ev) => {
            try {
                const content = String(ev.target?.result || '');
                let restoredAny = false;
                if (decodeSeedDetailed(content, state).ok) {
                    const cipherInput = document.getElementById('cipherMessageInput');
                    if (cipherInput) cipherInput.value = state.encodedMessage || '';
                    syncInputsFromState();
                    render();
                    pushHistory();
                    restoredAny = true;
                }
                const motionMatch = content.match(/<metadata id="spmotion-data">([\s\S]*?)<\/metadata>/);
                if (motionMatch && motionMatch[1]) {
                    try {
                        const unescaped = motionMatch[1]
                            .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                            .replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"');
                        const parsedTimeline = JSON.parse(unescaped);
                        if (Array.isArray(parsedTimeline.keyframes) && parsedTimeline.keyframes.length >= 2) {
                            setMotionTimeline(parsedTimeline);
                            restoredAny = true;
                        }
                    } catch {
                        // Ignore malformed metadata
                    }
                }
                if (restoredAny) {
                    showToast(state.encodedMessage
                        ? `Imported file & decoded message: "${state.encodedMessage}"`
                        : 'Imported SOLOPASS file & settings!');
                } else {
                    showToast('No SOLOPASS seed or cipher metadata found in file', 'error');
                }
            } catch (err) {
                console.error('[SOLOPASS] SVG import error:', err);
                showToast('Failed to import SVG file', 'error');
            }
            if (inputEl) inputEl.value = '';
        };
        reader.readAsText(file);
    };

    document.getElementById('importSvgInput')?.addEventListener('change', (e) => handleFileImport(e.target.files?.[0], e.target));
    document.getElementById('importSpmotionInput')?.addEventListener('change', (e) => handleFileImport(e.target.files?.[0], e.target));

    // Export Page Live Preview, Scene Mockup, Codec Clarity & Brand Pack
    let exportPreviewMode = 'static';
    let exportPreviewRaf = null;
    let exportPreviewStart = 0;
    let sceneMockupEnabled = false;
    let customSceneUrl = null;

    function updateWebmAlphaBadge() {
        const badge = document.getElementById('webmAlphaBadge');
        if (!badge) return;
        const bgMode = document.getElementById('exportOverlayBg')?.value || 'studio';
        const hasRecorder = typeof MediaRecorder !== 'undefined';
        const supportsVp9 = hasRecorder && typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9');
        if (!hasRecorder) {
            badge.textContent = 'Use .GIF / .ZIP';
            badge.className = 'text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/30 text-amber-200 font-mono';
        } else if (bgMode === 'transparent') {
            badge.textContent = supportsVp9 ? 'VP9 Alpha · NLEs: .ZIP safest' : 'Use .ZIP PNG Seq for Alpha';
            badge.className = 'text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/30 text-amber-200 font-mono';
        } else {
            badge.textContent = supportsVp9 ? 'VP9 HD Ready' : 'VP8 Stream Ready';
            badge.className = 'text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 font-mono';
        }
    }
    updateWebmAlphaBadge();

    function syncSceneBackdrop() {
        const backdrop = document.getElementById('exportSceneBackdrop');
        const btn = document.getElementById('exportSceneMockupBtn');
        if (backdrop) backdrop.classList.toggle('hidden', !sceneMockupEnabled);
        if (btn) {
            btn.className = sceneMockupEnabled
                ? 'px-2.5 py-1 rounded-lg bg-sky-500/25 border border-sky-400/50 text-[11px] font-semibold text-sky-100 transition'
                : 'px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-gray-300 transition';
        }
    }

    document.getElementById('exportSceneMockupBtn')?.addEventListener('click', () => {
        sceneMockupEnabled = !sceneMockupEnabled;
        syncSceneBackdrop();
        if (exportPreviewMode === 'static') updateExportPreviewFrame(null);
    });

    document.getElementById('exportSceneUpload')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (customSceneUrl) URL.revokeObjectURL(customSceneUrl);
        customSceneUrl = URL.createObjectURL(file);
        const imgEl = document.getElementById('exportSceneImg');
        const defEl = document.getElementById('exportSceneDefault');
        if (imgEl) {
            imgEl.src = customSceneUrl;
            imgEl.classList.remove('hidden');
        }
        if (defEl) defEl.classList.add('hidden');
        sceneMockupEnabled = true;
        syncSceneBackdrop();
        if (exportPreviewMode === 'static') updateExportPreviewFrame(null);
        showToast('Loaded custom 16:9 scene backdrop');
        e.target.value = '';
    });

    function stopExportPreviewLoop() {
        if (exportPreviewRaf) {
            cancelAnimationFrame(exportPreviewRaf);
            exportPreviewRaf = null;
        }
    }

    function updateExportPreviewFrame(prog = null) {
        const stage = document.getElementById('exportPreviewStage');
        const inner = document.getElementById('exportPreviewInner');
        if (!stage || !inner) return;

        const timeline = getMotionTimeline();
        const { bgMode, bgFill, bugPos } = resolveOverlaySettings();
        const resVal = parseInt(document.getElementById('webmResSelect')?.value || '1200', 10);

        if (sceneMockupEnabled) {
            stage.style.backgroundColor = '#090d16';
            stage.classList.remove('canvas-grid');
        } else {
            stage.style.backgroundColor = bgMode === 'transparent' ? 'transparent' : bgFill;
            stage.classList.toggle('canvas-grid', bgMode === 'transparent');
        }

        const bugHint = document.getElementById('exportPreviewBugHint');
        if (bugHint) bugHint.classList.toggle('hidden', bugPos === 'centered');

        if (bugPos === 'yt-bottom-left') {
            inner.className = 'w-[34%] max-w-[220px] absolute left-4 bottom-4 transition-all';
        } else if (bugPos === 'yt-bottom-right') {
            inner.className = 'w-[34%] max-w-[220px] absolute right-4 bottom-4 transition-all';
        } else {
            inner.className = 'w-full max-w-[440px] h-full flex items-center justify-center transition-all';
        }

        if (prog !== null) {
            applyInterpolatedTimeline(prog, { skipDomRender: true });
        }
        const isBeacon = timeline?.easing === 'step' && typeof state._clockBit === 'number';
        const opticalGridMarkup = isBeacon && window.SoloSyncGrid?.generateGridMarkup
            ? window.SoloSyncGrid.generateGridMarkup(600, state.showText ? 290 : 220, state._clockBit, 0)
            : '';
        inner.innerHTML = generateSVGString(state, { forExport: false, includeGuides: false, opticalGridMarkup });

        // Metadata pills
        const dimsEl = document.getElementById('exportMetaDims');
        const durEl = document.getElementById('exportMetaDuration');
        const ctaEl = document.getElementById('exportMetaCta');
        const seedEl = document.getElementById('exportMetaSeed');
        if (dimsEl) {
            if (bugPos !== 'centered') dimsEl.textContent = '1280×720 16:9';
            else if (resVal === 1920) dimsEl.textContent = '1920×1080 HD';
            else if (resVal === 512) dimsEl.textContent = '512×512 Sq';
            else dimsEl.textContent = `1800×${state.showText ? 870 : 660}`;
        }
        if (durEl) durEl.textContent = `${Number(timeline?.durationSec || 3).toFixed(1)}s · ${timeline?.keyframes?.length || 0} KF`;
        if (ctaEl) ctaEl.textContent = state.showLowerThird ? (state.encodedMessage || state.brandText || 'On') : 'Off';
        if (seedEl) seedEl.textContent = encodeStateToCode(state).slice(0, 14) + '…';
    }

    function syncExportPreviewButtons() {
        const staticBtn = document.getElementById('exportPreviewStaticBtn');
        const animBtn = document.getElementById('exportPreviewAnimBtn');
        const badge = document.getElementById('exportPreviewStatusBadge');
        const isAnim = exportPreviewMode === 'animated';
        if (staticBtn) {
            staticBtn.className = !isAnim
                ? 'px-3 py-1 rounded-lg bg-white/10 text-xs font-semibold text-white transition'
                : 'px-3 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition';
        }
        if (animBtn) {
            animBtn.className = isAnim
                ? 'px-3 py-1 rounded-lg bg-sky-500/25 border border-sky-400/40 text-xs font-semibold text-sky-200 transition'
                : 'px-3 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-white transition';
        }
        if (badge) badge.textContent = isAnim ? 'Loop Preview' : 'Vector Ready';
    }

    function startExportPreviewLoop() {
        stopExportPreviewLoop();
        exportPreviewStart = performance.now();
        const step = (now) => {
            const page = document.getElementById('exportPageView');
            if (!page || page.classList.contains('hidden') || exportPreviewMode !== 'animated') {
                stopExportPreviewLoop();
                return;
            }
            const timeline = getMotionTimeline();
            const durMs = Math.max(500, (timeline?.durationSec || 3) * 1000);
            const raw = ((now - exportPreviewStart) % durMs) / durMs;
            const prog = timeline?.playMode === 'pingpong' ? (raw <= 0.5 ? raw * 2 : (1 - raw) * 2) : raw;
            updateExportPreviewFrame(prog);
            exportPreviewRaf = requestAnimationFrame(step);
        };
        exportPreviewRaf = requestAnimationFrame(step);
    }

    document.getElementById('exportPreviewStaticBtn')?.addEventListener('click', () => {
        exportPreviewMode = 'static';
        stopExportPreviewLoop();
        applyInterpolatedTimeline(0, { skipDomRender: true });
        syncExportPreviewButtons();
        updateExportPreviewFrame(null);
    });
    document.getElementById('exportPreviewAnimBtn')?.addEventListener('click', () => {
        exportPreviewMode = 'animated';
        syncExportPreviewButtons();
        startExportPreviewLoop();
    });

    ['exportOverlayBg', 'exportBugPosition', 'webmResSelect'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            updateWebmAlphaBadge();
            if (exportPreviewMode === 'static') updateExportPreviewFrame(null);
        });
    });

    async function renderSvgToPngUint8(svgMarkup, width, height, bgFill = 'transparent', embedSeed = false) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const url = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' }));
        try {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    ctx.clearRect(0, 0, width, height);
                    if (bgFill !== 'transparent') {
                        ctx.fillStyle = bgFill;
                        ctx.fillRect(0, 0, width, height);
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve();
                };
                img.onerror = () => reject(new Error('SVG rasterization failed'));
                img.src = url;
            });
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const buf = await blob.arrayBuffer();
            return embedSeed ? injectPngTextChunk(buf, 'solopass', encodeStateToCode(state)) : new Uint8Array(buf);
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    document.getElementById('exportBrandPackBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('exportBrandPackBtn');
        const canvas = document.getElementById('exportCanvas');
        if (!btn || !canvas) return;
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Building Brand Pack...';
        showToast('Bundling SVG, PNG, Icon, GIF & .SPMOTION into .ZIP...');

        const wasPlaying = isTimelinePlaying();
        stopTimelinePlayback();
        const timeline = getMotionTimeline();
        const { bgFill, bugPos } = resolveOverlaySettings();

        try {
            const encoder = new TextEncoder();
            const svgCode = generateSVGString(state, { forExport: false, includeGuides: false });
            const exportSvg = generateSVGString(state, { forExport: true, includeGuides: false });
            const iconSvg = generateSVGString({ ...state, showText: false }, { forExport: true, includeGuides: false });

            const pngBytes = await renderSvgToPngUint8(exportSvg, 1800, state.showText ? 870 : 660, 'transparent', true);
            const iconBg = state.bgColor !== 'transparent' ? state.bgColor : '#0d0d16';
            const iconBytes = await renderSvgToPngUint8(iconSvg, 512, 512, iconBg, true);

            // Render compact animated GIF for pack
            canvas.width = bugPos !== 'centered' ? 640 : 600;
            canvas.height = bugPos !== 'centered' ? 360 : (state.showText ? 290 : 220);
            const gifBytes = await renderTimelineToGifBytes(canvas, timeline, bgFill, bugPos, {
                fps: 16,
                maxFrames: 64,
                onProgress: (pct) => { btn.textContent = `Packing GIF ${pct}%`; }
            });
            const spmotionBytes = encoder.encode(JSON.stringify(timeline, null, 2));
            const seedCode = encodeStateToCode(state);
            const readme = [
                'SOLOPASS Brand Pack',
                '===================',
                `Brand: ${state.brandText || 'SOLOPASS'}`,
                `Seed: ${seedCode}`,
                state.encodedMessage ? `Message: ${state.encodedMessage}` : '',
                `Framing: ${bugPos} | Overlay BG: ${bgFill}`,
                '',
                'Files included:',
                '- solopass-vector.svg (Scalable vector with embedded seed)',
                '- solopass-1800px.png (High-res transparent PNG + SP2 tEXt chunk)',
                '- solopass-icon-512.png (512x512 app icon)',
                '- solopass-animation.gif (Adaptive-palette animated loop)',
                '- solopass-timeline.spmotion (Re-editable timeline project)'
            ].filter(Boolean).join('\n');

            const zipBlob = buildZipBlob([
                { name: 'solopass-vector.svg', data: encoder.encode(svgCode) },
                { name: 'solopass-1800px.png', data: pngBytes },
                { name: 'solopass-icon-512.png', data: iconBytes },
                { name: 'solopass-animation.gif', data: gifBytes },
                { name: 'solopass-timeline.spmotion', data: spmotionBytes },
                { name: 'README.txt', data: encoder.encode(readme) }
            ]);
            triggerDownload(zipBlob, 'solopass-brand-pack.zip');
            showToast(`Downloaded solopass-brand-pack.zip (${(zipBlob.size / 1024).toFixed(0)} KB)`);
        } catch (err) {
            console.error('[SOLOPASS] Brand pack export failed:', err);
            showToast('Brand pack export failed', 'error');
        } finally {
            applyInterpolatedTimeline(0);
            btn.disabled = false;
            btn.innerHTML = origHtml;
            if (wasPlaying) document.getElementById('playTimelineBtn')?.click();
        }
    });

    window.addEventListener('solopass:modechange', (e) => {
        if (e.detail?.mode === 'export') {
            if (isTimelinePlaying()) stopTimelinePlayback();
            updateWebmAlphaBadge();
            syncExportPreviewButtons();
            if (exportPreviewMode === 'animated') startExportPreviewLoop();
            else updateExportPreviewFrame(null);
        } else {
            const wasRunning = exportPreviewRaf !== null;
            stopExportPreviewLoop();
            if (wasRunning) applyInterpolatedTimeline(0);
        }
    });
}
